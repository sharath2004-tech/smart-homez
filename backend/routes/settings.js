import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import BusinessHours from '../models/BusinessHours.js';
import Settings from '../models/Settings.js';

const router = express.Router();

// Time helpers: accept both 24h ("21:00") and 12h ("9:00 pm") inputs.
const parseClockToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const value = timeStr.trim().toLowerCase();

  const hhmm24 = value.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm24) {
    const h = Number(hhmm24[1]);
    const m = Number(hhmm24[2]);
    if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }

  const hhmm12 = value.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (hhmm12) {
    let h = Number(hhmm12[1]);
    const m = Number(hhmm12[2]);
    const meridiem = hhmm12[3];
    if (Number.isNaN(h) || Number.isNaN(m) || h < 1 || h > 12 || m < 0 || m > 59) return null;
    if (meridiem === 'pm' && h !== 12) h += 12;
    if (meridiem === 'am' && h === 12) h = 0;
    return h * 60 + m;
  }

  return null;
};

const minutesToHHMM = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const generateSlotsFromDayConfig = (dayConfig, slotDurationMinutes) => {
  const openMinutes = parseClockToMinutes(dayConfig?.openTime);
  const closeMinutes = parseClockToMinutes(dayConfig?.closeTime);
  if (openMinutes === null || closeMinutes === null || closeMinutes <= openMinutes) return [];

  const breaks = (dayConfig?.breaks || []).map((b) => {
    const start = parseClockToMinutes(b.start);
    const end = parseClockToMinutes(b.end);
    if (start === null || end === null) return null;
    return { start, end };
  }).filter(Boolean);

  const slots = [];
  for (let t = openMinutes; t + slotDurationMinutes <= closeMinutes; t += slotDurationMinutes) {
    const slotEnd = t + slotDurationMinutes;
    const inBreak = breaks.some((b) => t < b.end && slotEnd > b.start);
    if (!inBreak) slots.push(minutesToHHMM(t));
  }
  return slots;
};

