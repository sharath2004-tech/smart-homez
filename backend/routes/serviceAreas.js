/**
 * Backend Service Area Validation
 * Uses MongoDB database with radius-based service areas
 */

import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import Location from '../models/Location.js';
import Service from '../models/Service.js';
import ServiceArea from '../models/ServiceArea.js';
import ServiceAvailabilityRequest from '../models/ServiceAvailabilityRequest.js';
import { hasValue, parseCoordinate } from '../utils/coordinateValidation.js';
import { calculateDistance } from '../utils/geolocation.js';

const router = express.Router();

const buildDateRange = (from, to) => {
  const dateRange = {};

  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) {
      dateRange.$gte = fromDate;
    }
  }

  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      dateRange.$lte = toDate;
    }
  }

  return Object.keys(dateRange).length > 0 ? dateRange : null;
};

// @route   POST /api/service-areas/validate
// @desc    Validate if coordinates are within service area (checks Locations, not ServiceAreas)
// @access  Public
router.post('/validate', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    const parsedLatitude = parseCoordinate(latitude);
    const parsedLongitude = parseCoordinate(longitude);

    if (parsedLatitude === null || parsedLongitude === null) {
      return res.status(400).json({
        error: { message: 'Latitude and longitude are required', status: 400 },
      });
    }

    // Validate coordinate ranges
    if (parsedLatitude < -90 || parsedLatitude > 90 || parsedLongitude < -180 || parsedLongitude > 180) {
      return res.status(400).json({
        error: { message: 'Invalid coordinates', status: 400 },
      });
    }

    const nearbyLocation = await Location.findOne({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parsedLongitude, parsedLatitude]
          },
          $maxDistance: 50000
        }
      },
      isActive: true,
      isServiceAvailable: true
    }).select('apartmentName city area location maxServiceRadius');

    if (nearbyLocation?.location?.coordinates?.length) {
      const [locationLng, locationLat] = nearbyLocation.location.coordinates;
      const distanceMeters = Math.round(calculateDistance(parsedLatitude, parsedLongitude, locationLat, locationLng));
      const serviceRadiusMeters = Math.max(nearbyLocation.maxServiceRadius || 500, 100);

      if (distanceMeters <= serviceRadiusMeters) {
        return res.json({
          success: true,
          isAvailable: true,
          serviceArea: {
            id: nearbyLocation._id,
            name: nearbyLocation.apartmentName,
            city: nearbyLocation.city,
            area: nearbyLocation.area,
            distanceMeters,
            serviceRadiusMeters
          },
          message: `Service available at ${nearbyLocation.apartmentName}`,
        });
      }
    }

    const allLocations = await Location.find({ isActive: true, isServiceAvailable: true })
      .select('apartmentName city area location')
      .limit(10);

    let nearest = null;
    let minDistance = Infinity;

    for (const loc of allLocations) {
      const [locLng, locLat] = loc.location.coordinates;
      const distance = calculateDistance(parsedLatitude, parsedLongitude, locLat, locLng);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = {
          name: loc.apartmentName,
          city: loc.city,
          area: loc.area,
          distance: Math.round(distance / 100) / 10
        };
      }
    }

    res.json({
      success: true,
      isAvailable: false,
      message: 'Service not available in your selected region',
      nearest
    });
  } catch (error) {
    console.error('Service area validation error:', error);
    res.status(500).json({
      error: { message: 'Server error', status: 500 },
    });
  }
});

// @route   GET /api/service-areas
// @desc    Get all active service areas (public view)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { city } = req.query;

    const query = { isActive: true };
    if (city) query.city = city;

    const areas = await ServiceArea.find(query).select('name city description radiusKm');

    res.json({
      success: true,
      areas: areas.map(area => ({
        id: area._id,
        name: area.name,
        city: area.city,
        description: area.description,
        // Don't send exact coordinates and radius for security
      })),
      totalAreas: areas.length,
    });
  } catch (error) {
    console.error('Get service areas error:', error);
    res.status(500).json({
      error: { message: 'Server error', status: 500 },
    });
  }
});

// @route   GET /api/service-areas/map-data
// @desc    Get locations with coordinates for map display (shows actual service locations)
// @access  Public
router.get('/map-data', async (req, res) => {
  try {
    // Import Location model
    const { default: Location } = await import('../models/Location.js');
    
    const locations = await Location.find({ 
      isActive: true,
      isServiceAvailable: true 
    }).select('apartmentName area city location maxServiceRadius');

    res.json({
      success: true,
      areas: locations.map(loc => ({
        id: loc._id,
        name: loc.apartmentName,
        city: loc.city,
        description: `${loc.area}, ${loc.city}`,
        coordinates: {
          lat: loc.location.coordinates[1],
          lng: loc.location.coordinates[0]
        },
        radiusKm: (loc.maxServiceRadius || 500) / 1000, // Convert meters to km
        color: '#10b981' // Green color for available service
      }))
    });
  } catch (error) {
    console.error('Get map data error:', error);
    res.status(500).json({
      error: { message: 'Server error', status: 500 },
    });
  }
});

// @route   POST /api/service-areas/notify
// @desc    Store notification request for service expansion
// @access  Private
router.post('/notify', authenticate, async (req, res) => {
  try {
    const { latitude, longitude, email } = req.body;

    const parsedLatitude = parseCoordinate(latitude);
    const parsedLongitude = parseCoordinate(longitude);

    if (!email || parsedLatitude === null || parsedLongitude === null) {
      return res.status(400).json({
        error: { message: 'Email and location are required', status: 400 },
      });
    }

    // In production, store in database
    // For now, just acknowledge
    console.log('Service expansion notification:', {
      email,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      userId: req.user._id,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: 'We will notify you when services are available in your area',
    });
  } catch (error) {
    console.error('Notification signup error:', error);
    res.status(500).json({
      error: { message: 'Server error', status: 500 },
    });
  }
});

