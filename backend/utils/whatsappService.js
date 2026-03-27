import twilio from 'twilio';

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

export const isWhatsAppConfigured = () => Boolean(
  process.env.TWILIO_ACCOUNT_SID
  && process.env.TWILIO_AUTH_TOKEN
  && process.env.TWILIO_WHATSAPP_NUMBER
);

export const isWhatsAppOtpConfigured = () => Boolean(
  process.env.TWILIO_ACCOUNT_SID
  && process.env.TWILIO_AUTH_TOKEN
  && process.env.TWILIO_VERIFY_SID
  && process.env.OTP_DELIVERY_CHANNEL === 'whatsapp'
);

export const sendWhatsAppMessage = async ({ phone, message }) => {
  const to = normalizeIndianPhoneToE164(phone);
  const client = getTwilioClient();

  await client.messages.create({
    from: getWhatsAppSender(),
    to: `whatsapp:${to}`,
    body: message,
  });

  return { success: true, channel: 'whatsapp', to };
};

export const sendWhatsAppOtp = async (phone) => {
  const to = normalizeIndianPhoneToE164(phone);
  const client = getTwilioClient();

  await client.verify.v2.services(getTwilioVerifySid()).verifications.create({
    to,
    channel: 'whatsapp',
  });

  return { success: true, channel: 'whatsapp', to };
};

export const verifyWhatsAppOtp = async (phone, code) => {
  const to = normalizeIndianPhoneToE164(phone);
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
