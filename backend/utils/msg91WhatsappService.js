/**
 * MSG91 WhatsApp Service
 * 
 * Full WhatsApp messaging via MSG91 API.
 * Supports: template messages, OTP via WhatsApp, and plain text fallback.
 *
 * Required env vars:
 *   MSG91_AUTH_KEY              – API auth key from MSG91 dashboard
 *   MSG91_WHATSAPP_INTEGRATED_NUMBER – Your WhatsApp Business number registered on MSG91 (e.g. 919XXXXXXXXX)
 *   MSG91_WHATSAPP_TEMPLATE_NAMESPACE – (optional) template namespace from MSG91
 *
 * Template IDs are configured per notification type below.
 * You MUST create & approve these templates in the MSG91 dashboard first.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const MSG91_AUTH_KEY = () => process.env.MSG91_AUTH_KEY;
const MSG91_INTEGRATED_NUMBER = () => process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER;
const MSG91_TEMPLATE_NAMESPACE = () => process.env.MSG91_WHATSAPP_TEMPLATE_NAMESPACE || '';

const MSG91_WHATSAPP_API = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

// ---------------------------------------------------------------------------
// Template registry – map logical names → MSG91 approved template names
// Update the `msg91Name` values after creating templates in MSG91 dashboard.
// ---------------------------------------------------------------------------
const WHATSAPP_TEMPLATES = {
  // OTP & Auth
  OTP_VERIFICATION: {
    msg91Name: process.env.MSG91_WA_TPL_OTP || 'otp_verification',
    language: 'en',
    // body variables: {{1}} = OTP code, {{2}} = expiry minutes
    buildComponents: ({ otp, expiryMinutes = 10 }) => ({
      body_1: { type: 'text', value: String(otp) },
      body_2: { type: 'text', value: String(expiryMinutes) },
    }),
  },

  // Booking
  BOOKING_CONFIRMED: {
    msg91Name: process.env.MSG91_WA_TPL_BOOKING_CONFIRMED || 'booking_confirmed',
    language: 'en',
    buildComponents: ({ serviceName, date, time, bookingId }) => ({
      body_1: { type: 'text', value: String(serviceName || 'Cleaning Service') },
      body_2: { type: 'text', value: String(date || '') },
      body_3: { type: 'text', value: String(time || '') },
      body_4: { type: 'text', value: String(bookingId || '') },
    }),
  },

  BOOKING_CANCELLED: {
    msg91Name: process.env.MSG91_WA_TPL_BOOKING_CANCELLED || 'booking_cancelled',
    language: 'en',
    buildComponents: ({ serviceName, reason, refundAmount }) => ({
      body_1: { type: 'text', value: String(serviceName || 'Cleaning Service') },
      body_2: { type: 'text', value: String(reason || 'Cancelled by request') },
      body_3: { type: 'text', value: refundAmount ? `₹${refundAmount}` : 'N/A' },
    }),
  },

  BOOKING_RESCHEDULED: {
    msg91Name: process.env.MSG91_WA_TPL_BOOKING_RESCHEDULED || 'booking_rescheduled',
    language: 'en',
    buildComponents: ({ serviceName, newDate, newTime }) => ({
      body_1: { type: 'text', value: String(serviceName || 'Cleaning Service') },
      body_2: { type: 'text', value: String(newDate || '') },
      body_3: { type: 'text', value: String(newTime || '') },
    }),
  },

  // Worker
  WORKER_ASSIGNED: {
    msg91Name: process.env.MSG91_WA_TPL_WORKER_ASSIGNED || 'worker_assigned',
    language: 'en',
    buildComponents: ({ workerName, serviceName, date, time }) => ({
      body_1: { type: 'text', value: String(workerName || 'A worker') },
      body_2: { type: 'text', value: String(serviceName || 'Cleaning Service') },
      body_3: { type: 'text', value: String(date || '') },
      body_4: { type: 'text', value: String(time || '') },
    }),
  },

  WORKER_REASSIGNMENT: {
    msg91Name: process.env.MSG91_WA_TPL_WORKER_REASSIGNMENT || 'worker_reassignment',
    language: 'en',
    buildComponents: ({ oldWorkerName, newWorkerName, reason }) => ({
      body_1: { type: 'text', value: String(oldWorkerName || 'Previous worker') },
      body_2: { type: 'text', value: String(newWorkerName || 'New worker') },
      body_3: { type: 'text', value: String(reason || 'Schedule conflict') },
    }),
  },

  WORKER_ENROUTE: {
    msg91Name: process.env.MSG91_WA_TPL_WORKER_ENROUTE || 'worker_enroute',
    language: 'en',
    buildComponents: ({ workerName, eta }) => ({
      body_1: { type: 'text', value: String(workerName || 'Your worker') },
      body_2: { type: 'text', value: String(eta || 'shortly') },
    }),
  },

  // Schedule & Delays
  SCHEDULE_CHANGE: {
    msg91Name: process.env.MSG91_WA_TPL_SCHEDULE_CHANGE || 'schedule_change',
    language: 'en',
    buildComponents: ({ serviceName, newDate, newTime }) => ({
      body_1: { type: 'text', value: String(serviceName || 'Cleaning Service') },
      body_2: { type: 'text', value: String(newDate || '') },
      body_3: { type: 'text', value: String(newTime || '') },
    }),
  },

  DELAY_NOTIFICATION: {
    msg91Name: process.env.MSG91_WA_TPL_DELAY || 'delay_notification',
    language: 'en',
    buildComponents: ({ delayMinutes, reason }) => ({
      body_1: { type: 'text', value: String(delayMinutes || '15') },
      body_2: { type: 'text', value: String(reason || '') },
    }),
  },

  // Payments
  REFUND_PROCESSED: {
    msg91Name: process.env.MSG91_WA_TPL_REFUND || 'refund_processed',
    language: 'en',
    buildComponents: ({ amount, bookingId }) => ({
      body_1: { type: 'text', value: `₹${amount || 0}` },
      body_2: { type: 'text', value: String(bookingId || '') },
    }),
  },

  PAYMENT_RECEIVED: {
    msg91Name: process.env.MSG91_WA_TPL_PAYMENT || 'payment_received',
    language: 'en',
    buildComponents: ({ amount, serviceName }) => ({
      body_1: { type: 'text', value: `₹${amount || 0}` },
      body_2: { type: 'text', value: String(serviceName || 'Service') },
    }),
  },

  // Subscription
  SUBSCRIPTION_ACTIVATED: {
    msg91Name: process.env.MSG91_WA_TPL_SUB_ACTIVATED || 'subscription_activated',
    language: 'en',
    buildComponents: ({ planName, startDate, endDate }) => ({
      body_1: { type: 'text', value: String(planName || 'Subscription') },
      body_2: { type: 'text', value: String(startDate || '') },
      body_3: { type: 'text', value: String(endDate || '') },
    }),
  },

  SUBSCRIPTION_RENEWAL: {
    msg91Name: process.env.MSG91_WA_TPL_SUB_RENEWAL || 'subscription_renewal',
    language: 'en',
    buildComponents: ({ planName, renewalDate, amount }) => ({
      body_1: { type: 'text', value: String(planName || 'Subscription') },
      body_2: { type: 'text', value: String(renewalDate || '') },
      body_3: { type: 'text', value: amount ? `₹${amount}` : '' },
    }),
  },

  SUBSCRIPTION_PAUSED: {
    msg91Name: process.env.MSG91_WA_TPL_SUB_PAUSED || 'subscription_paused',
    language: 'en',
    buildComponents: ({ planName, pauseStart, pauseEnd }) => ({
      body_1: { type: 'text', value: String(planName || 'Subscription') },
      body_2: { type: 'text', value: String(pauseStart || '') },
      body_3: { type: 'text', value: String(pauseEnd || '') },
    }),
  },

  // SOS / Emergency
  SOS_ALERT: {
    msg91Name: process.env.MSG91_WA_TPL_SOS || 'sos_alert',
    language: 'en',
    buildComponents: ({ customerName, location }) => ({
      body_1: { type: 'text', value: String(customerName || 'Customer') },
      body_2: { type: 'text', value: String(location || 'Unknown') },
    }),
  },

  // Welcome
  WELCOME: {
    msg91Name: process.env.MSG91_WA_TPL_WELCOME || 'welcome_message',
    language: 'en',
    buildComponents: ({ name }) => ({
      body_1: { type: 'text', value: String(name || 'there') },
    }),
  },

  // Generic / fallback text notification
  GENERIC_NOTIFICATION: {
    msg91Name: process.env.MSG91_WA_TPL_GENERIC || 'generic_notification',
    language: 'en',
    buildComponents: ({ title, message }) => ({
      body_1: { type: 'text', value: String(title || 'Notification') },
      body_2: { type: 'text', value: String(message || '') },
    }),
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise any Indian phone string → 91XXXXXXXXXX (no +)
 */
