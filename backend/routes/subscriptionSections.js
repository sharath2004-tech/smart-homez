import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import SubscriptionSection from '../models/SubscriptionSection.js';

const router = express.Router();

// @route   GET /api/subscription-sections
// @desc    Get all active subscription sections (for customers)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const sections = await SubscriptionSection.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .select('-filterConfig.namePatternsExclude -filterConfig.serviceTypeExcludes');

    res.json({
      success: true,
      sections,
      count: sections.length
    });
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to fetch subscription sections', status: 500 }
    });
  }
});

// @route   GET /api/subscription-sections/admin/all
// @desc    Get all subscription sections (admin view - includes inactive)
// @access  Admin, Super Admin
router.get('/admin/all', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const sections = await SubscriptionSection.find()
      .populate('createdBy', 'name email')
      .sort({ sortOrder: 1 });

    res.json({
      success: true,
      sections,
      count: sections.length
    });
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to fetch subscription sections', status: 500 }
    });
  }
});

// @route   GET /api/subscription-sections/:id
// @desc    Get a specific subscription section
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const section = await SubscriptionSection.findById(req.params.id);

    if (!section) {
      return res.status(404).json({
        error: { message: 'Subscription section not found', status: 404 }
      });
    }

    res.json({
      success: true,
      section
    });
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to fetch subscription section', status: 500 }
    });
  }
});

// @route   POST /api/subscription-sections
// @desc    Create a new subscription section
// @access  Admin, Super Admin
router.post(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    body('name').trim().notEmpty().withMessage('Section name is required'),
    body('description').trim().notEmpty().withMessage('Section description is required'),
    body('icon').isIn(['Users', 'Droplet', 'Home', 'Sparkles', 'Clock', 'Heart', 'Zap', 'Package', 'Wind']).withMessage('Invalid icon'),
    body('color').isIn(['blue', 'teal', 'green', 'purple', 'orange', 'red', 'pink', 'yellow']).withMessage('Invalid color'),
    body('emoji').optional().isLength({ min: 1, max: 2 }).withMessage('Invalid emoji')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: { message: 'Validation error', details: errors.array() }
      });
    }

    try {
      const { name, description, emoji, icon, color, filterConfig, sortOrder } = req.body;

      // Check if section with same name already exists
      const existing = await SubscriptionSection.findOne({ name });
      if (existing) {
        return res.status(400).json({
          error: { message: 'Section with this name already exists' }
        });
      }

      const section = new SubscriptionSection({
        name,
        description,
        emoji: emoji || '📦',
        icon,
        color,
        filterConfig: filterConfig || { serviceTypeIncludes: [], serviceTypeExcludes: [], namePatternsInclude: [], namePatternsExclude: [] },
        sortOrder: sortOrder || 0,
        createdBy: req.user._id
      });

      await section.save();

      res.status(201).json({
        success: true,
        message: 'Subscription section created successfully',
        section
      });
    } catch (error) {
      console.error('Error creating section:', error);
      res.status(500).json({
        error: { message: 'Failed to create subscription section', status: 500 }
      });
    }
  }
);

// @route   PATCH /api/subscription-sections/:id
// @desc    Update a subscription section
// @access  Admin, Super Admin
router.patch(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    body('name').optional().trim().notEmpty().withMessage('Section name cannot be empty'),
    body('description').optional().trim().notEmpty().withMessage('Section description cannot be empty'),
    body('icon').optional().isIn(['Users', 'Droplet', 'Home', 'Sparkles', 'Clock', 'Heart', 'Zap', 'Package', 'Wind']).withMessage('Invalid icon'),
    body('color').optional().isIn(['blue', 'teal', 'green', 'purple', 'orange', 'red', 'pink', 'yellow']).withMessage('Invalid color')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: { message: 'Validation error', details: errors.array() }
      });
    }

    try {
      const section = await SubscriptionSection.findById(req.params.id);

      if (!section) {
        return res.status(404).json({
          error: { message: 'Subscription section not found', status: 404 }
        });
      }

      // Check if new name is unique
      if (req.body.name && req.body.name !== section.name) {
        const existing = await SubscriptionSection.findOne({ name: req.body.name });
        if (existing) {
          return res.status(400).json({
            error: { message: 'Section with this name already exists' }
          });
        }
      }

      // Update allowed fields
      const allowedFields = ['name', 'description', 'emoji', 'icon', 'color', 'filterConfig', 'sortOrder', 'isActive'];
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          section[field] = req.body[field];
        }
      });

      section.updatedAt = new Date();
      await section.save();

      res.json({
        success: true,
        message: 'Subscription section updated successfully',
        section
      });
    } catch (error) {
      console.error('Error updating section:', error);
      res.status(500).json({
        error: { message: 'Failed to update subscription section', status: 500 }
      });
    }
  }
);

// @route   DELETE /api/subscription-sections/:id
// @desc    Delete a subscription section
// @access  Super Admin only
router.delete(
  '/:id',
  authenticate,
  authorize('super_admin'),
  async (req, res) => {
    try {
      const section = await SubscriptionSection.findById(req.params.id);

      if (!section) {
        return res.status(404).json({
          error: { message: 'Subscription section not found', status: 404 }
        });
      }

      await SubscriptionSection.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: 'Subscription section deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting section:', error);
      res.status(500).json({
        error: { message: 'Failed to delete subscription section', status: 500 }
      });
    }
  }
);

// @route   PATCH /api/subscription-sections/:id/toggle
// @desc    Toggle section active/inactive status
// @access  Admin, Super Admin
router.patch(
  '/:id/toggle',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const section = await SubscriptionSection.findById(req.params.id);

      if (!section) {
        return res.status(404).json({
          error: { message: 'Subscription section not found', status: 404 }
        });
      }

      section.isActive = !section.isActive;
      section.updatedAt = new Date();
      await section.save();

      res.json({
        success: true,
        message: `Subscription section ${section.isActive ? 'activated' : 'deactivated'} successfully`,
        section
      });
    } catch (error) {
      console.error('Error toggling section:', error);
      res.status(500).json({
        error: { message: 'Failed to toggle subscription section', status: 500 }
      });
    }
  }
);

export default router;
