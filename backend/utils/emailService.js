import crypto from 'crypto';
import dns from 'node:dns';
import nodemailer from 'nodemailer';

// Force IPv4 DNS resolution so SMTP connections are never attempted over IPv6.
// Many hosting providers (e.g. Render free tier) block outbound IPv6 traffic,
// causing ENETUNREACH errors when smtp.gmail.com resolves to an AAAA record.
dns.setDefaultResultOrder('ipv4first');

// Check if email is configured
const isEmailConfigured = () => {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
};

// Create a fresh transporter for every send to avoid stale-connection timeouts.
// A long-lived singleton SMTP connection can be silently dropped by firewalls or
// the SMTP server's idle timeout (common on cloud hosts like Render). The next
// send attempt would then block until the socket timeout fires. Using a new
// transporter each time guarantees a clean TCP connection for every email.
const createTransporter = () => {
  if (!isEmailConfigured()) {
    console.warn('⚠️ Email not configured. Set SMTP_USER and SMTP_PASS in .env file.');
    return null;
  }

  try {
    const port = parseInt(process.env.SMTP_PORT || '465');
    const secure = port === 465;
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure, // true for 465 (SSL), false for 587 (STARTTLS)
      requireTLS: !secure, // force STARTTLS upgrade on port 587
      family: 4, // force IPv4 socket — belt-and-suspenders alongside dns.setDefaultResultOrder
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 45000
    });
  } catch (error) {
    console.error('❌ Failed to create email transporter:', error.message);
    return null;
  }
};

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

