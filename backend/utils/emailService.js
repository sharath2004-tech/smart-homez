import sgMail from '@sendgrid/mail';
import crypto from 'crypto';

// SendGrid HTTP API — no SMTP ports needed, works on Render free tier.
// Free tier: 100 emails/day (https://sendgrid.com/free/)
//
// Required env vars on Render:
//   SENDGRID_API_KEY  — API key from SendGrid dashboard (starts with SG.)
//   SENDGRID_FROM     — verified sender email (e.g. noreply@yourdomain.com)
//                       Must be verified: SendGrid → Settings → Sender Authentication

const isEmailConfigured = () => !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM);

// Configure SDK once on first call (lazy init)
let _sgConfigured = false;
const configure = () => {
  if (_sgConfigured) return true;
  if (!isEmailConfigured()) return false;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  _sgConfigured = true;
  return true;
};

// Internal helper — sends one email via SendGrid and returns a result object
const sendMail = async ({ to, subject, html }) => {
  if (!configure()) {
    console.warn('⚠️ SendGrid not configured. Set SENDGRID_API_KEY and SENDGRID_FROM.');
    return { success: false, reason: 'Email not configured' };
  }
  try {
    const [response] = await sgMail.send({
      to,
      from: { email: process.env.SENDGRID_FROM, name: 'Healthy Homez' },
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to} | HTTP ${response.statusCode}`);
    return { success: true, statusCode: response.statusCode };
  } catch (error) {
    const detail = error?.response?.body?.errors?.[0]?.message || error.message;
    console.error(`❌ SendGrid error for ${to}:`, detail);
    return { success: false, reason: detail };
  }
};

// Shared HTML wrapper — keeps all emails on-brand
const emailShell = (headerTitle, bodyHtml) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}
    .container{max-width:600px;margin:0 auto;padding:20px}
    .header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0}
    .header h1{margin:0;font-size:22px}
    .content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
    .otp-box{background:white;border:2px solid #667eea;padding:20px;margin:20px 0;text-align:center;border-radius:8px}
    .otp{font-size:36px;font-weight:bold;color:#667eea;letter-spacing:8px;font-family:monospace}
    .password-box{background:white;border:2px solid #667eea;padding:20px;margin:20px 0;text-align:center;border-radius:8px}
    .password{font-size:24px;font-weight:bold;color:#667eea;letter-spacing:2px;font-family:monospace}
    .btn{display:inline-block;background:#667eea;color:white!important;padding:12px 30px;text-decoration:none;border-radius:6px;margin:20px 0;font-weight:bold}
    .warning{background:#fff3cd;border-left:4px solid #ffc107;padding:15px;margin:20px 0}
    .success-box{background:#d4edda;border-left:4px solid #28a745;padding:15px;margin:20px 0}
    .footer{text-align:center;color:#666;font-size:12px;margin-top:30px}
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${headerTitle}</h1></div>
    <div class="content">${bodyHtml}</div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} Healthy Homez. All rights reserved.</p></div>
  </div>
</body>
</html>`;

// Generate temporary password using cryptographically secure random bytes
export const generateTemporaryPassword = () => {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;

  // Rejection sampling for unbiased random index within [0, max)
  const randomIndex = (max) => {
    const limit = Math.floor(256 / max) * max;
    let byte;
    do {
      byte = crypto.randomBytes(1)[0];
    } while (byte >= limit);
    return byte % max;
  };

  // Ensure at least one character from each required category
  const password = [
    upper[randomIndex(upper.length)],
    lower[randomIndex(lower.length)],
    digits[randomIndex(digits.length)],
    special[randomIndex(special.length)],
    ...Array.from({ length: 6 }, () => all[randomIndex(all.length)])
  ];

  // Fisher-Yates shuffle using rejection-sampled random indices
  for (let i = password.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join('');
};

// ------------------------------------------------------------------
// Temporary password email (admin-created worker accounts)
// ------------------------------------------------------------------
export const sendTemporaryPasswordEmail = async (email, name, temporaryPassword) => {
  console.log('📧 sendTemporaryPasswordEmail called for:', email);
  if (!isEmailConfigured()) {
    console.log('ℹ️ Email not configured. Temporary password for', name, ':', temporaryPassword);
    return { success: false, reason: 'Email not configured', password: temporaryPassword };
  }
  const html = emailShell('Welcome to Healthy Homez!', `
    <p>Hi ${name},</p>
    <p>Welcome to the Healthy Homez team! Your worker account has been created by an administrator.</p>
    <div class="password-box">
      <p style="margin:0 0 10px 0;font-size:14px;color:#666;">Your Temporary Password:</p>
      <div class="password">${temporaryPassword}</div>
    </div>
    <div class="warning">
      <strong>⚠️ Important Security Notice:</strong>
      <ul style="margin:10px 0 0 0;padding-left:20px;">
        <li>This temporary password must be changed on your first login</li>
        <li>You will be prompted to create a new password immediately</li>
        <li>Do not share this password with anyone</li>
      </ul>
    </div>
    <div style="text-align:center;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:8082'}/login" class="btn">Log In Now</a>
    </div>
    <p><strong>Account details:</strong></p>
    <ul><li><strong>Email:</strong> ${email}</li><li><strong>Role:</strong> Worker</li></ul>
    <p>Best regards,<br>The Healthy Homez Team</p>
  `);
  const result = await sendMail({ to: email, subject: 'Welcome to Healthy Homez - Your Temporary Password', html });
  if (!result.success) result.password = temporaryPassword;
  return result;
};

// ------------------------------------------------------------------
// Password change confirmation
// ------------------------------------------------------------------
export const sendPasswordChangeConfirmation = async (email, name) => {
  if (!isEmailConfigured()) {
    console.log('ℹ️ Email not configured. Skipping password change confirmation to:', email);
    return { success: false, reason: 'Email not configured' };
  }
  const html = emailShell('✓ Password Changed Successfully', `
    <p>Hi ${name},</p>
    <div class="success-box">
      <strong>✓ Your password has been changed successfully!</strong>
      <p style="margin:10px 0 0 0;">Your Healthy Homez account is now secured with your new password.</p>
    </div>
    <p>If you did not make this change, please contact our support team immediately.</p>
    <p>Best regards,<br>The Healthy Homez Team</p>
  `);
  return sendMail({ to: email, subject: 'Password Changed Successfully - Healthy Homez', html });
};

// ------------------------------------------------------------------
// Password reset link email
// ------------------------------------------------------------------
export const sendPasswordResetEmail = async (email, name, resetUrl) => {
  if (!isEmailConfigured()) {
    console.log('ℹ️ Email not configured. Skipping password reset email for:', name);
    return { success: false, reason: 'Email not configured' };
  }
  const html = emailShell('🔒 Password Reset Request', `
    <p>Hi ${name},</p>
    <p>We received a request to reset your password. Click the button below to choose a new password:</p>
    <div style="text-align:center;">
      <a href="${resetUrl}" class="btn">Reset My Password</a>
    </div>
    <div class="warning">
      <strong>⚠️ This link expires in 1 hour.</strong><br>
      If you did not request a password reset, please ignore this email.
    </div>
    <p>Best regards,<br>The Healthy Homez Team</p>
  `);
  return sendMail({ to: email, subject: 'Reset Your Password - Healthy Homez', html });
};

// ------------------------------------------------------------------
// Password reset OTP email
// ------------------------------------------------------------------
export const sendPasswordResetOtpEmail = async (email, name, otp) => {
  if (!isEmailConfigured()) {
    console.log('ℹ️ Email not configured. Skipping password reset OTP email for:', name);
    return { success: false, reason: 'Email not configured' };
  }
  const html = emailShell('🔒 Password Reset OTP', `
    <p>Hi ${name},</p>
    <p>We received a request to reset your password. Use the OTP below to continue:</p>
    <div class="otp-box">
      <p style="margin:0 0 10px 0;font-size:14px;color:#666;">Your One-Time Password:</p>
      <div class="otp">${otp}</div>
    </div>
    <div class="warning">
      <strong>⚠️ This OTP expires in 10 minutes.</strong><br>
      If you did not request a password reset, please ignore this email.
    </div>
    <p>Best regards,<br>The Healthy Homez Team</p>
  `);
  return sendMail({ to: email, subject: 'Your Password Reset OTP - Healthy Homez', html });
};

// ------------------------------------------------------------------
// Signup email OTP (new user email verification)
// ------------------------------------------------------------------
export const sendSignupOtpEmail = async (email, otp) => {
  if (!isEmailConfigured()) {
    console.log(`ℹ️ Email not configured. Signup OTP for ${email}: ${otp}`);
    return { success: false, reason: 'Email not configured' };
  }
  const html = emailShell('✉️ Verify Your Email', `
    <p>Welcome to Healthy Homez!</p>
    <p>Use the OTP below to verify your email address and complete your sign-up:</p>
    <div class="otp-box">
      <p style="margin:0 0 10px 0;font-size:14px;color:#666;">Your One-Time Password:</p>
      <div class="otp">${otp}</div>
    </div>
    <div class="warning">
      <strong>⚠️ This OTP expires in 10 minutes.</strong><br>
      If you did not create a Healthy Homez account, please ignore this email.
    </div>
    <p>Best regards,<br>The Healthy Homez Team</p>
  `);
  return sendMail({ to: email, subject: 'Your Sign-Up OTP - Healthy Homez', html });
};

export default {
  generateTemporaryPassword,
  sendTemporaryPasswordEmail,
  sendPasswordChangeConfirmation,
  sendPasswordResetEmail,
  sendPasswordResetOtpEmail,
  sendSignupOtpEmail,
};
