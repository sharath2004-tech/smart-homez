import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import Service from '../models/Service.js';
import { checkServiceAvailability } from '../utils/geolocation.js';

const router = express.Router();

// @route   GET /api/services
// @desc    Get all services (with optional location filtering)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { 
      category, 
      search, 
      isActive, 
      page = 1, 
      limit = 20,
      latitude,
      longitude,
      apartmentName
    } = req.query;
    
    const query = {};
    if (category) query.category = category;
    // Only filter by isActive if explicitly provided
    if (isActive !== undefined && isActive !== null && isActive !== '') {
      query.isActive = isActive === 'true' || isActive === true;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const services = await Service.find(query)
      .populate('createdBy', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    // If location provided, check availability for each service
    let servicesWithAvailability = services;
    if (latitude && longitude) {
      servicesWithAvailability = await Promise.all(
        services.map(async (service) => {
          try {
            const availability = await checkServiceAvailability(
              service._id,
              parseFloat(longitude),
              parseFloat(latitude),
              apartmentName
            );
            return {
              ...service.toObject(),
              availability: {
                available: availability.available,
                workersCount: availability.workersCount || 0,
                reason: availability.reason
              }
            };
          } catch (err) {
            return {
              ...service.toObject(),
              availability: {
                available: false,
                workersCount: 0,
                reason: 'Unable to check availability'
              }
            };
          }
        })
      );
    }

    const count = await Service.countDocuments(query);

    res.json({
      services: servicesWithAvailability,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalServices: count
    });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/services/by-location/:locationId
// @desc    Get services available at a specific location
// @access  Public
router.get('/by-location/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    
    // Import Location model dynamically to avoid circular dependency
    const Location = (await import('../models/Location.js')).default;
    
    const location = await Location.findById(locationId);
    if (!location) {
      return res.status(404).json({ 
        error: { message: 'Location not found', status: 404 } 
      });
    }

    // Get services available at this location
    let query = { isActive: true };
    
    if (location.availableServices && location.availableServices.length > 0) {
      // Filter to only show services available at this location
      const availableServiceIds = location.availableServices
        .filter(s => s.isActive)
        .map(s => s.service);
      query._id = { $in: availableServiceIds };
    }
    // If no specific services listed, assume all active services are available
    
    const services = await Service.find(query)
      .populate('createdBy', 'name email')
      .sort({ name: 1 });

    res.json({
      services,
      location: {
        _id: location._id,
        apartmentName: location.apartmentName,
        area: location.area,
        city: location.city,
        isServiceAvailable: location.isServiceAvailable
      },
      totalServices: services.length
    });
  } catch (error) {
    console.error('Get services by location error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/services/:id
// @desc    Get service by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('createdBy', 'name email');
    
    if (!service) {
      return res.status(404).json({ 
        error: { message: 'Service not found', status: 404 } 
      });
    }

    res.json({ service });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/services
// @desc    Create a new service (with all dynamic parameters)
// @access  Private/Admin
router.post('/',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    body('name').trim().notEmpty().withMessage('Service name is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('category').isIn(['health', 'cleaning', 'maintenance', 'consultation', 'therapy', 'other'])
      .withMessage('Invalid category'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('duration').isNumeric().withMessage('Duration must be a number')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { 
        name, description, category, serviceType, price, pricingPlans, subscriptionPlans,
        duration, image, tags, requirements, additionalServiceOptions,
        serviceLocations, availableInAllLocations,
        // New parameter fields
        sizeParameters, durationOptions, subscriptionOptions, addons,
        equipmentRequired, pricingTiers, workerPreferences, serviceFields,
        timeSlotRestrictions, cancellationPolicy, specialInstructionsTemplate
      } = req.body;

      const service = new Service({
        name,
        description,
        category,
        serviceType,
        price,
        pricingPlans,
        subscriptionPlans,
        duration,
        image,
        tags,
        requirements,
        additionalServiceOptions,
        serviceLocations,
        availableInAllLocations,
        // New parameter fields
        sizeParameters,
        durationOptions,
        subscriptionOptions,
        addons,
        equipmentRequired,
        pricingTiers,
        workerPreferences,
        serviceFields,
        timeSlotRestrictions,
        cancellationPolicy,
        specialInstructionsTemplate,
        createdBy: req.user._id
      });

      await service.save();

      res.status(201).json({ 
        message: 'Service created successfully', 
        service 
      });
    } catch (error) {
      console.error('Create service error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   PUT/PATCH /api/services/:id
// @desc    Update service (including all dynamic parameters)
// Shared update handler with proper validation and field clearing
const handleServiceUpdate = async (req, res) => {
  try {
    const { 
      name, description, category, serviceType, price, pricingPlans, subscriptionPlans,
      duration, image, tags, requirements, isActive, additionalServiceOptions,
      serviceLocations, availableInAllLocations,
      // New parameter fields
      sizeParameters, durationOptions, subscriptionOptions, addons,
      equipmentRequired, pricingTiers, workerPreferences, serviceFields,
      timeSlotRestrictions, cancellationPolicy, specialInstructionsTemplate
    } = req.body;

    // Validation for subscription plans
    if (subscriptionPlans && Array.isArray(subscriptionPlans)) {
      const ids = subscriptionPlans.map(plan => plan.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        return res.status(400).json({
          error: { message: 'Subscription plan IDs must be unique', status: 400 }
        });
      }
    }

    // Build update data with consistent conditional checks (using 'in' operator for proper undefined handling)
    const updateData = {};
    if ('name' in req.body) updateData.name = name;
    if ('description' in req.body) updateData.description = description;
    if ('category' in req.body) updateData.category = category;
    if ('serviceType' in req.body) updateData.serviceType = serviceType;
    if ('price' in req.body) updateData.price = price;
    if ('pricingPlans' in req.body) updateData.pricingPlans = pricingPlans;
    if ('subscriptionPlans' in req.body) updateData.subscriptionPlans = subscriptionPlans;
    if ('duration' in req.body) updateData.duration = duration;
    if ('image' in req.body) updateData.image = image;
    if ('tags' in req.body) updateData.tags = tags;
    if ('requirements' in req.body) updateData.requirements = requirements;
    if ('isActive' in req.body) updateData.isActive = isActive;
    if ('additionalServiceOptions' in req.body) updateData.additionalServiceOptions = additionalServiceOptions;
    if ('serviceLocations' in req.body) updateData.serviceLocations = serviceLocations;
    if ('availableInAllLocations' in req.body) updateData.availableInAllLocations = availableInAllLocations;
    
    // New parameter fields with consistent checks
    if ('sizeParameters' in req.body) updateData.sizeParameters = sizeParameters;
    if ('durationOptions' in req.body) updateData.durationOptions = durationOptions;
    if ('subscriptionOptions' in req.body) updateData.subscriptionOptions = subscriptionOptions;
    if ('addons' in req.body) updateData.addons = addons;
    if ('equipmentRequired' in req.body) updateData.equipmentRequired = equipmentRequired;
    if ('pricingTiers' in req.body) updateData.pricingTiers = pricingTiers;
    if ('workerPreferences' in req.body) updateData.workerPreferences = workerPreferences;
    if ('serviceFields' in req.body) updateData.serviceFields = serviceFields;
    if ('timeSlotRestrictions' in req.body) updateData.timeSlotRestrictions = timeSlotRestrictions;
    if ('cancellationPolicy' in req.body) updateData.cancellationPolicy = cancellationPolicy;
    if ('specialInstructionsTemplate' in req.body) updateData.specialInstructionsTemplate = specialInstructionsTemplate;

    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!service) {
      return res.status(404).json({ 
        error: { message: 'Service not found', status: 404 } 
      });
    }

    res.json({ message: 'Service updated successfully', service });
  } catch (error) {
    console.error('Update service error:', error);
    
    // More specific error messages
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: { message: error.message, status: 400 } 
      });
    }
    
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
};

// @access  Private/Admin
router.patch('/:id', authenticate, authorize('admin', 'super_admin'), handleServiceUpdate);

// Support PUT as well for compatibility
router.put('/:id', authenticate, authorize('admin', 'super_admin'), handleServiceUpdate);

// @route   DELETE /api/services/:id
// @desc    Delete service
// @access  Private/Admin
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);

    if (!service) {
      return res.status(404).json({ 
        error: { message: 'Service not found', status: 404 } 
      });
    }

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;
