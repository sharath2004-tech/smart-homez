import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import Location from '../models/Location.js';
import User from '../models/User.js';
import {
    calculateDistance,
    checkServiceAvailability,
    findNearbyWorkers,
    geocodeAddress,
    reverseGeocode
} from '../utils/geolocation.js';
import { hasValue, parseCoordinate } from '../utils/coordinateValidation.js';

const router = express.Router();

// @route   GET /api/locations/public
// @desc    Get all active service locations — for signup city/area picker (no auth)
// @access  Public
router.get('/public', async (req, res) => {
  try {
    const locations = await Location.find({ isActive: true })
      .select('apartmentName area city state zipCode location isServiceAvailable assignedWorkers')
      .sort({ city: 1, area: 1 });

    // Group by city
    const cityMap = {};
    for (const loc of locations) {
      const city = loc.city;
      if (!cityMap[city]) cityMap[city] = [];
      cityMap[city].push({
        _id: loc._id,
        apartmentName: loc.apartmentName,
        area: loc.area,
        city: loc.city,
        state: loc.state,
        zipCode: loc.zipCode,
        coordinates: loc.location?.coordinates
          ? { lng: loc.location.coordinates[0], lat: loc.location.coordinates[1] }
          : null,
        isServiceAvailable: loc.isServiceAvailable,
        workersCount: loc.assignedWorkers?.length || 0,
      });
    }

    const cities = Object.entries(cityMap).map(([city, locations]) => ({
      city,
      locations,
      hasService: locations.some(l => l.isServiceAvailable),
    }));

    res.json({ success: true, cities, total: locations.length });
  } catch (error) {
    console.error('Public locations error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all locations (admin only)
router.get('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { city, area, isActive } = req.query;
    const filter = {};

    if (city) filter.city = new RegExp(city, 'i');
    if (area) filter.area = new RegExp(area, 'i');
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    // If regular admin, only show their assigned locations
    if (req.user.role === 'admin') {
      const adminLocationIds = req.user.adminProfile?.assignedLocations?.map(loc => loc.locationId) || [];

      if (adminLocationIds.length === 0) {
        // Admin has no assigned locations, return empty list
        return res.status(200).json({
          success: true,
          count: 0,
          data: []
        });
      }

      // Add filter to only show admin's assigned locations
      filter._id = { $in: adminLocationIds };
    }
    // Super admin sees all locations (no additional filter needed)

    const locations = await Location.find(filter)
      .populate('createdBy', 'name email')
      .populate('assignedWorkers.worker', 'name email phone workerProfile.rating')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: locations.length,
      data: locations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching locations',
      error: error.message
    });
  }
});

// Create new location (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const locationData = {
      ...req.body,
      createdBy: req.user._id,
      isServiceAvailable: true // Service available at all created locations
    };
    
    const location = await Location.create(locationData);

    res.status(201).json({
      success: true,
      data: location
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating location',
      error: error.message
    });
  }
});

// Update location (admin only)
router.patch('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const location = await Location.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    res.status(200).json({
      success: true,
      data: location
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating location',
      error: error.message
    });
  }
});

// Delete location (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const location = await Location.findByIdAndDelete(req.params.id);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Location deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting location',
      error: error.message
    });
  }
});

// Assign worker to location (admin only)
router.post('/:id/assign-worker', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { workerId } = req.body;
    
    const worker = await User.findOne({ _id: workerId, role: 'worker' });
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // Check if worker already assigned
    const alreadyAssigned = location.assignedWorkers.some(
      w => w.worker.toString() === workerId
    );

    if (alreadyAssigned) {
      return res.status(400).json({
        success: false,
        message: 'Worker already assigned to this location'
      });
    }

    // Add to location's assigned workers
    location.assignedWorkers.push({ worker: workerId });
    
    // Auto-enable service availability when first worker is assigned
    if (location.assignedWorkers.length === 1) {
      location.isServiceAvailable = true;
    }
    
    await location.save();

    // Add to worker's assigned apartments
    worker.workerProfile.assignedApartments.push({
      locationId: location._id,
      apartmentName: location.apartmentName,
      building: location.building,
      area: location.area,
      city: location.city,
      location: location.location
    });
    await worker.save();

    res.status(200).json({
      success: true,
      message: 'Worker assigned successfully',
      data: location
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error assigning worker',
      error: error.message
    });
  }
});

// Check service availability at user's location
router.post('/check-availability', authenticate, async (req, res) => {
  try {
    const { serviceId, longitude, latitude, apartmentName } = req.body;

    const parsedLongitude = parseCoordinate(longitude);
    const parsedLatitude = parseCoordinate(latitude);

    if (!serviceId || parsedLongitude === null || parsedLatitude === null) {
      return res.status(400).json({
        success: false,
        message: 'Service ID, longitude, and latitude are required'
      });
    }

    const availability = await checkServiceAvailability(
      serviceId,
      parsedLongitude,
      parsedLatitude,
      apartmentName
    );

    res.status(200).json({
      success: true,
      data: availability
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking availability',
      error: error.message
    });
  }
});

