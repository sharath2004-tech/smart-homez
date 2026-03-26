import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, authorize } from '../middleware/auth.js';
import Location from '../models/Location.js';
import Notification from '../models/Notification.js';
import QuoteRequest from '../models/QuoteRequest.js';
import User from '../models/User.js';

const router = express.Router();

const PROPERTY_LABELS = {
  villa: 'Villa',
  bungalow: 'Bungalow',
  restaurant: 'Restaurant',
  corporate_office: 'Corporate Office',
  business: 'Business',
  other: 'Other'
};

// @route   POST /api/quotes
// @desc    Submit a commercial deep cleaning quote request (public)
// @access  Public
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, propertyType, propertyTypeCustom, placeSize, city, message } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: { message: 'Name is required', status: 400 } });
    if (!phone?.trim()) return res.status(400).json({ error: { message: 'Phone number is required', status: 400 } });
    if (!propertyType) return res.status(400).json({ error: { message: 'Property type is required', status: 400 } });

    // Optionally attach userId if a valid token is present
    let userId = null;
    const authHeader = req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.replace('Bearer ', ''), process.env.JWT_SECRET);
        userId = decoded.userId || decoded.id || decoded._id || null;
      } catch { /* ignore invalid/expired token */ }
    }

    const quote = new QuoteRequest({
      userId,
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      propertyType,
      propertyTypeCustom: propertyType === 'other' ? (propertyTypeCustom?.trim() || '') : '',
      placeSize: placeSize?.trim() || '',
      city: city?.trim() || '',
      message: message?.trim() || ''
    });
    await quote.save();

    // Build notification message
    const typeLabel = propertyType === 'other'
      ? (propertyTypeCustom?.trim() || 'Other')
      : (PROPERTY_LABELS[propertyType] || propertyType);
    const sizeText = placeSize?.trim() ? `, size: ${placeSize.trim()}` : '';
    const cityText = city?.trim() ? ` in ${city.trim()}` : '';
    const notifMessage = `${name} (${phone}) needs a deep cleaning quote — ${typeLabel}${cityText}${sizeText}.`;

    try {
      // Always notify all super admins
      const superAdmins = await User.find({ role: 'super_admin', isActive: true }).select('_id');

      // Find regional admins by city if provided
      let regionalAdminIds = [];
      if (city?.trim()) {
        const cityLocations = await Location.find({
          city: new RegExp(`^${city.trim()}$`, 'i')
        }).select('_id');
        const locationIds = cityLocations.map(l => l._id);

        if (locationIds.length > 0) {
          const regionalAdmins = await User.find({
            role: 'admin',
            isActive: true,
            'adminProfile.assignedLocations.locationId': { $in: locationIds }
          }).select('_id');
          regionalAdminIds = regionalAdmins.map(a => a._id.toString());
        }
      }

      // Merge unique recipient IDs
      const superAdminIds = superAdmins.map(a => a._id.toString());
      const allRecipientIds = [...new Set([...superAdminIds, ...regionalAdminIds])];

      if (allRecipientIds.length > 0) {
        const notifications = allRecipientIds.map(id => ({
          recipient: id,
          title: 'New Quote Request',
          message: notifMessage,
          type: 'general',
          data: { quoteId: quote._id }
        }));
        await Notification.insertMany(notifications);
        console.log(`📬 Quote notification sent to ${superAdminIds.length} super admin(s) + ${regionalAdminIds.length} regional admin(s)`);
      }
    } catch (notifErr) {
      console.error('Quote notification failed (non-fatal):', notifErr.message);
    }

    res.status(201).json({ success: true, message: 'Quote request submitted. Our team will contact you shortly.' });
  } catch (error) {
    console.error('Quote request error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/quotes/mine
// @desc    Get quote requests submitted by the logged-in customer
// @access  Private (customer)
router.get('/mine', authenticate, async (req, res) => {
  try {
    const query = [{ userId: req.user._id }];

    const phoneDigits = String(req.user?.phone || '').replace(/\D/g, '').slice(-10);
    if (phoneDigits.length === 10) {
      query.push({
        userId: null,
        phone: { $regex: `${phoneDigits}$` }
      });

      // Self-heal legacy records created before userId extraction fix
      await QuoteRequest.updateMany(
        {
          userId: null,
          phone: { $regex: `${phoneDigits}$` }
        },
        { $set: { userId: req.user._id } }
      );
    }

    const quotes = await QuoteRequest.find({ $or: query }).sort({ createdAt: -1 });
    res.json({ success: true, data: quotes });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/quotes
// @desc    Get all quote requests — super admin sees all, admin sees only their region
// @access  Private
router.get('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    let quotes;
    if (req.user.role === 'super_admin') {
      quotes = await QuoteRequest.find().sort({ createdAt: -1 });
    } else {
      // Admin: filter by cities in their assigned locations
      const locationIds = req.user.adminProfile?.assignedLocations?.map(l => l.locationId) || [];
      if (locationIds.length === 0) {
        return res.json({ success: true, data: [] });
      }
      const locations = await Location.find({ _id: { $in: locationIds } }).select('city');
      const cities = [...new Set(locations.map(l => l.city).filter(Boolean))];
      quotes = await QuoteRequest.find({
        city: { $in: cities.map(c => new RegExp(`^${c}$`, 'i')) }
      }).sort({ createdAt: -1 });
    }
    res.json({ success: true, data: quotes });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PATCH /api/quotes/:id/status
// @desc    Update quote status
// @access  Private
router.patch('/:id/status', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'contacted', 'closed'].includes(status)) {
      return res.status(400).json({ error: { message: 'Invalid status', status: 400 } });
    }
    const quote = await QuoteRequest.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!quote) return res.status(404).json({ error: { message: 'Quote not found', status: 404 } });
    res.json({ success: true, data: quote });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;
