import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import Subscription from '../models/Subscription.js';
import Booking from '../models/Booking.js';

const router = express.Router();

router.post('/', authenticate, authorize('customer'), [
  body('service').notEmpty(),
  body('plan').isIn(['daily', 'weekly', 'bi-weekly', 'monthly']),
  body('startDate').isISO8601(),
  body('preferredTimeSlots').isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const subscription = new Subscription({
      ...req.body,
      customer: req.user._id
    });
    await subscription.save();
    res.status(201).json({ subscription });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const query = req.user.role === 'customer' ? { customer: req.user._id } : {};
    const subscriptions = await Subscription.find(query)
      .populate('service', 'name price')
      .populate('customer', 'name email');
    res.json({ subscriptions });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

router.patch('/:id/pause', authenticate, async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) return res.status(404).json({ error: { message: 'Not found', status: 404 } });
    
    subscription.status = 'paused';
    subscription.pauseHistory.push({ pausedAt: new Date(), reason: req.body.reason });
    await subscription.save();
    res.json({ subscription });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

router.patch('/:id/resume', authenticate, async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) return res.status(404).json({ error: { message: 'Not found', status: 404 } });
    
    subscription.status = 'active';
    const lastPause = subscription.pauseHistory[subscription.pauseHistory.length - 1];
    if (lastPause) lastPause.resumedAt = new Date();
    await subscription.save();
    res.json({ subscription });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;
