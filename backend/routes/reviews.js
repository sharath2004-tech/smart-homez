import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import User from '../models/User.js';
import reviewAnalytics from '../utils/reviewAnalytics.js';

const router = express.Router();

router.post('/', authenticate, [
  body('booking').isMongoId().withMessage('Valid booking is required'),
  body('worker').optional().isMongoId().withMessage('Valid worker is required'),
  body('workerIds').optional().isArray({ min: 1 }).withMessage('workerIds must be a non-empty array'),
  body('workerIds.*').optional().isMongoId().withMessage('Each workerId must be valid'),
  body('overallRating').isInt({ min: 1, max: 5 }),
  body('categoryRatings.quality').isInt({ min: 1, max: 5 }),
  body('categoryRatings.timeliness').isInt({ min: 1, max: 5 }),
  body('categoryRatings.professionalism').isInt({ min: 1, max: 5 }),
  body('comment').optional().isLength({ max: 500 }).withMessage('Comment max 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    if (req.user.role !== 'customer') {
      return res.status(403).json({
        error: { message: 'Only customers can submit reviews', status: 403 }
      });
    }

    const booking = await Booking.findById(req.body.booking)
      .select('customer worker supportStaff status');

    if (!booking) {
      return res.status(404).json({
        error: { message: 'Booking not found', status: 404 }
      });
    }

    if (booking.customer?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: { message: 'You can only review your own bookings', status: 403 }
      });
    }

    if (!['completed', 'pending-review'].includes(booking.status)) {
      return res.status(400).json({
        error: { message: 'Reviews can only be submitted after service completion', status: 400 }
      });
    }

    const alreadyReviewed = await Review.findOne({
      booking: booking._id,
      customer: req.user._id
    }).lean();

    if (alreadyReviewed) {
      return res.status(400).json({
        error: { message: 'Review already submitted for this booking', status: 400 }
      });
    }

    const assignedWorkerIds = [
      booking.worker?.toString(),
      ...(booking.supportStaff || []).map(member => member.worker?.toString())
    ].filter(Boolean);

    const requestedWorkerIds = [
      ...(Array.isArray(req.body.workerIds) ? req.body.workerIds : []),
      ...(req.body.worker ? [req.body.worker] : [])
    ].filter(Boolean);

    const reviewWorkerIds = requestedWorkerIds.length > 0
      ? [...new Set(requestedWorkerIds)]
      : [...new Set(assignedWorkerIds)];

    if (reviewWorkerIds.length === 0) {
      return res.status(400).json({
        error: { message: 'No assigned workers found for this booking', status: 400 }
      });
    }

    const hasInvalidWorker = reviewWorkerIds.some(workerId => !assignedWorkerIds.includes(workerId));
    if (hasInvalidWorker) {
      return res.status(400).json({
        error: { message: 'Reviews can only be submitted for workers assigned to this booking', status: 400 }
      });
    }

    const workers = await User.find({
      _id: { $in: reviewWorkerIds },
      role: 'worker'
    });

    if (workers.length !== reviewWorkerIds.length) {
      return res.status(404).json({
        error: { message: 'One or more assigned workers were not found', status: 404 }
      });
    }

    const baseReview = {
      booking: booking._id,
      customer: req.user._id,
      overallRating: req.body.overallRating,
      categoryRatings: req.body.categoryRatings,
      comment: req.body.comment,
      isAnonymous: req.body.isAnonymous
    };

    const reviews = await Review.insertMany(
      reviewWorkerIds.map(workerId => ({
        ...baseReview,
        worker: workerId
      }))
    );

    for (const worker of workers) {
      const currentRating = worker.workerProfile?.rating || 0;
      const currentReviews = worker.workerProfile?.totalReviews || 0;
      const currentTotal = currentRating * currentReviews;
      const newTotal = currentTotal + req.body.overallRating;
      const newCount = currentReviews + 1;

      if (!worker.workerProfile) {
        worker.workerProfile = {};
      }

      worker.workerProfile.totalReviews = newCount;
      worker.workerProfile.rating = newTotal / newCount;

      await worker.save();
    }

    res.status(201).json({
      reviews,
      workerIds: reviewWorkerIds,
      reviewCount: reviews.length
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

router.get('/worker/:workerId', async (req, res) => {
  try {
    const reviews = await Review.find({ worker: req.params.workerId })
      .populate('customer', 'name')
      .sort({ createdAt: -1 });
    res.json({ reviews });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// Analytics endpoints
router.get('/worker/:workerId/analytics', authenticate, async (req, res) => {
  try {
    const { workerId } = req.params;

    // Verify worker exists
    const worker = await User.findById(workerId).select('role');
    if (!worker || worker.role !== 'worker') {
      return res.status(404).json({
        error: { message: 'Worker not found', status: 404 }
      });
    }

    const analytics = await reviewAnalytics.getWorkerCompleteAnalytics(workerId);
    res.json({ analytics });
  } catch (error) {
    console.error('Error getting worker analytics:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

router.get('/worker/:workerId/trends', authenticate, async (req, res) => {
  try {
    const { workerId } = req.params;

    // Verify worker exists
    const worker = await User.findById(workerId).select('role');
    if (!worker || worker.role !== 'worker') {
      return res.status(404).json({
        error: { message: 'Worker not found', status: 404 }
      });
    }

    const trends = await reviewAnalytics.getWorkerRatingTrends(workerId);
    res.json({ trends });
  } catch (error) {
    console.error('Error getting rating trends:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

/**
 * GET /api/reviews/public
 * Returns recent high-rating reviews with comments for the landing page.
 * No authentication required.
 */
router.get('/public', async (req, res) => {
  try {
    const reviews = await Review.find({
      overallRating: { $gte: 4 },
      comment: { $exists: true, $ne: '' }
    })
      .sort({ createdAt: -1 })
      .limit(12)
      .populate('customer', 'name isAnonymous')
      .lean();

    const publicReviews = reviews.map(r => ({
      _id: r._id,
      overallRating: r.overallRating,
      comment: r.comment,
      createdAt: r.createdAt,
      customerName: r.isAnonymous ? 'Anonymous' : (r.customer?.name || 'Customer'),
      avatar: r.isAnonymous ? 'AN' : ((r.customer?.name || 'CU').slice(0, 2).toUpperCase())
    }));

    res.json({ success: true, reviews: publicReviews });
  } catch (error) {
    console.error('Public reviews error:', error);
    res.status(500).json({ success: false, reviews: [] });
  }
});

router.get('/analytics/dashboard', authenticate, async (req, res) => {
  try {
    // Only allow admin/super_admin access
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: { message: 'Access denied', status: 403 }
      });
    }

    const adminId = req.user.role === 'admin' ? req.user._id : null;
    const dashboardData = await reviewAnalytics.getAdminDashboardRatings(adminId);

    res.json({ dashboard: dashboardData });
  } catch (error) {
    console.error('Error getting dashboard analytics:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;
