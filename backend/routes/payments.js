import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';

const router = express.Router();

// @route   GET /api/payments
// @desc    Get payments (filtered by user role)
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    let query = {};
    
    // Filter based on user role
    if (req.user.role === 'customer') {
      query.customer = req.user._id;
    } else if (req.user.role === 'worker') {
      // Find bookings for this worker and get their payment IDs
      const bookings = await Booking.find({ worker: req.user._id }).select('_id');
      const bookingIds = bookings.map(b => b._id);
      query.booking = { $in: bookingIds };
    }
    // Admin can see all payments (no filter applied)

    if (status) query.status = status;

    const payments = await Payment.find(query)
      .populate('customer', 'name email')
      .populate({
        path: 'booking',
        populate: [
          { path: 'service', select: 'name' },
          { path: 'worker', select: 'name' }
        ]
      })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ paymentDate: -1 });

    const count = await Payment.countDocuments(query);

    res.json({
      payments,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalPayments: count
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/payments/:id
// @desc    Get payment by ID
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('customer', 'name email')
      .populate({
        path: 'booking',
        populate: [
          { path: 'service', select: 'name price' },
          { path: 'worker', select: 'name email' },
          { path: 'customer', select: 'name email' }
        ]
      });
    
    if (!payment) {
      return res.status(404).json({ 
        error: { message: 'Payment not found', status: 404 } 
      });
    }

    // Check access permissions
    const isAuthorized = 
      req.user.role === 'admin' ||
      payment.customer._id.toString() === req.user._id.toString() ||
      (payment.booking && payment.booking.worker._id.toString() === req.user._id.toString());

    if (!isAuthorized) {
      return res.status(403).json({ 
        error: { message: 'Forbidden', status: 403 } 
      });
    }

    res.json({ payment });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/payments
// @desc    Create a new payment
// @access  Private/Customer
router.post('/',
  authenticate,
  authorize('customer', 'admin'),
  [
    body('booking').notEmpty().withMessage('Booking ID is required'),
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('paymentMethod').isIn(['card', 'cash', 'bank_transfer', 'wallet'])
      .withMessage('Invalid payment method')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { booking, amount, paymentMethod, transactionId } = req.body;

      // Verify booking exists and belongs to customer
      const bookingDoc = await Booking.findById(booking);
      if (!bookingDoc) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      if (bookingDoc.customer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: { message: 'Forbidden', status: 403 } 
        });
      }

      const payment = new Payment({
        booking,
        customer: req.user._id,
        amount,
        paymentMethod,
        transactionId,
        status: 'completed' // In real app, this would be 'pending' until payment gateway confirms
      });

      await payment.save();

      // Update booking payment status
      bookingDoc.paymentStatus = 'paid';
      await bookingDoc.save();

      const populatedPayment = await Payment.findById(payment._id)
        .populate('customer', 'name email')
        .populate('booking');

      res.status(201).json({ 
        message: 'Payment processed successfully', 
        payment: populatedPayment 
      });
    } catch (error) {
      console.error('Create payment error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   PUT /api/payments/:id/refund
// @desc    Refund a payment
// @access  Private/Admin
router.put('/:id/refund', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { refundAmount } = req.body;

    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({ 
        error: { message: 'Payment not found', status: 404 } 
      });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({ 
        error: { message: 'Only completed payments can be refunded', status: 400 } 
      });
    }

    payment.status = 'refunded';
    payment.refundAmount = refundAmount || payment.amount;
    payment.refundDate = new Date();
    await payment.save();

    // Update booking payment status
    const booking = await Booking.findById(payment.booking);
    if (booking) {
      booking.paymentStatus = 'refunded';
      await booking.save();
    }

    res.json({ message: 'Payment refunded successfully', payment });
  } catch (error) {
    console.error('Refund payment error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/payments/stats/summary
// @desc    Get payment statistics (admin) or user earnings (worker)
// @access  Private
router.get('/stats/summary', authenticate, async (req, res) => {
  try {
    let query = { status: 'completed' };

    if (req.user.role === 'worker') {
      // Get worker's earnings
      const bookings = await Booking.find({ worker: req.user._id }).select('_id');
      const bookingIds = bookings.map(b => b._id);
      query.booking = { $in: bookingIds };
    } else if (req.user.role === 'customer') {
      query.customer = req.user._id;
    }

    const payments = await Payment.find(query);

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalRefunded = payments
      .filter(p => p.status === 'refunded')
      .reduce((sum, p) => sum + p.refundAmount, 0);

    res.json({
      totalPayments: payments.length,
      totalAmount,
      totalRefunded,
      netAmount: totalAmount - totalRefunded
    });
  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;
