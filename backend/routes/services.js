import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import Service from '../models/Service.js';
import { checkServiceAvailability } from '../utils/geolocation.js';
import multer from 'multer';
import { uploadToCloudinary } from '../middleware/cloudinary.js';

// Multer instance for service images (memory storage → Cloudinary)
const uploadServiceImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPEG, PNG, or WEBP images are allowed'));
  },
}).single('image');

const router = express.Router();

// @route   POST /api/services/upload-image
// @desc    Upload a service image to Cloudinary and return the URL
// @access  Private/Admin
router.post('/upload-image', authenticate, authorize('admin', 'super_admin'), (req, res) => {
  uploadServiceImage(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: { message: err.message, status: 400 } });
    }
    if (!req.file) {
      return res.status(400).json({ error: { message: 'No image file provided', status: 400 } });
    }
    try {
      const url = await uploadToCloudinary(req.file.buffer, 'smart-homez/service-images');
      return res.json({ url });
    } catch (uploadErr) {
      console.error('Service image upload error:', uploadErr);
      return res.status(500).json({ error: { message: 'Image upload failed', status: 500 } });
    }
  });
});

router.get('/categories', async (req, res) => {
  try {
    const categories = await Service.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$serviceCategory', count: { $sum: 1 } } },
      { $match: { _id: { $ne: null } } },
      { $sort: { count: -1 } }
    ]);
    res.json({ categories: categories.map(c => ({ serviceCategory: c._id, count: c.count })) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load categories' });
  }
});

