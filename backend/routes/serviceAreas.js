/**
 * Backend Service Area Validation
 * Uses MongoDB database with radius-based service areas
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import ServiceArea from '../models/ServiceArea.js';

const router = express.Router();

// @route   POST /api/service-areas/validate
// @desc    Validate if coordinates are within service area  
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

    // Find service areas that contain this point
    const containingAreas = await ServiceArea.findContainingPoint(latitude, longitude);
    
    if (containingAreas.length > 0) {
      res.json({
        success: true,
        isAvailable: true,
        serviceArea: {
          id: containingAreas[0]._id,
          name: containingAreas[0].name,
          city: containingAreas[0].city,
          radiusKm: containingAreas[0].radiusKm
        },
        message: `Service available in ${containingAreas[0].name}`,
      });
    } else {
      // Find nearest service area
      const nearest = await ServiceArea.findNearest(latitude, longitude);
      
      res.json({
        success: true,
        isAvailable: false,
        message: 'Service not available in your area',
        nearest: nearest ? {
          name: nearest.area.name,
          city: nearest.area.city,
          distance: nearest.distance.toFixed(1)
        } : null
      });
    }
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
// @desc    Get service areas with coordinates for map display
// @access  Public
router.get('/map-data', async (req, res) => {
  try {
    const areas = await ServiceArea.find({ isActive: true })
      .select('name city description coordinates radiusKm color');

    res.json({
      success: true,
      areas: areas.map(area => ({
        id: area._id,
        name: area.name,
        city: area.city,
        description: area.description,
        coordinates: area.coordinates,
        radiusKm: area.radiusKm,
        color: area.color
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
