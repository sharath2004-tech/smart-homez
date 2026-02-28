import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import SOSAlert from '../models/SOSAlert.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

const router = express.Router();

router.post('/', authenticate, [
  body('location.coordinates').isArray(),
  body('userType').isIn(['customer', 'worker'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const alert = new SOSAlert({
      triggeredBy: req.user._id,
      ...req.body
    });
    await alert.save();

    const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } });
    for (const admin of admins) {
      await Notification.create({
        recipient: admin._id,
        type: 'sos',
        title: 'SOS Alert',
        message: `Emergency alert from ${req.user.name}`,
        priority: 'high',
        data: { alertId: alert._id }
      });
    }

    res.status(201).json({ alert });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const alerts = await SOSAlert.find({ status: 'active' })
      .populate('triggeredBy', 'name phone')
      .sort({ createdAt: -1 });
    res.json({ alerts });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

router.patch('/:id/resolve', authenticate, async (req, res) => {
  try {
    const alert = await SOSAlert.findById(req.params.id);
    if (!alert) return res.status(404).json({ error: { message: 'Not found', status: 404 } });

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.respondedBy.push({ admin: req.user._id, respondedAt: new Date(), action: req.body.action });
    await alert.save();
    res.json({ alert });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;
