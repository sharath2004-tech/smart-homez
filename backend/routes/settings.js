import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
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

// @route   GET /api/settings/admin
// @desc    Get full settings (admin only)
// @access  Private/Admin
router.get('/admin',
  authenticate,
  authorize('admin'),
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
// @desc    Update settings
// @access  Private/Admin
router.put('/',
  authenticate,
  authorize('admin'),
  [
    body('payment.upiId').optional().isString().trim().withMessage('UPI ID must be a string'),
    body('payment.upiName').optional().isString().trim().withMessage('UPI Name must be a string'),
    body('payment.qrCodeImage').optional(),
    body('company.name').optional().isString().trim().withMessage('Company name must be a string'),
    body('company.phone').optional().isString().trim().withMessage('Company phone must be a string'),
    body('company.email').optional().isEmail().withMessage('Company email must be valid'),
    body('booking.overtimeRate').optional().isFloat({ min: 0 }).withMessage('Overtime rate must be a positive number'),
    body('booking.cancellationHours').optional().isInt({ min: 0 }).withMessage('Cancellation hours must be a positive integer')
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

      console.log('Updating settings with:', {
        hasPayment: !!updates.payment,
        hasQrCodeImage: !!updates.payment?.qrCodeImage,
        qrCodeImageLength: updates.payment?.qrCodeImage?.length || 0,
        hasCompany: !!updates.company,
        hasBooking: !!updates.booking
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
