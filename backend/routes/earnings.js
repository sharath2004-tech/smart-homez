import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import Settings from '../models/Settings.js';
import User from '../models/User.js';
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

// @route   GET /api/earnings/payout-balance
// @desc    Get worker's pending payout balance
// @access  Private/Worker
router.get('/payout-balance', authenticate, authorize('worker'), async (req, res) => {
  try {
    const pendingEarnings = await WorkerEarnings.find({
      worker: req.user._id,
      payoutStatus: 'pending'
    });

    const processingEarnings = await WorkerEarnings.find({
      worker: req.user._id,
      payoutStatus: 'processing'
    });

    const completedEarnings = await WorkerEarnings.find({
      worker: req.user._id,
      payoutStatus: 'completed'
    });

    const pendingBalance = pendingEarnings.reduce((sum, e) => sum + e.netEarning, 0);
    const processingBalance = processingEarnings.reduce((sum, e) => sum + e.netEarning, 0);
    const totalPaidOut = completedEarnings.reduce((sum, e) => sum + e.netEarning, 0);

    const settings = await Settings.getSettings();
    const minPayoutAmount = settings.earnings?.minPayoutAmount || 500;

    res.json({
      pendingBalance,
      processingBalance,
      totalPaidOut,
      minPayoutAmount,
      canRequestPayout: pendingBalance >= minPayoutAmount,
      pendingCount: pendingEarnings.length,
      processingCount: processingEarnings.length
    });
  } catch (error) {
    console.error('Get payout balance error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/earnings/request-payout
// @desc    Request payout for pending earnings
// @access  Private/Worker
router.post('/request-payout', authenticate, authorize('worker'), async (req, res) => {
  try {
    const { payoutMethod = 'upi', payoutDetails } = req.body;

    // Get settings
    const settings = await Settings.getSettings();
    const minPayoutAmount = settings.earnings?.minPayoutAmount || 500;

    // Get pending earnings
    const pendingEarnings = await WorkerEarnings.find({
      worker: req.user._id,
      payoutStatus: 'pending'
    });

    const totalPending = pendingEarnings.reduce((sum, e) => sum + e.netEarning, 0);

    if (totalPending < minPayoutAmount) {
      return res.status(400).json({
        error: {
          message: `Minimum payout amount is ₹${minPayoutAmount}. Your current balance: ₹${totalPending.toFixed(2)}`,
          status: 400
        }
      });
    }

    if (pendingEarnings.length === 0) {
      return res.status(400).json({
        error: {
          message: 'No pending earnings to payout',
          status: 400
        }
      });
    }

    // Get worker bank details
    const worker = await User.findById(req.user._id);
    const bankDetails = payoutDetails || worker.workerProfile?.bankDetails;

    if (!bankDetails && payoutMethod === 'bank') {
      return res.status(400).json({
        error: {
          message: 'Please provide bank details for payout',
          status: 400
        }
      });
    }

    // Update all pending to processing
    const earningIds = pendingEarnings.map(e => e._id);
    await WorkerEarnings.updateMany(
      { _id: { $in: earningIds } },
      {
        payoutStatus: 'processing',
        payoutMethod: payoutMethod,
        payoutDetails: bankDetails,
        payoutDate: new Date()
      }
    );

    res.json({
      message: 'Payout request submitted successfully',
      amount: totalPending.toFixed(2),
      earningsCount: pendingEarnings.length,
      payoutMethod,
      estimatedProcessingDays: settings.earnings?.payoutSchedule === 'instant' ? 0 : 3
    });

  } catch (error) {
    console.error('Request payout error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/earnings/payout-history
// @desc    Get payout history
// @access  Private/Worker
router.get('/payout-history', authenticate, authorize('worker'), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const payouts = await WorkerEarnings.find({
      worker: req.user._id,
      payoutStatus: { $in: ['processing', 'completed', 'failed'] }
    })
      .populate('booking', 'bookingDate service')
      .sort({ payoutDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await WorkerEarnings.countDocuments({
      worker: req.user._id,
      payoutStatus: { $in: ['processing', 'completed', 'failed'] }
    });

    res.json({
      payouts,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalPayouts: count
    });
  } catch (error) {
    console.error('Get payout history error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;
