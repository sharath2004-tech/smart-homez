import express from 'express';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';
import User from '../models/User.js';

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

    const e164 = toE164(phone);
    const client = getTwilioClient();

    await client.verify.v2.services(getVerifySid()).verifications.create({
      to: e164,
      channel: 'sms',
    });

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Send OTP error:', error.message, error.code, error.status);

    if (error.message.includes('valid 10-digit')) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message.includes('credentials not configured') || error.message.includes('Verify SID')) {
      return res.status(500).json({ message: 'SMS service is not configured. Contact support.' });
    }
    // Twilio-specific error codes
    if (error.code === 60200) return res.status(400).json({ message: 'Invalid phone number format.' });
    if (error.code === 60203) return res.status(429).json({ message: 'Max OTP attempts reached. Please wait 10 minutes and try again.' });
    if (error.code === 60212) return res.status(429).json({ message: 'Too many requests. Please wait a moment and try again.' });
    if (error.code === 20003) return res.status(500).json({ message: 'SMS service authentication failed. Contact support.' });
    if (error.code === 20404) return res.status(500).json({ message: 'SMS service not found. Contact support.' });

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
    const client = getTwilioClient();

    const check = await client.verify.v2.services(getVerifySid()).verificationChecks.create({
      to: e164,
      code,
    });

    if (check.status !== 'approved') {
      return res.status(401).json({ message: 'Invalid or expired OTP. Please try again.' });
    }

    let user = await User.findOne({ phone: e164 });

    if (!user) {
      const allowedRoles = ['customer', 'worker'];
      const finalRole = allowedRoles.includes(role) ? role : 'customer';
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
    console.error('Verify OTP error:', error.message, error.code, error.status);
    if (error.status === 404 || error.code === 20404) {
      return res.status(401).json({ message: 'OTP has expired or already been used. Please request a new one.' });
    }
    if (error.code === 60200) return res.status(400).json({ message: 'Invalid phone number.' });
    if (error.code === 60202) return res.status(429).json({ message: 'Max verification attempts reached. Please request a new OTP.' });
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
    const client = getTwilioClient();

    const check = await client.verify.v2.services(getVerifySid()).verificationChecks.create({
      to: e164,
      code,
    });

    if (check.status !== 'approved') {
      return res.status(401).json({ message: 'Invalid or expired OTP. Please try again.' });
    }

    res.json({ success: true, verified: true });
  } catch (error) {
    console.error('Check OTP error:', error.message, error.code, error.status);
    if (error.status === 404 || error.code === 20404) {
      return res.status(401).json({ message: 'OTP has expired or already been used. Please request a new one.' });
    }
    if (error.code === 60202) return res.status(429).json({ message: 'Max verification attempts reached. Please request a new OTP.' });
    res.status(500).json({ message: error.message || 'Verification failed. Please try again.' });
  }
});

export default router;
