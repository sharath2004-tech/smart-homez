import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import { sendPasswordChangeConfirmation } from '../utils/emailService.js';

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register',
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

      const { name, email, password, role, phone, location, gender, religion, workerProfile } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingUser) {
        console.log(`⚠️ Registration attempt with existing email: ${email}`);
        return res.status(400).json({ 
          error: { message: 'User already exists with this email', status: 400 } 
        });
      }

      console.log(`✅ No existing user found for email: ${email}, proceeding with registration`);

      // Prepare user data
      const userData = {
        name,
        email,
        password,
        role: role || 'customer',
        phone,
        gender: gender || 'prefer_not_to_say',
        religion: religion || undefined,
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
          userData.workerProfile = {
            experience: workerProfile?.experience || 0,
            assignedApartments: [{
              apartmentName: location.area || '',
              area: location.area || '',
              city: location.city || '',
              location: {
                type: 'Point',
                coordinates: location.coordinates
              },
              maxWalkingDistance: 500 // Default 500 meters
            }],
            serviceRadius: 500 // Default 500 meters
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
        { expiresIn: '7d' }
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

      // Find user with password field
      const user = await User.findOne({ email }).select('+password');
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

      // Verify password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ 
          error: { message: 'Invalid credentials', status: 401 } 
        });
      }

      // Create JWT token
      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isFirstLogin: user.isFirstLogin
        },
        requirePasswordChange: user.isFirstLogin
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
    res.json({ user: req.user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change password (for first-time login or regular password change)
// @access  Private
router.post('/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
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

      // Verify current password
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({ 
          error: { message: 'Current password is incorrect', status: 401 } 
        });
      }

      // Update password and clear first login flag
      user.password = newPassword;
      user.temporaryPassword = undefined;
      user.isFirstLogin = false;
      await user.save();

      // Send confirmation email
      try {
        await sendPasswordChangeConfirmation(user.email, user.name);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Continue even if email fails
      }

      res.json({
        message: 'Password changed successfully',
        success: true
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   PATCH /api/auth/preferences
// @desc    Update user preferences
// @access  Private
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

export default router;