// Get nearby workers
router.post('/nearby-workers', authenticate, async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 500, specializations } = req.body;

    const parsedLongitude = parseCoordinate(longitude);
    const parsedLatitude = parseCoordinate(latitude);

    if (parsedLongitude === null || parsedLatitude === null) {
      return res.status(400).json({
        success: false,
        message: 'Longitude and latitude are required'
      });
    }

    const workers = await findNearbyWorkers(
      parsedLongitude,
      parsedLatitude,
      maxDistance,
      specializations
    );

    res.status(200).json({
      success: true,
      count: workers.length,
      data: workers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error finding nearby workers',
      error: error.message
    });
  }
});

// Get nearby locations
router.post('/nearby', authenticate, async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 500 } = req.body;

    const parsedLongitude = parseCoordinate(longitude);
    const parsedLatitude = parseCoordinate(latitude);

    if (parsedLongitude === null || parsedLatitude === null) {
      return res.status(400).json({
        success: false,
        message: 'Longitude and latitude are required'
      });
    }

    const locations = await Location.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parsedLongitude, parsedLatitude]
          },
          $maxDistance: maxDistance
        }
      },
      isServiceAvailable: true,
      isActive: true
    })
    .limit(10)
    .populate('assignedWorkers.worker', 'name workerProfile.rating');

    // Calculate distance for each location
    const locationsWithDistance = locations.map(loc => {
      const distance = calculateDistance(
        parsedLatitude,
        parsedLongitude,
        loc.location.coordinates[1],
        loc.location.coordinates[0]
      );
      return {
        ...loc.toObject(),
        distance: Math.round(distance) // meters
      };
    });

    res.status(200).json({
      success: true,
      count: locationsWithDistance.length,
      data: locationsWithDistance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error finding nearby locations',
      error: error.message
    });
  }
});

// Geocode address to coordinates
router.post('/geocode', authenticate, async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Address is required'
      });
    }

    const coordinates = await geocodeAddress(address);

    if (!coordinates) {
      return res.status(400).json({
        success: false,
        message: 'Could not find coordinates for this address. Please check the address details.'
      });
    }

    res.status(200).json({
      success: true,
      data: coordinates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error geocoding address',
      error: error.message
    });
  }
});

// Reverse geocode coordinates to address
router.post('/reverse-geocode', authenticate, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    const parsedLatitude = parseCoordinate(latitude);
    const parsedLongitude = parseCoordinate(longitude);

    if (parsedLatitude === null || parsedLongitude === null) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const address = await reverseGeocode(parsedLatitude, parsedLongitude);

    res.status(200).json({
      success: true,
      data: address
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error reverse geocoding',
      error: error.message
    });
  }
});

// @route   GET /api/locations/customer/nearby
// @desc    Get nearby service locations for customers (public/authenticated)
// @access  Public or Customer
router.get('/customer/nearby', async (req, res) => {
  try {
    const { latitude, longitude, maxDistance = 5000 } = req.query;

    if (!hasValue(latitude) || !hasValue(longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
        code: 'COORDINATES_REQUIRED'
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates',
        code: 'INVALID_COORDINATES'
      });
    }

    // Find nearby locations with available services
    const nearbyLocations = await Location.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          $maxDistance: parseInt(maxDistance)
        }
      },
      isActive: true,
      isServiceAvailable: true
    })
    .populate('assignedWorkers.worker', 'name workerProfile.specialization workerProfile.rating workerProfile.availability')
    .select('apartmentName building area city state zipCode location assignedWorkers availableServices isServiceAvailable')
    .limit(10);

    // Calculate distance for each location
    const locationsWithDistance = nearbyLocations.map(location => {
      const distance = calculateDistance(
        lat,
        lng,
        location.location.coordinates[1],
        location.location.coordinates[0]
      );

      // Count available workers at this location
      const availableWorkersCount = location.assignedWorkers.filter(
        aw => aw.worker?.workerProfile?.availability
      ).length;

      return {
        _id: location._id,
        apartmentName: location.apartmentName,
        building: location.building,
        area: location.area,
        city: location.city,
        state: location.state,
        zipCode: location.zipCode,
        coordinates: {
          lat: location.location.coordinates[1],
          lng: location.location.coordinates[0]
        },
        distance: Math.round(distance * 10) / 10, // Round to 1 decimal (in km)
        distanceFormatted: distance < 1 
          ? `${Math.round(distance * 1000)}m` 
          : `${(Math.round(distance * 10) / 10)}km`,
        availableWorkersCount,
        servicesAvailable: location.availableServices?.length || 0,
        isServiceAvailable: location.isServiceAvailable
      };
    });

    // Sort by distance
    locationsWithDistance.sort((a, b) => a.distance - b.distance);

    res.status(200).json({
      success: true,
      count: locationsWithDistance.length,
      data: locationsWithDistance,
      searchCenter: {
        latitude: lat,
        longitude: lng
      },
      maxDistance: parseInt(maxDistance)
    });
  } catch (error) {
    console.error('Get nearby locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error finding nearby locations',
      error: error.message
    });
  }
});

