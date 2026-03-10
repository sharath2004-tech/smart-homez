import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import WorkerSalaryRequest from '../models/WorkerSalaryRequest.js';

const router = express.Router();

// Default hourly rate if not set on worker profile
const DEFAULT_HOURLY_RATE = 90;

// ────────────────────────────────────────────────────────────────────────────
// WORKER routes
// ────────────────────────────────────────────────────────────────────────────

// @route   GET /api/salary-requests/my
// @desc    Worker: list own salary requests
// @access  Private/Worker
router.get('/my', authenticate, authorize('worker'), async (req, res) => {
  try {
    const requests = await WorkerSalaryRequest.find({ worker: req.user._id })
      .sort({ createdAt: -1 })
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .lean();

    res.json({ success: true, requests });
  } catch (error) {
    console.error('Get my salary requests error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/salary-requests/preview
// @desc    Worker: preview worked hours & amount for a date range before submitting
// @access  Private/Worker
router.get('/preview', authenticate, authorize('worker'), async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: { message: 'from and to dates are required', status: 400 } });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ error: { message: 'Invalid date format', status: 400 } });
    }

    if (fromDate > toDate) {
      return res.status(400).json({ error: { message: 'from date must be before to date', status: 400 } });
    }

    const bookings = await Booking.find({
      worker: req.user._id,
      status: 'completed',
      bookingDate: { $gte: fromDate, $lte: toDate }
    })
      .populate('service', 'name')
      .select('bookingDate startTime endTime actualStartTime actualEndTime actualDurationMinutes totalAmount service')
      .lean();

    let totalMinutes = 0;
    const tasks = bookings.map(b => {
      let mins = 0;
      if (b.actualDurationMinutes > 0) {
        mins = b.actualDurationMinutes;
      } else if (b.actualStartTime && b.actualEndTime) {
        mins = Math.floor((new Date(b.actualEndTime) - new Date(b.actualStartTime)) / 60000);
      }
      totalMinutes += mins;
      return {
        _id: b._id,
        date: b.bookingDate,
        startTime: b.startTime,
        endTime: b.endTime,
        serviceName: b.service?.name || 'Service',
        minutesWorked: mins
      };
    });

    const workerProfile = req.user.workerProfile || {};
    const hourlyRate = workerProfile.hourlyRate || DEFAULT_HOURLY_RATE;
    const requestedAmount = Math.round((totalMinutes / 60) * hourlyRate * 100) / 100;

    res.json({
      success: true,
      preview: {
        periodFrom: fromDate,
        periodTo: toDate,
        totalMinutesWorked: totalMinutes,
        totalTasksCompleted: bookings.length,
        hourlyRate,
        requestedAmount,
        tasks
      }
    });
  } catch (error) {
    console.error('Preview salary request error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/salary-requests
// @desc    Worker: submit a salary request for a date range
// @access  Private/Worker
router.post('/',
  authenticate,
  authorize('worker'),
  [
    body('periodFrom').isISO8601().withMessage('Valid periodFrom date required'),
    body('periodTo').isISO8601().withMessage('Valid periodTo date required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg, status: 400 } });
      }

      const { periodFrom, periodTo } = req.body;
      const fromDate = new Date(periodFrom);
      const toDate = new Date(periodTo);
      toDate.setHours(23, 59, 59, 999);

      if (fromDate > toDate) {
        return res.status(400).json({ error: { message: 'periodFrom must be before periodTo', status: 400 } });
      }

      // Prevent overlapping pending/approved requests
      const overlap = await WorkerSalaryRequest.findOne({
        worker: req.user._id,
        status: { $in: ['pending', 'approved'] },
        $or: [
          { periodFrom: { $lte: toDate }, periodTo: { $gte: fromDate } }
        ]
      });
      if (overlap) {
        return res.status(409).json({
          error: { message: 'A salary request already exists for an overlapping period', status: 409 }
        });
      }

      // Fetch completed bookings in the period for this worker
      const bookings = await Booking.find({
        worker: req.user._id,
        status: 'completed',
        bookingDate: { $gte: fromDate, $lte: toDate }
      }).select('_id actualDurationMinutes actualStartTime actualEndTime').lean();

      let totalMinutes = 0;
      for (const b of bookings) {
        if (b.actualDurationMinutes > 0) {
          totalMinutes += b.actualDurationMinutes;
        } else if (b.actualStartTime && b.actualEndTime) {
          totalMinutes += Math.floor((new Date(b.actualEndTime) - new Date(b.actualStartTime)) / 60000);
        }
      }

      const workerProfile = req.user.workerProfile || {};
      const hourlyRate = workerProfile.hourlyRate || DEFAULT_HOURLY_RATE;
      const requestedAmount = Math.round((totalMinutes / 60) * hourlyRate * 100) / 100;

      // Find the admin responsible for this worker's location
      let adminId = null;
      let locationId = null;
      if (workerProfile.assignedApartments && workerProfile.assignedApartments.length > 0) {
        locationId = workerProfile.assignedApartments[0].locationId || null;
        if (locationId) {
          // Find admin assigned to this location
          const admin = await User.findOne({
            role: 'admin',
            'adminProfile.assignedLocations.locationId': locationId
          }).select('_id').lean();
          if (admin) adminId = admin._id;
        }
      }

      const request = new WorkerSalaryRequest({
        worker: req.user._id,
        admin: adminId,
        location: locationId,
        periodFrom: fromDate,
        periodTo: toDate,
        totalMinutesWorked: totalMinutes,
        totalTasksCompleted: bookings.length,
        hourlyRate,
        requestedAmount,
        bookings: bookings.map(b => b._id)
      });

      await request.save();

      res.status(201).json({
        success: true,
        message: 'Salary request submitted successfully',
        request
      });
    } catch (error) {
      console.error('Submit salary request error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// ADMIN routes
// ────────────────────────────────────────────────────────────────────────────

// @route   GET /api/salary-requests/admin/worker-preview
// @desc    Admin: preview completed bookings for a worker in a date range
// @access  Private/Admin
router.get('/admin/worker-preview', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { workerId, from, to } = req.query;
    if (!workerId || !from || !to) {
      return res.status(400).json({ error: { message: 'workerId, from, and to are required', status: 400 } });
    }

    const worker = await User.findById(workerId).select('name email workerProfile').lean();
    if (!worker || worker.role === 'admin') {
      const found = await User.findById(workerId).select('name email role workerProfile').lean();
      if (!found) return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ error: { message: 'Invalid date format', status: 400 } });
    }

    const bookings = await Booking.find({
      worker: workerId,
      status: 'completed',
      bookingDate: { $gte: fromDate, $lte: toDate }
    })
      .populate('service', 'name')
      .select('bookingDate startTime endTime actualDurationMinutes actualStartTime actualEndTime service')
      .lean();

    let totalMinutes = 0;
    const tasks = bookings.map(b => {
      let mins = 0;
      if (b.actualDurationMinutes > 0) {
        mins = b.actualDurationMinutes;
      } else if (b.actualStartTime && b.actualEndTime) {
        mins = Math.floor((new Date(b.actualEndTime) - new Date(b.actualStartTime)) / 60000);
      }
      totalMinutes += mins;
      return {
        _id: b._id,
        date: b.bookingDate,
        startTime: b.startTime,
        endTime: b.endTime,
        serviceName: b.service?.name || 'Service',
        minutesWorked: mins
      };
    });

    const workerProfile = await User.findById(workerId).select('workerProfile').lean();
    const hourlyRate = (workerProfile?.workerProfile?.hourlyRate) || DEFAULT_HOURLY_RATE;
    const amount = Math.round((totalMinutes / 60) * hourlyRate * 100) / 100;

    res.json({
      success: true,
      preview: {
        periodFrom: fromDate,
        periodTo: toDate,
        totalMinutesWorked: totalMinutes,
        totalTasksCompleted: bookings.length,
        hourlyRate,
        requestedAmount: amount,
        tasks
      }
    });
  } catch (error) {
    console.error('Admin worker preview error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/salary-requests/admin/send
// @desc    Admin: directly send salary to a worker (creates a paid record)
// @access  Private/Admin
router.post('/admin/send',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    body('workerId').notEmpty().withMessage('Worker ID required'),
    body('periodFrom').isISO8601().withMessage('Valid periodFrom required'),
    body('periodTo').isISO8601().withMessage('Valid periodTo required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg, status: 400 } });
      }

      const { workerId, periodFrom, periodTo, notes } = req.body;

      const worker = await User.findById(workerId).select('name email workerProfile role').lean();
      if (!worker || worker.role !== 'worker') {
        return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
      }

      const fromDate = new Date(periodFrom);
      const toDate = new Date(periodTo);
      toDate.setHours(23, 59, 59, 999);

      if (fromDate > toDate) {
        return res.status(400).json({ error: { message: 'periodFrom must be before periodTo', status: 400 } });
      }

      const bookings = await Booking.find({
        worker: workerId,
        status: 'completed',
        bookingDate: { $gte: fromDate, $lte: toDate }
      }).select('_id actualDurationMinutes actualStartTime actualEndTime').lean();

      let totalMinutes = 0;
      for (const b of bookings) {
        if (b.actualDurationMinutes > 0) {
          totalMinutes += b.actualDurationMinutes;
        } else if (b.actualStartTime && b.actualEndTime) {
          totalMinutes += Math.floor((new Date(b.actualEndTime) - new Date(b.actualStartTime)) / 60000);
        }
      }

      const hourlyRate = worker.workerProfile?.hourlyRate || DEFAULT_HOURLY_RATE;
      const requestedAmount = Math.round((totalMinutes / 60) * hourlyRate * 100) / 100;

      const record = new WorkerSalaryRequest({
        worker: workerId,
        admin: req.user._id,
        periodFrom: fromDate,
        periodTo: toDate,
        totalMinutesWorked: totalMinutes,
        totalTasksCompleted: bookings.length,
        hourlyRate,
        requestedAmount,
        bookings: bookings.map(b => b._id),
        status: 'paid',
        approvedBy: req.user._id,
        approvedAt: new Date(),
        paidAt: new Date(),
        adminNotes: notes ? String(notes).slice(0, 500) : null
      });

      await record.save();
      await record.populate('worker', 'name email');

      res.status(201).json({
        success: true,
        message: `Salary of ₹${requestedAmount.toFixed(2)} sent to ${worker.name}`,
        request: record
      });
    } catch (error) {
      console.error('Admin send salary error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/salary-requests/admin
// @desc    Admin: list all worker salary requests for this admin's locations
// @access  Private/Admin
router.get('/admin', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { status } = req.query;

    let query = {};

    // Regular admin: only show requests for workers at their locations
    if (req.user.role === 'admin') {
      const locationIds = (req.user.adminProfile?.assignedLocations || []).map(l => l.locationId);
      // Find workers at these locations
      const workers = await User.find({
        role: 'worker',
        'workerProfile.assignedApartments.locationId': { $in: locationIds }
      }).select('_id').lean();
      const workerIds = workers.map(w => w._id);
      query.worker = { $in: workerIds };
    }

    if (status && ['pending', 'approved', 'rejected', 'paid'].includes(status)) {
      query.status = status;
    }

    const requests = await WorkerSalaryRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('worker', 'name email phone workerProfile')
      .populate('approvedBy', 'name')
      .populate('rejectedBy', 'name')
      .populate({
        path: 'bookings',
        select: 'bookingDate startTime endTime actualDurationMinutes actualStartTime actualEndTime service',
        populate: { path: 'service', select: 'name' }
      })
      .lean();

    res.json({ success: true, requests });
  } catch (error) {
    console.error('Get admin salary requests error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PATCH /api/salary-requests/:id/approve
// @desc    Admin: approve a salary request
// @access  Private/Admin
router.patch('/:id/approve', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const request = await WorkerSalaryRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: { message: 'Request not found', status: 404 } });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ error: { message: 'Only pending requests can be approved', status: 400 } });
    }

    const { notes } = req.body;
    request.status = 'approved';
    request.approvedAt = new Date();
    request.approvedBy = req.user._id;
    if (notes) request.adminNotes = String(notes).slice(0, 500);

    await request.save();
    await request.populate('worker', 'name email');

    res.json({ success: true, message: 'Salary request approved', request });
  } catch (error) {
    console.error('Approve salary request error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PATCH /api/salary-requests/:id/reject
// @desc    Admin: reject a salary request
// @access  Private/Admin
router.patch('/:id/reject',
  authenticate,
  authorize('admin', 'super_admin'),
  [body('reason').notEmpty().withMessage('Rejection reason is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg, status: 400 } });
      }

      const request = await WorkerSalaryRequest.findById(req.params.id);
      if (!request) {
        return res.status(404).json({ error: { message: 'Request not found', status: 404 } });
      }
      if (request.status !== 'pending') {
        return res.status(400).json({ error: { message: 'Only pending requests can be rejected', status: 400 } });
      }

      request.status = 'rejected';
      request.rejectedAt = new Date();
      request.rejectedBy = req.user._id;
      request.rejectionReason = String(req.body.reason).slice(0, 500);

      await request.save();
      await request.populate('worker', 'name email');

      res.json({ success: true, message: 'Salary request rejected', request });
    } catch (error) {
      console.error('Reject salary request error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   PATCH /api/salary-requests/:id/mark-paid
// @desc    Admin: mark an approved salary request as paid
// @access  Private/Admin
router.patch('/:id/mark-paid', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const request = await WorkerSalaryRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: { message: 'Request not found', status: 404 } });
    }
    if (request.status !== 'approved') {
      return res.status(400).json({ error: { message: 'Only approved requests can be marked as paid', status: 400 } });
    }

    const { notes } = req.body;
    request.status = 'paid';
    request.paidAt = new Date();
    if (notes) request.adminNotes = String(notes).slice(0, 500);

    await request.save();
    await request.populate('worker', 'name email');

    res.json({ success: true, message: 'Salary marked as paid', request });
  } catch (error) {
    console.error('Mark paid salary request error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;