// Send temporary password email
export const sendTemporaryPasswordEmail = async (email, name, temporaryPassword) => {
  try {
    console.log('📧 sendTemporaryPasswordEmail called for:', email);
    
    if (!isEmailConfigured()) {
      console.log('ℹ️ Email not configured. SMTP_USER:', process.env.SMTP_USER ? 'SET' : 'NOT SET');
      console.log('ℹ️ Email not configured. SMTP_PASS:', process.env.SMTP_PASS ? 'SET' : 'NOT SET');
      console.log('📧 Temporary password for', name, ':', temporaryPassword);
      return { success: false, reason: 'Email not configured', password: temporaryPassword };
    }

    console.log('✅ Email is configured. Creating transporter...');
    const transporter = createTransporter();
    if (!transporter) {
      console.log('ℹ️ Email transporter not available. Skipping email to:', email);
      return { success: false, reason: 'Transporter creation failed', password: temporaryPassword };
    }
    
    console.log('✅ Transporter created. Preparing email...');
    const mailOptions = {
      from: `"Healthy Homez" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Welcome to Healthy Homez - Your Temporary Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .password-box { background: white; border: 2px solid #667eea; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; }
            .password { font-size: 24px; font-weight: bold; color: #667eea; letter-spacing: 2px; font-family: monospace; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Healthy Homez!</h1>
              <p>Your worker account has been created</p>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>Welcome to the Healthy Homez team! Your worker account has been created by an administrator.</p>
              
              <div class="password-box">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Your Temporary Password:</p>
                <div class="password">${temporaryPassword}</div>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important Security Notice:</strong>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                  <li>This is a temporary password that must be changed on your first login</li>
                  <li>You will be required to create a new password immediately after logging in</li>
                  <li>Do not share this password with anyone</li>
                  <li>For security reasons, this email should be deleted after changing your password</li>
                </ul>
              </div>
              
              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:8082'}/login" class="button">Log In Now</a>
              </div>
              
              <p><strong>Your account details:</strong></p>
              <ul>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Role:</strong> Worker</li>
              </ul>
              
              <p>If you have any questions or need assistance, please contact our support team.</p>
              
              <p>Best regards,<br>The Healthy Homez Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Healthy Homez. All rights reserved.</p>
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    console.log('🚀 Sending email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Temporary password email sent successfully! Message ID:', info.messageId);
    console.log('📧 Email accepted by:', info.accepted);
    console.log('❌ Email rejected by:', info.rejected);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending temporary password email:');
    console.error('   Error message:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Error stack:', error.stack);
    return { success: false, reason: error.message, password: temporaryPassword };
  }
};

// Send password change confirmation email
export const sendPasswordChangeConfirmation = async (email, name) => {
  try {
    if (!isEmailConfigured()) {
      console.log('ℹ️ Email not configured. Skipping password change confirmation to:', email);
      return { success: false, reason: 'Email not configured' };
    }

    const transporter = createTransporter();
    if (!transporter) {
      console.log('ℹ️ Email transporter not available. Skipping password change confirmation.');
      return { success: false, reason: 'Transporter creation failed' };
    }
    
    const mailOptions = {
      from: `"Healthy Homez" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Password Changed Successfully - Healthy Homez',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .success-box { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✓ Password Changed Successfully</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              
              <div class="success-box">
                <strong>✓ Your password has been changed successfully!</strong>
                <p style="margin: 10px 0 0 0;">Your Healthy Homez account is now secured with your new password.</p>
              </div>
              
              <p>If you did not make this change, please contact our support team immediately.</p>
              
              <p>Best regards,<br>The Healthy Homez Team</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password change confirmation email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending password change confirmation:', error.message);
    return { success: false, reason: error.message };
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (email, name, resetUrl) => {
  try {
    if (!isEmailConfigured()) {
      console.log('ℹ️ Email not configured. Skipping password reset email for:', name);
      return { success: false, reason: 'Email not configured' };
    }

    const transporter = createTransporter();
    if (!transporter) {
      return { success: false, reason: 'Transporter creation failed' };
    }

    const mailOptions = {
      from: `"Healthy Homez" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Reset Your Password - Healthy Homez',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>🔒 Password Reset Request</h1></div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>We received a request to reset your password. Click the button below to choose a new password:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset My Password</a>
              </div>
              <div class="warning">
                <strong>⚠️ This link expires in 1 hour.</strong><br>
                If you did not request a password reset, please ignore this email — your password will remain unchanged.
              </div>
              <p>Best regards,<br>The Healthy Homez Team</p>
            </div>
            <div class="footer"><p>© ${new Date().getFullYear()} Healthy Homez. All rights reserved.</p></div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent to:', email, 'Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending password reset email:', error.message);
    return { success: false, reason: error.message };
  }
};

// Send password reset OTP email
export const sendPasswordResetOtpEmail = async (email, name, otp) => {
  try {
    if (!isEmailConfigured()) {
      console.log('ℹ️ Email not configured. Skipping password reset OTP email for:', name);
      return { success: false, reason: 'Email not configured' };
    }

    const transporter = createTransporter();
    if (!transporter) {
      return { success: false, reason: 'Transporter creation failed' };
    }

    const mailOptions = {
      from: `"Healthy Homez" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Password Reset OTP - Healthy Homez',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-box { background: white; border: 2px solid #667eea; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; }
            .otp { font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: monospace; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>🔒 Password Reset OTP</h1></div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>We received a request to reset your password. Use the OTP below to continue:</p>
              <div class="otp-box">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Your One-Time Password:</p>
                <div class="otp">${otp}</div>
              </div>
              <div class="warning">
                <strong>⚠️ This OTP expires in 10 minutes.</strong><br>
                If you did not request a password reset, please ignore this email — your password will remain unchanged.
              </div>
              <p>Best regards,<br>The Healthy Homez Team</p>
            </div>
            <div class="footer"><p>© ${new Date().getFullYear()} Healthy Homez. All rights reserved.</p></div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset OTP email sent to:', email, 'Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending password reset OTP email:', error.message);
    return { success: false, reason: error.message };
  }
};

// Send signup email OTP (for new user email verification)
export const sendSignupOtpEmail = async (email, otp) => {
  try {
    if (!isEmailConfigured()) {
      console.log(`ℹ️ Email not configured. Signup OTP for ${email}: ${otp}`);
      return { success: false, reason: 'Email not configured' };
    }

    const transporter = createTransporter();
    if (!transporter) return { success: false, reason: 'Transporter creation failed' };

    const mailOptions = {
      from: `"Healthy Homez" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Sign-Up OTP - Healthy Homez',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-box { background: white; border: 2px solid #667eea; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; }
            .otp { font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: monospace; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>✉️ Verify Your Email</h1></div>
            <div class="content">
              <p>Welcome to Healthy Homez!</p>
              <p>Use the OTP below to verify your email address and complete your sign-up:</p>
              <div class="otp-box">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Your One-Time Password:</p>
                <div class="otp">${otp}</div>
              </div>
              <div class="warning">
                <strong>⚠️ This OTP expires in 10 minutes.</strong><br>
                If you did not create a Healthy Homez account, please ignore this email.
              </div>
              <p>Best regards,<br>The Healthy Homez Team</p>
            </div>
            <div class="footer"><p>© ${new Date().getFullYear()} Healthy Homez. All rights reserved.</p></div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Signup OTP email sent to:', email, 'Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending signup OTP email:', error.message);
    return { success: false, reason: error.message };
  }
};

export default {
  generateTemporaryPassword,
  sendTemporaryPasswordEmail,
  sendPasswordChangeConfirmation,
  sendPasswordResetEmail,
  sendPasswordResetOtpEmail,
  sendSignupOtpEmail
};