// ==================== PAYMENT QR CODE MANAGEMENT ====================

// @route   PUT /api/locations/:id/payment-qr
// @desc    Update payment QR code for a location (Admin only)
// @access  Private/Admin
router.put('/:id/payment-qr', 
  authenticate, 
  authorize('admin', 'super_admin'), 
  async (req, res) => {
    try {
      const { upiId, upiName, qrCodeImage, accountNumber, ifscCode, phoneNumber } = req.body;

      const location = await Location.findById(req.params.id);
      
      if (!location) {
        return res.status(404).json({
          success: false,
          message: 'Location not found'
        });
      }

      // Check if admin has access to this location
      if (req.user.role === 'admin' && location.assignedAdmin?.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to manage this location'
        });
      }

      // Update payment QR details
      location.paymentQR = {
        upiId: upiId || location.paymentQR?.upiId,
        upiName: upiName || location.paymentQR?.upiName,
        qrCodeImage: qrCodeImage || location.paymentQR?.qrCodeImage,
        accountNumber: accountNumber || location.paymentQR?.accountNumber,
        ifscCode: ifscCode || location.paymentQR?.ifscCode,
        phoneNumber: phoneNumber || location.paymentQR?.phoneNumber,
        isActive: true,
        updatedBy: req.user._id,
        updatedAt: new Date()
      };

      await location.save();

      res.status(200).json({
        success: true,
        message: 'Payment QR updated successfully',
        paymentQR: location.paymentQR
      });

    } catch (error) {
      console.error('Update payment QR error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating payment QR',
        error: error.message
      });
    }
  }
);

// @route   GET /api/locations/:id/payment-qr
// @desc    Get payment QR code for a location
// @access  Private (Customer/Worker/Admin)
router.get('/:id/payment-qr', 
  authenticate, 
  async (req, res) => {
    try {
      const location = await Location.findById(req.params.id)
        .select('apartmentName area city paymentQR');
      
      if (!location) {
        return res.status(404).json({
          success: false,
          message: 'Location not found'
        });
      }

      // Check if location has payment QR configured
      if (!location.paymentQR?.upiId && !location.paymentQR?.qrCodeImage) {
        // Fallback to global settings
        const Settings = (await import('../models/Settings.js')).default;
        const settings = await Settings.getSettings();
        
        return res.status(200).json({
          success: true,
          message: 'Using global payment settings',
          paymentQR: {
            upiId: settings.payment?.upiId,
            upiName: settings.payment?.upiName,
            qrCodeImage: settings.payment?.qrCodeImage,
            isGlobal: true
          },
          location: {
            id: location._id,
            name: location.apartmentName,
            area: location.area,
            city: location.city
          }
        });
      }

      res.status(200).json({
        success: true,
        paymentQR: {
          upiId: location.paymentQR.upiId,
          upiName: location.paymentQR.upiName,
          qrCodeImage: location.paymentQR.qrCodeImage,
          phoneNumber: location.paymentQR.phoneNumber,
          isGlobal: false
        },
        location: {
          id: location._id,
          name: location.apartmentName,
          area: location.area,
          city: location.city
        }
      });

    } catch (error) {
      console.error('Get payment QR error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving payment QR',
        error: error.message
      });
    }
  }
);

// @route   DELETE /api/locations/:id/payment-qr
// @desc    Remove payment QR code for a location (reverts to global)
// @access  Private/Admin
router.delete('/:id/payment-qr', 
  authenticate, 
  authorize('admin', 'super_admin'), 
  async (req, res) => {
    try {
      const location = await Location.findById(req.params.id);
      
      if (!location) {
        return res.status(404).json({
          success: false,
          message: 'Location not found'
        });
      }

      // Check if admin has access
      if (req.user.role === 'admin' && location.assignedAdmin?.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to manage this location'
        });
      }

      // Clear payment QR (will fallback to global settings)
      location.paymentQR = {
        isActive: false,
        updatedBy: req.user._id,
        updatedAt: new Date()
      };

      await location.save();

      res.status(200).json({
        success: true,
        message: 'Payment QR removed. Will use global settings for payments.'
      });

    } catch (error) {
      console.error('Delete payment QR error:', error);
      res.status(500).json({
        success: false,
        message: 'Error removing payment QR',
        error: error.message
      });
    }
  }
);

export default router;