// @route   GET /api/services
// @desc    Get all services (with optional location filtering)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { 
      category, 
      serviceType,
      serviceCategory,
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
    if (serviceCategory) query.serviceCategory = serviceCategory;
    if (serviceType) {
      // Support comma-separated serviceType values
      const types = serviceType.split(',').map(t => t.trim());
      query.serviceType = types.length > 1 ? { $in: types } : types[0];
    }
    // Only filter by isActive if explicitly provided
    if (isActive !== undefined && isActive !== null && isActive !== '') {
      query.isActive = isActive === 'true' || isActive === true;
    }
    if (search) {
      // Escape special regex characters to prevent ReDoS
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
        { tags: { $in: [new RegExp(escapedSearch, 'i')] } }
      ];
    }

    const services = await Service.find(query)
      .populate('createdBy', 'name email')
      .populate('suggestedServices.serviceId', 'name price duration serviceType')
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
      .populate('createdBy', 'name email')
      .populate('suggestedServices.serviceId', 'name price duration serviceType');
    
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
        timeSlotRestrictions, cancellationPolicy, specialInstructionsTemplate,
        taskOptions,
        // Workforce & wage fields
        defaultWorkerCount, workerWage,
        // Service state and capabilities
        originalPrice, isActive, isQuoteService,
        workerSearchRadiusKm, allowBreakRequests,
        suggestedServices, dos, donts,
        displayOrder, serviceCategory,
        timeBasedPricing
      } = req.body;

      const servicePayload = {
        name, description, category, serviceType, price, pricingPlans, subscriptionPlans,
        duration, image, tags, requirements, additionalServiceOptions,
        serviceLocations, availableInAllLocations,
        sizeParameters, durationOptions, subscriptionOptions, addons,
        equipmentRequired, pricingTiers, workerPreferences, serviceFields,
        timeSlotRestrictions, cancellationPolicy, specialInstructionsTemplate,
        taskOptions,
        defaultWorkerCount, workerWage,
        originalPrice, isActive, isQuoteService,
        workerSearchRadiusKm, allowBreakRequests,
        suggestedServices, dos, donts,
        displayOrder, serviceCategory,
        timeBasedPricing
      };

      // Admins cannot create services directly — their request goes to super admin for approval
      if (req.user.role === 'admin') {
        const ServiceRequest = (await import('../models/ServiceRequest.js')).default;
        const Location = (await import('../models/Location.js')).default;
        const requestedLocationIds = (req.user.adminProfile?.assignedLocations || [])
          .map((location) => location.locationId)
          .filter(Boolean);
        const requestedRegions = requestedLocationIds.length > 0
          ? await Location.find({ _id: { $in: requestedLocationIds } })
              .select('apartmentName area city')
              .lean()
          : [];

        const request = new ServiceRequest({
          serviceData: servicePayload,
          serviceTypeName: req.body.serviceTypeName || name,
          requestedBy: req.user._id,
          requestedLocationIds,
          requestedRegions: requestedRegions.map((location) => ({
            locationId: location._id,
            apartmentName: location.apartmentName,
            area: location.area,
            city: location.city
          }))
        });
        await request.save();
        await request.populate('requestedBy', 'name email');
        return res.status(201).json({
          message: 'Service request submitted for super admin approval',
          request,
          requestSubmitted: true
        });
      }

      // super_admin: create directly
      const service = new Service({
        ...servicePayload,
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

// Validates pricing field values — shared by service update and price-change-request
function validatePricingFields(body) {
  const errors = [];

  if ('price' in body) {
    if (typeof body.price !== 'number' || body.price < 0) {
      errors.push('price must be a non-negative number');
    }
  }

  if ('originalPrice' in body) {
    if (typeof body.originalPrice !== 'number' || body.originalPrice < 0) {
      errors.push('originalPrice must be a non-negative number');
    }
  }

  if ('pricingPlans' in body && body.pricingPlans) {
    for (const key of ['oneTime', 'daily', 'weekly', 'monthly']) {
      const val = body.pricingPlans[key];
      if (val !== undefined && (typeof val !== 'number' || val < 0)) {
        errors.push(`pricingPlans.${key} must be a non-negative number`);
      }
    }
  }

  if ('subscriptionPlans' in body && Array.isArray(body.subscriptionPlans)) {
    body.subscriptionPlans.forEach((plan, i) => {
      const lbl = `subscriptionPlans[${i}]`;
      if (!plan.id || typeof plan.id !== 'string') {
        errors.push(`${lbl}.id is required and must be a string`);
      }
      if (plan.price !== undefined && (typeof plan.price !== 'number' || plan.price < 0)) {
        errors.push(`${lbl}.price must be a non-negative number`);
      }
      if (plan.totalMonthlyPrice !== undefined && (typeof plan.totalMonthlyPrice !== 'number' || plan.totalMonthlyPrice < 0)) {
        errors.push(`${lbl}.totalMonthlyPrice must be a non-negative number`);
      }
      if (plan.discountPercentage !== undefined && (typeof plan.discountPercentage !== 'number' || plan.discountPercentage < 0 || plan.discountPercentage > 100)) {
        errors.push(`${lbl}.discountPercentage must be 0–100`);
      }
      if (plan.sessionsPerMonth !== undefined && (!Number.isInteger(plan.sessionsPerMonth) || plan.sessionsPerMonth < 1)) {
        errors.push(`${lbl}.sessionsPerMonth must be an integer >= 1`);
      }
      if (plan.originalPrice !== undefined && (typeof plan.originalPrice !== 'number' || plan.originalPrice < 0)) {
        errors.push(`${lbl}.originalPrice must be a non-negative number`);
      }
    });
  }

  if ('durationOptions' in body && Array.isArray(body.durationOptions)) {
    body.durationOptions.forEach((opt, i) => {
      const lbl = `durationOptions[${i}]`;
      if (opt.hours !== undefined && (typeof opt.hours !== 'number' || opt.hours <= 0)) {
        errors.push(`${lbl}.hours must be a positive number`);
      }
      if (opt.price !== undefined && (typeof opt.price !== 'number' || opt.price < 0)) {
        errors.push(`${lbl}.price must be a non-negative number`);
      }
      if (opt.originalPrice !== undefined && (typeof opt.originalPrice !== 'number' || opt.originalPrice < 0)) {
        errors.push(`${lbl}.originalPrice must be a non-negative number`);
      }
    });
  }

  if ('pricingTiers' in body && Array.isArray(body.pricingTiers)) {
    body.pricingTiers.forEach((tier, i) => {
      const lbl = `pricingTiers[${i}]`;
      if (tier.pricePerUnit !== undefined && (typeof tier.pricePerUnit !== 'number' || tier.pricePerUnit < 0)) {
        errors.push(`${lbl}.pricePerUnit must be a non-negative number`);
      }
      if (tier.totalPrice !== undefined && (typeof tier.totalPrice !== 'number' || tier.totalPrice < 0)) {
        errors.push(`${lbl}.totalPrice must be a non-negative number`);
      }
      if (tier.quantityFrom !== undefined && tier.quantityTo !== undefined && tier.quantityTo < tier.quantityFrom) {
        errors.push(`${lbl}.quantityTo must be >= quantityFrom`);
      }
    });
  }

  return errors;
}

function validateWorkerWage(workerWage) {
  if (workerWage === undefined) return [];

  const errors = [];
  if (!workerWage || typeof workerWage !== 'object' || Array.isArray(workerWage)) {
    return ['workerWage must be an object'];
  }

  if (workerWage.type !== undefined && !['per_hour', 'per_session'].includes(workerWage.type)) {
    errors.push('workerWage.type must be per_hour or per_session');
  }

  if (workerWage.rate !== undefined && (typeof workerWage.rate !== 'number' || workerWage.rate < 0)) {
    errors.push('workerWage.rate must be a non-negative number');
  }

  return errors;
}

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
      timeSlotRestrictions, cancellationPolicy, specialInstructionsTemplate,
      taskOptions,
      // Workforce & wage fields
      defaultWorkerCount, workerWage,
      // Radius & break settings
      workerSearchRadiusKm, allowBreakRequests,
      // Time-based pricing
      timeBasedPricing,
      // Service capabilities
      suggestedServices, dos, donts,
      isQuoteService,
      displayOrder, serviceCategory
    } = req.body;

    // Admins cannot directly edit pricing — they must submit a price change request
    const PRICING_FIELDS = ['price', 'originalPrice', 'pricingPlans', 'subscriptionPlans', 'durationOptions', 'pricingTiers', 'workerWage'];
    if (req.user.role === 'admin') {
      const attempted = PRICING_FIELDS.filter(f => f in req.body);
      if (attempted.length > 0) {
        return res.status(403).json({
          error: {
            message: `Admins cannot directly update pricing fields (${attempted.join(', ')}). Use POST /api/services/${req.params.id}/price-change-request to submit a request for super admin review.`,
            status: 403
          }
        });
      }
    }

    // Validate pricing field values (super_admin path — admin is already blocked above)
    const pricingErrors = validatePricingFields(req.body);
    if (pricingErrors.length > 0) {
      return res.status(400).json({ error: { message: pricingErrors.join('; '), status: 400 } });
    }

    const workerWageErrors = validateWorkerWage(workerWage);
    if (workerWageErrors.length > 0) {
      return res.status(400).json({ error: { message: workerWageErrors.join('; '), status: 400 } });
    }

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
    if ('originalPrice' in req.body) updateData.originalPrice = req.body.originalPrice;
    if ('pricingPlans' in req.body) updateData.pricingPlans = pricingPlans;
    if ('subscriptionPlans' in req.body) updateData.subscriptionPlans = subscriptionPlans;
    if ('duration' in req.body) updateData.duration = duration;
    if ('image' in req.body) updateData.image = image;
    if ('tags' in req.body) updateData.tags = tags;
    if ('requirements' in req.body) updateData.requirements = requirements;
    if ('isActive' in req.body) updateData.isActive = isActive;
    if ('isQuoteService' in req.body) updateData.isQuoteService = isQuoteService;
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
    if ('taskOptions' in req.body) updateData.taskOptions = taskOptions;
    if ('defaultWorkerCount' in req.body) updateData.defaultWorkerCount = defaultWorkerCount;
    if ('workerWage' in req.body) updateData.workerWage = workerWage;
    if ('workerSearchRadiusKm' in req.body) updateData.workerSearchRadiusKm = workerSearchRadiusKm;
    if ('allowBreakRequests' in req.body) updateData.allowBreakRequests = allowBreakRequests;
    if ('timeBasedPricing' in req.body) updateData.timeBasedPricing = timeBasedPricing;
    if ('suggestedServices' in req.body) updateData.suggestedServices = suggestedServices;
    if ('dos' in req.body) updateData.dos = dos;
    if ('donts' in req.body) updateData.donts = donts;
    if ('displayOrder' in req.body) updateData.displayOrder = displayOrder;
    if ('serviceCategory' in req.body) updateData.serviceCategory = serviceCategory;

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

// @route   POST /api/services/:id/price-change-request
// @desc    Admin submits a pricing or worker-wage update request for super admin review
// @access  Private/Admin
router.post('/:id/price-change-request', authenticate, authorize('admin'), async (req, res) => {
  try {
    const PriceChangeRequest = (await import('../models/PriceChangeRequest.js')).default;

    const service = await Service.findById(req.params.id)
      .select('price originalPrice pricingPlans subscriptionPlans durationOptions pricingTiers workerWage')
      .lean();
    if (!service) {
      return res.status(404).json({ error: { message: 'Service not found', status: 404 } });
    }

    const { price, originalPrice, pricingPlans, subscriptionPlans, durationOptions, pricingTiers, workerWage, reason } = req.body;

    const hasPricingField = [price, originalPrice, pricingPlans, subscriptionPlans, durationOptions, pricingTiers, workerWage]
      .some(v => v !== undefined);
    if (!hasPricingField) {
      return res.status(400).json({
        error: {
          message: 'At least one pricing field must be provided: price, originalPrice, pricingPlans, subscriptionPlans, durationOptions, pricingTiers, workerWage',
          status: 400
        }
      });
    }

    // Validate the proposed values before saving the request
    const pricingErrors = validatePricingFields(req.body);
    if (pricingErrors.length > 0) {
      return res.status(400).json({ error: { message: pricingErrors.join('; '), status: 400 } });
    }

    const workerWageErrors = validateWorkerWage(workerWage);
    if (workerWageErrors.length > 0) {
      return res.status(400).json({ error: { message: workerWageErrors.join('; '), status: 400 } });
    }

    const proposedPricing = {};
    if (price !== undefined) proposedPricing.price = price;
    if (originalPrice !== undefined) proposedPricing.originalPrice = originalPrice;
    if (pricingPlans !== undefined) proposedPricing.pricingPlans = pricingPlans;
    if (subscriptionPlans !== undefined) proposedPricing.subscriptionPlans = subscriptionPlans;
    if (durationOptions !== undefined) proposedPricing.durationOptions = durationOptions;
    if (pricingTiers !== undefined) proposedPricing.pricingTiers = pricingTiers;
    if (workerWage !== undefined) proposedPricing.workerWage = workerWage;

    const request = new PriceChangeRequest({
      service: service._id,
      requestedBy: req.user._id,
      reason: reason || '',
      currentPricing: {
        price: service.price,
        originalPrice: service.originalPrice,
        pricingPlans: service.pricingPlans,
        subscriptionPlans: service.subscriptionPlans,
        durationOptions: service.durationOptions,
        pricingTiers: service.pricingTiers,
        workerWage: service.workerWage
      },
      proposedPricing
    });
    await request.save();

    res.status(201).json({ message: 'Price/wage change request submitted for super admin review', request });
  } catch (error) {
    console.error('Price change request error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

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
