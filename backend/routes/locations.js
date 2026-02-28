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

const router = express.Router();

// Get all locations (admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { city, area, isActive } = req.query;
    const filter = {};
    
    if (city) filter.city = new RegExp(city, 'i');
    if (area) filter.area = new RegExp(area, 'i');
    if (isActive !== undefined) filter.isActive = isActive === 'true';

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
      createdBy: req.user._id
    };
    
    const location = await Location.create(locationData);
    
    // Check if there are any workers in the same area/city to set initial availability
    const workersInArea = await User.find({
      role: 'worker',
      'workerProfile.city': location.city,
      'workerProfile.availability': true
    }).limit(1);
    
    // If workers are available in the area, mark service as available
    if (workersInArea.length > 0) {
      location.isServiceAvailable = true;
      await location.save();
    }

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

    if (!serviceId || !longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: 'Service ID, longitude, and latitude are required'
      });
    }

    const availability = await checkServiceAvailability(
      serviceId,
      longitude,
      latitude,
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

    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: 'Longitude and latitude are required'
      });
    }

    const workers = await findNearbyWorkers(
      longitude,
      latitude,
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

    if (!longitude || !latitude) {
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
            coordinates: [longitude, latitude]
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
        latitude,
        longitude,
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

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const address = await reverseGeocode(latitude, longitude);

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

export default router;
