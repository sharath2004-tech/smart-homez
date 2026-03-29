/**
 * MSG91 SMS OTP Service
 *
 * Provides SMS OTP functionality using MSG91 API
 * Supports fallback to Twilio if MSG91 fails
 *
 * API Documentation: https://docs.msg91.com/
 */

import twilio from 'twilio';
import { isMsg91WhatsAppConfigured, sendMsg91WhatsAppOtp } from './msg91WhatsappService.js';
import { isWhatsAppOtpConfigured, sendWhatsAppOtp, verifyWhatsAppOtp } from './whatsappService.js';

// In-memory storage for OTP request IDs (use Redis in production)
const otpStore = new Map();

// Rate limiting tracker (phone => { count, resetAt })
const rateLimiter = new Map();

/**
 * Configuration
 */
const MSG91_API_BASE = 'https://control.msg91.com/api/v5';
const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_SENDER_ID = process.env.MSG91_SENDER_ID || 'HLTHYZ';
const MSG91_TEMPLATE_ID = process.env.MSG91_OTP_TEMPLATE_ID;
const MSG91_OTP_EXPIRY = parseInt(process.env.MSG91_OTP_EXPIRY) || 600; // 10 minutes in seconds

const USE_MSG91 = MSG91_AUTH_KEY && MSG91_TEMPLATE_ID;
const TWILIO_FALLBACK_ENABLED = process.env.TWILIO_ENABLED === 'true';
const OTP_DELIVERY_CHANNEL = process.env.OTP_DELIVERY_CHANNEL || 'sms';

/**
 * Phone number normalization to E.164 format
 * @param {string} phone - Phone number (10 digits or with country code)
 * @returns {string} E.164 formatted phone (e.g., +919876543210)
 * @throws {Error} If phone number is invalid
 */
export function toE164(phone) {
  if (!phone) throw new Error('Phone number is required');

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Extract last 10 digits (Indian mobile numbers)
  const last10 = digits.slice(-10);

  if (last10.length < 10) {
    throw new Error('Enter a valid 10-digit mobile number');
  }

  // Return E.164 format with India country code (+91)
  return `+91${last10}`;
}

/**
 * Rate limiting check
 * @param {string} phone - E.164 phone number
 * @throws {Error} If rate limit exceeded
 */
function checkRateLimit(phone) {
  const now = Date.now();
  const limit = rateLimiter.get(phone);

  if (limit) {
    // Reset counter if time window has passed (1 hour)
    if (now > limit.resetAt) {
      rateLimiter.delete(phone);
    } else if (limit.count >= 5) {
      const minutesLeft = Math.ceil((limit.resetAt - now) / 60000);
      throw new Error(`Too many OTP requests. Please try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`);
    }
  }
}

/**
 * Increment rate limit counter
 * @param {string} phone - E.164 phone number
 */
function incrementRateLimit(phone) {
  const now = Date.now();
  const limit = rateLimiter.get(phone);

  if (limit) {
    limit.count += 1;
  } else {
    rateLimiter.set(phone, {
      count: 1,
      resetAt: now + 60 * 60 * 1000 // 1 hour from now
    });
  }
}

/**
 * Map MSG91 errors to user-friendly messages
 * @param {Object} error - Error object from MSG91 API
 * @returns {string} User-friendly error message
 */
function mapMSG91Error(error) {
  const message = error.message || '';
  const code = error.code || error.status;

  // MSG91 specific error codes
  if (message.includes('invalid mobile') || code === 101) {
    return 'Enter a valid 10-digit mobile number';
  }
  if (message.includes('otp expired') || code === 103) {
    return 'OTP has expired. Please request a new one.';
  }
  if (message.includes('verification failed') || message.includes('invalid otp') || code === 104) {
    return 'Invalid OTP. Please try again.';
  }
  if (message.includes('max attempts') || message.includes('too many') || code === 105) {
    return 'Too many attempts. Please wait 10 minutes and try again.';
  }
  if (message.includes('authentication failed') || message.includes('invalid authkey') || code === 201) {
    return 'SMS service authentication failed. Contact support.';
  }
  if (message.includes('template not found') || code === 301) {
    return 'SMS service configuration error. Contact support.';
  }
  if (message.includes('insufficient balance') || code === 302) {
    return 'SMS service temporarily unavailable. Contact support.';
  }

  // Generic error
  return message || 'Failed to send OTP. Please try again.';
}

