import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { sendOTP, toE164, verifyOTP } from '../utils/msg91Service.js';

const router = express.Router();

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

// ---------------------------------------------------------------------------
// MSG91 Widget token verification helpers
// ---------------------------------------------------------------------------

/**
 * Verify an MSG91 widget access token server-side.
 * Returns { type: 'success', mobile: '91XXXXXXXXXX' } on success.
 */
async function verifyMsg91WidgetToken(token) {
  const widgetId = process.env.MSG91_WIDGET_ID;
  const authKey = process.env.MSG91_AUTH_KEY;

  if (!widgetId || !authKey) {
    throw new Error('OTP service not configured on server');
  }

  const res = await fetch(
    'https://control.msg91.com/api/v5/widget/verifyAccessToken',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authkey: authKey, 'access-token': token }),
    },
  );
  const data = await res.json();

  if (!res.ok || data.type !== 'success') {
    throw new Error('OTP verification failed. Please try again.');
  }
  return data; // { type, mobile, ... }
}

// POST /api/auth/verify-widget-token
// Verifies MSG91 widget token, then finds/creates user and returns a platform JWT.
// Body: { token, phone, role?, name?, gender? }
router.post('/verify-widget-token', async (req, res) => {
  try {
    const { token, phone, role = 'customer', name, gender } = req.body;
    if (!token || !phone) {
      return res.status(400).json({ message: 'Token and phone are required' });
    }

    // Server-side verification with MSG91
    const verifyData = await verifyMsg91WidgetToken(token);

    // Use the mobile returned by MSG91 as the authoritative verified number
    const rawMobile = verifyData.mobile || verifyData.identifier || phone;
    const e164 = toE164(rawMobile);

    const requestedRole = typeof role === 'string' ? role.toLowerCase().trim() : 'customer';
    const finalRole = ['customer', 'worker'].includes(requestedRole) ? requestedRole : 'customer';
    const isSignupAttempt = Boolean(name && String(name).trim());

    let user = await User.findOne({ phone: e164, role: finalRole });

    if (!user) {
      if (isSignupAttempt) {
        // Explicit signup with name provided
        user = new User({
          name: String(name).trim(),
          phone: e164,
          role: finalRole,
          gender: gender || 'prefer_not_to_say',
          isPhoneVerified: true,
          isProfileIncomplete: false,
          password: Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12),
        });
      } else {
        // Login attempt — no account yet, auto-create a minimal profile
        user = new User({
          name: 'Customer',
          phone: e164,
          role: finalRole,
          gender: 'prefer_not_to_say',
          isPhoneVerified: true,
          isProfileIncomplete: true,
          password: Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12),
        });
      }
      await user.save();
    } else if (isSignupAttempt) {
      return res.status(409).json({
        message: `A ${finalRole} account with this mobile number already exists. Please log in instead.`,
      });
    } else if (!user.isPhoneVerified) {
      user.isPhoneVerified = true;
      await user.save();
    }

    const jwtToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );

    res.json({
      token: jwtToken,
      isNewUser: !!(isSignupAttempt || user.isProfileIncomplete),
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isPhoneVerified: true,
        isProfileIncomplete: !!user.isProfileIncomplete,
      },
    });
  } catch (error) {
    console.error('verify-widget-token error:', error.message);
    const status = error.message.includes('not configured') ? 500 : 401;
    res.status(status).json({ message: error.message || 'Verification failed. Please try again.' });
  }
});

// POST /api/auth/check-widget-token
// Verifies MSG91 widget token only — no user creation (used during worker registration).
// Body: { token, phone }
router.post('/check-widget-token', async (req, res) => {
  try {
    const { token, phone } = req.body;
    if (!token || !phone) {
      return res.status(400).json({ message: 'Token and phone are required' });
    }

    await verifyMsg91WidgetToken(token);

    res.json({ success: true, verified: true });
  } catch (error) {
    console.error('check-widget-token error:', error.message);
    const status = error.message.includes('not configured') ? 500 : 401;
    res.status(status).json({ message: error.message || 'Verification failed. Please try again.' });
  }
});

// PATCH /api/auth/complete-profile
// Completes profile for OTP-only users (name, email, gender + optional location).
// @access  Private (JWT required)
router.patch('/complete-profile', authenticate, async (req, res) => {
  try {
    const { name, email, gender, locationId, locationName, city, area } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check email uniqueness if provided
    if (email && email.trim()) {
      const existing = await User.findOne({ email: email.trim().toLowerCase(), _id: { $ne: user._id } });
      if (existing) {
        return res.status(409).json({ message: 'This email is already registered with another account.' });
      }
      user.email = email.trim().toLowerCase();
    }

    user.name = String(name).trim();
    if (gender) user.gender = gender;

    // Attach service location if provided
    if (locationId) {
      user.location = {
        ...user.location,
        serviceAreaId: locationId,
        locationName: locationName || '',
        city: city || '',
        area: area || '',
      };
    }

    user.isProfileIncomplete = false;
    await user.save();

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        gender: user.gender,
        isProfileIncomplete: false,
      },
    });
  } catch (error) {
    console.error('complete-profile error:', error.message);
    res.status(500).json({ message: error.message || 'Failed to update profile.' });
  }
});

export default router;
