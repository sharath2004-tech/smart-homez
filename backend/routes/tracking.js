import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import WorkerTracking from '../models/WorkerTracking.js';

const router = express.Router();

router.post('/', authenticate, authorize('worker'), [
  body('booking').notEmpty(),
  body('currentLocation.coordinates').isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const tracking = new WorkerTracking({
      worker: req.user._id,
      ...req.body
    });
    await tracking.save();
    res.status(201).json({ tracking });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

router.put('/:id/location', authenticate, authorize('worker'), async (req, res) => {
  try {
    const tracking = await WorkerTracking.findById(req.params.id);
    if (!tracking) return res.status(404).json({ error: { message: 'Not found', status: 404 } });

    tracking.currentLocation = req.body.currentLocation;
    tracking.route.push({ coordinates: req.body.currentLocation.coordinates, timestamp: new Date() });
    await tracking.save();
    res.json({ tracking });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

router.get('/booking/:bookingId', authenticate, async (req, res) => {
  try {
    const tracking = await WorkerTracking.findOne({ booking: req.params.bookingId })
      .populate('worker', 'name phone');
    res.json({ tracking });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;