function normalizePhone(phone) {
  if (!phone) throw new Error('Phone number is required');
  const digits = String(phone).replace(/\D/g, '');
  const last10 = digits.slice(-10);
  if (last10.length < 10) throw new Error('Enter a valid 10-digit mobile number');
  return `91${last10}`;
}

/**
 * Check if MSG91 WhatsApp is configured
 */
export function isMsg91WhatsAppConfigured() {
  return !!(MSG91_AUTH_KEY() && MSG91_INTEGRATED_NUMBER());
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

/**
 * Send a WhatsApp template message via MSG91
 *
 * @param {Object} opts
 * @param {string} opts.phone        – Recipient phone number (any format, Indian)
 * @param {string} opts.templateKey  – Key from WHATSAPP_TEMPLATES (e.g. 'BOOKING_CONFIRMED')
 * @param {Object} opts.variables    – Variables to fill in the template
 * @returns {Promise<{success:boolean, data?:any}>}
 */
export async function sendMsg91WhatsApp({ phone, templateKey, variables = {} }) {
  if (!isMsg91WhatsAppConfigured()) {
    console.warn('⚠️  MSG91 WhatsApp not configured. Set MSG91_AUTH_KEY & MSG91_WHATSAPP_INTEGRATED_NUMBER.');
    return { success: false, reason: 'MSG91 WhatsApp not configured' };
  }

  let template = WHATSAPP_TEMPLATES[templateKey];
  if (!template) {
    console.warn(`⚠️ Unknown WhatsApp template key: ${templateKey} — falling back to WELCOME`);
    template = WHATSAPP_TEMPLATES['WELCOME'];
  }

  const recipient = normalizePhone(phone);
  const components = template.buildComponents(variables);

  const payload = {
    integrated_number: MSG91_INTEGRATED_NUMBER(),
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      type: 'template',
      template: {
        name: template.msg91Name,
        language: {
          code: template.language,
          policy: 'deterministic',
        },
        ...(MSG91_TEMPLATE_NAMESPACE() ? { namespace: MSG91_TEMPLATE_NAMESPACE() } : {}),
        to_and_components: [
          {
            to: [recipient],
            components,
          },
        ],
      },
    },
  };

  try {
    console.log(`📲 Sending WhatsApp [${templateKey}] to ${recipient} via MSG91…`);

    const response = await fetch(MSG91_WHATSAPP_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: MSG91_AUTH_KEY(),
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`❌ MSG91 WhatsApp API error (${response.status}) for [${templateKey}] → ${recipient}:`, JSON.stringify(data));
      return { success: false, reason: data.message || data.error || `HTTP ${response.status}`, data };
    }

    // MSG91 returns 200 but may still report failure in the body
    if (data.type === 'error' || (data.message && data.message.toLowerCase().includes('error'))) {
      console.error(`❌ MSG91 WhatsApp API returned error body for [${templateKey}]:`, JSON.stringify(data));
      return { success: false, reason: data.message || 'MSG91 reported error', data };
    }

    console.log(`✅ WhatsApp [${templateKey}] sent to ${recipient} — MSG91 response:`, JSON.stringify(data));
    return { success: true, data };
  } catch (error) {
    console.error('❌ MSG91 WhatsApp send error:', error.message);
    return { success: false, reason: error.message };
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Send a plain-text WhatsApp using the GENERIC_NOTIFICATION template
 */
export async function sendMsg91WhatsAppText({ phone, title, message }) {
  return sendMsg91WhatsApp({
    phone,
    templateKey: 'GENERIC_NOTIFICATION',
    variables: { title, message },
  });
}

/**
 * Send OTP via MSG91 WhatsApp
 */
export async function sendMsg91WhatsAppOtp({ phone, otp, expiryMinutes = 10 }) {
  return sendMsg91WhatsApp({
    phone,
    templateKey: 'OTP_VERIFICATION',
    variables: { otp, expiryMinutes },
  });
}

// ---------------------------------------------------------------------------
// Map notification type → template key
// ---------------------------------------------------------------------------
const NOTIFICATION_TYPE_TO_TEMPLATE = {
  'booking-confirmed': 'BOOKING_CONFIRMED',
  'cancellation': 'BOOKING_CANCELLED',
  'booking-rescheduled': 'BOOKING_RESCHEDULED',
  'worker-assigned': 'WORKER_ASSIGNED',
  'worker-reassignment': 'WORKER_REASSIGNMENT',
  'worker-enroute': 'WORKER_ENROUTE',
  'schedule-change': 'SCHEDULE_CHANGE',
  'delay': 'DELAY_NOTIFICATION',
  'refund-processed': 'REFUND_PROCESSED',
  'payment': 'PAYMENT_RECEIVED',
  'subscription-renewal': 'SUBSCRIPTION_RENEWAL',
  'sos': 'SOS_ALERT',
  'booking': 'GENERIC_NOTIFICATION',
  'system': 'GENERIC_NOTIFICATION',
  'review': 'GENERIC_NOTIFICATION',
  'worker-registration': 'WELCOME',
  'worker-unavailable': 'GENERIC_NOTIFICATION',
};

/**
 * Resolve the best template key for a given notification type
 */
export function getTemplateKeyForType(notificationType) {
  return NOTIFICATION_TYPE_TO_TEMPLATE[notificationType] || 'GENERIC_NOTIFICATION';
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export { normalizePhone, WHATSAPP_TEMPLATES };

export default {
  isMsg91WhatsAppConfigured,
  sendMsg91WhatsApp,
  sendMsg91WhatsAppText,
  sendMsg91WhatsAppOtp,
  getTemplateKeyForType,
  WHATSAPP_TEMPLATES,
  normalizePhone,
};
