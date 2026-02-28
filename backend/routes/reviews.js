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
  body('categoryRatings.professionalism').isInt({ min: 1, max: 5 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const review = new Review({
      ...req.body,
      customer: req.user._id
    });
    await review.save();

    const worker = await User.findById(req.body.worker);
    const totalRating = worker.workerProfile.rating * worker.workerProfile.totalReviews + req.body.overallRating;
    worker.workerProfile.totalReviews += 1;
    worker.workerProfile.rating = totalRating / worker.workerProfile.totalReviews;
    await worker.save();

    res.status(201).json({ review });
  } catch (error) {
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
