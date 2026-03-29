/**
 * Notification Preferences Routes (REQ-C-010)
 * Manage user notification channel preferences
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import { isMsg91WhatsAppConfigured } from '../utils/msg91WhatsappService.js';
import { isWhatsAppConfigured, sendWhatsAppMessage } from '../utils/whatsappService.js';
const router = express.Router();

// @route   GET /api/notification-preferences
// @desc    Get user notification preferences
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notificationPreferences phone email');
    
    if (!user) {
      return res.status(404).json({ 
        error: { message: 'User not found', status: 404 } 
      });
    }

    res.json({ 
      preferences: user.notificationPreferences || {},
      contactInfo: {
        phone: user.phone,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PUT /api/notification-preferences
// @desc    Update user notification preferences
// @access  Private
router.put('/', authenticate, async (req, res) => {
  try {
    const { 
      inApp, 
      whatsapp, 
      sms,
      notifyOnWorkerAssignment,
      notifyOnScheduleChange,
      notifyOnWorkerReassignment,
      notifyOnDelay,
      notifyOnCancellation
    } = req.body;

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ 
        error: { message: 'User not found', status: 404 } 
      });
    }

    // Initialize preferences if not exists
    if (!user.notificationPreferences) {
      user.notificationPreferences = {};
    }

    // Update channel preferences
    if (inApp !== undefined) {
      user.notificationPreferences.inApp = {
        enabled: inApp.enabled !== undefined ? inApp.enabled : true
      };
    }

    if (whatsapp !== undefined) {
      user.notificationPreferences.whatsapp = {
        enabled: whatsapp.enabled !== undefined ? whatsapp.enabled : false,
        consentDate: whatsapp.enabled ? new Date() : user.notificationPreferences.whatsapp?.consentDate
      };
    }

    if (sms !== undefined) {
      user.notificationPreferences.sms = {
        enabled: sms.enabled !== undefined ? sms.enabled : false,
        consentDate: sms.enabled ? new Date() : user.notificationPreferences.sms?.consentDate
      };
    }

    // Update notification type preferences
    if (notifyOnWorkerAssignment !== undefined) {
      user.notificationPreferences.notifyOnWorkerAssignment = notifyOnWorkerAssignment;
    }
    if (notifyOnScheduleChange !== undefined) {
      user.notificationPreferences.notifyOnScheduleChange = notifyOnScheduleChange;
    }
    if (notifyOnWorkerReassignment !== undefined) {
      user.notificationPreferences.notifyOnWorkerReassignment = notifyOnWorkerReassignment;
    }
    if (notifyOnDelay !== undefined) {
      user.notificationPreferences.notifyOnDelay = notifyOnDelay;
    }
    if (notifyOnCancellation !== undefined) {
      user.notificationPreferences.notifyOnCancellation = notifyOnCancellation;
    }

    await user.save();

    res.json({ 
      message: 'Notification preferences updated successfully',
      preferences: user.notificationPreferences
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/notification-preferences/consent/whatsapp
// @desc    Grant WhatsApp notification consent
// @access  Private
router.post('/consent/whatsapp', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ 
        error: { message: 'User not found', status: 404 } 
      });
    }

    if (!user.phone) {
      return res.status(400).json({ 
        error: { message: 'Phone number required for WhatsApp notifications', status: 400 } 
      });
    }

    if (!user.notificationPreferences) {
      user.notificationPreferences = {};
    }

    user.notificationPreferences.whatsapp = {
      enabled: true,
      consentDate: new Date()
    };

    await user.save();

    res.json({ 
      message: 'WhatsApp notifications enabled successfully',
      preferences: user.notificationPreferences
    });
  } catch (error) {
    console.error('WhatsApp consent error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/notification-preferences/consent/sms
// @desc    Grant SMS notification consent
// @access  Private
router.post('/consent/sms', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ 
        error: { message: 'User not found', status: 404 } 
      });
    }

    if (!user.phone) {
      return res.status(400).json({ 
        error: { message: 'Phone number required for SMS notifications', status: 400 } 
      });
    }

    if (!user.notificationPreferences) {
      user.notificationPreferences = {};
    }

    user.notificationPreferences.sms = {
      enabled: true,
      consentDate: new Date()
    };

    await user.save();

    res.json({ 
      message: 'SMS notifications enabled successfully',
      preferences: user.notificationPreferences
    });
  } catch (error) {
    console.error('SMS consent error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   DELETE /api/notification-preferences/consent/whatsapp
// @desc    Revoke WhatsApp notification consent
// @access  Private
router.delete('/consent/whatsapp', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ 
        error: { message: 'User not found', status: 404 } 
      });
    }

    if (user.notificationPreferences?.whatsapp) {
      user.notificationPreferences.whatsapp.enabled = false;
      await user.save();
    }

    res.json({ 
      message: 'WhatsApp notifications disabled successfully',
      preferences: user.notificationPreferences
    });
  } catch (error) {
    console.error('WhatsApp consent revoke error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   DELETE /api/notification-preferences/consent/sms
// @desc    Revoke SMS notification consent
// @access  Private
router.delete('/consent/sms', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ 
        error: { message: 'User not found', status: 404 } 
      });
    }

    if (user.notificationPreferences?.sms) {
      user.notificationPreferences.sms.enabled = false;
      await user.save();
    }

    res.json({ 
      message: 'SMS notifications disabled successfully',
      preferences: user.notificationPreferences
    });
  } catch (error) {
    console.error('SMS consent revoke error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/notification-preferences/whatsapp/status
// @desc    Check MSG91 WhatsApp configuration status
// @access  Private
router.get('/whatsapp/status', authenticate, async (req, res) => {
  try {
    res.json({
      msg91Configured: isMsg91WhatsAppConfigured(),
      whatsappConfigured: isWhatsAppConfigured(),
      otpChannel: process.env.OTP_DELIVERY_CHANNEL || 'sms',
      integratedNumber: process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER ? '***' + process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER.slice(-4) : null,
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/notification-preferences/whatsapp/test
// @desc    Send a test WhatsApp message to the authenticated user
// @access  Private
router.post('/whatsapp/test', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('phone name');

    if (!user?.phone) {
      return res.status(400).json({ error: { message: 'No phone number on file', status: 400 } });
    }

    if (!isWhatsAppConfigured()) {
      return res.status(503).json({ error: { message: 'WhatsApp service is not configured', status: 503 } });
    }

    const result = await sendWhatsAppMessage({
      phone: user.phone,
      message: `Hi ${user.name || 'there'}! 👋 This is a test message from Healthy Homez. WhatsApp notifications are working perfectly.`,
      templateKey: 'WELCOME',
      variables: { name: user.name || 'there' },
    });

    res.json({
      success: true,
      message: 'Test WhatsApp message sent',
      channel: result.channel,
    });
  } catch (error) {
    console.error('WhatsApp test error:', error);
    res.status(500).json({ error: { message: error.message || 'Failed to send test message', status: 500 } });
  }
});

export default router;
