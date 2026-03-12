import nodemailer from 'nodemailer';

// Check if email is configured
const isEmailConfigured = () => {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
};

// Create transporter
const createTransporter = () => {
  if (!isEmailConfigured()) {
    console.warn('⚠️ Email not configured. Set SMTP_USER and SMTP_PASS in .env file.');
    return null;
  }

  try {
    const port = parseInt(process.env.SMTP_PORT || '465');
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465, // true for 465 (SSL), false for 587 (STARTTLS)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  } catch (error) {
    console.error('❌ Failed to create email transporter:', error.message);
    return null;
  }
};

// Generate temporary password
export const generateTemporaryPassword = () => {
  // Generate a random 10-character password with uppercase, lowercase, numbers, and special chars
  const length = 10;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special char
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
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
      from: `"Smart Homez" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Welcome to Smart Homez - Your Temporary Password',
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
              <h1>Welcome to Smart Homez!</h1>
              <p>Your worker account has been created</p>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>Welcome to the Smart Homez team! Your worker account has been created by an administrator.</p>
              
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
              
              <p>Best regards,<br>The Smart Homez Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Smart Homez. All rights reserved.</p>
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
      from: `"Smart Homez" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Password Changed Successfully - Smart Homez',
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
                <p style="margin: 10px 0 0 0;">Your Smart Homez account is now secured with your new password.</p>
              </div>
              
              <p>If you did not make this change, please contact our support team immediately.</p>
              
              <p>Best regards,<br>The Smart Homez Team</p>
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
      from: `"Smart Homez" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Reset Your Password - Smart Homez',
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
              <p>Best regards,<br>The Smart Homez Team</p>
            </div>
            <div class="footer"><p>© ${new Date().getFullYear()} Smart Homez. All rights reserved.</p></div>
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

export default {
  generateTemporaryPassword,
  sendTemporaryPasswordEmail,
  sendPasswordChangeConfirmation,
  sendPasswordResetEmail
};
