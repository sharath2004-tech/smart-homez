import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import Review from '../models/Review.js';
import User from '../models/User.js';

const router = express.Router();

router.post('/', authenticate, [
  body('booking').notEmpty(),
  body('worker').notEmpty(),
  body('overallRating').isInt({ min: 1, max: 5 }),
  body('categoryRatings.quality').isInt({ min: 1, max: 5 }),
  body('categoryRatings.timeliness').isInt({ min: 1, max: 5 }),
  body('categoryRatings.professionalism').isInt({ min: 1, max: 5 }),
  body('comment').optional().isLength({ max: 500 }).withMessage('Comment max 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    // Verify worker exists BEFORE creating review
    const worker = await User.findById(req.body.worker);
    if (!worker) {
      return res.status(404).json({ 
        error: { message: 'Worker not found', status: 404 } 
      });
    }

    const review = new Review({
      ...req.body,
      customer: req.user._id
    });
    await review.save();

    // Safe rating aggregation with null checks
    const currentRating = worker.workerProfile?.rating || 0;
    const currentReviews = worker.workerProfile?.totalReviews || 0;
    const currentTotal = currentRating * currentReviews;
    const newTotal = currentTotal + req.body.overallRating;
    const newCount = currentReviews + 1;
    
    // Initialize workerProfile if doesn't exist
    if (!worker.workerProfile) {
      worker.workerProfile = {};
    }
    
    worker.workerProfile.totalReviews = newCount;
    worker.workerProfile.rating = newTotal / newCount;
    
    await worker.save();

    res.status(201).json({ review });
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

export default router;
