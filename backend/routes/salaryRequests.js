import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import WorkerSalaryRequest from '../models/WorkerSalaryRequest.js';

const router = express.Router();

// Default hourly rate if not set on worker profile
const DEFAULT_HOURLY_RATE = 90;

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function calculateBookingMinutes(booking) {
  if (!booking) return 0;
  if (booking.actualDurationMinutes > 0) {
    return booking.actualDurationMinutes;
  }
  if (booking.actualStartTime && booking.actualEndTime) {
    return Math.max(0, Math.floor((new Date(booking.actualEndTime) - new Date(booking.actualStartTime)) / 60000));
  }
  return 0;
}

async function getLeavePenaltySummary(workerId, fromDate, toDate) {
  const worker = await User.findById(workerId).select('workerProfile.leaves').lean();
  const leaves = worker?.workerProfile?.leaves || [];

  const penaltyBreakdown = leaves
    .filter((leave) => {
      if (!leave?.penaltyApplied || !leave?.penaltyAmount || leave.status === 'rejected' || !leave.date) {
        return false;
      }

      const leaveDate = new Date(leave.date);
      return leaveDate >= fromDate && leaveDate <= toDate;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((leave) => ({
      leaveDate: leave.date,
      requestedAt: leave.requestedAt || null,
      reason: leave.reason || '',
      amount: leave.penaltyAmount || 0,
      leaveStatus: leave.status || 'pending'
    }));

  const totalPenaltyAmount = penaltyBreakdown.reduce((sum, penalty) => sum + (penalty.amount || 0), 0);

  return {
    penaltyBreakdown,
    totalPenaltyAmount
  };
}

function calculateNetAmount(grossAmount, totalPenaltyAmount, applyPenaltyDeduction) {
  if (!applyPenaltyDeduction) {
    return grossAmount;
  }

  return Math.max(0, Number((grossAmount - totalPenaltyAmount).toFixed(2)));
}

function deriveLocationIdFromBookings(bookings = []) {
  const uniqueLocationIds = [
    ...new Set(
      bookings
        .map((booking) => booking.location?.locationId?.toString())
        .filter(Boolean)
    )
  ];

  return uniqueLocationIds.length === 1 ? uniqueLocationIds[0] : null;
}

function getWorkMetrics(bookings = []) {
  let totalMinutes = 0;
  const workedDays = new Set();
  const workedMonths = new Set();

  for (const booking of bookings) {
    const minutesWorked = calculateBookingMinutes(booking);
    totalMinutes += minutesWorked;

    const referenceDate = booking.bookingDate || booking.completedAt || booking.actualEndTime || booking.actualStartTime;
    if (!referenceDate) continue;

    const parsedDate = new Date(referenceDate);
    if (Number.isNaN(parsedDate.getTime())) continue;

    const dayKey = parsedDate.toISOString().slice(0, 10);
    const monthKey = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}`;
    workedDays.add(dayKey);
    workedMonths.add(monthKey);
  }

  return {
    totalMinutes,
    workedDays: workedDays.size,
    workedMonths: workedMonths.size
  };
}

function getCompensationSummary(workerProfile = {}, workMetrics = { totalMinutes: 0, workedDays: 0, workedMonths: 0 }) {
  const wageType = workerProfile?.wageType || 'hourly';

  if (wageType === 'daily') {
    const dailyWage = Number(workerProfile.dailyWage) || 0;
    return {
      wageType,
      hourlyRate: Number(workerProfile.hourlyRate) || 0,
      dailyWage,
      monthlyWage: null,
      rateAmount: dailyWage,
      payUnitsWorked: workMetrics.workedDays,
      payUnitLabel: 'day',
      requestedAmount: roundMoney(workMetrics.workedDays * dailyWage)
    };
  }

  if (wageType === 'monthly') {
    const monthlyWage = Number(workerProfile.monthlyWage) || 0;
    return {
      wageType,
      hourlyRate: Number(workerProfile.hourlyRate) || 0,
      dailyWage: null,
      monthlyWage,
      rateAmount: monthlyWage,
      payUnitsWorked: workMetrics.workedMonths,
      payUnitLabel: 'month',
      requestedAmount: roundMoney(workMetrics.workedMonths * monthlyWage)
    };
  }

  const hourlyRate = Number(workerProfile.hourlyRate) || DEFAULT_HOURLY_RATE;
  const workedHours = roundMoney(workMetrics.totalMinutes / 60);
  return {
    wageType: 'hourly',
    hourlyRate,
    dailyWage: null,
    monthlyWage: null,
    rateAmount: hourlyRate,
    payUnitsWorked: workedHours,
    payUnitLabel: 'hour',
    requestedAmount: roundMoney(workedHours * hourlyRate)
  };
}

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

    const tasks = bookings.map(b => {
      const mins = calculateBookingMinutes(b);
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
    const workMetrics = getWorkMetrics(bookings);
    const compensation = getCompensationSummary(workerProfile, workMetrics);
    const penaltySummary = await getLeavePenaltySummary(req.user._id, fromDate, toDate);

    res.json({
      success: true,
      preview: {
        periodFrom: fromDate,
        periodTo: toDate,
        totalMinutesWorked: workMetrics.totalMinutes,
        totalTasksCompleted: bookings.length,
        wageType: compensation.wageType,
        hourlyRate: compensation.hourlyRate,
        dailyWage: compensation.dailyWage,
        monthlyWage: compensation.monthlyWage,
        rateAmount: compensation.rateAmount,
        payUnitsWorked: compensation.payUnitsWorked,
        payUnitLabel: compensation.payUnitLabel,
        requestedAmount: compensation.requestedAmount,
        netAmount: calculateNetAmount(compensation.requestedAmount, penaltySummary.totalPenaltyAmount, true),
        totalPenaltyAmount: penaltySummary.totalPenaltyAmount,
        penaltyBreakdown: penaltySummary.penaltyBreakdown,
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
      }).select('_id actualDurationMinutes actualStartTime actualEndTime location').lean();

      const workerProfile = req.user.workerProfile || {};
      const workMetrics = getWorkMetrics(bookings);
      const compensation = getCompensationSummary(workerProfile, workMetrics);
      const penaltySummary = await getLeavePenaltySummary(req.user._id, fromDate, toDate);

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

      const bookingDerivedLocationId = deriveLocationIdFromBookings(bookings);
      if (bookingDerivedLocationId) {
        locationId = bookingDerivedLocationId;
      }

      const request = new WorkerSalaryRequest({
        worker: req.user._id,
        admin: adminId,
        location: locationId,
        periodFrom: fromDate,
        periodTo: toDate,
        totalMinutesWorked: workMetrics.totalMinutes,
        totalTasksCompleted: bookings.length,
        wageType: compensation.wageType,
        hourlyRate: compensation.hourlyRate,
        dailyWage: compensation.dailyWage,
        monthlyWage: compensation.monthlyWage,
        rateAmount: compensation.rateAmount,
        payUnitsWorked: compensation.payUnitsWorked,
        payUnitLabel: compensation.payUnitLabel,
        requestedAmount: compensation.requestedAmount,
        netAmount: compensation.requestedAmount,
        totalPenaltyAmount: penaltySummary.totalPenaltyAmount,
        penaltyBreakdown: penaltySummary.penaltyBreakdown,
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

    const tasks = bookings.map(b => {
      const mins = calculateBookingMinutes(b);
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
    const workMetrics = getWorkMetrics(bookings);
    const compensation = getCompensationSummary(workerProfile?.workerProfile || {}, workMetrics);
    const penaltySummary = await getLeavePenaltySummary(workerId, fromDate, toDate);

    res.json({
      success: true,
      preview: {
        periodFrom: fromDate,
        periodTo: toDate,
        totalMinutesWorked: workMetrics.totalMinutes,
        totalTasksCompleted: bookings.length,
        wageType: compensation.wageType,
        hourlyRate: compensation.hourlyRate,
        dailyWage: compensation.dailyWage,
        monthlyWage: compensation.monthlyWage,
        rateAmount: compensation.rateAmount,
        payUnitsWorked: compensation.payUnitsWorked,
        payUnitLabel: compensation.payUnitLabel,
        requestedAmount: compensation.requestedAmount,
        netAmount: calculateNetAmount(compensation.requestedAmount, penaltySummary.totalPenaltyAmount, true),
        totalPenaltyAmount: penaltySummary.totalPenaltyAmount,
        penaltyBreakdown: penaltySummary.penaltyBreakdown,
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

      const { workerId, periodFrom, periodTo, notes, applyPenaltyDeduction = false } = req.body;

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
      }).select('_id actualDurationMinutes actualStartTime actualEndTime location').lean();

      const workMetrics = getWorkMetrics(bookings);
      const compensation = getCompensationSummary(worker.workerProfile || {}, workMetrics);
      const penaltySummary = await getLeavePenaltySummary(workerId, fromDate, toDate);
      const netAmount = calculateNetAmount(compensation.requestedAmount, penaltySummary.totalPenaltyAmount, applyPenaltyDeduction);
      const derivedLocationId = deriveLocationIdFromBookings(bookings)
        || worker.workerProfile?.assignedApartments?.[0]?.locationId
        || null;

      const record = new WorkerSalaryRequest({
        worker: workerId,
        admin: req.user._id,
        location: derivedLocationId,
        periodFrom: fromDate,
        periodTo: toDate,
        totalMinutesWorked: workMetrics.totalMinutes,
        totalTasksCompleted: bookings.length,
        wageType: compensation.wageType,
        hourlyRate: compensation.hourlyRate,
        dailyWage: compensation.dailyWage,
        monthlyWage: compensation.monthlyWage,
        rateAmount: compensation.rateAmount,
        payUnitsWorked: compensation.payUnitsWorked,
        payUnitLabel: compensation.payUnitLabel,
        requestedAmount: compensation.requestedAmount,
        netAmount,
        totalPenaltyAmount: penaltySummary.totalPenaltyAmount,
        penaltyTreatment: applyPenaltyDeduction ? 'included' : 'excluded',
        penaltyBreakdown: penaltySummary.penaltyBreakdown,
        penaltyDecidedBy: req.user._id,
        penaltyDecidedAt: new Date(),
        bookings: bookings.map(b => b._id),
        status: 'paid',
        approvedBy: req.user._id,
        approvedAt: new Date(),
        paidBy: req.user._id,
        paidAt: new Date(),
        adminNotes: notes ? String(notes).slice(0, 500) : null
      });

      await record.save();
      await record.populate('worker', 'name email');
      await record.populate('paidBy', 'name email');
      await record.populate('penaltyDecidedBy', 'name email role');
      await record.populate('location', 'apartmentName area city');

      res.status(201).json({
        success: true,
        message: `Salary of ₹${netAmount.toFixed(2)} sent to ${worker.name}`,
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
      .populate('admin', 'name email')
      .populate('approvedBy', 'name')
      .populate('paidBy', 'name email')
      .populate('penaltyDecidedBy', 'name email role')
      .populate('rejectedBy', 'name')
      .populate('location', 'apartmentName area city')
      .populate({
        path: 'bookings',
        select: 'bookingId bookingDate startTime endTime actualDurationMinutes actualStartTime actualEndTime service location',
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

    const { notes, applyPenaltyDeduction = false } = req.body;
    const fromDate = new Date(request.periodFrom);
    const toDate = new Date(request.periodTo);
    const penaltySummary = await getLeavePenaltySummary(request.worker, fromDate, toDate);
    request.status = 'paid';
    request.paidAt = new Date();
    request.paidBy = req.user._id;
    request.totalPenaltyAmount = penaltySummary.totalPenaltyAmount;
    request.penaltyBreakdown = penaltySummary.penaltyBreakdown;
    request.penaltyTreatment = applyPenaltyDeduction ? 'included' : 'excluded';
    request.penaltyDecidedBy = req.user._id;
    request.penaltyDecidedAt = new Date();
    request.netAmount = calculateNetAmount(request.requestedAmount || 0, penaltySummary.totalPenaltyAmount, applyPenaltyDeduction);
    if (notes) request.adminNotes = String(notes).slice(0, 500);

    await request.save();
    await request.populate('worker', 'name email');
    await request.populate('paidBy', 'name email');
    await request.populate('penaltyDecidedBy', 'name email role');

    res.json({ success: true, message: 'Salary marked as paid', request });
  } catch (error) {
    console.error('Mark paid salary request error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;
