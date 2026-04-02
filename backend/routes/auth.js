import crypto from 'crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';
import { authenticate } from '../middleware/auth.js';
import { uploadProfilePicture, uploadWorkerFiles } from '../middleware/upload.js';
import Location from '../models/Location.js';
import Notification from '../models/Notification.js';
import Settings from '../models/Settings.js';
import User from '../models/User.js';
import { sendPasswordChangeConfirmation, sendPasswordResetEmail, sendPasswordResetOtpEmail, sendSignupOtpEmail } from '../utils/emailService.js';
import { sendOTP, verifyOTP } from '../utils/msg91Service.js';
import { evaluateWorkerEffectiveAvailability } from '../utils/workerAvailability.js';

// Google OAuth
import { OAuth2Client } from 'google-auth-library';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('SMS service not configured');
  return twilio(sid, token);
}

function getVerifySid() {
  const sid = process.env.TWILIO_VERIFY_SID;
  if (!sid) throw new Error('SMS verify service not configured');
  return sid;
}

function toE164(phone) {
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length < 10) throw new Error('Enter a valid 10-digit mobile number');
  return `+91${digits}`;
}

function normalizeIndianPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  if (digits.length < 10) return null;
  return `+91${digits}`;
}

const router = express.Router();

const handleProfilePictureUpload = (req, res, next) => {
  uploadProfilePicture(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    const status = err?.name === 'MulterError' ? 400 : 400;
    res.status(status).json({
      error: {
        message: err.message || 'Profile picture upload failed',
        status
      }
    });
  });
};

const getPasswordSetupState = (user) => {
  const hasCustomPassword = user?.hasCustomPassword !== false;
  return {
    hasCustomPassword,
    needsPasswordSetup: Boolean(user?.isFirstLogin || !hasCustomPassword)
  };
};

const isMatchingTemporaryPassword = (submittedPassword, temporaryPassword) => {
  if (typeof submittedPassword !== 'string' || typeof temporaryPassword !== 'string') {
    return false;
  }

  if (submittedPassword === temporaryPassword) {
    return true;
  }

  const trimmedSubmittedPassword = submittedPassword.trim();
  return trimmedSubmittedPassword.length > 0 && trimmedSubmittedPassword === temporaryPassword;
};

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

const looksLikeBcryptHash = (value) => (
  typeof value === 'string' && BCRYPT_HASH_PATTERN.test(value)
);

const resolveFirstLoginPasswordFallback = (submittedPassword, user) => {
  if (!user?.isFirstLogin) {
    return null;
  }

  if (isMatchingTemporaryPassword(submittedPassword, user.temporaryPassword)) {
    return user.temporaryPassword;
  }

  if (typeof user?.password === 'string' && !looksLikeBcryptHash(user.password)) {
    if (isMatchingTemporaryPassword(submittedPassword, user.password)) {
      return user.password;
    }
  }

  return null;
};

