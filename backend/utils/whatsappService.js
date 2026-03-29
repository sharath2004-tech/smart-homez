import twilio from 'twilio';
import {
    getTemplateKeyForType,
    isMsg91WhatsAppConfigured,
    sendMsg91WhatsApp,
    sendMsg91WhatsAppOtp
} from './msg91WhatsappService.js';

export const normalizeIndianPhoneToE164 = (phone) => {
  if (!phone) {
    throw new Error('Phone number is required');
  }

  const digits = String(phone).replace(/\D/g, '').slice(-10);
  if (digits.length < 10) {
    throw new Error('Enter a valid 10-digit mobile number');
  }

  return `+91${digits}`;
};

// ---------------------------------------------------------------------------
// Twilio helpers (fallback)
// ---------------------------------------------------------------------------
const getTwilioClient = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    throw new Error('Twilio credentials not configured');
  }

  return twilio(sid, token);
};

const getTwilioVerifySid = () => {
  const sid = process.env.TWILIO_VERIFY_SID;
  if (!sid) {
    throw new Error('Twilio Verify SID not configured');
  }

  return sid;
};

const getWhatsAppSender = () => {
  const sender = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!sender) {
    throw new Error('Twilio WhatsApp sender not configured');
  }

  return sender.startsWith('whatsapp:') ? sender : `whatsapp:${sender}`;
};

// ---------------------------------------------------------------------------
// Configuration checks
// ---------------------------------------------------------------------------
export const isWhatsAppConfigured = () => {
  // MSG91 WhatsApp is the primary channel
  if (isMsg91WhatsAppConfigured()) return true;
  // Twilio as fallback
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID
    && process.env.TWILIO_AUTH_TOKEN
    && process.env.TWILIO_WHATSAPP_NUMBER
  );
};

export const isWhatsAppOtpConfigured = () => {
  const channel = process.env.OTP_DELIVERY_CHANNEL;
  if (channel === 'msg91_whatsapp' && isMsg91WhatsAppConfigured()) return true;
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID
    && process.env.TWILIO_AUTH_TOKEN
    && process.env.TWILIO_VERIFY_SID
    && channel === 'whatsapp'
  );
};

// ---------------------------------------------------------------------------
// Send WhatsApp message – MSG91 primary, Twilio fallback
// ---------------------------------------------------------------------------

/**
 * Send a WhatsApp message (plain text or template-based).
 * Tries MSG91 first; if unavailable or fails, falls back to Twilio.
 *
 * @param {Object} opts
 * @param {string} opts.phone   – recipient phone
 * @param {string} opts.message – text body (used for Twilio fallback / generic template)
 * @param {string} [opts.templateKey] – MSG91 template key (e.g. 'BOOKING_CONFIRMED')
 * @param {Object} [opts.variables]   – template variables
 * @param {string} [opts.notificationType] – notification type for auto-template resolution
 */
export const sendWhatsAppMessage = async ({ phone, message, templateKey, variables, notificationType }) => {
  const to = normalizeIndianPhoneToE164(phone);

  // ---- MSG91 primary path ----
  if (isMsg91WhatsAppConfigured()) {
    try {
      const resolvedKey = templateKey
        || (notificationType ? getTemplateKeyForType(notificationType) : null)
        || 'GENERIC_NOTIFICATION';

      const vars = variables || { title: 'Healthy Homez', message: message || '' };

      const result = await sendMsg91WhatsApp({ phone: to, templateKey: resolvedKey, variables: vars });
      if (result.success) {
        return { success: true, channel: 'msg91_whatsapp', to };
      }
      console.warn('⚠️  MSG91 WhatsApp failed, trying Twilio fallback…', result.reason);
    } catch (err) {
      console.warn('⚠️  MSG91 WhatsApp error, trying Twilio fallback…', err.message);
    }
  }

  // ---- Twilio fallback path ----
  try {
    const client = getTwilioClient();
    await client.messages.create({
      from: getWhatsAppSender(),
      to: `whatsapp:${to}`,
      body: message || 'You have a new notification from Healthy Homez.',
    });
    return { success: true, channel: 'twilio_whatsapp', to };
  } catch (err) {
    console.error('❌ Twilio WhatsApp fallback also failed:', err.message);
    throw new Error('WhatsApp message delivery failed on all channels');
  }
};

// ---------------------------------------------------------------------------
// Send WhatsApp OTP – MSG91 primary, Twilio fallback
// ---------------------------------------------------------------------------
export const sendWhatsAppOtp = async (phone) => {
  const to = normalizeIndianPhoneToE164(phone);

  // MSG91 WhatsApp OTP
  if (process.env.OTP_DELIVERY_CHANNEL === 'msg91_whatsapp' && isMsg91WhatsAppConfigured()) {
    // Generate a 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const result = await sendMsg91WhatsAppOtp({ phone: to, otp });
    if (result.success) {
      return { success: true, channel: 'msg91_whatsapp', to, otp };
    }
    console.warn('⚠️  MSG91 WhatsApp OTP failed, trying Twilio…');
  }

  // Twilio Verify fallback
  const client = getTwilioClient();
  await client.verify.v2.services(getTwilioVerifySid()).verifications.create({
    to,
    channel: 'whatsapp',
  });

  return { success: true, channel: 'twilio_whatsapp', to };
};

export const verifyWhatsAppOtp = async (phone, code) => {
  const to = normalizeIndianPhoneToE164(phone);

  // For MSG91 WhatsApp OTP the verification is done via msg91Service.js (verifySMSOTP)
  // so this function only handles Twilio Verify path
  const client = getTwilioClient();

  const check = await client.verify.v2.services(getTwilioVerifySid()).verificationChecks.create({
    to,
    code,
  });

  if (check.status !== 'approved') {
    throw new Error('Invalid or expired OTP');
  }

  return { verified: true, channel: 'whatsapp', to };
};

export default {
  normalizeIndianPhoneToE164,
  isWhatsAppConfigured,
  isWhatsAppOtpConfigured,
  sendWhatsAppMessage,
  sendWhatsAppOtp,
  verifyWhatsAppOtp,
};