// @route   POST /api/service-areas/requests
// @desc    Store a customer poll/request for a service unavailable in their location
// @access  Private
router.post('/requests',
  authenticate,
  [
    body('serviceId').isMongoId().withMessage('Valid service is required'),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
    body('address').optional().isString().trim(),
    body('area').optional().isString().trim(),
    body('city').optional().isString().trim(),
    body('state').optional().isString().trim(),
    body('zipCode').optional().isString().trim(),
    body('serviceAreaId').optional({ values: 'falsy' }).isMongoId().withMessage('Service area ID must be valid'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: { message: errors.array()[0].msg, status: 400 },
        });
      }

      const {
        serviceId,
        latitude,
        longitude,
        address = '',
        area = '',
        city = '',
        state = '',
        zipCode = '',
        serviceAreaId = null,
      } = req.body;

      const service = await Service.findById(serviceId)
        .select('name serviceType category')
        .lean();

      if (!service) {
        return res.status(404).json({
          error: { message: 'Service not found', status: 404 },
        });
      }

      const lat = Number(latitude);
      const lng = Number(longitude);
      const locationKey = `${lat.toFixed(3)}:${lng.toFixed(3)}`;
      const now = new Date();

      const request = await ServiceAvailabilityRequest.findOneAndUpdate(
        {
          requestedBy: req.user._id,
          service: service._id,
          locationKey,
        },
        {
          $set: {
            serviceName: service.name,
            serviceType: service.serviceType || '',
            category: service.category || '',
            customerName: req.user.name || '',
            customerEmail: req.user.email || '',
            customerPhone: req.user.phone || '',
            address,
            area,
            city,
            state,
            zipCode,
            serviceAreaId: serviceAreaId || null,
            location: {
              type: 'Point',
              coordinates: [lng, lat],
            },
            lastRequestedAt: now,
          },
          $setOnInsert: {
            source: 'customer_service_unavailable',
          },
          $inc: {
            requestCount: 1,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
        }
      );

      res.status(201).json({
        success: true,
        message: 'Your request has been recorded. We will review demand in your area.',
        request,
      });
    } catch (error) {
      console.error('Create service availability request error:', error);
      res.status(500).json({
        error: { message: 'Server error', status: 500 },
      });
    }
  }
);

// @route   GET /api/service-areas/requests/analytics
// @desc    Get service request poll counts for a selected map range and date range
// @access  Private/Admin/Super Admin
router.get('/requests/analytics',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    query('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be valid'),
    query('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be valid'),
    query('radiusKm').optional().isFloat({ min: 0.1, max: 100 }).withMessage('Radius must be between 0.1 and 100 km'),
    query('serviceId').optional().isMongoId().withMessage('Service must be valid'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: { message: errors.array()[0].msg, status: 400 },
        });
      }

      const {
        latitude,
        longitude,
        radiusKm = 5,
        serviceId,
        from,
        to,
      } = req.query;

      const match = {};
      const dateRange = buildDateRange(from, to);

      if (dateRange) {
        match.lastRequestedAt = dateRange;
      }

      if (serviceId) {
        match.service = serviceId;
      }

      if (latitude !== undefined && longitude !== undefined) {
        const radiusInRadians = Number(radiusKm) / 6378.1;
        match.location = {
          $geoWithin: {
            $centerSphere: [[Number(longitude), Number(latitude)], radiusInRadians],
          },
        };
      }

      const [summary, byService, recentRequests] = await Promise.all([
        ServiceAvailabilityRequest.aggregate([
          { $match: match },
          {
            $group: {
              _id: null,
              uniqueRequestRecords: { $sum: 1 },
              totalPollCount: { $sum: '$requestCount' },
              uniqueCustomers: { $addToSet: '$requestedBy' },
              uniqueLocations: { $addToSet: '$locationKey' },
            },
          },
          {
            $project: {
              _id: 0,
              uniqueRequestRecords: 1,
              totalPollCount: 1,
              uniqueCustomers: { $size: '$uniqueCustomers' },
              uniqueLocations: { $size: '$uniqueLocations' },
            },
          },
        ]),
        ServiceAvailabilityRequest.aggregate([
          { $match: match },
          {
            $group: {
              _id: '$service',
              serviceName: { $first: '$serviceName' },
              serviceType: { $first: '$serviceType' },
              requestRecords: { $sum: 1 },
              totalPollCount: { $sum: '$requestCount' },
            },
          },
          { $sort: { totalPollCount: -1, requestRecords: -1, serviceName: 1 } },
          { $limit: 10 },
        ]),
        ServiceAvailabilityRequest.find(match)
          .sort({ lastRequestedAt: -1 })
          .limit(25)
          .populate('requestedBy', 'name email phone')
          .populate('service', 'name serviceType')
          .lean(),
      ]);

      res.json({
        success: true,
        filters: {
          latitude: latitude !== undefined ? Number(latitude) : null,
          longitude: longitude !== undefined ? Number(longitude) : null,
          radiusKm: Number(radiusKm),
          from: from || null,
          to: to || null,
          serviceId: serviceId || null,
        },
        summary: summary[0] || {
          uniqueRequestRecords: 0,
          totalPollCount: 0,
          uniqueCustomers: 0,
          uniqueLocations: 0,
        },
        byService,
        recentRequests,
      });
    } catch (error) {
      console.error('Get service availability analytics error:', error);
      res.status(500).json({
        error: { message: 'Server error', status: 500 },
      });
    }
  }
);

export default router;
