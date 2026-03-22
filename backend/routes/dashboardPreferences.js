import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import DashboardPreferences from '../models/DashboardPreferences.js';

const router = express.Router();

/**
 * Get dashboard service preferences (public - for customers)
 * GET /api/dashboard-preferences
 */
router.get('/', async (req, res) => {
  try {
    const config = await DashboardPreferences.getDefaultConfig();

    // Return only active services sorted by sortOrder
    const activeServices = config.services
      .filter(service => service.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    res.json({
      services: activeServices,
      maxServices: config.maxServices
    });
  } catch (error) {
    console.error('Error fetching dashboard preferences:', error);
    res.status(500).json({
      error: { message: 'Server error', status: 500 }
    });
  }
});

/**
 * Get dashboard preferences for admin management
 * GET /api/dashboard-preferences/admin
 */
router.get('/admin', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const config = await DashboardPreferences.getDefaultConfig();

    res.json({
      services: config.services.sort((a, b) => a.sortOrder - b.sortOrder),
      maxServices: config.maxServices,
      lastUpdatedAt: config.lastUpdatedAt,
      lastUpdatedBy: config.lastUpdatedBy
    });
  } catch (error) {
    console.error('Error fetching dashboard preferences for admin:', error);
    res.status(500).json({
      error: { message: 'Server error', status: 500 }
    });
  }
});

/**
 * Update dashboard service preferences (admin only)
 * PUT /api/dashboard-preferences
 */
router.put('/', authenticate, authorize('admin', 'super_admin'), [
  body('services').isArray().withMessage('Services must be an array'),
  body('services.*.id').notEmpty().withMessage('Service ID is required'),
  body('services.*.icon').notEmpty().withMessage('Service icon is required'),
  body('services.*.nameKey').notEmpty().withMessage('Service name key is required'),
  body('services.*.subtitleKey').notEmpty().withMessage('Service subtitle key is required'),
  body('services.*.customName').optional().isString().withMessage('Custom name must be a string'),
  body('services.*.customSubtitle').optional().isString().withMessage('Custom subtitle must be a string'),
  body('services.*.badge').notEmpty().withMessage('Service badge is required'),
  body('services.*.path').notEmpty().withMessage('Service path is required'),
  body('services.*.isActive').isBoolean().withMessage('isActive must be boolean'),
  body('services.*.sortOrder').isInt({ min: 1 }).withMessage('Sort order must be positive integer'),
  body('maxServices').optional().isInt({ min: 1, max: 8 }).withMessage('Max services must be between 1-8')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: { message: errors.array()[0].msg, status: 400 }
      });
    }

    const { services, maxServices } = req.body;

    // Validate that at least one service is active
    const activeServices = services.filter(s => s.isActive);
    if (activeServices.length === 0) {
      return res.status(400).json({
        error: { message: 'At least one service must be active', status: 400 }
      });
    }

    // Validate max services limit
    if (activeServices.length > (maxServices || 4)) {
      return res.status(400).json({
        error: { message: `Cannot have more than ${maxServices || 4} active services`, status: 400 }
      });
    }

    // Validate sort order uniqueness
    const sortOrders = services.map(s => s.sortOrder);
    if (new Set(sortOrders).size !== sortOrders.length) {
      return res.status(400).json({
        error: { message: 'Sort orders must be unique', status: 400 }
      });
    }

    // Update configuration
    const config = await DashboardPreferences.getDefaultConfig();
    config.services = services;
    if (maxServices) config.maxServices = maxServices;
    config.lastUpdatedBy = req.user._id;
    config.lastUpdatedAt = new Date();

    await config.save();

    res.json({
      message: 'Dashboard preferences updated successfully',
      services: config.services.sort((a, b) => a.sortOrder - b.sortOrder),
      maxServices: config.maxServices
    });

  } catch (error) {
    console.error('Error updating dashboard preferences:', error);
    res.status(500).json({
      error: { message: 'Server error', status: 500 }
    });
  }
});

/**
 * Toggle service active status
 * PATCH /api/dashboard-preferences/services/:serviceId/toggle
 */
router.patch('/services/:serviceId/toggle', authenticate, authorize('admin', 'super_admin'), [
  param('serviceId').notEmpty().withMessage('Service ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: { message: errors.array()[0].msg, status: 400 }
      });
    }

    const config = await DashboardPreferences.getDefaultConfig();
    const serviceIndex = config.services.findIndex(s => s.id === req.params.serviceId);

    if (serviceIndex === -1) {
      return res.status(404).json({
        error: { message: 'Service not found', status: 404 }
      });
    }

    const service = config.services[serviceIndex];
    const newActiveStatus = !service.isActive;

    // Check if we're deactivating and would have no active services left
    if (!newActiveStatus) {
      const remainingActiveServices = config.services.filter((s, idx) => idx !== serviceIndex && s.isActive);
      if (remainingActiveServices.length === 0) {
        return res.status(400).json({
          error: { message: 'Cannot deactivate last active service', status: 400 }
        });
      }
    }

    // Check max services limit when activating
    if (newActiveStatus) {
      const activeCount = config.services.filter(s => s.isActive).length;
      if (activeCount >= config.maxServices) {
        return res.status(400).json({
          error: { message: `Cannot activate more than ${config.maxServices} services`, status: 400 }
        });
      }
    }

    service.isActive = newActiveStatus;
    config.lastUpdatedBy = req.user._id;
    config.lastUpdatedAt = new Date();

    await config.save();

    res.json({
      message: `Service ${newActiveStatus ? 'activated' : 'deactivated'} successfully`,
      service: {
        id: service.id,
        isActive: service.isActive
      }
    });

  } catch (error) {
    console.error('Error toggling service status:', error);
    res.status(500).json({
      error: { message: 'Server error', status: 500 }
    });
  }
});

/**
 * Reorder services
 * PUT /api/dashboard-preferences/reorder
 */
router.put('/reorder', authenticate, authorize('admin', 'super_admin'), [
  body('serviceIds').isArray().withMessage('Service IDs must be an array'),
  body('serviceIds.*').notEmpty().withMessage('Service ID cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: { message: errors.array()[0].msg, status: 400 }
      });
    }

    const { serviceIds } = req.body;
    const config = await DashboardPreferences.getDefaultConfig();

    // Validate all service IDs exist
    const existingIds = config.services.map(s => s.id);
    const invalidIds = serviceIds.filter(id => !existingIds.includes(id));

    if (invalidIds.length > 0) {
      return res.status(400).json({
        error: { message: `Invalid service IDs: ${invalidIds.join(', ')}`, status: 400 }
      });
    }

    // Reorder services
    const reorderedServices = [];
    serviceIds.forEach((id, index) => {
      const service = config.services.find(s => s.id === id);
      if (service) {
        service.sortOrder = index + 1;
        reorderedServices.push(service);
      }
    });

    // Add any services not in the reorder list at the end
    const remainingServices = config.services.filter(s => !serviceIds.includes(s.id));
    remainingServices.forEach((service, index) => {
      service.sortOrder = serviceIds.length + index + 1;
      reorderedServices.push(service);
    });

    config.services = reorderedServices;
    config.lastUpdatedBy = req.user._id;
    config.lastUpdatedAt = new Date();

    await config.save();

    res.json({
      message: 'Services reordered successfully',
      services: config.services.sort((a, b) => a.sortOrder - b.sortOrder)
    });

  } catch (error) {
    console.error('Error reordering services:', error);
    res.status(500).json({
      error: { message: 'Server error', status: 500 }
    });
  }
});

export default router;