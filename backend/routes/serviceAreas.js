/**
 * Backend Service Area Validation
 * Uses MongoDB database with radius-based service areas
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import ServiceArea from '../models/ServiceArea.js';

const router = express.Router();

// @route   POST /api/service-areas/validate
// @desc    Validate if coordinates are within service area (checks Locations, not ServiceAreas)
// @access  Public
router.post('/validate', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: { message: 'Latitude and longitude are required', status: 400 },
      });
    }

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        error: { message: 'Invalid coordinates', status: 400 },
      });
    }

    // Import Location model
    const { default: Location } = await import('../models/Location.js');
    
    // Find locations within 5km radius (city-level coverage)
    const nearbyLocations = await Location.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: 5000 // 5 km — covers typical city service area
        }
      },
      isActive: true // include all active locations regardless of isServiceAvailable
    }).limit(1);
    
    if (nearbyLocations.length > 0) {
      const location = nearbyLocations[0];
      res.json({
        success: true,
        isAvailable: true,
        serviceArea: {
          id: location._id,
          name: location.apartmentName,
          city: location.city,
          area: location.area
        },
        message: `Service available at ${location.apartmentName}`,
      });
    } else {
      // Find nearest location (active only)
      const allLocations = await Location.find({ isActive: true }).limit(10);
      
      let nearest = null;
      let minDistance = Infinity;
      
      for (const loc of allLocations) {
        const [locLng, locLat] = loc.location.coordinates;
        const distance = calculateDistance(latitude, longitude, locLat, locLng);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = { name: loc.apartmentName, city: loc.city, distance: distance / 1000 }; // km
        }
      }
      
      res.json({
        success: true,
        isAvailable: false,
        message: 'Service not available in your area',
        nearest: nearest
      });
    }
  } catch (error) {
    console.error('Service area validation error:', error);
    res.status(500).json({
      error: { message: 'Server error', status: 500 },
    });
  }
});

// Helper function to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

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

    if (!email || !latitude || !longitude) {
      return res.status(400).json({
        error: { message: 'Email and location are required', status: 400 },
      });
    }

    // In production, store in database
    // For now, just acknowledge
    console.log('Service expansion notification:', {
      email,
      latitude,
      longitude,
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

export default router;
