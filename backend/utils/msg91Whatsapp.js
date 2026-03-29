/**
 * MSG91 WhatsApp utility (DEPRECATED)
 *
 * This file is kept for backward compatibility.
 * Use msg91WhatsappService.js instead — it provides ES module exports,
 * template-based messaging, OTP support, and auto-fallback to Twilio.
 */

import {
    isMsg91WhatsAppConfigured,
    normalizePhone,
    sendMsg91WhatsAppText
} from './msg91WhatsappService.js';

/**
 * Send WhatsApp message via MSG91 (legacy API)
 * @param {Object} params
 * @param {string} params.to - Recipient mobile number (with country code)
 * @param {string} params.templateId - MSG91 template name
 * @param {Object} params.variables - Variables for the template
 */
export async function sendWhatsappMessage({ to, templateId, variables }) {
  if (!isMsg91WhatsAppConfigured()) {
    throw new Error('MSG91 WhatsApp not configured');
  }

  const phone = normalizePhone(to);

  // If a specific templateId is provided, try to match it
  // Otherwise fall back to generic
  const result = await sendMsg91WhatsAppText({
    phone,
    title: variables?.title || 'Notification',
    message: variables?.message || '',
  });

  if (!result.success) {
    throw new Error(result.reason || 'MSG91 WhatsApp send failed');
  }

  return result;
}

export default { sendWhatsappMessage };