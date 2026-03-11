import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import BusinessHours from '../models/BusinessHours.js';
import Settings from '../models/Settings.js';

const router = express.Router();

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

export default router;
