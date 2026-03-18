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
    body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg } });
      }

      const request = await LocationRequest.findById(req.params.id);
      if (!request) return res.status(404).json({ error: { message: 'Location request not found' } });

      if (request.status !== 'pending') {
        return res.status(400).json({ error: { message: `Request already ${request.status}` } });
      }

      request.status = req.body.status;
      request.reviewedBy = req.user._id;
      request.reviewNote = req.body.reviewNote || '';
      request.reviewedAt = new Date();

      await request.save();

      // If approved, create the actual location
      let createdLocation = null;
      if (req.body.status === 'approved') {
        createdLocation = new Location({
          apartmentName: request.apartmentName,
          building: request.building,
          area: request.area,
          city: request.city,
          state: request.state,
          zipCode: request.zipCode,
          location: { type: 'Point', coordinates: [0, 0] },
          maxServiceRadius: 500
        });
        await createdLocation.save();
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
