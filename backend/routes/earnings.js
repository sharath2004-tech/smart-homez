import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import WorkerEarnings from '../models/WorkerEarnings.js';

const router = express.Router();

router.get('/', authenticate, authorize('worker'), async (req, res) => {
  try {
    const { period = 'daily', startDate, endDate } = req.query;
    const query = { worker: req.user._id };

    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const earnings = await WorkerEarnings.find(query)
      .populate('booking', 'service bookingDate')
      .sort({ date: -1 });

    const total = earnings.reduce((sum, e) => sum + e.netEarning, 0);
    res.json({ earnings, total, period });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

router.get('/summary', authenticate, authorize('worker'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const [daily, weekly, monthly] = await Promise.all([
      WorkerEarnings.aggregate([
        { $match: { worker: req.user._id, date: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$netEarning' } } }
      ]),
      WorkerEarnings.aggregate([
        { $match: { worker: req.user._id, date: { $gte: weekAgo } } },
        { $group: { _id: null, total: { $sum: '$netEarning' } } }
      ]),
      WorkerEarnings.aggregate([
        { $match: { worker: req.user._id, date: { $gte: monthAgo } } },
        { $group: { _id: null, total: { $sum: '$netEarning' } } }
      ])
    ]);

    res.json({
      daily: daily[0]?.total || 0,
      weekly: weekly[0]?.total || 0,
      monthly: monthly[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;