/**
 * Send SMS OTP via MSG91
 * @param {string} phone - E.164 formatted phone number
 * @param {Object} options - Optional parameters { templateId }
 * @returns {Promise<Object>} { success: true, requestId: string, message: string }
 * @throws {Error} If sending fails
 */
export async function sendSMSOTP(phone, options = {}) {
  try {
    const e164 = toE164(phone);
    checkRateLimit(e164);

    if (!USE_MSG91) {
      throw new Error('MSG91 not configured. Set MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID in .env');
    }

    // Remove + prefix for MSG91 API (expects 91XXXXXXXXXX)
    const msg91Phone = e164.replace('+', '');

    const payload = {
      template_id: options.templateId || MSG91_TEMPLATE_ID,
      mobile: msg91Phone,
      authkey: MSG91_AUTH_KEY,
      sender: MSG91_SENDER_ID,
      otp_expiry: Math.floor(MSG91_OTP_EXPIRY / 60) // MSG91 expects minutes
    };

    console.log(`📱 Sending OTP to ${phone} via MSG91...`);

    const response = await fetch(`${MSG91_API_BASE}/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': MSG91_AUTH_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || data.type === 'error') {
      throw new Error(data.message || `MSG91 API error: ${response.status}`);
    }

    // Store request ID for verification
    const requestId = data.request_id || data.requestId || Date.now().toString();
    otpStore.set(e164, {
      requestId,
      sentAt: Date.now(),
      expiresAt: Date.now() + (MSG91_OTP_EXPIRY * 1000)
    });

    incrementRateLimit(e164);

    console.log(`✅ OTP sent successfully to ${phone} (Request ID: ${requestId})`);

    return {
      success: true,
      requestId,
      message: 'OTP sent successfully'
    };

  } catch (error) {
    console.error('❌ MSG91 send OTP error:', error.message);
    throw new Error(mapMSG91Error(error));
  }
}

/**
 * Verify SMS OTP via MSG91
 * @param {string} phone - E.164 formatted phone number
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<Object>} { verified: true, message: string }
 * @throws {Error} If verification fails
 */
export async function verifySMSOTP(phone, otp) {
  try {
    const e164 = toE164(phone);

    if (!USE_MSG91) {
      throw new Error('MSG91 not configured');
    }

    // Check if OTP was sent to this number
    const stored = otpStore.get(e164);
    if (!stored) {
      throw new Error('No OTP request found for this number. Please request a new OTP.');
    }

    // Check if OTP expired
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(e164);
      throw new Error('OTP has expired. Please request a new one.');
    }

    // Remove + prefix for MSG91 API
    const msg91Phone = e164.replace('+', '');

    console.log(`🔍 Verifying OTP for ${phone}...`);

    const response = await fetch(`${MSG91_API_BASE}/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': MSG91_AUTH_KEY
      },
      body: JSON.stringify({
        mobile: msg91Phone,
        otp: otp.toString(),
        authkey: MSG91_AUTH_KEY
      })
    });

    const data = await response.json();

    if (!response.ok || data.type === 'error') {
      // Check for specific error messages
      if (data.message && data.message.toLowerCase().includes('already verified')) {
        // OTP was already used
        otpStore.delete(e164);
        throw new Error('OTP has already been used. Please request a new one.');
      }
      throw new Error(data.message || 'Invalid OTP. Please try again.');
    }

    // Successful verification
    otpStore.delete(e164);
    console.log(`✅ OTP verified successfully for ${phone}`);

    return {
      verified: true,
      message: 'OTP verified successfully'
    };

  } catch (error) {
    console.error('❌ MSG91 verify OTP error:', error.message);
    throw new Error(mapMSG91Error(error));
  }
}

