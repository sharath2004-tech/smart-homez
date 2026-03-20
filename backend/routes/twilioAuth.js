import express from 'express';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';
import User from '../models/User.js';
import { sendOTP, verifyOTP, toE164 } from '../utils/msg91Service.js';

const router = express.Router();

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env');
  }
  return twilio(accountSid, authToken);
}

function getVerifySid() {
  const sid = process.env.TWILIO_VERIFY_SID;
  if (!sid) throw new Error('Twilio Verify SID not configured. Set TWILIO_VERIFY_SID in .env');
  return sid;
}

function toE164(phone) {
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length < 10) throw new Error('Enter a valid 10-digit mobile number');
  return `+91${digits}`;
}

// POST /api/auth/send-otp
// Sends a verification OTP via Twilio Verify
// Body: { phone }
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone number is required' });

    // Send OTP via MSG91 (automatically falls back to Twilio if MSG91 fails)
    await sendOTP(phone);

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Send OTP error:', error.message);

    // Universal error handling (works for both MSG91 and Twilio)
    if (error.message.includes('valid 10-digit')) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message.includes('not configured') || error.message.includes('Contact support')) {
      return res.status(500).json({ message: 'SMS service is not configured. Contact support.' });
    }
    if (error.message.includes('Too many')) {
      return res.status(429).json({ message: error.message });
    }

    // Generic error
    res.status(400).json({ message: error.message || 'Failed to send OTP. Please try again.' });
  }
});

// POST /api/auth/verify-otp
// Verifies OTP and returns a platform JWT; creates user if first time
// Body: { phone, code, role, name, gender }
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, code, role = 'customer', name, gender } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ message: 'Phone number and OTP code are required' });
    }

    const e164 = toE164(phone);

    // Verify OTP via MSG91 (automatically falls back to Twilio if needed)
    const result = await verifyOTP(e164, code);

    if (!result.verified) {
      return res.status(401).json({ message: 'Invalid or expired OTP. Please try again.' });
    }

    const requestedRole = typeof role === 'string' ? role.toLowerCase().trim() : 'customer';
    const allowedRoles = ['customer', 'worker'];
    const finalRole = allowedRoles.includes(requestedRole) ? requestedRole : 'customer';
    const isSignupAttempt = Boolean(name && String(name).trim());

    let user = await User.findOne({ phone: e164, role: finalRole });

    if (!user) {
      // For login flow (no name), do not auto-create users
      if (!isSignupAttempt) {
        return res.status(404).json({
          message: `No ${finalRole} account found for this mobile number. Please sign up first.`
        });
      }

      const existingSameRoleUser = await User.findOne({ phone: e164, role: finalRole });
      if (existingSameRoleUser) {
        return res.status(409).json({
          message: `A ${finalRole} account with this mobile number already exists. Please log in instead.`
        });
      }

      const digits = e164.replace(/\D/g, '').slice(-10);

      user = new User({
        name: name || `User${digits.slice(-4)}`,
        phone: e164,
        role: finalRole,
        gender: gender || 'prefer_not_to_say',
        isPhoneVerified: true,
        isFirstLogin: false,
        password: Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12),
      });
      await user.save();
    } else if (isSignupAttempt) {
      return res.status(409).json({
        message: `A ${user.role} account with this mobile number already exists. Please log in instead.`
      });
    } else if (!user.isPhoneVerified) {
      user.isPhoneVerified = true;
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      isNewUser: !user.name || user.name.startsWith('User'),
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isPhoneVerified: true,
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error.message);

    // Handle common verification errors
    if (error.message.includes('expired') || error.message.includes('already been used')) {
      return res.status(401).json({ message: error.message });
    }
    if (error.message.includes('Invalid OTP')) {
      return res.status(401).json({ message: error.message });
    }
    if (error.message.includes('Too many')) {
      return res.status(429).json({ message: error.message });
    }

    res.status(500).json({ message: error.message || 'Verification failed. Please try again.' });
  }
});

// POST /api/auth/check-otp
// Verifies OTP only (no user creation) — used for phone verification during worker registration
// Body: { phone, code }
router.post('/check-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ message: 'Phone number and OTP code are required' });
    }

    const e164 = toE164(phone);

    // Verify OTP via MSG91 (automatically falls back to Twilio if needed)
    const result = await verifyOTP(e164, code);

    if (!result.verified) {
      return res.status(401).json({ message: 'Invalid or expired OTP. Please try again.' });
    }

    res.json({ success: true, verified: true });
  } catch (error) {
    console.error('Check OTP error:', error.message);

    // Handle common verification errors
    if (error.message.includes('expired') || error.message.includes('already been used')) {
      return res.status(401).json({ message: error.message });
    }
    if (error.message.includes('Invalid OTP')) {
      return res.status(401).json({ message: error.message });
    }
    if (error.message.includes('Too many')) {
      return res.status(429).json({ message: error.message });
    }

    res.status(500).json({ message: error.message || 'Verification failed. Please try again.' });
  }
});

export default router;