// Rate limiter for sensitive auth endpoints (OTP / password reset)
const sensitiveAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests, please try again later.', status: 429 } }
});

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register',
  sensitiveAuthLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/).withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
    body('role').optional().isIn(['customer', 'worker', 'admin']).withMessage('Invalid role')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password, role, phone, location, gender, religion, workerProfile, isPhoneVerified } = req.body;
      const normalizedRole = role || 'customer';
      const normalizedPhone = normalizeIndianPhone(phone);

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingUser) {
        console.log(`⚠️ Registration attempt with existing email: ${email}`);
        return res.status(400).json({ 
          error: { message: 'User already exists with this email', status: 400 } 
        });
      }

      if (phone && !normalizedPhone) {
        return res.status(400).json({
          error: { message: 'Enter a valid 10-digit mobile number', status: 400 }
        });
      }

      if (normalizedPhone) {
        const phoneDigits = normalizedPhone.slice(-10);
        const existingPhoneRoleUser = await User.findOne({
          role: normalizedRole,
          phone: { $regex: `${phoneDigits}$` }
        });

        if (existingPhoneRoleUser) {
          return res.status(409).json({
            error: {
              message: `A ${normalizedRole} account with this mobile number already exists. Please log in instead.`,
              status: 409
            }
          });
        }
      }

      console.log(`✅ No existing user found for email: ${email}, proceeding with registration`);

      // Load configurable settings
      const settings = await Settings.getSettings();

      // Prepare user data
      const userData = {
        name,
        email: email.toLowerCase().trim(), // Normalize email
        password,
        role: normalizedRole,
        phone: normalizedPhone || phone,
        gender: gender || 'prefer_not_to_say',
        religion: religion || undefined,
        isPhoneVerified: isPhoneVerified === true || isPhoneVerified === 'true',
        isFirstLogin: false // Self-registered users don't need password change
      };

      // Add location data if provided
      if (location && location.coordinates && location.coordinates.length === 2) {
        // Add to addresses array
        userData.addresses = [{
          label: 'Home',
          street: location.address || '',
          area: location.area || '',
          city: location.city || '',
          zipCode: location.zipCode || '',
          location: {
            type: 'Point',
            coordinates: location.coordinates // [longitude, latitude]
          },
          isDefault: true
        }];

        // Set currentLocation
        userData.currentLocation = {
          type: 'Point',
          coordinates: location.coordinates,
          lastUpdated: new Date()
        };

        // For workers, initialize workerProfile with service area
        if (role === 'worker' && location.serviceAreaId) {
          let locationId = null;
          // Try to find the Location document by city and area
          if (location.city && location.area) {
            const foundLocation = await Location.findOne({
              city: new RegExp(`^${location.city}$`, 'i'),
              area: new RegExp(`^${location.area}$`, 'i')
            }).select('_id apartmentName');
            if (foundLocation) {
              locationId = foundLocation._id;
            }
          }
          userData.workerProfile = {
            experience: workerProfile?.experience || 0,
            assignedApartments: [{
              locationId, // Include the Location document ID if found
              apartmentName: location.area || '',
              area: location.area || '',
              city: location.city || '',
              location: {
                type: 'Point',
                coordinates: location.coordinates
              },
              maxWalkingDistance: settings.booking.serviceRadius // configurable
            }],
            serviceRadius: settings.booking.serviceRadius // configurable
          };
        } else if (role === 'worker' && workerProfile) {
          // If no location but workerProfile provided
          userData.workerProfile = {
            experience: workerProfile.experience || 0
          };
        }
      } else if (role === 'worker' && workerProfile) {
        // Worker without location
        userData.workerProfile = {
          experience: workerProfile.experience || 0
        };
      }

      // Create new user
      const user = new User(userData);

      await user.save();

      console.log(`✅ User registered successfully: ${email} (ID: ${user._id})`);

      // Create JWT token
      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle MongoDB duplicate key error (unique index violation)
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern || {})[0];
        return res.status(400).json({ 
          error: { 
            message: `A user with this ${field || 'email'} already exists. If you recently deleted this account, please wait a moment and try again.`, 
            status: 400 
          } 
        });
      }
      
      res.status(500).json({ error: { message: 'Server error during registration', status: 500 } });
    }
  }
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login',
  sensitiveAuthLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Normalize email (lowercase and trim) to match schema
      const normalizedEmail = email.toLowerCase().trim();

      // Find user with password and temporary password fields
      const user = await User.findOne({ email: normalizedEmail }).select('+password +temporaryPassword');
      if (!user) {
        return res.status(401).json({ 
          error: { message: 'Invalid credentials', status: 401 } 
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(401).json({ 
          error: { message: 'Account is deactivated', status: 401 } 
        });
      }

      // Verify password. For first-login accounts, also allow the stored temporary
      // password as a fallback in case the persisted hash became out of sync.
      let isMatch = await user.comparePassword(password);
      let usedTemporaryPasswordFallback = false;

      const fallbackPassword = resolveFirstLoginPasswordFallback(password, user);

      if (!isMatch && fallbackPassword) {
        isMatch = true;
        usedTemporaryPasswordFallback = true;

        try {
          user.password = fallbackPassword;
          if (!user.temporaryPassword) {
            user.temporaryPassword = fallbackPassword;
          }
          await user.save({ validateBeforeSave: false });
          console.warn(`⚠️ Repaired password hash for first-login user ${user.email} using temporary password fallback.`);
        } catch (repairError) {
          console.error(`Failed to repair password hash for ${user.email}:`, repairError);
        }
      }

      if (!isMatch) {
        return res.status(401).json({ 
          error: { message: 'Invalid credentials', status: 401 } 
        });
      }

      // Create JWT token
      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.json({
        message: usedTemporaryPasswordFallback ? 'Login successful (temporary password verified)' : 'Login successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          profileImage: user.profileImage,
          isFirstLogin: user.isFirstLogin,
          ...getPasswordSetupState(user)
        },
        requirePasswordChange: getPasswordSetupState(user).needsPasswordSetup
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = req.user.toObject();

    if (user.role === 'worker' && user.workerProfile) {
      const effectiveAvailability = await evaluateWorkerEffectiveAvailability(req.user);
      user.workerProfile = {
        ...user.workerProfile,
        manualAvailability: user.workerProfile.availability,
        availability: effectiveAvailability.effectiveAvailability,
        effectiveAvailability: effectiveAvailability.effectiveAvailability,
        availabilityReason: effectiveAvailability.reason,
        withinWorkingWindow: effectiveAvailability.withinWorkingWindow,
        operationsCompleted: effectiveAvailability.operationsCompleted
      };
    }

    res.json({ user: { ...user, ...getPasswordSetupState(req.user) } });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PATCH /api/auth/me
// @desc    Update current user profile (name, phone, gender, religion)
// @access  Private
router.patch('/me', authenticate, handleProfilePictureUpload,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('phone').optional().trim(),
    body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_to_say']).withMessage('Invalid gender value'),
    body('religion').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, phone, gender, religion } = req.body;
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) updateData.phone = phone;
      if (gender !== undefined) updateData.gender = gender;
      if (religion !== undefined) updateData.religion = religion;
      if (req.file) {
        updateData.profileImage = `/uploads/profile-pics/${req.file.filename}`;
      }

      // Email change: check for duplicates before updating
      if (email !== undefined) {
        const normalizedEmail = email.toLowerCase().trim();
        const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: req.user._id } });
        if (existing) {
          return res.status(400).json({ error: { message: 'Email is already in use', status: 400 } });
        }
        updateData.email = normalizedEmail;
      }

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({ error: { message: 'User not found', status: 404 } });
      }

      res.json({ message: 'Profile updated successfully', user });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/auth/change-password