/**
 * Resend SMS OTP via MSG91
 * @param {string} phone - E.164 formatted phone number
 * @param {string} retryType - 'text' or 'voice' (default: 'text')
 * @returns {Promise<Object>} { success: true, requestId: string, message: string }
 * @throws {Error} If resending fails
 */
export async function resendSMSOTP(phone, retryType = 'text') {
  try {
    const e164 = toE164(phone);
    checkRateLimit(e164);

    if (!USE_MSG91) {
      throw new Error('MSG91 not configured');
    }

    // Check if OTP was sent to this number
    const stored = otpStore.get(e164);
    if (!stored) {
      // If no OTP exists, send a new one instead
      return await sendSMSOTP(phone);
    }

    // Remove + prefix for MSG91 API
    const msg91Phone = e164.replace('+', '');

    console.log(`🔄 Resending OTP to ${phone} via ${retryType}...`);

    const response = await fetch(`${MSG91_API_BASE}/otp/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': MSG91_AUTH_KEY
      },
      body: JSON.stringify({
        mobile: msg91Phone,
        retrytype: retryType, // 'text' or 'voice'
        authkey: MSG91_AUTH_KEY
      })
    });

    const data = await response.json();

    if (!response.ok || data.type === 'error') {
      throw new Error(data.message || `Failed to resend OTP`);
    }

    // Update stored data
    otpStore.set(e164, {
      requestId: data.request_id || stored.requestId,
      sentAt: Date.now(),
      expiresAt: Date.now() + (MSG91_OTP_EXPIRY * 1000)
    });

    incrementRateLimit(e164);

    console.log(`✅ OTP resent successfully to ${phone}`);

    return {
      success: true,
      requestId: data.request_id || stored.requestId,
      message: `OTP resent via ${retryType}`
    };

  } catch (error) {
    console.error('❌ MSG91 resend OTP error:', error.message);
    throw new Error(mapMSG91Error(error));
  }
}

/**
 * Twilio fallback functions (if MSG91 fails)
 */
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured');
  }

  return twilio(accountSid, authToken);
}

function getTwilioVerifySid() {
  const sid = process.env.TWILIO_VERIFY_SID;
  if (!sid) throw new Error('Twilio Verify SID not configured');
  return sid;
}

/**
 * Send OTP via Twilio (fallback)
 * @param {string} phone - E.164 phone number
 * @returns {Promise<Object>}
 */
async function sendViaTwilio(phone) {
  console.log(`📱 Falling back to Twilio for ${phone}...`);

  const client = getTwilioClient();
  await client.verify.v2.services(getTwilioVerifySid()).verifications.create({
    to: phone,
    channel: 'sms'
  });

  console.log(`✅ OTP sent via Twilio to ${phone}`);

  return {
    success: true,
    requestId: 'twilio',
    message: 'OTP sent successfully (via backup service)'
  };
}

/**
 * Verify OTP via Twilio (fallback)
 * @param {string} phone - E.164 phone number
 * @param {string} code - OTP code
 * @returns {Promise<Object>}
 */
async function verifyViaTwilio(phone, code) {
  console.log(`🔍 Verifying OTP via Twilio for ${phone}...`);

  const client = getTwilioClient();
  const check = await client.verify.v2.services(getTwilioVerifySid()).verificationChecks.create({
    to: phone,
    code
  });

  if (check.status !== 'approved') {
    throw new Error('Invalid or expired OTP');
  }

  console.log(`✅ OTP verified via Twilio for ${phone}`);

  return {
    verified: true,
    message: 'OTP verified successfully'
  };
}

/**
 * Public API with automatic fallback
 */

/**
 * Send OTP (tries MSG91, falls back to Twilio if enabled)
 * @param {string} phone - Phone number
 * @param {Object} options - Optional parameters
 * @returns {Promise<Object>}
 */
export async function sendOTP(phone, options = {}) {
  const e164 = toE164(phone);

  try {
    // MSG91 WhatsApp OTP (preferred channel)
    if (OTP_DELIVERY_CHANNEL === 'msg91_whatsapp' && isMsg91WhatsAppConfigured()) {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const result = await sendMsg91WhatsAppOtp({ phone: e164, otp, expiryMinutes: Math.floor(MSG91_OTP_EXPIRY / 60) });
      if (result.success) {
        // Store OTP for verification
        otpStore.set(e164, {
          requestId: 'msg91_whatsapp',
          otp,
          sentAt: Date.now(),
          expiresAt: Date.now() + (MSG91_OTP_EXPIRY * 1000)
        });
        incrementRateLimit(e164);
        console.log(`✅ OTP sent via MSG91 WhatsApp to ${phone}`);
        return { success: true, requestId: 'msg91_whatsapp', message: 'OTP sent via WhatsApp' };
      }
      console.warn('⚠️ MSG91 WhatsApp OTP failed, falling through to other channels…');
    }

    // Twilio WhatsApp OTP
    if (OTP_DELIVERY_CHANNEL === 'whatsapp' && isWhatsAppOtpConfigured()) {
      return await sendWhatsAppOtp(e164);
    }

    if (USE_MSG91) {
      return await sendSMSOTP(e164, options);
    } else if (TWILIO_FALLBACK_ENABLED) {
      return await sendViaTwilio(e164);
    } else {
      throw new Error('No SMS service configured. Set up MSG91 or enable Twilio fallback.');
    }
  } catch (error) {
    // If MSG91 fails and Twilio fallback is enabled, try Twilio
    if (USE_MSG91 && TWILIO_FALLBACK_ENABLED) {
      console.warn('⚠️ MSG91 failed, attempting Twilio fallback...');
      try {
        return await sendViaTwilio(e164);
      } catch (twilioError) {
        console.error('❌ Twilio fallback also failed:', twilioError.message);
        throw error; // Throw original MSG91 error
      }
    }
    throw error;
  }
}

/**
 * Verify OTP (tries MSG91, falls back to Twilio if needed)
 * @param {string} phone - Phone number
 * @param {string} code - OTP code
 * @returns {Promise<Object>}
 */
export async function verifyOTP(phone, code) {
  const e164 = toE164(phone);

  try {
    // MSG91 WhatsApp OTP verification (stored locally)
    if (OTP_DELIVERY_CHANNEL === 'msg91_whatsapp') {
      const stored = otpStore.get(e164);
      if (stored && stored.requestId === 'msg91_whatsapp') {
        if (Date.now() > stored.expiresAt) {
          otpStore.delete(e164);
          throw new Error('OTP has expired. Please request a new one.');
        }
        if (stored.otp === String(code)) {
          otpStore.delete(e164);
          console.log(`✅ OTP verified (MSG91 WhatsApp) for ${phone}`);
          return { verified: true, message: 'OTP verified successfully' };
        }
        throw new Error('Invalid OTP. Please try again.');
      }
      // Fall through to other methods if no stored OTP
    }

    if (OTP_DELIVERY_CHANNEL === 'whatsapp' && isWhatsAppOtpConfigured()) {
      return await verifyWhatsAppOtp(e164, code);
    }

    if (USE_MSG91) {
      return await verifySMSOTP(e164, code);
    } else if (TWILIO_FALLBACK_ENABLED) {
      return await verifyViaTwilio(e164, code);
    } else {
      throw new Error('No SMS service configured');
    }
  } catch (error) {
    // If MSG91 fails and we used Twilio to send, verify with Twilio
    if (USE_MSG91 && TWILIO_FALLBACK_ENABLED) {
      try {
        return await verifyViaTwilio(e164, code);
      } catch (twilioError) {
        // Throw original error
        throw error;
      }
    }
    throw error;
  }
}

/**
 * Clean up expired OTP entries (run periodically)
 */
export function cleanupExpiredOTPs() {
  const now = Date.now();
  let cleaned = 0;

  for (const [phone, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(phone);
      cleaned++;
    }
  }

  // Clean up old rate limit entries
  for (const [phone, limit] of rateLimiter.entries()) {
    if (now > limit.resetAt) {
      rateLimiter.delete(phone);
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired OTP entries`);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredOTPs, 5 * 60 * 1000);

export default {
  sendOTP,
  verifyOTP,
  sendSMSOTP,
  verifySMSOTP,
  resendSMSOTP,
  toE164
};