// @route   GET /api/settings
// @desc    Get application settings (public for certain fields)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    
    // Return public settings only for non-admin users
    const publicSettings = {
      payment: {
        upiId: settings.payment.upiId,
        upiName: settings.payment.upiName,
        qrCodeImage: settings.payment.qrCodeImage
      },
      company: {
        name: settings.company.name,
        phone: settings.company.phone,
        email: settings.company.email
      },
      booking: {
        overtimeRate: settings.booking.overtimeRate,
        cancellationHours: settings.booking.cancellationHours
      }
    };
    
    res.json({ settings: publicSettings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/settings/business-hours
// @desc    Get today's business hours (public — all roles, no auth required)
// @access  Public
router.get('/business-hours', async (req, res) => {
  try {
    const config = await BusinessHours.getConfig();

    // Use the configured business timezone so day/date reflect local business time,
    // not the server's UTC clock.
    const tz = config.timezone || 'Asia/Kolkata';
    const now = new Date();
    const tzDateFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const todayStr = tzDateFmt.format(now); // YYYY-MM-DD in business timezone
    const dayName = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'long'
    }).format(now).toLowerCase(); // 'monday', 'tuesday', …

    const dayConfig = config.schedule.find(d => d.day === dayName);

    // 60-day cutoff for upcoming holidays
    const cutoffStr = tzDateFmt.format(new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000));

    // Format HH:MM → human-readable "9:00 AM"
    const fmt = (t) => {
      if (!t) return '';
      const [h, m] = t.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 || 12;
      return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    // Check if today is a declared holiday
    const todayHoliday = config.holidays?.find(h => h.date === todayStr);

    res.json({
      success: true,
      businessHours: {
        isOpen: todayHoliday ? false : (dayConfig?.isActive ?? false),
        holidayToday: todayHoliday ? (todayHoliday.label || 'Holiday') : null,
        day: dayName,
        openTime: dayConfig?.openTime ?? null,
        closeTime: dayConfig?.closeTime ?? null,
        openFormatted: (!todayHoliday && dayConfig?.isActive) ? fmt(dayConfig.openTime) : null,
        closeFormatted: (!todayHoliday && dayConfig?.isActive) ? fmt(dayConfig.closeTime) : null,
        breaks: dayConfig?.breaks ?? [],
        slotDurationMinutes: config.slotDurationMinutes,
        timezone: config.timezone,
        // Upcoming holidays — next 60 days in business timezone
        upcomingHolidays: (config.holidays ?? [])
          .filter(h => h.date >= todayStr && h.date <= cutoffStr)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 5),
        // Full week summary for tooltip display
        weekSchedule: config.schedule.map(d => ({
          day: d.day,
          isActive: d.isActive,
          openTime: d.openTime,
          closeTime: d.closeTime
        }))
      }
    });
  } catch (error) {
    console.error('Get business hours (public) error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/settings/business-hours/available-slots
// @desc    Public slot preview for a given date based on configured business hours
// @query   date=YYYY-MM-DD
// @access  Public
router.get('/business-hours/available-slots', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: { message: 'Query param ?date=YYYY-MM-DD is required', status: 400 } });
    }

    const config = await BusinessHours.getConfig();
    const tz = config.timezone || 'Asia/Kolkata';

    // Keep weekday calculation in business timezone.
    const refDate = new Date(`${date}T12:00:00Z`);
    if (Number.isNaN(refDate.getTime())) {
      return res.status(400).json({ error: { message: 'Invalid date format', status: 400 } });
    }

    const dayName = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long'
    }).format(refDate).toLowerCase();

    const dayConfig = config.schedule.find((d) => d.day === dayName);
    const holiday = (config.holidays || []).find((h) => h.date === date);

    if (holiday) {
      return res.json({
        success: true,
        slots: [],
        date,
        day: dayName,
        reason: `Holiday: ${holiday.label || 'Holiday'}`
      });
    }

    if (!dayConfig || !dayConfig.isActive) {
      return res.json({
        success: true,
        slots: [],
        date,
        day: dayName,
        reason: 'Business is closed on this day'
      });
    }

    const slots = generateSlotsFromDayConfig(dayConfig, config.slotDurationMinutes);

    res.json({
      success: true,
      slots,
      date,
      day: dayName,
      config: {
        openTime: dayConfig.openTime,
        closeTime: dayConfig.closeTime,
        breaks: dayConfig.breaks || [],
        slotDurationMinutes: config.slotDurationMinutes,
        timezone: config.timezone
      }
    });
  } catch (error) {
    console.error('Get public available slots error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/settings/admin
// @desc    Get full settings (admin only)
// @access  Private/Admin+SuperAdmin
router.get('/admin',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const settings = await Settings.getSettings();
      res.json({ settings });
    } catch (error) {
      console.error('Get admin settings error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   PUT /api/settings
// @desc    Update settings. Admin: payment/company/booking only. Super_admin: all sections.
// @access  Private/Admin+SuperAdmin
router.put('/',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    // Payment
    body('payment.upiId').optional().isString().trim().withMessage('UPI ID must be a string'),
    body('payment.upiName').optional().isString().trim().withMessage('UPI Name must be a string'),
    body('payment.qrCodeImage').optional(),
    // Company
    body('company.name').optional().isString().trim().withMessage('Company name must be a string'),
    body('company.phone').optional().isString().trim().withMessage('Company phone must be a string'),
    body('company.email').optional().isEmail().withMessage('Company email must be valid'),
    body('company.address').optional().isString().trim(),
    body('company.defaultState').optional().isString().trim().withMessage('Default state must be a string'),
    // Booking
    body('booking.overtimeRate').optional().isFloat({ min: 0 }).withMessage('Overtime rate must be a positive number'),
    body('booking.cancellationHours').optional().isInt({ min: 0 }).withMessage('Cancellation hours must be a positive integer'),
    body('booking.serviceRadius').optional().isInt({ min: 50 }).withMessage('Service radius must be at least 50 meters'),
    // Earnings (super_admin only — validated but enforced in handler)
    body('earnings.platformCommissionRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Commission rate must be between 0 and 1'),
    body('earnings.bookingConvenienceFee').optional().isFloat({ min: 0 }).withMessage('Convenience fee must be non-negative'),
    body('earnings.minPayoutAmount').optional().isFloat({ min: 0 }).withMessage('Min payout must be non-negative'),
    body('earnings.payoutSchedule').optional().isIn(['instant', 'weekly', 'biweekly', 'monthly']).withMessage('Invalid payout schedule'),
    body('earnings.instantPayoutFee').optional().isFloat({ min: 0, max: 0.1 }).withMessage('Instant payout fee must be between 0 and 0.1'),
    body('earnings.payoutDay').optional().isInt({ min: 1, max: 7 }).withMessage('Payout day must be 1-7'),
    body('earnings.autoPayoutEnabled').optional().isBoolean(),
    // Subscriptions (super_admin only)
    body('subscriptions.workerPlans.basic.price').optional().isFloat({ min: 0 }),
    body('subscriptions.workerPlans.pro.price').optional().isFloat({ min: 0 }),
    body('subscriptions.workerPlans.premium.price').optional().isFloat({ min: 0 }),
    body('subscriptions.customerPlans.basic.price').optional().isFloat({ min: 0 }),
    body('subscriptions.customerPlans.premium.price').optional().isFloat({ min: 0 }),
    // Cancellation Policy (super_admin only)
    body('cancellationPolicy.fullRefundHours').optional().isFloat({ min: 0 }).withMessage('Full refund hours must be non-negative'),
    body('cancellationPolicy.partialRefundPercentage').optional().isFloat({ min: 0, max: 100 }),
    body('cancellationPolicy.partialRefundHours').optional().isFloat({ min: 0 }),
    body('cancellationPolicy.cancellationCharge').optional().isFloat({ min: 0 }),
    body('cancellationPolicy.noRefundHours').optional().isFloat({ min: 0 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('Settings validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const updates = {
        payment: req.body.payment,
        company: req.body.company,
        booking: req.body.booking
      };

      // Only super_admin can update earnings, subscriptions, and cancellation policy
      if (req.user.role === 'super_admin') {
        if (req.body.earnings) updates.earnings = req.body.earnings;
        if (req.body.subscriptions) updates.subscriptions = req.body.subscriptions;
        if (req.body.cancellationPolicy) updates.cancellationPolicy = req.body.cancellationPolicy;
      } else if (req.body.earnings || req.body.subscriptions || req.body.cancellationPolicy) {
        return res.status(403).json({ error: { message: 'Only super admins can update earnings, subscription pricing, and cancellation policy', status: 403 } });
      }

      // Only super_admin can update overtime rate
      if (req.user.role !== 'super_admin' && updates.booking?.overtimeRate !== undefined) {
        return res.status(403).json({ error: { message: 'Only super admins can update the overtime rate', status: 403 } });
      }

      console.log('Updating settings with:', {
        hasPayment: !!updates.payment,
        hasQrCodeImage: !!updates.payment?.qrCodeImage,
        qrCodeImageLength: updates.payment?.qrCodeImage?.length || 0,
        hasCompany: !!updates.company,
        hasBooking: !!updates.booking,
        hasEarnings: !!updates.earnings,
        hasSubscriptions: !!updates.subscriptions,
        hasCancellationPolicy: !!updates.cancellationPolicy
      });

      const settings = await Settings.updateSettings(updates, req.user._id);

      res.json({ 
        message: 'Settings updated successfully', 
        settings 
      });
    } catch (error) {
      console.error('Update settings error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/settings/overtime-rate-request
// @desc    Admin requests a change to the overtime rate (super_admin must approve)
// @access  Private/Admin
router.post('/overtime-rate-request',
  authenticate,
  authorize('admin'),
  [
    body('requestedRate').isFloat({ min: 0 }).withMessage('Requested rate must be a non-negative number'),
    body('reason').optional().isString().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { requestedRate, reason } = req.body;
      const settings = await Settings.getSettings();

      // Cancel any existing pending request from this admin
      settings.overtimeRateRequests = (settings.overtimeRateRequests || []).map(r => {
        if (r.status === 'pending' && r.requestedBy.toString() === req.user._id.toString()) {
          r.status = 'rejected';
          r.reviewNote = 'Superseded by a new request';
          r.reviewedAt = new Date();
        }
        return r;
      });

      settings.overtimeRateRequests.push({
        requestedRate: parseFloat(requestedRate),
        requestedBy: req.user._id,
        requestedByName: req.user.name || '',
        reason: reason || '',
        status: 'pending',
        requestedAt: new Date()
      });

      await settings.save();

      // Notify all super admins
      const superAdmins = await User.find({ role: 'super_admin' }).select('_id').lean();
      for (const sa of superAdmins) {
        await Notification.create({
          recipient: sa._id,
          type: 'system',
          title: 'Overtime Rate Change Request',
          message: `${req.user.name || 'An admin'} is requesting the overtime rate to be changed to ₹${requestedRate}/min. Reason: ${reason || 'Not provided'}`,
          data: { requestedRate, requestedBy: req.user._id },
          priority: 'medium'
        });
      }

      res.status(201).json({ message: 'Overtime rate change request submitted successfully' });
    } catch (error) {
      console.error('Overtime rate request error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/settings/overtime-rate-requests
// @desc    Super admin gets all overtime rate change requests
// @access  Private/SuperAdmin
router.get('/overtime-rate-requests',
  authenticate,
  authorize('super_admin'),
  async (req, res) => {
    try {
      const settings = await Settings.getSettings();
      const requests = (settings.overtimeRateRequests || [])
        .slice()
        .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

      res.json({
        requests,
        currentRate: settings.booking.overtimeRate
      });
    } catch (error) {
      console.error('Get overtime rate requests error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   PUT /api/settings/overtime-rate-requests/:requestId/review
// @desc    Super admin approves or rejects an overtime rate change request
// @access  Private/SuperAdmin
router.put('/overtime-rate-requests/:requestId/review',
  authenticate,
  authorize('super_admin'),
  [
    body('approved').isBoolean().withMessage('approved must be a boolean'),
    body('reviewNote').optional().isString().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { approved, reviewNote } = req.body;
      const settings = await Settings.getSettings();

      const request = (settings.overtimeRateRequests || []).id(req.params.requestId);
      if (!request) {
        return res.status(404).json({ error: { message: 'Request not found', status: 404 } });
      }
      if (request.status !== 'pending') {
        return res.status(400).json({ error: { message: 'This request has already been reviewed', status: 400 } });
      }

      request.status = approved ? 'approved' : 'rejected';
      request.reviewedBy = req.user._id;
      request.reviewNote = reviewNote || '';
      request.reviewedAt = new Date();

      if (approved) {
        settings.booking.overtimeRate = request.requestedRate;
        settings.updatedBy = req.user._id;
        settings.updatedAt = new Date();
      }

      await settings.save();

      // Notify the requesting admin
      await Notification.create({
        recipient: request.requestedBy,
        type: 'system',
        title: approved ? 'Overtime Rate Request Approved' : 'Overtime Rate Request Rejected',
        message: approved
          ? `Your request to change the overtime rate to ₹${request.requestedRate}/min has been approved.`
          : `Your request to change the overtime rate to ₹${request.requestedRate}/min was rejected.${reviewNote ? ` Reason: ${reviewNote}` : ''}`,
        data: { requestedRate: request.requestedRate, approved },
        priority: 'medium'
      });

      res.json({
        message: approved ? 'Request approved. Overtime rate updated.' : 'Request rejected.',
        currentRate: settings.booking.overtimeRate
      });
    } catch (error) {
      console.error('Review overtime rate request error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

export default router;