// @desc    Change password (for first-time login or regular password change)
// @access  Private
router.post('/change-password',
  authenticate,
  [
    body('currentPassword').optional().isString(),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/).withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;

      // Find user with password field
      const user = await User.findById(req.user._id).select('+password +temporaryPassword');
      if (!user) {
        return res.status(404).json({ 
          error: { message: 'User not found', status: 404 } 
        });
      }

      const { needsPasswordSetup } = getPasswordSetupState(user);

      if (!needsPasswordSetup) {
        if (!currentPassword) {
          return res.status(400).json({ 
            error: { message: 'Current password is required', status: 400 } 
          });
        }

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
          return res.status(401).json({ 
            error: { message: 'Current password is incorrect', status: 401 } 
          });
        }
      }

      // Update password and clear setup flags
      user.password = newPassword;
      user.temporaryPassword = undefined;
      user.isFirstLogin = false;
      user.hasCustomPassword = true;
      await user.save();

      // Send confirmation email
      try {
        await sendPasswordChangeConfirmation(user.email, user.name);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Continue even if email fails
      }

      res.json({
        message: needsPasswordSetup ? 'Password added successfully' : 'Password changed successfully',
        success: true
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/auth/forgot-password
// @desc    Request a password reset link (sends email with token)
// @access  Public
router.post('/forgot-password',
  [body('email').isEmail().withMessage('Valid email is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;
      const user = await User.findOne({ email: email.toLowerCase().trim() });

      // Always return success to prevent user enumeration
      if (!user) {
        return res.json({ message: 'If that email exists, a reset link has been sent.' });
      }

      // Generate a secure random token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save({ validateBeforeSave: false });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
      const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

      // Respond immediately so client never times out waiting for SMTP
      res.json({ message: 'If that email exists, a reset link has been sent.' });

      // Send email in the background after responding
      sendPasswordResetEmail(user.email, user.name, resetUrl).catch((emailError) => {
        console.error('Failed to send reset email:', emailError);
      });

      return; // prevent outer catch from sending another response
    } catch (error) {
      if (res.headersSent) return;
      console.error('Forgot password error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/auth/reset-password
// @desc    Reset password using token from email
// @access  Public
router.post('/reset-password',
  [
    body('token').notEmpty().withMessage('Token is required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/).withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, newPassword } = req.body;
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      }).select('+password +passwordResetToken +passwordResetExpires');

      if (!user) {
        return res.status(400).json({ error: { message: 'Invalid or expired reset token.', status: 400 } });
      }

      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.isFirstLogin = false;
      user.hasCustomPassword = true;
      await user.save();

      try {
        await sendPasswordChangeConfirmation(user.email, user.name);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }

      res.json({ message: 'Password reset successfully. You can now log in.', success: true });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/auth/forgot-password-email-otp
// @desc    Send OTP to email for password reset
// @access  Public
router.post('/forgot-password-email-otp',
  sensitiveAuthLimiter,
  [body('email').isEmail().withMessage('Valid email is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;
      const user = await User.findOne({ email: email.toLowerCase().trim() });

      // Always return success to prevent user enumeration
      if (!user) {
        return res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });
      }

      // Generate a 6-digit numeric OTP
      const otp = String(100000 + crypto.randomInt(900000));
      const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

      user.passwordResetToken = hashedOtp;
      user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await user.save({ validateBeforeSave: false });

      // Respond immediately so client never times out waiting for SMTP
      res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });

      // Send email in the background after responding
      sendPasswordResetOtpEmail(user.email, user.name, otp).catch((emailError) => {
        console.error('Failed to send reset OTP email:', emailError);
      });

      return;
    } catch (error) {
      if (res.headersSent) return;
      console.error('Forgot password email OTP error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/auth/reset-password-email-otp
// @desc    Verify email OTP and reset password
// @access  Public
router.post('/reset-password-email-otp',
  sensitiveAuthLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('otp').notEmpty().withMessage('OTP is required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Must contain uppercase letter')
      .matches(/[a-z]/).withMessage('Must contain lowercase letter')
      .matches(/[0-9]/).withMessage('Must contain a number')
      .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Must contain a special character')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, otp, newPassword } = req.body;
      const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

      const user = await User.findOne({
        email: email.toLowerCase().trim(),
        passwordResetToken: hashedOtp,
        passwordResetExpires: { $gt: Date.now() }
      }).select('+password +passwordResetToken +passwordResetExpires');

      if (!user) {
        return res.status(400).json({ error: { message: 'Invalid or expired OTP.', status: 400 } });
      }

      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.isFirstLogin = false;
      user.hasCustomPassword = true;
      await user.save();

      try {
        await sendPasswordChangeConfirmation(user.email, user.name);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }

      res.json({ message: 'Password reset successfully. You can now log in.', success: true });
    } catch (error) {
      console.error('Reset password email OTP error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/auth/forgot-password-phone
// @desc    Send OTP to phone for password reset
// @access  Public
router.post('/forgot-password-phone',
  sensitiveAuthLimiter,
  [body('phone').notEmpty().withMessage('Phone number is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { phone } = req.body;

      // Check user exists with this phone (don't reveal if not found)
      const e164 = toE164(phone);

      // Use only digits for matching — all digits are safe in regex so no escaping needed
      const digits = phone.replace(/\D/g, '').slice(-10);
      const user = await User.findOne({ phone: { $regex: `${digits}$` } });
      if (!user) {
        return res.json({ success: true, message: 'If that phone is registered, an OTP has been sent.' });
      }

      // Send OTP via MSG91 (automatically falls back to Twilio if configured)
      await sendOTP(e164);

      res.json({ success: true, message: 'OTP sent to your phone.' });
    } catch (error) {
      console.error('Forgot password phone error:', error.message);
      if (error.message.includes('not configured')) {
        return res.status(500).json({ error: { message: 'SMS service not available. Use email reset instead.', status: 500 } });
      }
      res.status(400).json({ error: { message: error.message || 'Failed to send OTP', status: 400 } });
    }
  }
);

// @route   POST /api/auth/reset-password-phone
// @desc    Verify OTP and reset password via phone
// @access  Public
router.post('/reset-password-phone',
  sensitiveAuthLimiter,
  [
    body('phone').notEmpty().withMessage('Phone is required'),
    body('otp').notEmpty().withMessage('OTP is required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Must contain uppercase letter')
      .matches(/[a-z]/).withMessage('Must contain lowercase letter')
      .matches(/[0-9]/).withMessage('Must contain a number')
      .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Must contain a special character')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { phone, otp, newPassword } = req.body;
      const e164 = toE164(phone);

      // Verify OTP via MSG91 (automatically falls back to Twilio if needed)
      const result = await verifyOTP(e164, otp);

      if (!result.verified) {
        return res.status(400).json({ error: { message: 'Invalid or expired OTP', status: 400 } });
      }

      const digits = phone.replace(/\D/g, '').slice(-10);
      const user = await User.findOne({ phone: { $regex: `${digits}$` } }).select('+password');
      if (!user) {
        return res.status(404).json({ error: { message: 'User not found', status: 404 } });
      }

      user.password = newPassword;
      user.isFirstLogin = false;
      user.hasCustomPassword = true;
      await user.save();

      try { await sendPasswordChangeConfirmation(user.email, user.name); } catch {}

      res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
      console.error('Reset password phone error:', error.message);

      // Handle verification errors
      if (error.message.includes('Invalid OTP')) {
        return res.status(400).json({ error: { message: 'Incorrect OTP', status: 400 } });
      }
      if (error.message.includes('expired')) {
        return res.status(400).json({ error: { message: 'OTP has expired. Please request a new one.', status: 400 } });
      }

      res.status(500).json({ error: { message: error.message || 'Server error', status: 500 } });
    }
  }
);

router.patch('/preferences', authenticate, async (req, res) => {
  try {
    const { preferences } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { preferences } },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        error: { message: 'User not found', status: 404 }
      });
    }

    res.json({
      message: 'Preferences updated successfully',
      user
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/auth/update-location
// @desc    Update customer location (used after Google OAuth signup)
// @access  Private
router.post('/update-location', authenticate, async (req, res) => {
  try {
    const { locationId } = req.body;

    if (!locationId) {
      return res.status(400).json({
        error: { message: 'Location ID is required', status: 400 }
      });
    }

    // Only customers can update location this way
    if (req.user.role !== 'customer') {
      return res.status(403).json({
        error: { message: 'This endpoint is only for customer accounts', status: 403 }
      });
    }

    // Find the location document
    const foundLocation = await Location.findById(locationId).select('_id apartmentName area city state zipCode location');
    if (!foundLocation) {
      return res.status(400).json({
        error: { message: 'Selected location does not exist. Please choose a valid location.', status: 400 }
      });
    }

    // Prepare location data
    const updateData = {};

    // Add to addresses array
    if (foundLocation.location?.coordinates?.length === 2) {
      updateData.addresses = [{
        label: 'Home',
        street: '',
        area: foundLocation.area || '',
        city: foundLocation.city || '',
        zipCode: foundLocation.zipCode || '',
        location: {
          type: 'Point',
          coordinates: foundLocation.location.coordinates // [longitude, latitude]
        },
        isDefault: true
      }];

      // Set currentLocation
      updateData.currentLocation = {
        type: 'Point',
        coordinates: foundLocation.location.coordinates,
        lastUpdated: new Date()
      };
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        error: { message: 'User not found', status: 404 }
      });
    }

    console.log(`✅ Location updated for customer ${user.email}: ${foundLocation.city}, ${foundLocation.area}`);

    res.json({
      success: true,
      message: 'Location updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        addresses: user.addresses,
        currentLocation: user.currentLocation
      }
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// In-memory store for signup email OTPs: email → { hash, expiresAt }
const signupEmailOtpStore = new Map();

// @route   POST /api/auth/send-email-otp
// @desc    Send a 6-digit OTP to an email address for signup verification
// @access  Public
router.post('/send-email-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }
    const key = email.toLowerCase().trim();
    const otp = String(100000 + crypto.randomInt(900000));
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    signupEmailOtpStore.set(key, { hash: hashedOtp, expiresAt: Date.now() + 10 * 60 * 1000 });
    // Actually send the email and fail if it can't be delivered
    const result = await sendSignupOtpEmail(key, otp);
    if (!result.success) {
      signupEmailOtpStore.delete(key);
      return res.status(503).json({ message: 'Email service is unavailable. Please sign up with phone number instead.' });
    }
    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ message: 'Failed to send OTP' });
  }
});

// @route   POST /api/auth/verify-email-otp
// @desc    Verify the 6-digit signup email OTP (does NOT create the user)
// @access  Public
router.post('/verify-email-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }
    const key = email.toLowerCase().trim();
    const record = signupEmailOtpStore.get(key);
    if (!record) {
      return res.status(400).json({ message: 'No OTP found for this email. Please request a new one.' });
    }
    if (Date.now() > record.expiresAt) {
      signupEmailOtpStore.delete(key);
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }
    const hashedInput = crypto.createHash('sha256').update(String(otp)).digest('hex');
    if (hashedInput !== record.hash) {
      return res.status(400).json({ message: 'Incorrect OTP. Please try again.' });
    }
    signupEmailOtpStore.delete(key); // Consume OTP — one-time use
    res.json({ success: true, verified: true });
  } catch (err) {
    res.status(500).json({ message: 'Verification failed' });
  }
});

// @route   POST /api/auth/register-worker
// @desc    Register a new worker with profile pic + Aadhaar documents
// @access  Public (multipart/form-data)
router.post('/register-worker',
  uploadWorkerFiles.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { name, email, password, phone, gender, experience, skills, location, phoneVerified, emailVerified, contactMethod, otpVerified } = req.body;

      // Validate OTP verification
      if (otpVerified !== 'true') {
        return res.status(400).json({ error: { message: 'Please verify your email or phone before registering', status: 400 } });
      }

      // Validate required text fields
      if (!name || !email || !password || !phone) {
        return res.status(400).json({ error: { message: 'Name, email, password and phone are required', status: 400 } });
      }

      // Validate password strength
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: { message: 'Password must be at least 8 characters with uppercase, lowercase, number and special character', status: 400 } });
      }

      // Validate required files
      if (!req.files?.profilePicture?.[0]) {
        return res.status(400).json({ error: { message: 'Profile picture is required', status: 400 } });
      }
      if (!req.files?.aadhaarFront?.[0]) {
        return res.status(400).json({ error: { message: 'Aadhaar front image is required', status: 400 } });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingUser) {
        return res.status(400).json({ error: { message: 'User already exists with this email', status: 400 } });
      }

      const normalizedPhone = normalizeIndianPhone(phone);
      if (!normalizedPhone) {
        return res.status(400).json({ error: { message: 'Enter a valid 10-digit mobile number', status: 400 } });
      }

      const phoneDigits = normalizedPhone.slice(-10);
      const existingWorkerWithPhone = await User.findOne({
        role: 'worker',
        phone: { $regex: `${phoneDigits}$` }
      });
      if (existingWorkerWithPhone) {
        return res.status(409).json({
          error: {
            message: 'A worker account with this mobile number already exists. Please log in instead.',
            status: 409
          }
        });
      }

      const settings = await Settings.getSettings();

      // Parse skills from JSON string if needed
      let parsedSkills = [];
      if (skills) {
        try {
          parsedSkills = typeof skills === 'string' ? JSON.parse(skills) : skills;
        } catch {
          parsedSkills = Array.isArray(skills) ? skills : [skills];
        }
      }

      // Parse location from JSON string if needed
      let parsedLocation = null;
      if (location) {
        try {
          parsedLocation = typeof location === 'string' ? JSON.parse(location) : location;
        } catch { /* ignore */ }
      }

      const profilePicFile = req.files.profilePicture[0];
      const aadhaarFrontFile = req.files.aadhaarFront[0];
      const aadhaarBackFile = req.files.aadhaarBack?.[0] || null;

      const userData = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        role: 'worker',
        phone: normalizedPhone,
        gender: gender || 'prefer_not_to_say',
        profileImage: `/uploads/profile-pics/${profilePicFile.filename}`,
        isFirstLogin: false,
        isPhoneVerified: contactMethod === 'phone' && (phoneVerified === 'true' || phoneVerified === true),
        isEmailVerified: contactMethod === 'email' && (emailVerified === 'true' || emailVerified === true),
        workerProfile: {
          experience: parseInt(experience) || 0,
          specialization: parsedSkills,
          accountStatus: 'pending_review',
          wageType: 'hourly',
          dailyWage: null,
          monthlyWage: null,
          documents: {
            aadhaarFront: `/uploads/worker-docs/${aadhaarFrontFile.filename}`,
            aadhaarBack: aadhaarBackFile ? `/uploads/worker-docs/${aadhaarBackFile.filename}` : null,
            uploadedAt: new Date()
          }
        }
      };

      // locationId is now sent directly from worker signup dropdown
      const selectedLocationId = req.body.locationId;
      if (selectedLocationId) {
        const foundLocation = await Location.findById(selectedLocationId).select('_id apartmentName area city location');
        if (!foundLocation) {
          return res.status(400).json({ error: { message: 'Selected location does not exist. Please choose a valid service area.', status: 400 } });
        }

        userData.workerProfile.assignedApartments = [{
          locationId: foundLocation._id,
          apartmentName: foundLocation.apartmentName || foundLocation.area || '',
          area: foundLocation.area || '',
          city: foundLocation.city || '',
          location: foundLocation.location,
          maxWalkingDistance: settings.booking.serviceRadius
        }];
        userData.workerProfile.serviceRadius = settings.booking.serviceRadius;

        if (foundLocation.location?.coordinates?.length === 2) {
          userData.addresses = [{
            label: 'Home',
            street: '',
            area: foundLocation.area || '',
            city: foundLocation.city || '',
            zipCode: '',
            location: foundLocation.location,
            isDefault: true
          }];
          userData.currentLocation = {
            type: 'Point',
            coordinates: foundLocation.location.coordinates,
            lastUpdated: new Date()
          };
        }
      } else {
        return res.status(400).json({ error: { message: 'Please select a service area to register.', status: 400 } });
      }

      const user = new User(userData);
      await user.save();

      console.log(`✅ Worker registered (pending review): ${email} (ID: ${user._id})`);

      // Notify all admins about new worker registration request
      try {
        const admins = await User.find({ role: { $in: ['admin', 'super_admin'] }, isActive: true }).select('_id');
        if (admins.length > 0) {
          const notifications = admins.map(admin => ({
            recipient: admin._id,
            title: 'New Worker Application',
            message: `${name} has applied to join as a worker. Review their profile and documents.`,
            type: 'worker-registration',
            data: { workerId: user._id, workerName: name }
          }));
          await Notification.insertMany(notifications);
        }
      } catch (notifErr) {
        console.error('Admin notification failed (non-fatal):', notifErr.message);
      }

      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.status(201).json({
        message: 'Worker registration successful. Pending admin review.',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          accountStatus: 'pending_review'
        }
      });
    } catch (error) {
      console.error('Worker registration error:', error);
      if (error.code === 11000) {
        return res.status(400).json({ error: { message: 'A user with this email already exists', status: 400 } });
      }
      res.status(500).json({ error: { message: 'Server error during registration', status: 500 } });
    }
  }
);

