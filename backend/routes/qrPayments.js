import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import Booking from '../models/Booking.js';
import QRPayment from '../models/QRPayment.js';
import Location from '../models/Location.js';
import Settings from '../models/Settings.js';

const router = express.Router();

// @route   POST /api/qr-payments/generate
// @desc    Generate QR code for payment
// @access  Private/Customer/Worker
router.post('/generate',
  authenticate,
  authorize('customer', 'worker', 'admin'),
  [
    body('bookingId').notEmpty().withMessage('Booking ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { bookingId } = req.body;

      // Verify booking exists and belongs to customer or worker
      const booking = await Booking.findById(bookingId)
        .populate('worker', 'name email')
        .populate('service', 'name price');
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      // Allow access for customer, assigned worker, or admin
      const isCustomer = booking.customer.toString() === req.user._id.toString();
      const isWorker = booking.worker && booking.worker._id.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';
      
      if (!isCustomer && !isWorker && !isAdmin) {
        return res.status(403).json({ 
          error: { message: 'Forbidden', status: 403 } 
        });
      }

      // Check if QR payment already exists
      let qrPayment = await QRPayment.findOne({ booking: bookingId });
      
      // Get payment details: Try location-specific first, then fallback to global settings
      let upiId, upiName, qrCodeImage;
      let paymentSource = 'global';
      
      // Try to get location-specific payment QR
      if (booking.location?.locationId) {
        const location = await Location.findById(booking.location.locationId);
        
        if (location?.paymentQR?.isActive && location.paymentQR?.upiId) {
          // Use location-specific QR
          upiId = location.paymentQR.upiId;
          upiName = location.paymentQR.upiName;
          qrCodeImage = location.paymentQR.qrCodeImage;
          paymentSource = 'location';
          console.log(`✅ Using location-specific QR for ${location.apartmentName}`);
        }
      }
      
      // Fallback to global settings if no location QR
      if (!upiId) {
        const settings = await Settings.getSettings();
        upiId = settings.payment?.upiId || 'healthyhomez@upi';
        upiName = settings.payment?.upiName || 'Healthy Homez';
        qrCodeImage = settings.payment?.qrCodeImage;
        console.log('ℹ️ Using global payment settings (no location QR configured)');
      }
      
      if (qrPayment) {
        // Update existing QR payment
        qrPayment.amount = booking.totalAmount;
        qrPayment.upiId = upiId;
        qrPayment.qrCodeImageUrl = qrCodeImage;
        qrPayment.qrCodeData = qrPayment.generateQRData();
        await qrPayment.save();
      } else {
        // Create new QR payment
        qrPayment = new QRPayment({
          booking: bookingId,
          customer: booking.customer,
          worker: booking.worker,
          amount: booking.totalAmount,
          upiId: upiId,
          qrCodeImageUrl: qrCodeImage
        });
        
        qrPayment.qrCodeData = qrPayment.generateQRData();
        await qrPayment.save();

        // Update booking
        booking.qrPayment = qrPayment._id;
        booking.paymentStatus = 'qr-generated';
        await booking.save();
      }

      const populatedPayment = await QRPayment.findById(qrPayment._id)
        .populate('customer', 'name email phone')
        .populate('worker', 'name email phone')
        .populate('booking');

      res.status(201).json({ 
        message: 'QR code generated successfully', 
        qrPayment: populatedPayment,
        paymentDetails: {
          upiId,
          upiName,
          qrCodeImage,
          source: paymentSource,
          locationName: booking.location?.apartmentName
        }
      });

    } catch (error) {
      console.error('Generate QR payment error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/qr-payments/:id/worker-confirm
// @desc    Worker confirms payment by uploading transaction screenshot
// @access  Private/Worker
router.post('/:id/worker-confirm',
  authenticate,
  authorize('worker', 'admin'),
  [
    body('transactionId').notEmpty().withMessage('Transaction ID is required'),
    body('transactionScreenshot').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { transactionId, transactionScreenshot, workerNotes, paymentMethod } = req.body;

      const qrPayment = await QRPayment.findById(req.params.id)
        .populate('booking')
        .populate('worker', 'name');
      
      if (!qrPayment) {
        return res.status(404).json({ 
          error: { message: 'QR Payment not found', status: 404 } 
        });
      }

      // Check if worker is assigned to this booking
      if (qrPayment.worker.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: { message: 'Forbidden: You are not assigned to this booking', status: 403 } 
        });
      }

      // Check if already confirmed
      if (qrPayment.status === 'worker-confirmed' || qrPayment.status === 'completed') {
        return res.status(400).json({ 
          error: { message: 'Payment already confirmed', status: 400 } 
        });
      }

      // Update QR payment
      qrPayment.transactionId = transactionId;
      qrPayment.transactionScreenshot = transactionScreenshot || null;
      qrPayment.workerNotes = workerNotes || '';
      qrPayment.paymentMethod = paymentMethod || 'upi';
      qrPayment.status = 'worker-confirmed';
      qrPayment.workerConfirmedAt = new Date();
      qrPayment.workerConfirmedBy = req.user._id;

      await qrPayment.save();

      // Update booking payment status
      const booking = await Booking.findById(qrPayment.booking);
      if (booking) {
        booking.paymentStatus = 'worker-confirmed';
        booking.paymentMethod = paymentMethod || 'qr-upi';
        await booking.save();
      }

      const updatedPayment = await QRPayment.findById(qrPayment._id)
        .populate('customer', 'name email phone')
        .populate('worker', 'name email phone')
        .populate('booking');

      res.json({ 
        message: 'Payment confirmed by worker successfully', 
        qrPayment: updatedPayment 
      });

    } catch (error) {
      console.error('Worker confirm payment error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/qr-payments/:id/admin-verify
// @desc    Admin verifies and approves payment
// @access  Private/Admin
router.post('/:id/admin-verify',
  authenticate,
  authorize('admin'),
  [
    body('approved').isBoolean().withMessage('Approved status is required'),
    body('adminNotes').optional().isString(),
    body('rejectionReason').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { approved, adminNotes, rejectionReason } = req.body;

      const qrPayment = await QRPayment.findById(req.params.id).populate('booking');
      
      if (!qrPayment) {
        return res.status(404).json({ 
          error: { message: 'QR Payment not found', status: 404 } 
        });
      }

      if (qrPayment.status !== 'worker-confirmed') {
        return res.status(400).json({ 
          error: { message: 'Payment must be worker-confirmed first', status: 400 } 
        });
      }

      // Update QR payment
      qrPayment.status = approved ? 'completed' : 'rejected';
      qrPayment.adminNotes = adminNotes || '';
      qrPayment.rejectionReason = approved ? null : rejectionReason;
      qrPayment.adminVerifiedAt = new Date();
      qrPayment.adminVerifiedBy = req.user._id;

      await qrPayment.save();

      // Update booking payment status
      const booking = await Booking.findById(qrPayment.booking);
      if (booking) {
        booking.paymentStatus = approved ? 'paid' : 'failed';
        await booking.save();
      }

      const updatedPayment = await QRPayment.findById(qrPayment._id)
        .populate('customer', 'name email phone')
        .populate('worker', 'name email phone')
        .populate('booking');

      res.json({ 
        message: approved ? 'Payment verified successfully' : 'Payment rejected', 
        qrPayment: updatedPayment 
      });

    } catch (error) {
      console.error('Admin verify payment error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/qr-payments
// @desc    Get QR payments (filtered by user role)
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    let query = {};
    
    // Filter based on user role
    if (req.user.role === 'customer') {
      query.customer = req.user._id;
    } else if (req.user.role === 'worker') {
      query.worker = req.user._id;
    }
    // Admin can see all payments (no filter applied)

    if (status) query.status = status;

    const qrPayments = await QRPayment.find(query)
      .populate('customer', 'name email phone')
      .populate('worker', 'name email phone')
      .populate({
        path: 'booking',
        populate: { path: 'service', select: 'name' }
      })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await QRPayment.countDocuments(query);

    res.json({
      qrPayments,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalPayments: count
    });

  } catch (error) {
    console.error('Get QR payments error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/qr-payments/:id
// @desc    Get QR payment by ID
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    const qrPayment = await QRPayment.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('worker', 'name email phone')
      .populate({
        path: 'booking',
        populate: [
          { path: 'service', select: 'name price' },
          { path: 'customer', select: 'name email phone' }
        ]
      });
    
    if (!qrPayment) {
      return res.status(404).json({ 
        error: { message: 'QR Payment not found', status: 404 } 
      });
    }

    // Check access permissions
    const isAuthorized = 
      req.user.role === 'admin' ||
      qrPayment.customer._id.toString() === req.user._id.toString() ||
      qrPayment.worker._id.toString() === req.user._id.toString();

    if (!isAuthorized) {
      return res.status(403).json({ 
        error: { message: 'Forbidden', status: 403 } 
      });
    }

    res.json({ qrPayment });

  } catch (error) {
    console.error('Get QR payment error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/qr-payments/pending/worker-action
// @desc    Get pending QR payments for worker to confirm
// @access  Private/Worker
router.get('/pending/worker-action', authenticate, authorize('worker'), async (req, res) => {
  try {
    const qrPayments = await QRPayment.find({
      worker: req.user._id,
      status: 'pending'
    })
      .populate('customer', 'name email phone')
      .populate({
        path: 'booking',
        populate: { path: 'service', select: 'name price' }
      })
      .sort({ createdAt: -1 });

    res.json({ 
      qrPayments,
      count: qrPayments.length 
    });

  } catch (error) {
    console.error('Get pending QR payments error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;
