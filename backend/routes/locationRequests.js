/**
 * Location Request Routes
 * Admin can request new location creation; super admin approves or rejects
 */

import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import Location from '../models/Location.js';
import LocationRequest from '../models/LocationRequest.js';

const router = express.Router();

/**
 * Admin submits a location creation request
 * POST /api/location-requests
 */
router.post(
  '/',
  authenticate,
  authorize('admin'),
  [
    body('apartmentName').notEmpty().withMessage('Apartment name is required'),
    body('area').notEmpty().withMessage('Area is required'),
    body('city').notEmpty().withMessage('City is required'),
    body('state').notEmpty().withMessage('State is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg } });
      }

      const { apartmentName, building, area, city, state, zipCode, reason } = req.body;

      const request = new LocationRequest({
        requestedBy: req.user._id,
        apartmentName,
        building,
        area,
        city,
        state,
        zipCode,
        reason
      });

      await request.save();
      await request.populate('requestedBy', 'name email');

      res.status(201).json({ success: true, request });
    } catch (error) {
      console.error('Create location request error:', error);
      res.status(500).json({ error: { message: 'Server error' } });
    }
  }
);

/**
 * Get location requests
 * GET /api/location-requests
 * Admin: their own requests; Super admin: all requests
 */
router.get(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const filter = {};
      if (req.user.role === 'admin') filter.requestedBy = req.user._id;
      if (req.query.status) filter.status = req.query.status;

      const requests = await LocationRequest.find(filter)
        .populate('requestedBy', 'name email')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 });

      res.json({ success: true, requests });
    } catch (error) {
      console.error('Get location requests error:', error);
      res.status(500).json({ error: { message: 'Server error' } });
    }
  }
);

/**
 * Super admin reviews (approve/reject) a location request
 * PATCH /api/location-requests/:id/review
 */
router.patch(
  '/:id/review',
  authenticate,
  authorize('super_admin'),
  [
    param('id').isMongoId().withMessage('Valid request ID is required'),
    body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),
    body('coordinates').if(body('status').equals('approved')).custom((coords) => {
      if (!coords || !Array.isArray(coords) || coords.length !== 2) {
        throw new Error('Valid coordinates [longitude, latitude] are required for approval');
      }
      const [lng, lat] = coords;
      if (typeof lng !== 'number' || typeof lat !== 'number') {
        throw new Error('Coordinates must be numbers');
      }
      if (lng < -180 || lng > 180) throw new Error('Longitude must be between -180 and 180');
      if (lat < -90 || lat > 90) throw new Error('Latitude must be between -90 and 90');
      // Reject placeholder coordinates
      if (lng === 0 && lat === 0) {
        throw new Error('Please provide actual coordinates, not placeholder [0, 0]');
      }
      return true;
    })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg } });
      }

      // Use findOneAndUpdate with atomic check to prevent race conditions
      const request = await LocationRequest.findOneAndUpdate(
        { _id: req.params.id, status: 'pending' },
        {
          $set: {
            status: req.body.status,
            reviewedBy: req.user._id,
            reviewNote: req.body.reviewNote || '',
            reviewedAt: new Date()
          }
        },
        { new: true }
      );

      if (!request) {
        // Either request doesn't exist or status is not pending
        const existingRequest = await LocationRequest.findById(req.params.id);
        if (!existingRequest) {
          return res.status(404).json({ error: { message: 'Location request not found' } });
        }
        return res.status(400).json({ error: { message: `Request already ${existingRequest.status}` } });
      }

      // If approved, create the actual location atomically
      let createdLocation = null;
      if (req.body.status === 'approved') {
        try {
          createdLocation = new Location({
            apartmentName: request.apartmentName,
            building: request.building,
            area: request.area,
            city: request.city,
            state: request.state,
            zipCode: request.zipCode,
            location: { type: 'Point', coordinates: req.body.coordinates },
            maxServiceRadius: 500
          });
          await createdLocation.save();
        } catch (locationError) {
          // Rollback the request status if location creation fails
          await LocationRequest.findByIdAndUpdate(req.params.id, {
            $set: { status: 'pending', reviewedBy: null, reviewNote: '', reviewedAt: null }
          });
          console.error('Location creation failed, rolled back request approval:', locationError);
          return res.status(500).json({
            error: { message: 'Failed to create location. Request approval has been rolled back.' }
          });
        }
      }

      await request.populate('requestedBy', 'name email');
      await request.populate('reviewedBy', 'name email');

      res.json({
        success: true,
        request,
        createdLocation: createdLocation || null,
        message: req.body.status === 'approved'
          ? 'Location request approved and location created.'
          : 'Location request rejected.'
      });
    } catch (error) {
      console.error('Review location request error:', error);
      res.status(500).json({ error: { message: 'Server error' } });
    }
  }
);

export default router;
