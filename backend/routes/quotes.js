import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import Notification from '../models/Notification.js';
import QuoteRequest from '../models/QuoteRequest.js';
import User from '../models/User.js';

const router = express.Router();

// @route   POST /api/quotes
// @desc    Submit a commercial deep cleaning quote request (public)
// @access  Public
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, propertyType, message } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: { message: 'Name is required', status: 400 } });
    if (!phone?.trim()) return res.status(400).json({ error: { message: 'Phone number is required', status: 400 } });
    if (!propertyType) return res.status(400).json({ error: { message: 'Property type is required', status: 400 } });

    const quote = new QuoteRequest({ name: name.trim(), phone: phone.trim(), email: email?.trim() || null, propertyType, message: message?.trim() || '' });
    await quote.save();

    // Notify all super admins and admins
    try {
      const admins = await User.find({ role: { $in: ['admin', 'super_admin'] }, isActive: true }).select('_id');
      if (admins.length > 0) {
        const propertyLabels = { villa: 'Villa', bungalow: 'Bungalow', restaurant: 'Restaurant', corporate_office: 'Corporate Office', other: 'Other' };
        const notifications = admins.map(admin => ({
          recipient: admin._id,
          title: 'New Quote Request',
          message: `${name} (${phone}) wants a deep cleaning quote for a ${propertyLabels[propertyType] || propertyType}.`,
          type: 'general',
          data: { quoteId: quote._id }
        }));
        await Notification.insertMany(notifications);
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

// @route   GET /api/quotes
// @desc    Get all quote requests (admin/super_admin only)
// @access  Private
router.get('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const quotes = await QuoteRequest.find().sort({ createdAt: -1 });
    res.json({ success: true, data: quotes });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PATCH /api/quotes/:id/status
// @desc    Update quote status (admin/super_admin only)
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