// @route   POST /api/auth/google
// @desc    Google OAuth login/signup (customers only)
// @access  Public
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: { message: 'Google credential is required', status: 400 } });
    }

    // Check if Google OAuth is configured
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        error: { message: 'Google authentication is not configured. Please use email signup.', status: 500 }
      });
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ error: { message: 'Invalid Google token', status: 401 } });
    }

    const { email, name, picture, sub: googleId, email_verified } = payload;

    if (!email) {
      return res.status(400).json({ error: { message: 'Email not provided by Google', status: 400 } });
    }

    // Check if user exists (by email or Google ID)
    let user = await User.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { 'oauthProviders.google.id': googleId }
      ],
      role: 'customer' // Only customers can use OAuth
    });

    let isNewUser = false;

    if (!user) {
      // Create new customer account
      isNewUser = true;
      user = new User({
        name: name || 'Customer',
        email: email.toLowerCase().trim(),
        role: 'customer',
        profileImage: picture || undefined,
        isEmailVerified: email_verified || true, // Google verified the email
        oauthProviders: {
          google: {
            id: googleId,
            email,
            linkedAt: new Date()
          }
        },
        // Generate random password (OAuth users don't need it)
        password: crypto.randomBytes(32).toString('hex'),
        hasCustomPassword: false,
        isFirstLogin: false
      });

      await user.save();
      console.log(`✅ New customer via Google OAuth: ${email} (ID: ${user._id})`);
    } else {
      // Update OAuth info if not already linked
      if (!user.oauthProviders?.google?.id) {
        user.oauthProviders = {
          ...user.oauthProviders,
          google: {
            id: googleId,
            email,
            linkedAt: new Date()
          }
        };

        // Update profile image if not set
        if (!user.profileImage && picture) {
          user.profileImage = picture;
        }

        await user.save();
        console.log(`✅ Linked Google OAuth to existing customer: ${email}`);
      } else {
        // Always refresh profile picture from Google on re-login
        if (picture && user.profileImage !== picture) {
          user.profileImage = picture;
          await user.save();
        }
        console.log(`✅ Existing customer signed in via Google OAuth: ${email}`);
      }
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        error: { message: 'Account is deactivated', status: 401 }
      });
    }

    // Check if user has location data
    const hasLocation = !!(user.addresses?.length > 0 || user.currentLocation?.coordinates?.length > 0);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      token,
      isNewUser,
      hasLocation,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        isFirstLogin: user.isFirstLogin,
        ...getPasswordSetupState(user)
      }
    });
  } catch (error) {
    console.error('Google OAuth error:', error);

    // Handle specific Google OAuth errors
    if (error.message?.includes('Token used too late') || error.message?.includes('Invalid token')) {
      return res.status(401).json({
        error: { message: 'Google authentication session expired. Please try again.', status: 401 }
      });
    }

    res.status(500).json({
      error: { message: 'Google authentication failed. Please try again or use email signup.', status: 500 }
    });
  }
});

export default router;
