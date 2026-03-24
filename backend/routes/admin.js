import express from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import twilio from 'twilio';
import { authenticate, authorize } from '../middleware/auth.js';
import { uploadAdminDoc, uploadWorkerFiles } from '../middleware/upload.js';
import Booking from '../models/Booking.js';
import BusinessExpense from '../models/BusinessExpense.js';
import Location from '../models/Location.js';
import Notification from '../models/Notification.js';
import ServiceArea from '../models/ServiceArea.js';
import Settings from '../models/Settings.js';
import User from '../models/User.js';
import WorkerEarnings from '../models/WorkerEarnings.js';
import WorkerSalaryRequest from '../models/WorkerSalaryRequest.js';
import { generateTemporaryPassword, sendTemporaryPasswordEmail } from '../utils/emailService.js';
import { checkSlotAvailability } from '../utils/slotManagement.js';
import {
    evaluateWorkerEffectiveAvailability,
    isWorkerAssignedToBooking,
    isWorkerAvailableForTimeRange,
    isWorkerEligibleForAssignment
} from '../utils/workerAvailability.js';

// Send temporary password via SMS (plain message, not Twilio Verify)
async function sendTemporaryPasswordSMS(phone, name, temporaryPassword) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) {
    console.warn('⚠️ Twilio SMS not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.');
    return { success: false, reason: 'SMS service not configured' };
  }
  try {
    const client = twilio(sid, token);
    const digits = phone.replace(/\D/g, '').slice(-10);
    const to = `+91${digits}`;
    const body = `Hi ${name}, welcome to Healthy Homez! Your temporary password is: ${temporaryPassword}  Please log in and change it immediately. App: ${process.env.FRONTEND_URL || 'https://healthyhomez.app'}`;
    await client.messages.create({ body, from, to });
    console.log(`✅ Temporary password SMS sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('❌ SMS send error:', error.message);
    return { success: false, reason: error.message };
  }
}

// Canonical list of valid Indian cities — shared with super-admin routes for consistency
const VALID_INDIAN_CITIES = [
  'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai',
  'Kolkata', 'Ahmedabad', 'Pune', 'Jaipur', 'Surat',
  'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane',
  'Bhopal', 'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad',
  'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut',
  'Rajkot', 'Kalyan', 'Varanasi', 'Srinagar', 'Aurangabad',
  'Dhanbad', 'Amritsar', 'Navi Mumbai', 'Allahabad', 'Ranchi',
  'Howrah', 'Coimbatore', 'Jabalpur', 'Gwalior', 'Vijayawada',
  'Jodhpur', 'Madurai', 'Raipur', 'Kota', 'Guwahati',
  'Chandigarh', 'Solapur', 'Hubballi', 'Tiruchirappalli', 'Bareilly',
  'Mysuru', 'Tiruppur', 'Gurgaon', 'Noida', 'Aligarh',
  'Jalandhar', 'Bhubaneswar', 'Salem', 'Warangal', 'Guntur',
  'Bhiwandi', 'Gorakhpur', 'Bikaner', 'Jamshedpur', 'Bhilai',
  'Cuttack', 'Kochi', 'Nellore', 'Bhavnagar', 'Dehradun',
  'Durgapur', 'Asansol', 'Rourkela', 'Nanded', 'Kolhapur',
  'Ajmer', 'Ujjain', 'Udaipur', 'Siliguri', 'Jhansi',
  'Mangalore', 'Erode', 'Belgaum', 'Tirunelveli', 'Malegaon'
];

const router = express.Router();

const workerUploadFields = [
  { name: 'profilePicture', maxCount: 1 },
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 }
];

const handleWorkerUploadFields = (req, res, next) => {
  uploadWorkerFiles.fields(workerUploadFields)(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    const status = err?.name === 'MulterError' ? 400 : 400;
    res.status(status).json({
      error: {
        message: err.message || 'Worker file upload failed',
        status
      }
    });
  });
};

const buildCredentialDeliveryResults = (credentialDelivery, phone) => {
  const results = {};

  if (credentialDelivery === 'email' || credentialDelivery === 'both') {
    results.email = 'queued';
  }

  if (credentialDelivery === 'phone' || credentialDelivery === 'both') {
    results.sms = phone ? 'queued' : 'skipped: phone not provided';
  }

  return results;
};

const queueWorkerCredentialDelivery = ({ credentialDelivery, email, phone, name, temporaryPassword }) => {
  void Promise.resolve().then(async () => {
    const deliveryResults = {};

    if (credentialDelivery === 'email' || credentialDelivery === 'both') {
      const result = await sendTemporaryPasswordEmail(email, name, temporaryPassword);
      deliveryResults.email = result.success ? 'sent' : `failed: ${result.reason}`;
    }

    if ((credentialDelivery === 'phone' || credentialDelivery === 'both') && phone) {
      const result = await sendTemporaryPasswordSMS(phone, name, temporaryPassword);
      deliveryResults.sms = result.success ? 'sent' : `failed: ${result.reason}`;
    }

    console.log(`📨 Worker credential delivery completed for ${email}:`, deliveryResults);
  }).catch((deliveryError) => {
    console.error(`Worker credential delivery failed for ${email}:`, deliveryError);
  });
};

const COMPLETED_BOOKING_DATE_EXPR = {
  $ifNull: [
    '$completedAt',
    {
      $ifNull: [
        '$actualEndTime',
        {
          $ifNull: ['$updatedAt', '$bookingDate']
        }
      ]
    }
  ]
};

const REVENUE_BOOKING_MATCH = {
  status: 'completed',
  cancellationDate: null
};

// ============== SUPER ADMIN ROUTES ==============

// @route   POST /api/admin/locations
// @desc    Create a new location (area) - Super Admin only
// @access  Private/Super Admin
router.post('/locations',
  authenticate,
  authorize('super_admin'),
  [
    body('apartmentName').notEmpty().withMessage('Apartment name is required'),
    body('area').notEmpty().withMessage('Area is required'),
    body('city')
      .notEmpty().withMessage('City is required')
      .custom((val) => {
        const normalised = val.trim();
        const match = VALID_INDIAN_CITIES.find(
          (c) => c.toLowerCase() === normalised.toLowerCase()
        );
        if (!match) throw new Error(`"${normalised}" is not a recognised Indian city. Please select a city from the list.`);
        return true;
      }),
    body('coordinates')
      .isArray({ min: 2, max: 2 }).withMessage('Coordinates must be an array of exactly 2 values [longitude, latitude]')
      .custom((coords) => {
        const [lng, lat] = coords;
        if (typeof lng !== 'number' || typeof lat !== 'number') throw new Error('Coordinates must be numbers');
        if (lng < -180 || lng > 180) throw new Error('Longitude must be between -180 and 180');
        if (lat < -90 || lat > 90) throw new Error('Latitude must be between -90 and 90');
        return true;
      })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg, status: 400 } });
      }

      const { apartmentName, building, area, city, state, zipCode, coordinates, maxServiceRadius } = req.body;
      // Normalise to canonical capitalisation
      const canonicalCity = VALID_INDIAN_CITIES.find(
        (c) => c.toLowerCase() === city.trim().toLowerCase()
      ) || city.trim();
      const settings = await Settings.getSettings();

      const location = new Location({
        apartmentName,
        building,
        area,
        city: canonicalCity,
        state: state || settings.company.defaultState,
        zipCode,
        location: {
          type: 'Point',
          coordinates: coordinates // [longitude, latitude]
        },
        maxServiceRadius: maxServiceRadius || settings.booking.serviceRadius,
        isServiceAvailable: true, // Service available at all created locations
        createdBy: req.user._id
      });

      await location.save();

      res.status(201).json({
        success: true,
        message: 'Location created successfully',
        location
      });
    } catch (error) {
      console.error('Create location error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/admin/create-admin
// @desc    Create a new admin and assign to location - Super Admin only
// @access  Private/Super Admin
router.post('/create-admin',
  authenticate,
  authorize('super_admin'),
  (req, res, next) => uploadAdminDoc(req, res, (err) => {
    if (err) return res.status(400).json({ error: { message: err.message, status: 400 } });
    next();
  }),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('assignedLocationIds').optional().custom((val) => {
      if (!val) return true;
      if (Array.isArray(val)) return true;
      if (typeof val === 'string') return true; // single location sent as string by FormData
      throw new Error('Assigned locations must be an array');
    })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg, status: 400 } });
      }

      const { name, email, password, phone, idDocumentType } = req.body;
      // Normalize: FormData sends a single selected item as a string, multiple as array
      let assignedLocationIds = req.body.assignedLocationIds;
      if (typeof assignedLocationIds === 'string') assignedLocationIds = [assignedLocationIds];
      else if (!assignedLocationIds) assignedLocationIds = [];
      const idDocumentPath = req.file ? `/uploads/admin-docs/${req.file.filename}` : null;

      // Check if email exists
      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingUser) {
        console.log(`⚠️ Admin creation attempt with existing email: ${email}`);
        return res.status(400).json({ error: { message: 'Email already exists', status: 400 } });
      }

      console.log(`✅ No existing user found for email: ${email}, proceeding with admin creation`);

      // Get location details if provided
      let assignedLocations = [];
      if (assignedLocationIds && assignedLocationIds.length > 0) {
        const locations = await Location.find({ _id: { $in: assignedLocationIds } });
        assignedLocations = locations.map(loc => ({
          locationId: loc._id,
          locationName: loc.apartmentName,
          area: loc.area,
          city: loc.city
        }));

        // Update locations with assigned admin
        await Location.updateMany(
          { _id: { $in: assignedLocationIds } },
          { $set: { assignedAdmin: null } } // Will be set after user creation
        );
      }

      // Create admin user
      const admin = new User({
        name,
        email: email.toLowerCase().trim(),
        password,
        phone,
        role: 'admin',
        adminProfile: {
          assignedLocations,
          permissions: {
            canCreateWorkers: true,
            canDeleteWorkers: true,
            canManageApartments: true,
            canViewReports: true
          },
          createdBy: req.user._id,
          idDocument: idDocumentPath,
          idDocumentType: idDocumentType || null
        }
      });

      await admin.save();

      // Update locations with the new admin
      if (assignedLocationIds && assignedLocationIds.length > 0) {
        await Location.updateMany(
          { _id: { $in: assignedLocationIds } },
          { $set: { assignedAdmin: admin._id } }
        );
      }

      res.status(201).json({
        success: true,
        message: 'Admin created successfully',
        admin: {
          _id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          assignedLocations: admin.adminProfile.assignedLocations
        }
      });
    } catch (error) {
      console.error('Create admin error:', error);
      
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
      
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/admin/location-overview
// @desc    Get all locations with aggregate stats (worker count, bookings, revenue) - Super Admin only
// @access  Private/Super Admin
router.get('/location-overview', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const locations = await Location.find({ isActive: true })
      .populate('assignedAdmin', 'name email')
      .lean();

    const overviewData = await Promise.all(
      locations.map(async (loc) => {
        const workers = await User.find({
          role: 'worker',
          isActive: true,
          'workerProfile.assignedApartments.locationId': loc._id
        }).select('_id workerProfile.availability workerProfile.rating').lean();

        const workerIds = workers.map((w) => w._id);

        const [activeBookings, completedBookings, revenueResult] = await Promise.all([
          Booking.countDocuments({ worker: { $in: workerIds }, status: { $in: ['pending', 'confirmed', 'in-progress'] } }),
          Booking.countDocuments({ worker: { $in: workerIds }, ...REVENUE_BOOKING_MATCH }),
          Booking.aggregate([
            { $match: { worker: { $in: workerIds }, ...REVENUE_BOOKING_MATCH } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ])
        ]);

        return {
          ...loc,
          stats: {
            workerCount: workers.length,
            onlineWorkers: workers.filter((w) => w.workerProfile?.availability).length,
            activeBookings,
            completedBookings,
            revenue: revenueResult[0]?.total || 0
          }
        };
      })
    );

    res.json({ success: true, locations: overviewData });
  } catch (error) {
    console.error('Location overview error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/admin/locations
// @desc    Get all locations - Super Admin sees all, Admin sees assigned
// @access  Private/Admin
router.get('/locations', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    let query = { isActive: true };

    // If admin (not super_admin), only show assigned locations
    if (req.user.role === 'admin') {
      query.assignedAdmin = req.user._id;
    }

    const locations = await Location.find(query)
      .populate('assignedAdmin', 'name email')
      .populate('assignedWorkers.worker', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      locations
    });
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PATCH /api/admin/locations/:locationId
// @desc    Update a location - Super Admin only
// @access  Private/Super Admin
router.patch('/locations/:locationId', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { locationId } = req.params;
    const {
      apartmentName,
      building,
      area,
      city,
      state,
      zipCode,
      coordinates,
      maxServiceRadius,
      isServiceAvailable
    } = req.body;

    const updates = {};

    if (apartmentName !== undefined) updates.apartmentName = apartmentName;
    if (building !== undefined) updates.building = building;
    if (area !== undefined) updates.area = area;
    if (state !== undefined) updates.state = state;
    if (zipCode !== undefined) updates.zipCode = zipCode;
    if (maxServiceRadius !== undefined) updates.maxServiceRadius = maxServiceRadius;
    if (isServiceAvailable !== undefined) updates.isServiceAvailable = isServiceAvailable;

    if (city !== undefined) {
      updates.city = VALID_INDIAN_CITIES.find(
        (c) => c.toLowerCase() === String(city).trim().toLowerCase()
      ) || String(city).trim();
    }

    if (coordinates !== undefined) {
      if (!Array.isArray(coordinates) || coordinates.length !== 2) {
        return res.status(400).json({
          error: { message: 'Coordinates must be an array of exactly 2 values [longitude, latitude]', status: 400 }
        });
      }

      const [lng, lat] = coordinates.map(Number);
      if (Number.isNaN(lng) || Number.isNaN(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        return res.status(400).json({
          error: { message: 'Coordinates must contain valid longitude and latitude values', status: 400 }
        });
      }

      updates.location = {
        type: 'Point',
        coordinates: [lng, lat]
      };
    }

    const location = await Location.findByIdAndUpdate(
      locationId,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('assignedAdmin', 'name email');

    if (!location) {
      return res.status(404).json({ error: { message: 'Location not found', status: 404 } });
    }

    console.log(`✅ Location ${location.apartmentName} updated by super admin ${req.user.name}`);

    res.json({
      success: true,
      message: 'Location updated successfully',
      location
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   DELETE /api/admin/locations/:locationId
// @desc    Delete a location - Super Admin only
// @access  Private/Super Admin
router.delete('/locations/:locationId', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { locationId } = req.params;

    const location = await Location.findById(locationId);
    if (!location) {
      return res.status(404).json({ error: { message: 'Location not found', status: 404 } });
    }

    // Check if location has workers assigned
    const workersCount = await User.countDocuments({
      role: 'worker',
      'workerProfile.assignedApartments.locationId': locationId
    });

    if (workersCount > 0) {
      return res.status(400).json({
        error: {
          message: `Cannot delete location with ${workersCount} assigned worker(s). Please reassign or remove them first.`,
          status: 400
        }
      });
    }

    // Check for active bookings at this location
    const activeBookings = await Booking.countDocuments({
      'location.locationId': locationId,
      status: { $in: ['pending', 'confirmed', 'in-progress'] }
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        error: {
          message: `Cannot delete location with ${activeBookings} active booking(s). Please complete them first.`,
          status: 400
        }
      });
    }

    await Location.findByIdAndDelete(locationId);

    console.log(`✅ Location ${location.apartmentName} deleted by super admin ${req.user.name}`);

    res.json({
      success: true,
      message: 'Location deleted successfully'
    });
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/admin/admins
// @desc    Get all admins - Super Admin only
// @access  Private/Super Admin
router.get('/admins', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { city } = req.query;
    
    let query = { role: 'admin', isActive: true };

    const admins = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    // Filter by city if provided
    let filteredAdmins = admins;
    if (city) {
      filteredAdmins = admins.filter(admin => 
        admin.adminProfile?.assignedLocations?.some(loc => 
          loc.city.toLowerCase().includes(city.toLowerCase())
        )
      );
    }

    // Get location counts for each admin
    const adminsWithStats = await Promise.all(filteredAdmins.map(async (admin) => {
      const locationIds = admin.adminProfile?.assignedLocations?.map(loc => loc.locationId) || [];
      const workerCount = await User.countDocuments({
        role: 'worker',
        isActive: true,
        'workerProfile.assignedApartments.locationId': { $in: locationIds }
      });

      return {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        assignedLocations: admin.adminProfile?.assignedLocations || [],
        permissions: admin.adminProfile?.permissions,
        idDocument: admin.adminProfile?.idDocument || null,
        idDocumentType: admin.adminProfile?.idDocumentType || null,
        workerCount,
        createdAt: admin.createdAt
      };
    }));

    res.json({
      success: true,
      admins: adminsWithStats
    });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PATCH /api/admin/admins/:adminId
// @desc    Update an admin - Super Admin only
// @access  Private/Super Admin
router.patch('/admins/:adminId', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { adminId } = req.params;
    const { name, phone, email, assignedLocationIds, permissions } = req.body;

    const admin = await User.findOne({ _id: adminId, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ error: { message: 'Admin not found', status: 404 } });
    }

    // Update basic fields
    if (name) admin.name = name;
    if (phone) admin.phone = phone;
    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: adminId } });
      if (existing) {
        return res.status(400).json({ error: { message: 'Email already in use', status: 400 } });
      }
      admin.email = normalizedEmail;
    }

    // Update permissions if provided
    if (permissions && typeof permissions === 'object') {
      admin.adminProfile.permissions = { ...admin.adminProfile.permissions.toObject?.() || admin.adminProfile.permissions, ...permissions };
    }

    // Update assigned locations if provided
    if (assignedLocationIds) {
      const locations = await Location.find({ _id: { $in: assignedLocationIds } });
      admin.adminProfile.assignedLocations = locations.map(loc => ({
        locationId: loc._id,
        locationName: loc.apartmentName,
        area: loc.area,
        city: loc.city
      }));

      // Update locations with new admin assignment
      await Location.updateMany(
        { assignedAdmin: adminId },
        { $unset: { assignedAdmin: '' } }
      );
      await Location.updateMany(
        { _id: { $in: assignedLocationIds } },
        { $set: { assignedAdmin: adminId } }
      );
    }

    await admin.save();

    console.log(`✅ Admin ${admin.name} updated by super admin ${req.user.name}`);

    res.json({
      success: true,
      message: 'Admin updated successfully',
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        assignedLocations: admin.adminProfile.assignedLocations
      }
    });
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   DELETE /api/admin/admins/:adminId
// @desc    Delete an admin - Super Admin only
// @access  Private/Super Admin
router.delete('/admins/:adminId', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { adminId } = req.params;

    const admin = await User.findOne({ _id: adminId, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ error: { message: 'Admin not found', status: 404 } });
    }

    // Check if admin has workers assigned to their locations
    const locationIds = admin.adminProfile?.assignedLocations?.map(loc => loc.locationId) || [];
    const workersCount = await User.countDocuments({
      role: 'worker',
      'workerProfile.assignedApartments.locationId': { $in: locationIds }
    });

    if (workersCount > 0) {
      return res.status(400).json({
        error: {
          message: `Cannot delete admin with ${workersCount} worker(s) in their locations. Please reassign workers first.`,
          status: 400
        }
      });
    }

    // Remove admin assignment from locations
    await Location.updateMany(
      { assignedAdmin: adminId },
      { $unset: { assignedAdmin: '' } }
    );

    await User.findByIdAndDelete(adminId);

    console.log(`✅ Admin ${admin.name} deleted by super admin ${req.user.name}`);

    res.json({
      success: true,
      message: 'Admin deleted successfully'
    });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// ============== ADMIN ROUTES ==============

// @route   POST /api/admin/workers
// @desc    Create a new worker - Admin only (sends temporary password via email)
// @access  Private/Admin
router.post('/workers',
  authenticate,
  authorize('admin', 'super_admin'),
  handleWorkerUploadFields,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').optional().notEmpty().withMessage('Phone cannot be empty'),
    body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_to_say']).withMessage('Invalid gender'),
    body('religion').optional().isString(),
    body('experience').optional().isNumeric().withMessage('Experience must be a number'),
    body('specialization').custom((value) => {
      if (Array.isArray(value)) return true;
      if (typeof value === 'string') {
        try { const p = JSON.parse(value); return Array.isArray(p); } catch { return false; }
      }
      return false;
    }).withMessage('Specialization must be an array'),
    body('assignedApartmentIds').optional().custom((value) => {
      if (Array.isArray(value)) return true;
      if (typeof value === 'string') {
        try { const p = JSON.parse(value); return Array.isArray(p); } catch { return false; }
      }
      return false;
    }).withMessage('Assigned apartments must be an array'),
    body('hourlyRate').isFloat({ gt: 0 }).withMessage('Valid hourly rate is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg, status: 400 } });
      }

      const { name, email, phone, gender, religion, experience, hourlyRate, aadhaarNumber, dateOfBirth } = req.body;

      // Parse array fields that may come as JSON strings from multipart forms
      let specialization = req.body.specialization;
      if (typeof specialization === 'string') {
        try { specialization = JSON.parse(specialization); } catch { specialization = [specialization]; }
      }
      let assignedApartmentIds = req.body.assignedApartmentIds;
      if (typeof assignedApartmentIds === 'string') {
        try { assignedApartmentIds = JSON.parse(assignedApartmentIds); } catch { assignedApartmentIds = [assignedApartmentIds]; }
      }

      // Extract uploaded verification document paths
      const files = req.files || {};
      const profileImagePath = files.profilePicture?.[0]
        ? `/uploads/profile-pics/${files.profilePicture[0].filename}` : null;
      const aadhaarFrontPath = files.aadhaarFront?.[0]
        ? `/uploads/worker-docs/${files.aadhaarFront[0].filename}` : null;
      const aadhaarBackPath = files.aadhaarBack?.[0]
        ? `/uploads/worker-docs/${files.aadhaarBack[0].filename}` : null;

      if (!email) {
        return res.status(400).json({ error: { message: 'Email is required', status: 400 } });
      }

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();
      
      // Check if email exists
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        console.log(`⚠️ Worker creation attempt with existing email: ${normalizedEmail}`);
        return res.status(400).json({ error: { message: 'Email already exists', status: 400 } });
      }

      console.log(`✅ No existing user found for email: ${normalizedEmail}, proceeding with worker creation`);

      // Check if admin has permission (only if role is admin, not super_admin)
      if (req.user.role === 'admin' && !req.user.adminProfile?.permissions?.canCreateWorkers) {
        return res.status(403).json({ error: { message: 'No permission to create workers', status: 403 } });
      }

      // Generate temporary password
      const temporaryPassword = generateTemporaryPassword();
      console.log(`🔑 Generated temporary password for ${normalizedEmail}:`, temporaryPassword);

      // REQUIRE location assignment for workers
      if (!assignedApartmentIds || assignedApartmentIds.length === 0) {
        return res.status(400).json({ 
          error: { message: 'Worker must be assigned to at least one location', status: 400 } 
        });
      }

      // Get apartment assignments
      const locations = await Location.find({ _id: { $in: assignedApartmentIds } });
      const settings = await Settings.getSettings();
      
      if (locations.length === 0) {
        return res.status(404).json({ error: { message: 'No valid locations found', status: 404 } });
      }
      
      // Verify admin has access to these locations
      if (req.user.role === 'admin') {
        const userLocationIds = req.user.adminProfile.assignedLocations.map(loc => loc.locationId.toString());
        const unauthorizedLocations = locations.filter(loc => !userLocationIds.includes(loc._id.toString()));
        if (unauthorizedLocations.length > 0) {
          return res.status(403).json({ error: { message: 'Cannot assign worker to locations you don\'t manage', status: 403 } });
        }
      }

      const assignedApartments = locations.map(loc => ({
        locationId: loc._id,
        apartmentName: loc.apartmentName,
        building: loc.building,
        area: loc.area,
        city: loc.city,
        location: loc.location,
        maxWalkingDistance: loc.maxServiceRadius
      }));

      // Create worker
      const worker = new User({
        name,
        email: normalizedEmail,
        password: temporaryPassword, // Will be hashed by pre-save hook
        temporaryPassword: temporaryPassword, // Store plain text for reference (not hashed)
        isFirstLogin: true, // Force password change on first login
        hasCustomPassword: false,
        phone,
        gender: gender || 'prefer_not_to_say',
        religion: religion || undefined,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        role: 'worker',
        isActive: true,
        isVerified: false,
        profileImage: profileImagePath,
        workerProfile: {
          specialization,
          experience: experience || 0,
          hourlyRate: Number(hourlyRate) || 0,
          wageType: 'hourly',
          dailyWage: null,
          monthlyWage: null,
          joinDate: new Date(),
          assignedApartments,
          availability: false,
          serviceRadius: settings.booking.serviceRadius, // configurable walking distance in meters
          documents: {
            aadhaarFront: aadhaarFrontPath,
            aadhaarBack: aadhaarBackPath,
            aadhaarNumber: aadhaarNumber || null,
            uploadedAt: (aadhaarFrontPath || aadhaarBackPath) ? new Date() : null
          }
        }
      });

      console.log(`💾 Saving worker to database...`);
      await worker.save();
      console.log(`✅ Worker saved successfully with ID: ${worker._id}`);

      // Add worker to location's assignedWorkers
      await Location.updateMany(
        { _id: { $in: assignedApartmentIds } },
        { $push: { assignedWorkers: { worker: worker._id, assignedAt: new Date() } } }
      );

      // Return immediately so worker creation isn't blocked by email/SMS provider latency.
      const credentialDelivery = req.body.credentialDelivery || 'email'; // 'email' | 'phone' | 'both'
      const deliveryResults = buildCredentialDeliveryResults(credentialDelivery, phone);

      const deliveryMessage =
        credentialDelivery === 'both'
          ? 'Credential delivery has been queued for email and SMS.'
          : credentialDelivery === 'phone'
          ? 'Credential delivery has been queued for SMS.'
          : 'Credential delivery has been queued for email.';

      res.status(201).json({
        success: true,
        message: `Worker created successfully. ${deliveryMessage}`,
        deliveryResults,
        credentialDelivery,
        worker: {
          _id: worker._id,
          name: worker.name,
          email: worker.email,
          phone: worker.phone,
          role: worker.role,
          gender: worker.gender,
          religion: worker.religion,
          experience: worker.workerProfile.experience,
          specialization: worker.workerProfile.specialization,
          assignedApartments: worker.workerProfile.assignedApartments.map(apt => apt.apartmentName)
        },
        temporaryPassword: temporaryPassword // Send back to admin as backup (in case email fails)
      });

      queueWorkerCredentialDelivery({
        credentialDelivery,
        email: normalizedEmail,
        phone,
        name,
        temporaryPassword
      });
    } catch (error) {
      console.error('Create worker error:', error);
      
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
      
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   PATCH /api/admin/workers/:workerId/archive
// @desc    Archive a worker (soft deactivation) - preserves history
// @access  Private/Admin
router.patch('/workers/:workerId/archive', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { workerId } = req.params;

    if (req.user.role === 'admin' && !req.user.adminProfile?.permissions?.canDeleteWorkers) {
      return res.status(403).json({ error: { message: 'No permission to archive workers', status: 403 } });
    }

    const worker = await User.findById(workerId);
    if (!worker || worker.role !== 'worker') {
      return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
    }

    if (req.user.role === 'admin') {
      const adminLocationIds = req.user.adminProfile?.assignedLocations?.map(loc => loc.locationId.toString()) || [];
      const workerLocationIds = worker.workerProfile?.assignedApartments?.map(apt => apt.locationId?.toString()).filter(Boolean) || [];
      const hasAccess = workerLocationIds.some(locId => adminLocationIds.includes(locId));
      if (!hasAccess) {
        return res.status(403).json({ error: { message: 'You can only archive workers assigned to your locations', status: 403 } });
      }
    }

    // Check for active bookings before archiving
    const activeBookings = await Booking.countDocuments({
      worker: workerId,
      status: { $in: ['pending', 'confirmed', 'in-progress'] }
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        error: {
          message: `Cannot archive worker with ${activeBookings} active booking(s). Please reassign or complete them first.`,
          status: 400
        }
      });
    }

    worker.isActive = false;
    worker.isArchived = true;

    // Validate and set resigned date
    if (req.body?.resignedDate) {
      const resignedDate = new Date(req.body.resignedDate);
      if (isNaN(resignedDate.getTime())) {
        return res.status(400).json({ error: { message: 'Invalid resigned date format', status: 400 } });
      }
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      if (resignedDate > today) {
        return res.status(400).json({ error: { message: 'Resigned date cannot be in the future', status: 400 } });
      }
      worker.workerProfile.resignedDate = resignedDate;
    } else {
      worker.workerProfile.resignedDate = new Date();
    }
    await worker.save({ validateBeforeSave: false });

    console.log(`✅ Worker ${worker.name} (${workerId}) archived by ${req.user.role} ${req.user.name}`);

    res.json({ success: true, message: 'Worker archived successfully' });
  } catch (error) {
    console.error('Archive worker error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PATCH /api/admin/workers/:workerId/unarchive
// @desc    Unarchive a worker (restore access)
// @access  Private/Admin
router.patch('/workers/:workerId/unarchive', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { workerId } = req.params;

    if (req.user.role === 'admin' && !req.user.adminProfile?.permissions?.canDeleteWorkers) {
      return res.status(403).json({ error: { message: 'No permission to unarchive workers', status: 403 } });
    }

    const worker = await User.findById(workerId);
    if (!worker || worker.role !== 'worker') {
      return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
    }

    worker.isActive = true;
    worker.isArchived = false;
    await worker.save({ validateBeforeSave: false });

    console.log(`✅ Worker ${worker.name} (${workerId}) unarchived by ${req.user.role} ${req.user.name}`);

    res.json({ success: true, message: 'Worker unarchived successfully' });
  } catch (error) {
    console.error('Unarchive worker error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/admin/workers
// @desc    Get all workers in admin's assigned locations
// @access  Private/Admin
router.get('/workers', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    console.log('\n==================== GET /workers ====================');
    console.log('👤 User:', req.user.name, '| Role:', req.user.role, '| ID:', req.user._id);
    console.log('📋 Admin Profile:', JSON.stringify(req.user.adminProfile, null, 2));
    
    // Super admin sees all workers (including archived); regular admin only sees active workers
    let query = req.user.role === 'super_admin'
      ? { role: 'worker' }
      : { role: 'worker', isActive: true };

    // Get all workers first
    let workers = await User.find(query)
      .select('name email phone isActive isArchived workerProfile.specialization workerProfile.assignedApartments workerProfile.rating workerProfile.availability workerProfile.completedJobs workerProfile.totalEarnings workerProfile.experience currentLocation addresses createdAt')
      .sort({ createdAt: -1 });

    console.log(`🔍 Total workers in database (for ${req.user.role}): ${workers.length}`);

    // If regular admin, filter workers by assigned locations
    if (req.user.role === 'admin') {
      // Get admin's assigned location IDs
      const adminLocationIds = req.user.adminProfile?.assignedLocations?.map(loc => loc.locationId.toString()) || [];
      
      console.log(`🔍 Admin ${req.user.name} (ID: ${req.user._id}) assigned to locations:`, adminLocationIds);

      if (adminLocationIds.length === 0) {
        console.log(`⚠️ Admin ${req.user.name} has NO assigned locations - returning empty worker list`);
        return res.json({ workers: [], noRegionAssigned: true });
      } else {
        // Filter workers who are assigned to ANY of the admin's locations
        workers = workers.filter(worker => {
          // Check if worker has any assigned apartments matching admin's locations
          const workerLocationIds = worker.workerProfile?.assignedApartments?.map(apt => apt.locationId?.toString()).filter(Boolean) || [];
          
          console.log(`  🔎 Checking worker ${worker.name}: locations =`, workerLocationIds);
          
          // Worker is visible if any of their assigned locations match admin's locations
          const hasMatchingLocation = workerLocationIds.some(locId => adminLocationIds.includes(locId));
          
          if (hasMatchingLocation) {
            console.log(`    ✅ Worker ${worker.name} visible to admin (location match)`);
          } else {
            console.log(`    ❌ Worker ${worker.name} NOT visible to admin (no location match)`);
          }
          
          return hasMatchingLocation;
        });

        console.log(`📊 Admin ${req.user.name} sees ${workers.length} workers`);
      }
    } else {
      // Super Admin: optionally filter by locationId query param
      if (req.query.locationId) {
        const { locationId } = req.query;
        workers = workers.filter((worker) => {
          const locIds = worker.workerProfile?.assignedApartments?.map((a) => a.locationId?.toString()).filter(Boolean) || [];
          return locIds.includes(locationId.toString());
        });
        console.log(`👑 Super Admin filtered to ${workers.length} workers for location ${locationId}`);
      } else {
        console.log(`👑 Super Admin sees all ${workers.length} workers`);
      }
    }

    workers = await Promise.all(
      workers.map(async (worker) => {
        const effectiveAvailability = await evaluateWorkerEffectiveAvailability(worker);
        const workerObject = worker.toObject();

        workerObject.workerProfile = {
          ...workerObject.workerProfile,
          manualAvailability: workerObject.workerProfile?.availability,
          availability: effectiveAvailability.effectiveAvailability,
          effectiveAvailability: effectiveAvailability.effectiveAvailability,
          availabilityReason: effectiveAvailability.reason,
          withinWorkingWindow: effectiveAvailability.withinWorkingWindow,
          operationsCompleted: effectiveAvailability.operationsCompleted
        };

        return workerObject;
      })
    );

    console.log('✅ Returning', workers.length, 'workers to', req.user.role);
    console.log('==================== END GET /workers ====================\n');

    res.json({
      success: true,
      workers
    });
  } catch (error) {
    console.error('Get workers error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/admin/workers/:workerId
// @desc    Get complete worker details for viewing/editing
// @access  Private/Admin/SuperAdmin
router.get('/workers/:workerId', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { workerId } = req.params;

    const worker = await User.findById(workerId).select('-password -passwordResetToken -passwordResetExpires -temporaryPassword');

    if (!worker || worker.role !== 'worker') {
      return res.status(404).json({
        error: { message: 'Worker not found', status: 404 }
      });
    }

    // Allow both admin and super_admin to view all worker details
    console.log(`✅ ${req.user.role} ${req.user.name} viewing worker ${worker.name} (${workerId})`);

    res.json({
      success: true,
      worker
    });
  } catch (error) {
    console.error('Get worker details error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/admin/workers/:workerId/performance
// @desc    Get worker performance summary including work types and revenue generated
// @access  Private/Admin/SuperAdmin
router.get('/workers/:workerId/performance', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { workerId } = req.params;
    const { from, to } = req.query;

    const worker = await User.findById(workerId)
      .select('name role workerProfile.assignedApartments')
      .lean();

    if (!worker || worker.role !== 'worker') {
      return res.status(404).json({
        error: { message: 'Worker not found', status: 404 }
      });
    }

    if (req.user.role === 'admin') {
      const adminLocationIds = (req.user.adminProfile?.assignedLocations || [])
        .map((location) => location.locationId?.toString())
        .filter(Boolean);
      const workerLocationIds = (worker.workerProfile?.assignedApartments || [])
        .map((assignment) => assignment.locationId?.toString())
        .filter(Boolean);

      const hasLocationAccess = workerLocationIds.some((locationId) => adminLocationIds.includes(locationId));
      if (!hasLocationAccess) {
        return res.status(403).json({ error: { message: 'You can only view workers assigned to your locations', status: 403 } });
      }
    }

    const bookingDateQuery = {};
    if (from || to) {
      const fromDate = from ? new Date(from) : new Date('2000-01-01T00:00:00.000Z');
      const toDate = to ? new Date(to) : new Date();
      toDate.setHours(23, 59, 59, 999);

      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ error: { message: 'Invalid date format', status: 400 } });
      }

      bookingDateQuery.bookingDate = { $gte: fromDate, $lte: toDate };
    }

    const bookings = await Booking.find({
      worker: workerId,
      status: 'completed',
      ...bookingDateQuery
    })
      .populate('service', 'name category')
      .select('bookingId bookingDate bookingType startTime endTime actualDurationMinutes actualStartTime actualEndTime totalAmount service location createdAt')
      .sort({ bookingDate: -1, startTime: -1 })
      .lean();

    const calculateBookingMinutes = (booking) => {
      if (!booking) return 0;
      if (booking.actualDurationMinutes > 0) {
        return booking.actualDurationMinutes;
      }
      if (booking.actualStartTime && booking.actualEndTime) {
        return Math.max(0, Math.floor((new Date(booking.actualEndTime) - new Date(booking.actualStartTime)) / 60000));
      }
      return 0;
    };

    const formatWorkTypeLabel = (value) => {
      if (!value) return 'General Service';
      return String(value)
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .trim();
    };

    const getServiceName = (booking) => {
      if (booking?.service?.name) return booking.service.name;
      if (booking?.bookingType === 'deep-cleaning-cart') return 'Move In / Move Out — Commercial & Residential';
      return 'Service';
    };

    const getWorkType = (booking) => {
      if (booking?.service?.category) return formatWorkTypeLabel(booking.service.category);
      if (booking?.bookingType === 'deep-cleaning-cart') return 'Move In / Move Out';
      if (booking?.bookingType) return formatWorkTypeLabel(booking.bookingType);
      return 'General Service';
    };

    const normalizedBookings = bookings.map((booking) => {
      const minutesWorked = calculateBookingMinutes(booking);
      const revenueGenerated = Number((booking.totalAmount || 0).toFixed(2));
      const serviceName = getServiceName(booking);
      const workType = getWorkType(booking);
      return {
        booking,
        serviceName,
        workType,
        minutesWorked,
        revenueGenerated,
      };
    });

    const serviceBreakdownMap = new Map();
    let totalMinutesWorked = 0;
    let totalRevenueGenerated = 0;

    normalizedBookings.forEach(({ serviceName, workType, minutesWorked, revenueGenerated }) => {
      const serviceKey = `${serviceName}__${workType}`;

      totalMinutesWorked += minutesWorked;
      totalRevenueGenerated += revenueGenerated;

      const existing = serviceBreakdownMap.get(serviceKey) || {
        serviceName,
        workType,
        tasksCompleted: 0,
        minutesWorked: 0,
        revenueGenerated: 0,
      };

      existing.tasksCompleted += 1;
      existing.minutesWorked += minutesWorked;
      existing.revenueGenerated = Number((existing.revenueGenerated + revenueGenerated).toFixed(2));
      serviceBreakdownMap.set(serviceKey, existing);
    });

    const recentTasks = normalizedBookings.slice(0, 12).map(({ booking, serviceName, workType, minutesWorked, revenueGenerated }) => ({
      _id: booking._id,
      bookingId: booking.bookingId || null,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      serviceName,
      workType,
      minutesWorked,
      revenueGenerated,
      location: booking.location
        ? {
            apartmentName: booking.location.apartmentName,
            area: booking.location.area,
            city: booking.location.city,
          }
        : null,
    }));

    const serviceBreakdown = Array.from(serviceBreakdownMap.values()).sort((left, right) => {
      if (right.revenueGenerated !== left.revenueGenerated) {
        return right.revenueGenerated - left.revenueGenerated;
      }

      return right.tasksCompleted - left.tasksCompleted;
    });

    res.json({
      success: true,
      summary: {
        totalTasksCompleted: bookings.length,
        totalMinutesWorked,
        totalRevenueGenerated: Number(totalRevenueGenerated.toFixed(2)),
        averageRevenuePerTask: bookings.length > 0 ? Number((totalRevenueGenerated / bookings.length).toFixed(2)) : 0,
        serviceTypesWorked: serviceBreakdown.length,
        serviceBreakdown,
      },
      recentTasks,
    });
  } catch (error) {
    console.error('Get worker performance error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/admin/workers/:workerId/reset-password
// @desc    Generate a fresh temporary password for a worker account
// @access  Private/Admin/SuperAdmin
router.post('/workers/:workerId/reset-password', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { workerId } = req.params;
    const requestedDelivery = req.body?.credentialDelivery;

    const worker = await User.findById(workerId).select('+temporaryPassword');
    if (!worker || worker.role !== 'worker') {
      return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
    }

    if (req.user.role === 'admin') {
      if (!req.user.adminProfile?.permissions?.canCreateWorkers) {
        return res.status(403).json({ error: { message: 'No permission to reset worker passwords', status: 403 } });
      }

      const adminLocationIds = req.user.adminProfile?.assignedLocations?.map(loc => loc.locationId?.toString()) || [];
      const workerLocationIds = worker.workerProfile?.assignedApartments?.map(apt => apt.locationId?.toString()).filter(Boolean) || [];
      const hasAccess = workerLocationIds.some(locId => adminLocationIds.includes(locId));

      if (!hasAccess) {
        return res.status(403).json({ error: { message: 'You can only reset passwords for workers assigned to your locations', status: 403 } });
      }
    }

    const hasPhone = Boolean(worker.phone && worker.phone.trim());
    const credentialDelivery = ['email', 'phone', 'both'].includes(requestedDelivery)
      ? requestedDelivery
      : (hasPhone ? 'both' : 'email');

    if ((credentialDelivery === 'phone' || credentialDelivery === 'both') && !hasPhone) {
      return res.status(400).json({
        error: { message: 'Worker does not have a phone number for SMS delivery', status: 400 }
      });
    }

    const temporaryPassword = generateTemporaryPassword();
    worker.password = temporaryPassword;
    worker.temporaryPassword = temporaryPassword;
    worker.isFirstLogin = true;
    worker.hasCustomPassword = false;

    if (worker.workerProfile) {
      worker.workerProfile.availability = false;
    }

    await worker.save({ validateBeforeSave: false });

    const deliveryResults = {};

    if (credentialDelivery === 'email' || credentialDelivery === 'both') {
      const result = await sendTemporaryPasswordEmail(worker.email, worker.name, temporaryPassword);
      deliveryResults.email = result.success ? 'sent' : `failed: ${result.reason}`;
    }

    if (credentialDelivery === 'phone' || credentialDelivery === 'both') {
      const result = await sendTemporaryPasswordSMS(worker.phone, worker.name, temporaryPassword);
      deliveryResults.sms = result.success ? 'sent' : `failed: ${result.reason}`;
    }

    console.log(`🔐 Temporary password reset for worker ${worker.name} (${worker._id}) by ${req.user.role} ${req.user.name}`);

    res.json({
      success: true,
      message: 'Temporary password reset successfully',
      credentialDelivery,
      deliveryResults,
      temporaryPassword,
      worker: {
        _id: worker._id,
        name: worker.name,
        email: worker.email,
        phone: worker.phone,
        isFirstLogin: worker.isFirstLogin,
        hasCustomPassword: worker.hasCustomPassword,
        workerProfile: {
          availability: worker.workerProfile?.availability ?? false
        }
      }
    });
  } catch (error) {
    console.error('Reset worker password error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PUT /api/admin/workers/:workerId
// @desc    Update complete worker details (all fields including documents)
// @access  Private/Admin/SuperAdmin
router.put('/workers/:workerId',
  authenticate,
  authorize('admin', 'super_admin'),
  handleWorkerUploadFields,
  async (req, res) => {
    try {
      const { workerId } = req.params;
      const files = req.files;

      const worker = await User.findById(workerId);

      if (!worker || worker.role !== 'worker') {
        return res.status(404).json({
          error: { message: 'Worker not found', status: 404 }
        });
      }

      // Allow both admin and super_admin to update all worker details

      // Parse the request body (form-data sends JSON as strings)
      let updateData = {};
      const previousAssignedLocationIds = (worker.workerProfile?.assignedApartments || [])
        .map(apt => apt.locationId?.toString())
        .filter(Boolean);
      let nextAssignedLocationIds = null;

      // Basic fields
      if (req.body.name) updateData.name = req.body.name;
      if (req.body.email) updateData.email = req.body.email;
      if (req.body.phone) updateData.phone = req.body.phone;
      if (req.body.gender) updateData.gender = req.body.gender;
      if (req.body.dateOfBirth) updateData.dateOfBirth = new Date(req.body.dateOfBirth);
      if (req.body.religion) updateData.religion = req.body.religion;
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive === 'true' || req.body.isActive === true;
      if (req.body.isVerified !== undefined) updateData.isVerified = req.body.isVerified === 'true' || req.body.isVerified === true;

      // Worker profile fields
      if (req.body.workerProfile) {
        const workerProfile = typeof req.body.workerProfile === 'string'
          ? JSON.parse(req.body.workerProfile)
          : req.body.workerProfile;

        // Update each field individually to preserve existing data
        if (workerProfile.specialization) updateData['workerProfile.specialization'] = workerProfile.specialization;
        if (workerProfile.experience !== undefined) updateData['workerProfile.experience'] = Number(workerProfile.experience);
        if (workerProfile.languages) updateData['workerProfile.languages'] = workerProfile.languages;
        if (workerProfile.hourlyRate !== undefined) updateData['workerProfile.hourlyRate'] = Number(workerProfile.hourlyRate);
        updateData['workerProfile.dailyWage'] = null;
        updateData['workerProfile.monthlyWage'] = null;
        updateData['workerProfile.wageType'] = 'hourly';
        if (workerProfile.availability !== undefined) updateData['workerProfile.availability'] = workerProfile.availability;
        if (workerProfile.accountStatus) updateData['workerProfile.accountStatus'] = workerProfile.accountStatus;
        if (workerProfile.serviceRadius !== undefined) updateData['workerProfile.serviceRadius'] = Number(workerProfile.serviceRadius);
        if (workerProfile.joinDate) updateData['workerProfile.joinDate'] = new Date(workerProfile.joinDate);
        if (workerProfile.resignedDate) updateData['workerProfile.resignedDate'] = new Date(workerProfile.resignedDate);

        // Bank details
        if (workerProfile.bankDetails) {
          if (workerProfile.bankDetails.accountHolderName) updateData['workerProfile.bankDetails.accountHolderName'] = workerProfile.bankDetails.accountHolderName;
          if (workerProfile.bankDetails.accountNumber) updateData['workerProfile.bankDetails.accountNumber'] = workerProfile.bankDetails.accountNumber;
          if (workerProfile.bankDetails.ifscCode) updateData['workerProfile.bankDetails.ifscCode'] = workerProfile.bankDetails.ifscCode;
          if (workerProfile.bankDetails.bankName) updateData['workerProfile.bankDetails.bankName'] = workerProfile.bankDetails.bankName;
          if (workerProfile.bankDetails.upiId) updateData['workerProfile.bankDetails.upiId'] = workerProfile.bankDetails.upiId;
        }

        // Working Time Window - with validation for time slots
        if (workerProfile.workingTimeWindow !== undefined) {
          const wtw = workerProfile.workingTimeWindow;
          
          if (wtw.enabled !== undefined) {
            updateData['workerProfile.workingTimeWindow.enabled'] = wtw.enabled;
          }
          
          if (wtw.workingDays !== undefined) {
            updateData['workerProfile.workingTimeWindow.workingDays'] = wtw.workingDays;
          }
          
          if (wtw.timezone !== undefined) {
            updateData['workerProfile.workingTimeWindow.timezone'] = wtw.timezone;
          }
          
          // Handle time slots with validation
          if (wtw.timeSlots !== undefined) {
            // Validate time slots
            if (!Array.isArray(wtw.timeSlots)) {
              return res.status(400).json({
                error: { message: 'timeSlots must be an array', status: 400 }
              });
            }
            
            // Validate each time slot
            for (const slot of wtw.timeSlots) {
              if (!slot.startTime || !slot.endTime) {
                return res.status(400).json({
                  error: { message: 'Each time slot must have startTime and endTime', status: 400 }
                });
              }
              
              // Validate time format (HH:MM)
              const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
              if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
                return res.status(400).json({
                  error: { message: 'Time must be in HH:MM format (24-hour)', status: 400 }
                });
              }
              
              // Validate start time is before end time
              const [startHour, startMin] = slot.startTime.split(':').map(Number);
              const [endHour, endMin] = slot.endTime.split(':').map(Number);
              const startMinutes = startHour * 60 + startMin;
              const endMinutes = endHour * 60 + endMin;
              
              if (startMinutes >= endMinutes) {
                return res.status(400).json({
                  error: { message: 'Start time must be before end time in each slot', status: 400 }
                });
              }
            }
            
            // Check for overlapping time slots
            for (let i = 0; i < wtw.timeSlots.length; i++) {
              for (let j = i + 1; j < wtw.timeSlots.length; j++) {
                const slot1 = wtw.timeSlots[i];
                const slot2 = wtw.timeSlots[j];
                
                const [s1StartH, s1StartM] = slot1.startTime.split(':').map(Number);
                const [s1EndH, s1EndM] = slot1.endTime.split(':').map(Number);
                const [s2StartH, s2StartM] = slot2.startTime.split(':').map(Number);
                const [s2EndH, s2EndM] = slot2.endTime.split(':').map(Number);
                
                const s1Start = s1StartH * 60 + s1StartM;
                const s1End = s1EndH * 60 + s1EndM;
                const s2Start = s2StartH * 60 + s2StartM;
                const s2End = s2EndH * 60 + s2EndM;
                
                // Check for overlap: slot1 starts before slot2 ends AND slot1 ends after slot2 starts
                if (s1Start < s2End && s1End > s2Start) {
                  return res.status(400).json({
                    error: { 
                      message: `Time slots overlap: ${slot1.startTime}-${slot1.endTime} and ${slot2.startTime}-${slot2.endTime}`,
                      status: 400 
                    }
                  });
                }
              }
            }
            
            updateData['workerProfile.workingTimeWindow.timeSlots'] = wtw.timeSlots;
          }
          
          // Legacy support: if startTime/endTime provided (for backward compatibility)
          if (wtw.startTime !== undefined) {
            updateData['workerProfile.workingTimeWindow.startTime'] = wtw.startTime;
          }
          if (wtw.endTime !== undefined) {
            updateData['workerProfile.workingTimeWindow.endTime'] = wtw.endTime;
          }
        }
      }

      // Handle file uploads
      if (files) {
        if (files.aadhaarFront && files.aadhaarFront[0]) {
          updateData['workerProfile.documents.aadhaarFront'] = `/uploads/worker-docs/${files.aadhaarFront[0].filename}`;
          updateData['workerProfile.documents.uploadedAt'] = new Date();
        }
        if (files.aadhaarBack && files.aadhaarBack[0]) {
          updateData['workerProfile.documents.aadhaarBack'] = `/uploads/worker-docs/${files.aadhaarBack[0].filename}`;
          updateData['workerProfile.documents.uploadedAt'] = new Date();
        }
        if (files.profilePicture && files.profilePicture[0]) {
          updateData.profileImage = `/uploads/profile-pics/${files.profilePicture[0].filename}`;
        }
      }

      // Aadhaar number (from form body)
      if (req.body.aadhaarNumber) {
        updateData['workerProfile.documents.aadhaarNumber'] = req.body.aadhaarNumber;
      }

      // Addresses
      if (req.body.addresses) {
        const addresses = typeof req.body.addresses === 'string'
          ? JSON.parse(req.body.addresses)
          : req.body.addresses;
        updateData.addresses = addresses;
      }

      if (req.body.assignedApartmentIds !== undefined) {
        const parsedAssignedApartmentIds = typeof req.body.assignedApartmentIds === 'string'
          ? JSON.parse(req.body.assignedApartmentIds)
          : req.body.assignedApartmentIds;

        if (!Array.isArray(parsedAssignedApartmentIds)) {
          return res.status(400).json({
            error: { message: 'assignedApartmentIds must be an array', status: 400 }
          });
        }

        nextAssignedLocationIds = [...new Set(parsedAssignedApartmentIds.map(String).filter(Boolean))];

        const assignedLocations = nextAssignedLocationIds.length > 0
          ? await Location.find({ _id: { $in: nextAssignedLocationIds } })
          : [];

        if (assignedLocations.length !== nextAssignedLocationIds.length) {
          return res.status(400).json({
            error: { message: 'One or more selected locations were not found', status: 400 }
          });
        }

        if (req.user.role === 'admin') {
          const adminLocationIds = req.user.adminProfile?.assignedLocations?.map(loc => loc.locationId.toString()) || [];
          const hasUnauthorizedLocation = nextAssignedLocationIds.some(locationId => !adminLocationIds.includes(locationId));

          if (hasUnauthorizedLocation) {
            return res.status(403).json({
              error: { message: 'You can only assign workers to your permitted locations', status: 403 }
            });
          }
        }

        updateData['workerProfile.assignedApartments'] = assignedLocations.map(location => ({
          locationId: location._id,
          apartmentName: location.apartmentName,
          building: location.building,
          area: location.area,
          city: location.city,
          location: location.location,
          maxWalkingDistance: location.maxServiceRadius
        }));
      }

      // Update worker
      const updatedWorker = await User.findByIdAndUpdate(
        workerId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select('-password -passwordResetToken -passwordResetExpires -temporaryPassword');

      if (nextAssignedLocationIds !== null) {
        const locationsToRemove = previousAssignedLocationIds.filter(locationId => !nextAssignedLocationIds.includes(locationId));
        const locationsToAdd = nextAssignedLocationIds.filter(locationId => !previousAssignedLocationIds.includes(locationId));

        if (locationsToRemove.length > 0) {
          await Location.updateMany(
            { _id: { $in: locationsToRemove } },
            { $pull: { assignedWorkers: { worker: updatedWorker._id } } }
          );
        }

        for (const locationId of locationsToAdd) {
          await Location.updateOne(
            { _id: locationId, 'assignedWorkers.worker': { $ne: updatedWorker._id } },
            { $push: { assignedWorkers: { worker: updatedWorker._id, assignedAt: new Date() } } }
          );
        }
      }

      console.log(`✅ Worker ${updatedWorker.name} (${workerId}) updated by ${req.user.role} ${req.user.name}`);

      res.json({
        success: true,
        message: 'Worker updated successfully',
        worker: updatedWorker
      });
    } catch (error) {
      console.error('Update worker error:', error);
      res.status(500).json({ error: { message: 'Server error', details: error.message, status: 500 } });
    }
  }
);

// @route   PATCH /api/admin/workers/:workerId/assign-location
// @desc    Assign worker to apartment/location
// @access  Private/Admin
router.patch('/workers/:workerId/assign-location',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    body('locationId').notEmpty().withMessage('Location ID is required')
  ],
  async (req, res) => {
    try {
      const { workerId } = req.params;
      const { locationId } = req.body;
      const replaceExisting = req.body.replaceExisting === true || req.body.replaceExisting === 'true';

      const worker = await User.findById(workerId);
      if (!worker || worker.role !== 'worker') {
        return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
      }

      const location = await Location.findById(locationId);
      if (!location) {
        return res.status(404).json({ error: { message: 'Location not found', status: 404 } });
      }

      // Verify admin has access to this location
      if (req.user.role === 'admin') {
        const hasAccess = req.user.adminProfile.assignedLocations.some(
          loc => loc.locationId.toString() === locationId
        );
        if (!hasAccess) {
          return res.status(403).json({ error: { message: 'No access to this location', status: 403 } });
        }
      }

      const existingAssignments = worker.workerProfile?.assignedApartments || [];
      const existingLocationIds = existingAssignments.map(apt => apt.locationId?.toString()).filter(Boolean);

      if (replaceExisting) {
        const locationIdsToRemove = existingLocationIds.filter(existingLocationId => existingLocationId !== locationId);

        if (locationIdsToRemove.length > 0) {
          await Location.updateMany(
            { _id: { $in: locationIdsToRemove } },
            { $pull: { assignedWorkers: { worker: worker._id } } }
          );
        }

        worker.workerProfile.assignedApartments = [{
          locationId: location._id,
          apartmentName: location.apartmentName,
          building: location.building,
          area: location.area,
          city: location.city,
          location: location.location,
          maxWalkingDistance: location.maxServiceRadius
        }];
        await worker.save();

        await Location.updateOne(
          { _id: location._id, 'assignedWorkers.worker': { $ne: worker._id } },
          { $push: { assignedWorkers: { worker: workerId, assignedAt: new Date() } } }
        );

        return res.json({
          success: true,
          message: 'Worker reassigned successfully',
          worker: {
            _id: worker._id,
            name: worker.name,
            assignedApartments: worker.workerProfile.assignedApartments
          }
        });
      }

      // Check if already assigned
      const alreadyAssigned = worker.workerProfile.assignedApartments.some(
        apt => apt.apartmentName === location.apartmentName && apt.area === location.area
      );

      if (!alreadyAssigned) {
        worker.workerProfile.assignedApartments.push({
          locationId: location._id, // Add locationId for filtering
          apartmentName: location.apartmentName,
          building: location.building,
          area: location.area,
          city: location.city,
          location: location.location,
          maxWalkingDistance: location.maxServiceRadius
        });
        await worker.save();

        // Add to location's assigned workers
        const workerAlreadyInLocation = location.assignedWorkers.some(
          w => w.worker.toString() === workerId
        );
        if (!workerAlreadyInLocation) {
          location.assignedWorkers.push({ worker: workerId, assignedAt: new Date() });
          try {
            await location.save();
          } catch (locationSaveError) {
            // Rollback worker assignment to keep both documents consistent
            worker.workerProfile.assignedApartments.pop();
            await worker.save().catch(rollbackErr =>
              console.error('Rollback failed — data may be inconsistent:', rollbackErr)
            );
            throw locationSaveError;
          }
        }
      }

      res.json({
        success: true,
        message: 'Worker assigned to location successfully',
        worker: {
          _id: worker._id,
          name: worker.name,
          assignedApartments: worker.workerProfile.assignedApartments
        }
      });
    } catch (error) {
      console.error('Assign worker to location error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/admin/dashboard-stats
// @desc    Get admin dashboard statistics
// @access  Private/Admin
router.get('/dashboard-stats', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get workers based on role
    let workers = await User.find({
      role: 'worker',
      isActive: true
    });

    // Filter workers by location for regular admins
    if (req.user.role === 'admin') {
      const adminLocationIds = req.user.adminProfile?.assignedLocations?.map(loc => loc.locationId.toString()) || [];
      
      console.log(`📊 Dashboard: Admin ${req.user.name} filtering workers for locations:`, adminLocationIds);

      // Filter workers who are assigned to ANY of the admin's locations
      workers = workers.filter(worker => {
        const workerLocationIds = worker.workerProfile?.assignedApartments?.map(apt => apt.locationId?.toString()).filter(Boolean) || [];
        return workerLocationIds.some(locId => adminLocationIds.includes(locId));
      });

      console.log(`📊 Dashboard: Admin sees ${workers.length} workers`);
    } else if (req.query.locationId) {
      // Super Admin filtering by specific location
      const { locationId } = req.query;
      workers = workers.filter((worker) => {
        const locIds = worker.workerProfile?.assignedApartments?.map((a) => a.locationId?.toString()).filter(Boolean) || [];
        return locIds.includes(locationId.toString());
      });
      console.log(`👑 Dashboard: Super Admin filtered to ${workers.length} workers for location ${locationId}`);
    } else {
      console.log(`👑 Dashboard: Super Admin sees all ${workers.length} workers`);
    }

    const workersInLocations = workers;

    // Build booking location filter for admin (blank = super_admin sees all)
    let bookingLocationFilter = {};
    if (req.user.role === 'admin') {
      const adminLocIds = (req.user.adminProfile?.assignedLocations || [])
        .map(loc => loc.locationId).filter(Boolean);
      if (adminLocIds.length > 0) {
        bookingLocationFilter = { 'location.locationId': { $in: adminLocIds } };
      }
    } else if (req.query.locationId) {
      bookingLocationFilter = { 'location.locationId': req.query.locationId };
    }

    // Date boundaries
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Today's stats
    const todayBookings = await Booking.countDocuments({
      ...bookingLocationFilter,
      createdAt: { $gte: today },
      status: { $in: ['pending', 'confirmed', 'in-progress'] }
    });

    const [completedTodayResult, todayRevenue] = await Promise.all([
      Booking.aggregate([
        { $match: { ...bookingLocationFilter, ...REVENUE_BOOKING_MATCH } },
        { $addFields: { effectiveCompletedAt: COMPLETED_BOOKING_DATE_EXPR } },
        { $match: { effectiveCompletedAt: { $gte: today } } },
        { $count: 'count' }
      ]),
      Booking.aggregate([
        { $match: { ...bookingLocationFilter, ...REVENUE_BOOKING_MATCH } },
        { $addFields: { effectiveCompletedAt: COMPLETED_BOOKING_DATE_EXPR } },
        { $match: { effectiveCompletedAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ])
    ]);
    const completedToday = completedTodayResult[0]?.count || 0;

    // Yesterday's stats for change calculation
    const yesterdayBookings = await Booking.countDocuments({
      ...bookingLocationFilter,
      createdAt: { $gte: yesterday, $lt: today },
      status: { $in: ['pending', 'confirmed', 'in-progress'] }
    });

    const [completedYesterdayResult, yesterdayRevenue] = await Promise.all([
      Booking.aggregate([
        { $match: { ...bookingLocationFilter, ...REVENUE_BOOKING_MATCH } },
        { $addFields: { effectiveCompletedAt: COMPLETED_BOOKING_DATE_EXPR } },
        { $match: { effectiveCompletedAt: { $gte: yesterday, $lt: today } } },
        { $count: 'count' }
      ]),
      Booking.aggregate([
        { $match: { ...bookingLocationFilter, ...REVENUE_BOOKING_MATCH } },
        { $addFields: { effectiveCompletedAt: COMPLETED_BOOKING_DATE_EXPR } },
        { $match: { effectiveCompletedAt: { $gte: yesterday, $lt: today } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ])
    ]);
    const completedYesterday = completedYesterdayResult[0]?.count || 0;

    // Helper to format percentage change
    const calcChange = (current, previous) => {
      if (previous === 0) return current > 0 ? '+100%' : '0%';
      const pct = ((current - previous) / previous * 100).toFixed(1);
      return Number(pct) >= 0 ? `+${pct}%` : `${pct}%`;
    };

    // Count online workers
    const onlineWorkers = workersInLocations.filter(w => w.workerProfile.availability).length;

    // Calculate fulfillment rate (today)
    const totalBookingsToday = todayBookings + completedToday;
    const fulfillmentRate = totalBookingsToday > 0 
      ? ((completedToday / totalBookingsToday) * 100).toFixed(1)
      : 100;

    // Calculate fulfillment rate (yesterday) for change
    const totalBookingsYesterday = yesterdayBookings + completedYesterday;
    const fulfillmentRateYesterday = totalBookingsYesterday > 0
      ? (completedYesterday / totalBookingsYesterday) * 100
      : 100;

    res.json({
      success: true,
      stats: {
        todayBookings,
        bookingsChange: calcChange(todayBookings, yesterdayBookings),
        activeWorkers: workersInLocations.length,
        workersOnlineInfo: `${onlineWorkers} online`,
        todayRevenue: todayRevenue[0]?.total || 0,
        revenueChange: calcChange(todayRevenue[0]?.total || 0, yesterdayRevenue[0]?.total || 0),
        fulfillmentRate: parseFloat(fulfillmentRate),
        fulfillmentChange: calcChange(parseFloat(fulfillmentRate), fulfillmentRateYesterday)
      }
    });
  } catch (error) {
    console.error('Get admin dashboard stats error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/admin/profit-stats
// @desc    Get profit statistics (revenue - expenses - wages)
// @access  Private/Super Admin Only
router.get('/profit-stats', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    // Parse date range from query params
    let fromDate = req.query.from ? new Date(req.query.from) : null;
    let toDate = req.query.to ? new Date(req.query.to) : null;

    // Default to last 30 days if no dates provided
    if (!fromDate || !toDate) {
      toDate = new Date();
      toDate.setHours(23, 59, 59, 999);
      fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);
      fromDate.setHours(0, 0, 0, 0);
    } else {
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);
    }

    let locationObjectId = null;
    if (req.query.locationId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.locationId)) {
        return res.status(400).json({ error: { message: 'Invalid location ID', status: 400 } });
      }
      locationObjectId = new mongoose.Types.ObjectId(req.query.locationId);
    }

    // Build location filter (optional for super_admin)
    const bookingLocationFilter = locationObjectId
      ? { 'location.locationId': locationObjectId }
      : {};

    // 1. Calculate revenue grouped by service (from completed bookings)
    const serviceRevenue = await Booking.aggregate([
      {
        $match: {
          ...bookingLocationFilter,
          ...REVENUE_BOOKING_MATCH
        }
      },
      {
        $addFields: {
          effectiveCompletedAt: COMPLETED_BOOKING_DATE_EXPR
        }
      },
      {
        $match: {
          effectiveCompletedAt: { $gte: fromDate, $lte: toDate }
        }
      },
      {
        $lookup: {
          from: 'services',
          localField: 'service',
          foreignField: '_id',
          as: 'serviceDoc'
        }
      },
      {
        $addFields: {
          resolvedServiceName: {
            $ifNull: [
              { $arrayElemAt: ['$serviceDoc.name', 0] },
              {
                $cond: [
                  { $gt: [{ $size: { $ifNull: ['$cartItems', []] } }, 0] },
                  'Deep Cleaning Cart',
                  {
                    $cond: [
                      { $ifNull: ['$serviceDetails.package', false] },
                      { $concat: ['Deep Cleaning - ', '$serviceDetails.package'] },
                      {
                        $cond: [
                          { $eq: ['$bookingType', 'monthly-subscription'] },
                          'Monthly Subscription',
                          {
                            $cond: [
                              { $eq: ['$bookingType', 'deep-cleaning-cart'] },
                              'Deep Cleaning Cart',
                              'Other Service'
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          resolvedServiceKey: {
            $ifNull: [
              { $toString: '$service' },
              {
                $cond: [
                  { $gt: [{ $size: { $ifNull: ['$cartItems', []] } }, 0] },
                  'deep-cleaning-cart',
                  { $ifNull: ['$bookingType', 'other-service'] }
                ]
              }
            ]
          }
        }
      },
      {
        $group: {
          _id: {
            serviceId: '$resolvedServiceKey',
            serviceName: '$resolvedServiceName'
          },
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          serviceId: '$_id.serviceId',
          serviceName: '$_id.serviceName',
          totalRevenue: '$total',
          bookingCount: '$count'
        }
      },
      {
        $sort: {
          totalRevenue: -1,
          serviceName: 1
        }
      }
    ]);

    const totalRevenue = serviceRevenue.reduce((sum, item) => sum + (item.totalRevenue || 0), 0);
    const revenueCount = serviceRevenue.reduce((sum, item) => sum + (item.bookingCount || 0), 0);

    // 2. Calculate Total Expenses (from business expenses)
    const expenseMatch = {
      date: { $gte: fromDate, $lte: toDate }
    };

    const expensesPipeline = [
      {
        $match: expenseMatch
      },
      {
        $lookup: {
          from: 'bookings',
          localField: 'bookingId',
          foreignField: '_id',
          as: 'linkedBooking'
        }
      },
      {
        $unwind: {
          path: '$linkedBooking',
          preserveNullAndEmptyArrays: true
        }
      }
    ];

    if (locationObjectId) {
      expensesPipeline.push({
        $match: {
          $or: [
            { location: locationObjectId },
            { 'linkedBooking.location.locationId': locationObjectId }
          ]
        }
      });
    }

    expensesPipeline.push(
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    );

    const expensesResult = await BusinessExpense.aggregate(expensesPipeline);

    const totalExpenses = expensesResult[0]?.total || 0;
    const expensesCount = expensesResult[0]?.count || 0;

    // 3. Calculate Total Wages Paid (from paid salary requests) with detail payload
    const paidWageRequests = await WorkerSalaryRequest.find({
      status: 'paid',
      paidAt: { $gte: fromDate, $lte: toDate }
    })
      .populate('worker', 'name email phone workerProfile.assignedApartments')
      .populate('admin', 'name email')
      .populate('approvedBy', 'name email')
      .populate('paidBy', 'name email')
      .populate('location', 'apartmentName area city')
      .populate({
        path: 'bookings',
        select: 'bookingId bookingDate startTime endTime actualDurationMinutes actualStartTime actualEndTime location service',
        populate: { path: 'service', select: 'name' }
      })
      .lean();

    const locationIdStr = locationObjectId?.toString() || null;

    const calculateBookingMinutes = (booking) => {
      if (!booking) return 0;
      if (booking.actualDurationMinutes > 0) {
        return booking.actualDurationMinutes;
      }
      if (booking.actualStartTime && booking.actualEndTime) {
        return Math.max(0, Math.floor((new Date(booking.actualEndTime) - new Date(booking.actualStartTime)) / 60000));
      }
      return 0;
    };

    const wageDetails = paidWageRequests
      .map((request) => {
        const paidBy = request.paidBy || request.approvedBy || request.admin || null;
        const bookings = request.bookings || [];
        const bookingsWithMinutes = bookings.map((booking) => ({
          booking,
          minutesWorked: calculateBookingMinutes(booking)
        }));
        const matchedBookings = locationIdStr
          ? bookingsWithMinutes.filter(({ booking }) => booking.location?.locationId?.toString() === locationIdStr)
          : bookingsWithMinutes;

        const directLocationMatch = locationIdStr
          ? request.location?._id?.toString() === locationIdStr
          : false;
        const workerAssignedLocationMatch = locationIdStr
          ? (request.worker?.workerProfile?.assignedApartments || []).some((apartment) => apartment.locationId?.toString() === locationIdStr)
          : false;

        if (locationIdStr && !directLocationMatch && matchedBookings.length === 0 && !workerAssignedLocationMatch) {
          return null;
        }

        const requestMinutes = request.totalMinutesWorked || bookingsWithMinutes.reduce((sum, item) => sum + item.minutesWorked, 0);
        const matchedMinutes = matchedBookings.reduce((sum, item) => sum + item.minutesWorked, 0);
        const relevantBookings = locationIdStr ? matchedBookings : bookingsWithMinutes;

        const settledAmount = request.netAmount ?? request.requestedAmount ?? 0;
        let allocatedAmount = settledAmount;
        let allocatedMinutes = request.totalMinutesWorked || 0;
        let allocatedTasks = request.totalTasksCompleted || bookings.length;

        if (locationIdStr) {
          if (matchedBookings.length > 0 && requestMinutes > 0) {
            allocatedAmount = Number(((settledAmount * matchedMinutes) / requestMinutes).toFixed(2));
            allocatedMinutes = matchedMinutes;
            allocatedTasks = matchedBookings.length;
          } else if (matchedBookings.length > 0) {
            allocatedTasks = matchedBookings.length;
            allocatedMinutes = matchedMinutes;
          }
        }

        const locationSource = request.location
          ? {
              apartmentName: request.location.apartmentName,
              area: request.location.area,
              city: request.location.city
            }
          : matchedBookings[0]?.booking?.location
            ? {
                apartmentName: matchedBookings[0].booking.location.apartmentName,
                area: matchedBookings[0].booking.location.area,
                city: matchedBookings[0].booking.location.city
              }
            : bookingsWithMinutes[0]?.booking?.location
              ? {
                  apartmentName: bookingsWithMinutes[0].booking.location.apartmentName,
                  area: bookingsWithMinutes[0].booking.location.area,
                  city: bookingsWithMinutes[0].booking.location.city
                }
              : null;

        const relevantMinutes = relevantBookings.reduce((sum, item) => sum + item.minutesWorked, 0);
        let runningAllocatedAmount = 0;
        const bookingBreakdown = relevantBookings.map(({ booking, minutesWorked }, index) => {
          const bookingCount = relevantBookings.length || 1;
          let bookingAllocatedAmount = 0;

          if (index === relevantBookings.length - 1) {
            bookingAllocatedAmount = Number((allocatedAmount - runningAllocatedAmount).toFixed(2));
          } else if (relevantMinutes > 0) {
            bookingAllocatedAmount = Number(((allocatedAmount * minutesWorked) / relevantMinutes).toFixed(2));
          } else {
            bookingAllocatedAmount = Number((allocatedAmount / bookingCount).toFixed(2));
          }

          runningAllocatedAmount += bookingAllocatedAmount;

          return {
            bookingMongoId: booking._id,
            bookingId: booking.bookingId || null,
            bookingDate: booking.bookingDate || null,
            serviceName: booking.service?.name || 'Service',
            minutesWorked,
            allocatedAmount: bookingAllocatedAmount,
            location: booking.location
              ? {
                  apartmentName: booking.location.apartmentName,
                  area: booking.location.area,
                  city: booking.location.city
                }
              : null
          };
        });

        return {
          _id: request._id,
          worker: request.worker
            ? {
                name: request.worker.name,
                email: request.worker.email,
                phone: request.worker.phone || ''
              }
            : null,
          paidBy: paidBy
            ? {
                name: paidBy.name,
                email: paidBy.email || ''
              }
            : null,
          amount: allocatedAmount,
          paidAt: request.paidAt || null,
          totalMinutesWorked: allocatedMinutes,
          totalTasksCompleted: allocatedTasks,
          hourlyRate: request.hourlyRate || 0,
          periodFrom: request.periodFrom,
          periodTo: request.periodTo,
          location: locationSource,
          bookingBreakdown
        };
      })
      .filter((request) => request && request.amount > 0)
      .sort((a, b) => new Date(b.paidAt || b.periodTo).getTime() - new Date(a.paidAt || a.periodTo).getTime());

    const totalWages = wageDetails.reduce((sum, request) => sum + (request.amount || 0), 0);
    const wagesCount = wageDetails.length;

    // 4. Calculate Overall Profit
    const totalProfit = totalRevenue - totalExpenses - totalWages;

    // Calculate profit margin percentage
    const profitMargin = totalRevenue > 0
      ? ((totalProfit / totalRevenue) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      profitStats: {
        totalRevenue,
        revenueCount,
        revenueByService: serviceRevenue,
        totalExpenses,
        expensesCount,
        totalWages,
        wagesCount,
        wageDetails,
        totalProfit,
        profitMargin,
        dateRange: {
          from: fromDate,
          to: toDate
        }
      }
    });
  } catch (error) {
    console.error('Get profit stats error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/admin/recent-bookings
// @desc    Get recent bookings for admin's locations
// @access  Private/Admin
router.get('/recent-bookings', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const limitNum = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);

    // Build location query upfront
    let locationQuery = {};
    if (req.user.role === 'admin') {
      const adminLocationIds = (req.user.adminProfile?.assignedLocations || [])
        .map(loc => loc.locationId).filter(Boolean);
      if (adminLocationIds.length > 0) {
        locationQuery = { 'location.locationId': { $in: adminLocationIds } };
      } else {
        // Admin has no locations assigned — return empty
        return res.json({ success: true, bookings: [] });
      }
    } else if (req.user.role === 'super_admin' && req.query.locationId) {
      locationQuery = { 'location.locationId': req.query.locationId };
    }

    const bookings = await Booking.find(locationQuery)
      .populate('customer', 'name')
      .populate('worker', 'name')
      .populate('service', 'name')
      .sort({ createdAt: -1 })
      .limit(limitNum);

    res.json({
      success: true,
      bookings
    });
  } catch (error) {
    console.error('Get recent bookings error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/admin/alerts
// @desc    Get system alerts for admin
// @access  Private/Admin
router.get('/alerts', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const alerts = [];

    // Get workers for this admin
    let workerQuery = { role: 'worker', isActive: true };
    let workers = await User.find(workerQuery);

    // Filter workers by admin's locations
    if (req.user.role === 'admin') {
      const adminLocationIds = req.user.adminProfile?.assignedLocations?.map(loc => loc.locationId.toString()) || [];
      workers = workers.filter(worker => {
        const workerLocationIds = worker.workerProfile?.assignedApartments?.map(apt => apt.locationId?.toString()).filter(Boolean) || [];
        return workerLocationIds.some(locId => adminLocationIds.includes(locId));
      });
    }

    // Build location filter for unassigned bookings (admin sees only their region)
    let unassignedLocationFilter = {};
    if (req.user.role === 'admin') {
      const adminLocIds = (req.user.adminProfile?.assignedLocations || [])
        .map(loc => loc.locationId).filter(Boolean);
      if (adminLocIds.length > 0) {
        unassignedLocationFilter = { 'location.locationId': { $in: adminLocIds } };
      }
    }

    // Check for unassigned bookings (only for this admin's area)
    const unassignedBookings = await Booking.countDocuments({
      ...unassignedLocationFilter,
      worker: null,
      status: 'pending'
    });

    if (unassignedBookings > 0) {
      alerts.push({
        type: 'warning',
        message: `${unassignedBookings} booking(s) have no worker assigned — auto-reassignment in progress`,
        action: 'assign-workers',
        count: unassignedBookings
      });
    }

    // Check for offline workers during active shift (only admin's workers)
    const now = new Date();
    const currentHour = now.getHours();
    if (currentHour >= 8 && currentHour <= 20) { // During working hours
      const offlineWorkers = workers.filter(w => !w.workerProfile?.availability);

      if (offlineWorkers.length > 0) {
        alerts.push({
          type: 'error',
          message: `${offlineWorkers.length} worker(s) have been offline for 2+ hours during active shift`,
          action: 'contact-workers',
          workers: offlineWorkers.map(w => ({ _id: w._id, name: w.name }))
        });
      }
    }

    res.json({
      success: true,
      alerts
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// ============== SERVICE AREAS MANAGEMENT ==============

// @route   GET /api/admin/service-areas
// @desc    Get all service areas
// @access  Private/Admin
router.get('/service-areas',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const { city, isActive } = req.query;
      
      const query = {};
      if (city) query.city = city;
      if (isActive !== undefined) query.isActive = isActive === 'true';
      
      const serviceAreas = await ServiceArea.find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });
      
      res.json({
        success: true,
        count: serviceAreas.length,
        serviceAreas
      });
    } catch (error) {
      console.error('Get service areas error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/admin/service-areas/:id
// @desc    Get single service area
// @access  Private/Admin
router.get('/service-areas/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const serviceArea = await ServiceArea.findById(req.params.id)
        .populate('createdBy', 'name email');
      
      if (!serviceArea) {
        return res.status(404).json({ 
          error: { message: 'Service area not found', status: 404 } 
        });
      }
      
      res.json({
        success: true,
        serviceArea
      });
    } catch (error) {
      console.error('Get service area error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/admin/service-areas
// @desc    Create new service area
// @access  Private/Admin
router.post('/service-areas',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    body('name').notEmpty().withMessage('Service area name is required'),
    body('city').notEmpty().withMessage('City is required'),
    body('coordinates.lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    body('coordinates.lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
    body('radiusKm').isFloat({ min: 0.5, max: 50 }).withMessage('Radius must be between 0.5 and 50 km')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: { message: errors.array()[0].msg, status: 400 } 
        });
      }
      
      const { name, description, city, coordinates, radiusKm, isActive, color } = req.body;
      
      // Check if service area with same name and city already exists
      const existing = await ServiceArea.findOne({ name, city });
      if (existing) {
        return res.status(400).json({ 
          error: { message: 'Service area with this name already exists in this city', status: 400 } 
        });
      }
      
      const serviceArea = new ServiceArea({
        name,
        description,
        city,
        coordinates,
        radiusKm,
        isActive: isActive !== undefined ? isActive : true,
        color: color || '#10b981',
        createdBy: req.user._id
      });
      
      await serviceArea.save();
      
      res.status(201).json({
        success: true,
        message: 'Service area created successfully',
        serviceArea
      });
    } catch (error) {
      console.error('Create service area error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   PUT /api/admin/service-areas/:id
// @desc    Update service area
// @access  Private/Admin
router.put('/service-areas/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const { name, description, city, coordinates, radiusKm, isActive, color } = req.body;
      
      const serviceArea = await ServiceArea.findById(req.params.id);
      
      if (!serviceArea) {
        return res.status(404).json({ 
          error: { message: 'Service area not found', status: 404 } 
        });
      }
      
      // Update fields
      if (name) serviceArea.name = name;
      if (description !== undefined) serviceArea.description = description;
      if (city) serviceArea.city = city;
      if (coordinates) serviceArea.coordinates = coordinates;
      if (radiusKm) serviceArea.radiusKm = radiusKm;
      if (isActive !== undefined) serviceArea.isActive = isActive;
      if (color) serviceArea.color = color;
      
      await serviceArea.save();
      
      res.json({
        success: true,
        message: 'Service area updated successfully',
        serviceArea
      });
    } catch (error) {
      console.error('Update service area error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   DELETE /api/admin/service-areas/:id
// @desc    Delete service area
// @access  Private/Admin
router.delete('/service-areas/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const serviceArea = await ServiceArea.findById(req.params.id);
      
      if (!serviceArea) {
        return res.status(404).json({ 
          error: { message: 'Service area not found', status: 404 } 
        });
      }
      
      await ServiceArea.findByIdAndDelete(req.params.id);
      
      res.json({
        success: true,
        message: 'Service area deleted successfully'
      });
    } catch (error) {
      console.error('Delete service area error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/admin/service-areas/check
// @desc    Check if coordinates are in any service area
// @access  Private/Admin
router.post('/service-areas/check',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    body('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: { message: errors.array()[0].msg, status: 400 } 
        });
      }
      
      const { lat, lng } = req.body;
      
      const containingAreas = await ServiceArea.findContainingPoint(lat, lng);
      const nearest = await ServiceArea.findNearest(lat, lng);
      
      res.json({
        success: true,
        isAvailable: containingAreas.length > 0,
        serviceAreas: containingAreas,
        nearest: nearest ? {
          area: nearest.area,
          distance: nearest.distance
        } : null
      });
    } catch (error) {
      console.error('Check service area error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/admin/workforce-status
// @desc    Get all workers with their current status and assignments
// @access  Private/Admin
router.get('/workforce-status', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Get all workers
    let workers = await User.find({
      role: 'worker',
      isActive: true
    })
      .select('name email phone workerProfile.specialization workerProfile.assignedApartments workerProfile.rating workerProfile.availability workerProfile.leaves workerProfile.completedJobs workerProfile.workingTimeWindow currentLocation')
      .sort({ name: 1 });

    // Filter workers by admin's assigned locations
    if (req.user.role === 'admin') {
      const adminLocIds = (req.user.adminProfile?.assignedLocations || [])
        .map(loc => loc.locationId?.toString()).filter(Boolean);
      if (adminLocIds.length > 0) {
        workers = workers.filter(worker => {
          const workerLocIds = (worker.workerProfile?.assignedApartments || [])
            .map(apt => apt.locationId?.toString()).filter(Boolean);
          return workerLocIds.some(id => adminLocIds.includes(id));
        });
      } else {
        // No region assigned — return empty with flag
        return res.json({ workers: [], summary: { total: 0, free: 0, working: 0, onLeave: 0, offline: 0 }, noRegionAssigned: true });
      }
    }

    // Get all bookings for today
    const bookings = await Booking.find({
      bookingDate: { $gte: todayStart, $lte: todayEnd },
      status: { $ne: 'cancelled' }
    })
      .populate('customer', 'name')
      .populate('service', 'name')
      .populate('location', 'apartmentName area city')
      .sort({ startTime: 1 });

    // Build worker status map
    const workforceStatus = await Promise.all(workers.map(async (worker) => {
      const effectiveAvailability = await evaluateWorkerEffectiveAvailability(worker, {
        referenceDate: now,
        bookings
      });

      // Check if worker has leave today
      const todayLeave = worker.workerProfile.leaves?.find(leave => {
        const leaveDate = new Date(leave.date);
        leaveDate.setHours(0, 0, 0, 0);
        return leaveDate.getTime() === todayStart.getTime() && leave.status === 'approved';
      });

      // Find current and upcoming bookings for this worker
      const workerBookings = bookings.filter(b => 
        isWorkerAssignedToBooking(b, worker._id)
      );

      // Determine current task
      let currentTask = null;
      let status = 'free';
      let statusDetail = 'Available';

      if (todayLeave) {
        status = 'on-leave';
        statusDetail = `On Leave${todayLeave.reason ? `: ${todayLeave.reason}` : ''}`;
      } else if (!effectiveAvailability.effectiveAvailability) {
        status = 'offline';
        statusDetail = effectiveAvailability.reason || 'Offline';
      } else {
        // Check if currently working
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        for (const booking of workerBookings) {
          const [startHours, startMinutes] = booking.startTime.split(':').map(Number);
          const [endHours, endMinutes] = booking.endTime.split(':').map(Number);
          const startMinutesOfDay = startHours * 60 + startMinutes;
          const endMinutesOfDay = endHours * 60 + endMinutes;

          if (booking.status === 'in-progress') {
            status = 'working';
            currentTask = booking;
            statusDetail = `Working at ${booking.location?.apartmentName || 'Unknown Location'}`;
            break;
          } else if (currentTime >= startMinutesOfDay && currentTime <= endMinutesOfDay && booking.status === 'confirmed') {
            status = 'scheduled';
            currentTask = booking;
            statusDetail = `Scheduled at ${booking.location?.apartmentName || 'Unknown Location'}`;
            break;
          }
        }
      }

      return {
        _id: worker._id,
        name: worker.name,
        email: worker.email,
        phone: worker.phone,
        specialization: worker.workerProfile.specialization || [],
        rating: worker.workerProfile.rating || 0,
        completedJobs: worker.workerProfile.completedJobs || 0,
        assignedApartments: worker.workerProfile.assignedApartments || [],
        availability: effectiveAvailability.effectiveAvailability,
        manualAvailability: worker.workerProfile.availability,
        status,
        statusDetail,
        currentTask: currentTask ? {
          bookingId: currentTask._id,
          customer: currentTask.customer?.name,
          service: currentTask.service?.name,
          location: currentTask.location,
          startTime: currentTask.startTime,
          endTime: currentTask.endTime,
          status: currentTask.status
        } : null,
        todayBookings: workerBookings.map(b => ({
          bookingId: b._id,
          customer: b.customer?.name,
          service: b.service?.name,
          location: b.location,
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status
        })),
        onLeave: !!todayLeave
      };
    }));

    // Calculate summary statistics
    const summary = {
      total: workforceStatus.length,
      free: workforceStatus.filter(w => w.status === 'free').length,
      working: workforceStatus.filter(w => w.status === 'working' || w.status === 'scheduled').length,
      onLeave: workforceStatus.filter(w => w.status === 'on-leave').length,
      offline: workforceStatus.filter(w => w.status === 'offline').length
    };

    res.json({
      success: true,
      summary,
      workers: workforceStatus
    });
  } catch (error) {
    console.error('Get workforce status error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/admin/manual-assign
// @desc    Manually assign a worker to a booking
// @access  Private/Admin
router.get('/bookings/:bookingId/available-workers', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId).populate('service');

    if (!booking) {
      return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
    }

    const bookingLocationId = booking.location?.locationId?.toString() || null;
    const adminLocationIds = (req.user.adminProfile?.assignedLocations || [])
      .map((location) => location.locationId?.toString())
      .filter(Boolean);

    if (req.user.role === 'admin') {
      if (!bookingLocationId || !adminLocationIds.includes(bookingLocationId)) {
        return res.status(403).json({ error: { message: 'You can only manage bookings in your assigned region', status: 403 } });
      }
    }

    const workerQuery = {
      role: 'worker',
      isActive: true
    };

    if (booking.service?.category) {
      workerQuery['workerProfile.specialization'] = { $in: [booking.service.category] };
    }

    if (bookingLocationId) {
      workerQuery['workerProfile.assignedApartments.locationId'] = booking.location.locationId;
    } else if (req.user.role === 'admin') {
      workerQuery['workerProfile.assignedApartments.locationId'] = { $in: adminLocationIds };
    }

    const workers = await User.find(workerQuery)
      .select('name email phone isFirstLogin workerProfile.specialization workerProfile.assignedApartments workerProfile.rating workerProfile.availability workerProfile.leaves workerProfile.workingTimeWindow')
      .sort({ 'workerProfile.rating': -1, name: 1 });

    const availableWorkers = [];

    for (const worker of workers) {
      if (booking.worker && booking.worker.toString() === worker._id.toString()) {
        continue;
      }

      const eligibility = isWorkerEligibleForAssignment(worker);
      if (!eligibility.eligible) {
        continue;
      }

      const timeRangeAvailability = isWorkerAvailableForTimeRange(worker, booking.bookingDate, booking.startTime, booking.endTime);
      if (!timeRangeAvailability.available) {
        continue;
      }

      const slotAvailability = await checkSlotAvailability(
        worker._id,
        booking.bookingDate,
        booking.startTime,
        booking.endTime,
        Booking,
        15,
        booking._id
      );

      if (!slotAvailability.available) {
        continue;
      }

      availableWorkers.push({
        _id: worker._id,
        name: worker.name,
        email: worker.email,
        phone: worker.phone,
        rating: worker.workerProfile?.rating || 0,
        specialization: worker.workerProfile?.specialization || [],
        assignedApartments: worker.workerProfile?.assignedApartments || []
      });
    }

    res.json({ success: true, workers: availableWorkers, bookingId: booking._id });
  } catch (error) {
    console.error('Get available workers for booking error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

router.post('/manual-assign',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    body('bookingId').isMongoId().withMessage('Valid booking ID is required'),
    body('workerId').isMongoId().withMessage('Valid worker ID is required'),
    body('reason').optional().isString().trim().isLength({ max: 300 }).withMessage('Reason must be 300 characters or fewer')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg, status: 400 } });
      }

      const { bookingId, workerId, reason } = req.body;

      const booking = await Booking.findById(bookingId)
        .populate('service')
        .populate('location');
      
      if (!booking) {
        return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
      }

      if (!['pending', 'confirmed', 'in-progress'].includes(booking.status)) {
        return res.status(400).json({ 
          error: { 
            message: `Cannot reassign booking with status: ${booking.status}`,
            status: 400 
          } 
        });
      }

      const bookingLocationId = booking.location?.locationId?.toString() || null;
      const adminLocationIds = (req.user.adminProfile?.assignedLocations || [])
        .map((location) => location.locationId?.toString())
        .filter(Boolean);

      if (req.user.role === 'admin' && (!bookingLocationId || !adminLocationIds.includes(bookingLocationId))) {
        return res.status(403).json({ error: { message: 'You can only manage bookings in your assigned region', status: 403 } });
      }

      const worker = await User.findById(workerId);
      if (!worker || worker.role !== 'worker') {
        return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
      }

      const workerLocationIds = (worker.workerProfile?.assignedApartments || [])
        .map((apartment) => apartment.locationId?.toString())
        .filter(Boolean);

      if (bookingLocationId && !workerLocationIds.includes(bookingLocationId)) {
        return res.status(400).json({ error: { message: 'Worker is not assigned to this booking location', status: 400 } });
      }

      if (req.user.role === 'admin' && !workerLocationIds.some((locationId) => adminLocationIds.includes(locationId))) {
        return res.status(403).json({ error: { message: 'You can only assign workers from your region', status: 403 } });
      }

      if (booking.worker && booking.worker.toString() === workerId) {
        return res.status(400).json({ error: { message: 'This worker is already assigned to the booking', status: 400 } });
      }

      const eligibility = isWorkerEligibleForAssignment(worker);
      if (!eligibility.eligible) {
        return res.status(400).json({ error: { message: eligibility.reason, status: 400 } });
      }

      const timeRangeAvailability = isWorkerAvailableForTimeRange(worker, booking.bookingDate, booking.startTime, booking.endTime);
      if (!timeRangeAvailability.available) {
        return res.status(400).json({ error: { message: timeRangeAvailability.reason, status: 400 } });
      }

      const slotAvailability = await checkSlotAvailability(
        worker._id,
        booking.bookingDate,
        booking.startTime,
        booking.endTime,
        Booking,
        15,
        booking._id
      );

      if (!slotAvailability.available) {
        return res.status(400).json({ 
          error: { 
            message: slotAvailability.reason || 'Worker has a conflicting booking at this time',
            status: 400 
          } 
        });
      }

      const previousWorkerId = booking.worker?.toString() || null;

      booking.worker = workerId;
      booking.assignmentMethod = 'manual';
      booking.assignedBy = req.user._id;
      booking.assignedAt = new Date();
      booking.notes = `${booking.notes || ''}${booking.notes ? '\n' : ''}${previousWorkerId ? 'Reassigned' : 'Assigned'} by ${req.user.role}${reason ? `: ${reason}` : ''}`;
      
      if (booking.status === 'pending') {
        booking.status = 'confirmed';
      }

      await booking.save();

      await booking.populate('worker', 'name email phone');

      res.json({
        success: true,
        message: previousWorkerId ? 'Worker reassigned successfully' : 'Worker assigned successfully',
        booking: {
          _id: booking._id,
          worker: booking.worker,
          status: booking.status,
          assignmentMethod: booking.assignmentMethod
        }
      });
    } catch (error) {
      console.error('Manual assign error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// ==================== PAYOUT MANAGEMENT ====================

// @route   GET /api/admin/payouts/pending
// @desc    Get all pending payout requests
// @access  Private/Admin
router.get('/payouts/pending', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const payouts = await WorkerEarnings.find({
      payoutStatus: 'processing'
    })
      .populate('worker', 'name email phone workerProfile.bankDetails')
      .populate('booking', 'bookingDate service')
      .sort({ payoutDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Group by worker
    const workerPayouts = {};
    payouts.forEach(earning => {
      const workerId = earning.worker._id.toString();
      if (!workerPayouts[workerId]) {
        workerPayouts[workerId] = {
          worker: earning.worker,
          earnings: [],
          totalAmount: 0,
          earningsCount: 0,
          requestedDate: earning.payoutDate
        };
      }
      workerPayouts[workerId].earnings.push(earning);
      workerPayouts[workerId].totalAmount += earning.netEarning;
      workerPayouts[workerId].earningsCount += 1;
    });

    const count = Object.keys(workerPayouts).length;

    res.json({
      payouts: Object.values(workerPayouts),
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalWorkers: count,
      totalAmount: Object.values(workerPayouts).reduce((sum, p) => sum + p.totalAmount, 0)
    });
  } catch (error) {
    console.error('Get pending payouts error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/admin/payouts/process/:workerId
// @desc    Process payout for a worker (mark as completed)
// @access  Private/Admin
router.post('/payouts/process/:workerId', 
  authenticate, 
  authorize('admin', 'super_admin'), 
  async (req, res) => {
    try {
      const { workerId } = req.params;
      const { transactionId, notes } = req.body;

      // Get all processing earnings for this worker
      const earnings = await WorkerEarnings.find({
        worker: workerId,
        payoutStatus: 'processing'
      });

      if (earnings.length === 0) {
        return res.status(404).json({
          error: { message: 'No pending payouts found for this worker', status: 404 }
        });
      }

      const totalAmount = earnings.reduce((sum, e) => sum + e.netEarning, 0);

      // Update all to completed
      await WorkerEarnings.updateMany(
        { 
          worker: workerId, 
          payoutStatus: 'processing' 
        },
        { 
          payoutStatus: 'completed',
          payoutDate: new Date(),
          'metadata.transactionId': transactionId,
          'metadata.processedBy': req.user._id,
          'metadata.notes': notes
        }
      );

      res.json({
        message: 'Payout processed successfully',
        workerId,
        amount: totalAmount.toFixed(2),
        earningsCount: earnings.length,
        transactionId
      });

    } catch (error) {
      console.error('Process payout error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/admin/payouts/reject/:workerId
// @desc    Reject payout request (return to pending)
// @access  Private/Admin
router.post('/payouts/reject/:workerId', 
  authenticate, 
  authorize('admin', 'super_admin'), 
  async (req, res) => {
    try {
      const { workerId } = req.params;
      const { reason } = req.body;

      // Update all processing to pending
      const result = await WorkerEarnings.updateMany(
        { 
          worker: workerId, 
          payoutStatus: 'processing' 
        },
        { 
          payoutStatus: 'pending',
          payoutDate: null,
          'metadata.rejectedBy': req.user._id,
          'metadata.rejectionReason': reason
        }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({
          error: { message: 'No pending payouts found for this worker', status: 404 }
        });
      }

      res.json({
        message: 'Payout request rejected',
        workerId,
        earningsReturned: result.modifiedCount
      });

    } catch (error) {
      console.error('Reject payout error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/admin/payouts/history
// @desc    Get payout history
// @access  Private/Admin
router.get('/payouts/history', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'completed' } = req.query;

    const payouts = await WorkerEarnings.find({
      payoutStatus: status
    })
      .populate('worker', 'name email phone')
      .populate('booking', 'bookingDate service')
      .sort({ payoutDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await WorkerEarnings.countDocuments({ payoutStatus: status });

    const totalAmount = await WorkerEarnings.aggregate([
      { $match: { payoutStatus: status } },
      { $group: { _id: null, total: { $sum: '$netEarning' } } }
    ]);

    res.json({
      payouts,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalPayouts: count,
      totalAmount: totalAmount[0]?.total || 0
    });
  } catch (error) {
    console.error('Get payout history error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/admin/payouts/stats
// @desc    Get payout statistics
// @access  Private/Admin
router.get('/payouts/stats', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const [pending, processing, completed, platformRevenue] = await Promise.all([
      WorkerEarnings.aggregate([
        { $match: { payoutStatus: 'pending' } },
        { $group: { _id: null, total: { $sum: '$netEarning' }, count: { $sum: 1 } } }
      ]),
      WorkerEarnings.aggregate([
        { $match: { payoutStatus: 'processing' } },
        { $group: { _id: null, total: { $sum: '$netEarning' }, count: { $sum: 1 } } }
      ]),
      WorkerEarnings.aggregate([
        { $match: { payoutStatus: 'completed' } },
        { $group: { _id: null, total: { $sum: '$netEarning' }, count: { $sum: 1 } } }
      ]),
      WorkerEarnings.aggregate([
        { $group: { _id: null, total: { $sum: '$platformCommission' } } }
      ])
    ]);

    res.json({
      pending: {
        amount: pending[0]?.total || 0,
        count: pending[0]?.count || 0
      },
      processing: {
        amount: processing[0]?.total || 0,
        count: processing[0]?.count || 0
      },
      completed: {
        amount: completed[0]?.total || 0,
        count: completed[0]?.count || 0
      },
      platformRevenue: platformRevenue[0]?.total || 0
    });
  } catch (error) {
    console.error('Get payout stats error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/admin/worker-schedule-comprehensive
// @desc    Get worker schedules with past, present, and future bookings
// @access  Private/Admin
router.get('/worker-schedule-comprehensive',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const { workerId, startDate, endDate } = req.query;
      
      // Default date range: 1 month in past to 3 months in future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const defaultStartDate = new Date(today);
      defaultStartDate.setMonth(defaultStartDate.getMonth() - 1);
      
      const defaultEndDate = new Date(today);
      defaultEndDate.setMonth(defaultEndDate.getMonth() + 3);
      
      const queryStartDate = startDate ? new Date(startDate) : defaultStartDate;
      const queryEndDate = endDate ? new Date(endDate) : defaultEndDate;
      
      // Build query
      const bookingQuery = {
        bookingDate: {
          $gte: queryStartDate,
          $lte: queryEndDate
        },
        status: { $in: ['pending', 'confirmed', 'in-progress', 'completed'] }
      };
      
      if (workerId && workerId !== 'all') {
        bookingQuery.worker = workerId;
      } else {
        // Only show bookings with assigned workers
        bookingQuery.worker = { $ne: null };
      }
      
      // Get all bookings in range
      const bookings = await Booking.find(bookingQuery)
        .populate('worker', 'name email phone workerProfile')
        .populate('customer', 'name phone email')
        .populate('service', 'name category')
        .populate('location', 'apartmentName area city')
        .sort({ bookingDate: 1, startTime: 1 });
      
      // Get unique workers
      const workerIds = [...new Set(bookings.map(b => b.worker?._id.toString()).filter(Boolean))];
      const workers = await User.find({ 
        _id: { $in: workerIds },
        role: 'worker'
      }).select('name email phone workerProfile');
      
      // Categorize bookings
      const pastBookings = [];
      const presentBookings = [];
      const futureBookings = [];
      
      bookings.forEach(booking => {
        const bookingDate = new Date(booking.bookingDate);
        bookingDate.setHours(0, 0, 0, 0);
        
        if (bookingDate < today) {
          pastBookings.push(booking);
        } else if (bookingDate.getTime() === today.getTime()) {
          presentBookings.push(booking);
        } else {
          futureBookings.push(booking);
        }
      });
      
      // Group by worker
      const workerSchedules = workers.map(worker => {
        const workerBookings = bookings.filter(b => 
          b.worker?._id.toString() === worker._id.toString()
        );
        
        return {
          worker: {
            _id: worker._id,
            name: worker.name,
            email: worker.email,
            phone: worker.phone,
            specialization: worker.workerProfile?.specialization || '',
            rating: worker.workerProfile?.rating || 0,
            completedJobs: worker.workerProfile?.completedJobs || 0
          },
          statistics: {
            totalBookings: workerBookings.length,
            pastBookings: workerBookings.filter(b => {
              const bookingDate = new Date(b.bookingDate);
              bookingDate.setHours(0, 0, 0, 0);
              return bookingDate < today;
            }).length,
            todayBookings: workerBookings.filter(b => {
              const bookingDate = new Date(b.bookingDate);
              bookingDate.setHours(0, 0, 0, 0);
              return bookingDate.getTime() === today.getTime();
            }).length,
            futureBookings: workerBookings.filter(b => {
              const bookingDate = new Date(b.bookingDate);
              bookingDate.setHours(0, 0, 0, 0);
              return bookingDate > today;
            }).length,
            subscriptionBookings: workerBookings.filter(b => 
              b.subscription?.isSubscription
            ).length,
            oneTimeBookings: workerBookings.filter(b => 
              !b.subscription?.isSubscription
            ).length,
            completedBookings: workerBookings.filter(b => 
              b.status === 'completed'
            ).length
          },
          bookings: workerBookings.map(b => ({
            _id: b._id,
            bookingDate: b.bookingDate,
            startTime: b.startTime,
            endTime: b.endTime,
            status: b.status,
            bookingType: b.bookingType,
            isSubscription: b.subscription?.isSubscription || false,
            subscriptionFrequency: b.recurringSchedule?.frequency || null,
            subscriptionDays: b.recurringSchedule?.selectedDays || [],
            subscriptionEndDate: b.subscription?.subscriptionEndDate || null,
            autoRenewal: b.subscription?.autoRenewal || false,
            service: {
              name: b.service?.name ?? (b.bookingType === 'deep-cleaning-cart' ? '✨ Move In / Move Out Cleaning' : 'Unknown'),
              category: b.service?.category ?? (b.bookingType === 'deep-cleaning-cart' ? 'deep-cleaning' : '')
            },
            customer: {
              name: b.customer?.name,
              phone: b.customer?.phone
            },
            location: {
              apartmentName: b.location?.apartmentName,
              area: b.location?.area,
              city: b.location?.city
            }
          }))
        };
      });
      
      res.json({
        success: true,
        dateRange: {
          start: queryStartDate,
          end: queryEndDate
        },
        summary: {
          totalWorkers: workers.length,
          totalBookings: bookings.length,
          pastBookings: pastBookings.length,
          todayBookings: presentBookings.length,
          futureBookings: futureBookings.length,
          subscriptionBookings: bookings.filter(b => b.subscription?.isSubscription).length,
          oneTimeBookings: bookings.filter(b => !b.subscription?.isSubscription).length
        },
        workerSchedules
      });
    } catch (error) {
      console.error('Get comprehensive worker schedule error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/admin/worker-schedule-export
// @desc    Export worker schedules to Excel/CSV
// @access  Private/Admin
router.get('/worker-schedule-export',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const { workerId, startDate, endDate } = req.query;
      
      // Default date range: 1 month in past to 3 months in future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const defaultStartDate = new Date(today);
      defaultStartDate.setMonth(defaultStartDate.getMonth() - 1);
      
      const defaultEndDate = new Date(today);
      defaultEndDate.setMonth(defaultEndDate.getMonth() + 3);
      
      const queryStartDate = startDate ? new Date(startDate) : defaultStartDate;
      const queryEndDate = endDate ? new Date(endDate) : defaultEndDate;
      
      // Build query
      const bookingQuery = {
        bookingDate: {
          $gte: queryStartDate,
          $lte: queryEndDate
        },
        status: { $in: ['pending', 'confirmed', 'in-progress', 'completed'] }
      };
      
      if (workerId && workerId !== 'all') {
        bookingQuery.worker = workerId;
      } else {
        bookingQuery.worker = { $ne: null };
      }
      
      // Get all bookings in range
      const bookings = await Booking.find(bookingQuery)
        .populate('worker', 'name email phone workerProfile')
        .populate('customer', 'name phone email')
        .populate('service', 'name category')
        .populate('location', 'apartmentName area city')
        .sort({ 'worker.name': 1, bookingDate: 1, startTime: 1 });
      
      // Create CSV content
      const csvHeader = [
        'Worker Name',
        'Worker Phone',
        'Worker Specialization',
        'Date',
        'Day',
        'Start Time',
        'End Time',
        'Status',
        'Period',
        'Booking Type',
        'Subscription',
        'Frequency',
        'Service',
        'Category',
        'Customer Name',
        'Customer Phone',
        'Location',
        'Area',
        'City'
      ].join(',');
      
      const csvRows = bookings.map(booking => {
        const bookingDate = new Date(booking.bookingDate);
        bookingDate.setHours(0, 0, 0, 0);
        
        let period = 'Future';
        if (bookingDate < today) period = 'Past';
        else if (bookingDate.getTime() === today.getTime()) period = 'Today';
        
        const dayName = bookingDate.toLocaleDateString('en-US', { weekday: 'long' });
        const dateStr = bookingDate.toLocaleDateString('en-US');
        
        return [
          booking.worker?.name || 'N/A',
          booking.worker?.phone || 'N/A',
          booking.worker?.workerProfile?.specialization || 'N/A',
          dateStr,
          dayName,
          booking.startTime,
          booking.endTime,
          booking.status,
          period,
          booking.bookingType || 'oneTime',
          booking.subscription?.isSubscription ? 'Yes' : 'No',
          booking.recurringSchedule?.frequency || 'N/A',
          booking.service?.name || 'N/A',
          booking.service?.category || 'N/A',
          booking.customer?.name || 'N/A',
          booking.customer?.phone || 'N/A',
          booking.location?.apartmentName || 'N/A',
          booking.location?.area || 'N/A',
          booking.location?.city || 'N/A'
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
      });
      
      const csv = [csvHeader, ...csvRows].join('\n');
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="worker-schedule-${new Date().toISOString().split('T')[0]}.csv"`);
      
      res.send(csv);
    } catch (error) {
      console.error('Export worker schedule error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// ============== WORKER APPROVAL ROUTES ==============

// @route   GET /api/admin/worker-requests
// @desc    List workers pending admin approval
// @access  Private/Admin
router.get('/worker-requests', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const pendingWorkers = await User.find({
      role: 'worker',
      'workerProfile.accountStatus': 'pending_review'
    })
      .select('name email phone gender profileImage workerProfile.specialization workerProfile.experience workerProfile.accountStatus workerProfile.documents workerProfile.wageType workerProfile.hourlyRate createdAt')
      .sort({ createdAt: -1 });

    res.json({ success: true, workers: pendingWorkers });
  } catch (error) {
    console.error('Get worker requests error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/admin/worker-requests/:id/approve
// @desc    Approve a pending worker
// @access  Private/Admin
router.post('/worker-requests/:id/approve', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const parsedHourlyRate = Number(req.body.hourlyRate);
    if (!Number.isFinite(parsedHourlyRate) || parsedHourlyRate <= 0) {
      return res.status(400).json({ error: { message: 'Valid hourly rate is required for approval', status: 400 } });
    }

    const normalizedWageType = 'hourly';
    const approvedRateLabel = `₹${parsedHourlyRate}/hr`;
    const wageUpdates = {
      'workerProfile.wageType': normalizedWageType,
      'workerProfile.hourlyRate': parsedHourlyRate,
      'workerProfile.dailyWage': null,
      'workerProfile.monthlyWage': null
    };

    const worker = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'worker', 'workerProfile.accountStatus': 'pending_review' },
      {
        'workerProfile.accountStatus': 'active',
        'workerProfile.joinDate': new Date(),
        isVerified: true,
        ...wageUpdates
      },
      { new: true }
    );

    if (!worker) return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });

    await Notification.create({
      recipient: worker._id,
      title: 'Application Approved!',
      message: `Your worker account has been approved with hourly pay (${approvedRateLabel}). You can now log in and start accepting bookings.`,
      type: 'system',
      data: {
        type: 'account_approved',
        wageType: normalizedWageType,
        payRate: approvedRateLabel
      }
    });

    console.log(`✅ Worker approved: ${worker.name} (${worker._id}) by admin ${req.user._id}`);
    res.json({
      success: true,
      message: 'Worker approved successfully',
      worker: {
        id: worker._id,
        name: worker.name,
        wageType: normalizedWageType,
        payRate: approvedRateLabel
      }
    });
  } catch (error) {
    console.error('Approve worker error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/admin/worker-requests/:id/reject
// @desc    Reject a pending worker
// @access  Private/Admin
router.post('/worker-requests/:id/reject', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    const worker = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'worker' },
      { 'workerProfile.accountStatus': 'rejected', isVerified: false },
      { new: true }
    );

    if (!worker) return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });

    await Notification.create({
      recipient: worker._id,
      title: 'Application Status Update',
      message: reason || 'Your worker application was not approved at this time. Please contact support for more information.',
      type: 'system',
      data: { type: 'account_rejected' }
    });

    console.log(`❌ Worker rejected: ${worker.name} (${worker._id}) by admin ${req.user._id}`);
    res.json({ success: true, message: 'Worker rejected' });
  } catch (error) {
    console.error('Reject worker error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/admin/area-stats
// @desc    Aggregate worker count and booking demand per area for heatmap
// @access  Super Admin only
router.get('/area-stats', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    // Get all active workers
    let workers = await User.find({ role: 'worker', isActive: true })
      .select('workerProfile.assignedApartments')
      .lean();

    // Filter workers by admin's assigned locations
    if (req.user.role === 'admin') {
      const adminLocationIds = req.user.adminProfile?.assignedLocations?.map(loc => loc.locationId?.toString()) || [];

      if (adminLocationIds.length === 0) {
        return res.json({ stats: [] });
      }

      // Filter workers who are assigned to admin's locations
      workers = workers.filter(worker => {
        const workerLocationIds = worker.workerProfile?.assignedApartments?.map(apt => apt.locationId?.toString()).filter(Boolean) || [];
        return workerLocationIds.some(locId => adminLocationIds.includes(locId));
      });
    }
    // Super admin sees all workers (no filter)

    // Count workers per area
    const areaWorkerMap = new Map();
    for (const worker of workers) {
      const apartments = worker.workerProfile?.assignedApartments || [];
      for (const apt of apartments) {
        if (apt.area && apt.city) {
          const key = `${apt.area}||${apt.city}`;
          if (!areaWorkerMap.has(key)) {
            areaWorkerMap.set(key, { area: apt.area, city: apt.city, workerCount: 0, bookingCount: 0 });
          }
          areaWorkerMap.get(key).workerCount++;
        }
      }
    }

    // Get worker IDs for booking filtering
    const workerIds = workers.map(w => w._id);

    // Active bookings per area (last 30 days) - only for filtered workers
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const bookingAgg = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          status: { $ne: 'cancelled' },
          worker: { $in: workerIds }
        }
      },
      { $group: {
        _id: { area: '$location.area', city: '$location.city' },
        bookingCount: { $sum: 1 }
      }},
      { $project: { _id: 0, area: '$_id.area', city: '$_id.city', bookingCount: 1 } }
    ]);

    // Merge booking counts into area map
    for (const b of bookingAgg) {
      if (b.area && b.city) {
        const key = `${b.area}||${b.city}`;
        if (areaWorkerMap.has(key)) {
          areaWorkerMap.get(key).bookingCount = b.bookingCount;
        } else {
          // Area with bookings but no workers (critical)
          areaWorkerMap.set(key, { area: b.area, city: b.city, workerCount: 0, bookingCount: b.bookingCount });
        }
      }
    }

    const stats = Array.from(areaWorkerMap.values())
      .filter(a => a.area)
      .sort((a, b) => b.bookingCount - a.bookingCount);

    res.json({ stats });
  } catch (error) {
    console.error('Area stats error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PATCH /api/admin/workers/:id/documents
// @desc    Update worker documents (profile picture, Aadhaar) - Admin/Super Admin only
// @access  Private/Admin/Super Admin
router.patch('/workers/:id/documents',
  authenticate,
  authorize('admin', 'super_admin'),
  uploadWorkerFiles.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { aadhaarNumber } = req.body;

      // Find the worker
      const worker = await User.findOne({ _id: id, role: 'worker' });
      if (!worker) {
        return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
      }

      // Location restriction removed - both admin and super_admin can update any worker's documents

      // Extract uploaded document paths
      const files = req.files || {};
      const updates = {};

      if (files.profilePicture?.[0]) {
        updates.profileImage = `/uploads/profile-pics/${files.profilePicture[0].filename}`;
      }

      if (files.aadhaarFront?.[0]) {
        updates['workerProfile.documents.aadhaarFront'] = `/uploads/worker-docs/${files.aadhaarFront[0].filename}`;
        updates['workerProfile.documents.uploadedAt'] = new Date();
      }

      if (files.aadhaarBack?.[0]) {
        updates['workerProfile.documents.aadhaarBack'] = `/uploads/worker-docs/${files.aadhaarBack[0].filename}`;
        updates['workerProfile.documents.uploadedAt'] = new Date();
      }

      if (aadhaarNumber) {
        updates['workerProfile.documents.aadhaarNumber'] = aadhaarNumber;
      }

      // Update worker
      const updatedWorker = await User.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('name email profileImage workerProfile.documents');

      console.log(`✅ Worker documents updated by ${req.user.role} ${req.user.name} for worker ${worker.name}`);

      res.json({
        success: true,
        message: 'Worker documents updated successfully',
        worker: {
          _id: updatedWorker._id,
          name: updatedWorker.name,
          email: updatedWorker.email,
          profileImage: updatedWorker.profileImage,
          documents: updatedWorker.workerProfile.documents
        }
      });
    } catch (error) {
      console.log('Update worker documents error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   PATCH /api/admin/workers/:id/profile
// @desc    Update worker profile (all details) - Admin/Super Admin only
// @access  Private/Admin/Super Admin
router.patch('/workers/:id/profile',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        email,
        phone,
        dateOfBirth,
        specialization,
        hourlyRate,
        isAvailable,
        addresses,
        aadhaarNumber
      } = req.body;

      // Find the worker
      const worker = await User.findOne({ _id: id, role: 'worker' });
      if (!worker) {
        return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
      }

      // Build update object
      const updates = {};

      // Basic fields
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth;
      if (addresses !== undefined) updates.addresses = addresses;

      // Worker profile fields
      if (specialization !== undefined) updates['workerProfile.specialization'] = specialization;
      updates['workerProfile.wageType'] = 'hourly';
      if (hourlyRate !== undefined) updates['workerProfile.hourlyRate'] = hourlyRate;
      updates['workerProfile.dailyWage'] = null;
      updates['workerProfile.monthlyWage'] = null;
      if (isAvailable !== undefined) updates['workerProfile.isAvailable'] = isAvailable;
      if (aadhaarNumber !== undefined) updates['workerProfile.documents.aadhaarNumber'] = aadhaarNumber;

      // Update worker
      const updatedWorker = await User.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password');

      console.log(`✅ Worker profile updated by ${req.user.role} ${req.user.name} for worker ${worker.name}`);

      res.json({
        success: true,
        message: 'Worker profile updated successfully',
        worker: updatedWorker
      });
    } catch (error) {
      console.error('Update worker profile error:', error);

      // Handle duplicate email error
      if (error.code === 11000) {
        return res.status(400).json({
          error: { message: 'Email already exists', status: 400 }
        });
      }

      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/admin/customers
// @desc    Get all customers with addresses - Admin/Super Admin only
// @access  Private/Admin/Super Admin
router.get('/customers',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const { search, page = 1, limit = 20, city } = req.query;
      
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 20));
      
      const query = { role: 'customer', isActive: true };
      
      // Search by name or email
      if (search) {
        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { name: { $regex: escapedSearch, $options: 'i' } },
          { email: { $regex: escapedSearch, $options: 'i' } },
          { phone: { $regex: escapedSearch, $options: 'i' } }
        ];
      }
      
      // Filter by city in addresses
      if (city) {
        query['addresses.city'] = { $regex: new RegExp(city, 'i') };
      }
      
      const customers = await User.find(query)
        .select('name email phone addresses createdAt isVerified')
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum)
        .lean();
      
      const count = await User.countDocuments(query);
      
      // Get booking count for each customer
      const customersWithStats = await Promise.all(
        customers.map(async (customer) => {
          const bookingCount = await Booking.countDocuments({ 
            customer: customer._id 
          });
          
          return {
            _id: customer._id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            totalAddresses: customer.addresses?.length || 0,
            addresses: customer.addresses,
            bookingCount,
            isVerified: customer.isVerified,
            joinedAt: customer.createdAt
          };
        })
      );
      
      res.json({
        success: true,
        customers: customersWithStats,
        totalPages: Math.ceil(count / limitNum),
        currentPage: pageNum,
        totalCustomers: count
      });
    } catch (error) {
      console.error('Get customers error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/admin/customers/:id
// @desc    Get specific customer details with full info - Admin/Super Admin only
// @access  Private/Admin/Super Admin
router.get('/customers/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const customer = await User.findOne({ _id: id, role: 'customer' })
        .select('name email phone addresses preferences createdAt isVerified isEmailVerified isPhoneVerified')
        .lean();
      
      if (!customer) {
        return res.status(404).json({ error: { message: 'Customer not found', status: 404 } });
      }
      
      // Get booking statistics
      const [totalBookings, completedBookings, cancelledBookings] = await Promise.all([
        Booking.countDocuments({ customer: id }),
        Booking.countDocuments({ customer: id, ...REVENUE_BOOKING_MATCH }),
        Booking.countDocuments({ customer: id, status: 'cancelled' })
      ]);
      
      // Get preferred workers
      const preferredWorkerIds = [
        customer.preferences?.preferredWorkerP1,
        customer.preferences?.preferredWorkerP2,
        customer.preferences?.preferredWorkerP3,
        ...(customer.preferences?.preferredWorkers || [])
      ].filter(Boolean);
      
      const preferredWorkers = await User.find({
        _id: { $in: preferredWorkerIds },
        role: 'worker'
      }).select('name email phone workerProfile.specialization workerProfile.rating').lean();
      
      // Get recent bookings
      const recentBookings = await Booking.find({ customer: id })
        .populate('worker', 'name phone')
        .populate('service', 'name')
        .select('bookingDate status totalAmount service worker createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
      
      // Calculate months active
      const monthsActive = Math.floor(
        (new Date() - new Date(customer.createdAt)) / (1000 * 60 * 60 * 24 * 30)
      );
      
      res.json({
        success: true,
        customer: {
          _id: customer._id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          addresses: customer.addresses,
          preferences: customer.preferences,
          isVerified: customer.isVerified,
          isEmailVerified: customer.isEmailVerified,
          isPhoneVerified: customer.isPhoneVerified,
          joinedAt: customer.createdAt,
          monthsActive,
          stats: {
            totalBookings,
            completedBookings,
            cancelledBookings,
            preferredWorkers,
            recentBookings
          }
        }
      });
    } catch (error) {
      console.error('Get customer details error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

export default router;
