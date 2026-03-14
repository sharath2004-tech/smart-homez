/**
 * Super Admin Routes — /api/super-admin/*
 * All routes here are exclusively for the super_admin role.
 * Regular admins are blocked at the authorize() middleware level.
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import twilio from 'twilio';
import { authenticate, authorize } from '../middleware/auth.js';
import { uploadWorkerFiles } from '../middleware/upload.js';
import Booking from '../models/Booking.js';
import BusinessHours from '../models/BusinessHours.js';
import Location from '../models/Location.js';
import Settings from '../models/Settings.js';
import User from '../models/User.js';
import { generateTemporaryPassword, sendTemporaryPasswordEmail } from '../utils/emailService.js';

// Send temporary password via SMS
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

// Canonical list of valid Indian cities — prevents free-text garbage input
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

// Apply authenticate + super_admin guard to every route in this file
router.use(authenticate, authorize('super_admin'));

// ─── Location Overview ────────────────────────────────────────────────────────

// @route   GET /api/super-admin/overview
// @desc    All locations with aggregate stats (workers, bookings, revenue)
router.get('/overview', async (req, res) => {
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
          Booking.countDocuments({ worker: { $in: workerIds }, status: 'completed' }),
          Booking.aggregate([
            { $match: { worker: { $in: workerIds }, status: 'completed' } },
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
    console.error('Super admin overview error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// ─── Global / Filtered Stats ──────────────────────────────────────────────────

// @route   GET /api/super-admin/stats
// @desc    Dashboard stats — global or filtered by ?locationId=
router.get('/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let workers = await User.find({ role: 'worker', isActive: true });

    if (req.query.locationId) {
      const { locationId } = req.query;
      workers = workers.filter((w) => {
        const locIds = w.workerProfile?.assignedApartments?.map((a) => a.locationId?.toString()).filter(Boolean) || [];
        return locIds.includes(locationId.toString());
      });
    }

    const workerIds = workers.map((w) => w._id);
    const onlineWorkers = workers.filter((w) => w.workerProfile?.availability).length;

    const [todayBookings, completedToday, todayRevenue] = await Promise.all([
      Booking.countDocuments({
        ...(workerIds.length ? { worker: { $in: workerIds } } : {}),
        createdAt: { $gte: today },
        status: { $in: ['pending', 'confirmed', 'in-progress'] }
      }),
      Booking.countDocuments({
        ...(workerIds.length ? { worker: { $in: workerIds } } : {}),
        completedAt: { $gte: today },
        status: 'completed'
      }),
      Booking.aggregate([
        {
          $match: {
            ...(workerIds.length ? { worker: { $in: workerIds } } : {}),
            completedAt: { $gte: today },
            status: 'completed'
          }
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ])
    ]);

    const totalBookingsToday = todayBookings + completedToday;
    const fulfillmentRate = totalBookingsToday > 0
      ? parseFloat(((completedToday / totalBookingsToday) * 100).toFixed(1))
      : 100;

    res.json({
      success: true,
      stats: {
        todayBookings,
        bookingsChange: '+0%',
        activeWorkers: workers.length,
        workersOnlineInfo: `${onlineWorkers} online`,
        todayRevenue: todayRevenue[0]?.total || 0,
        revenueChange: '+0%',
        fulfillmentRate,
        fulfillmentChange: '+0%'
      }
    });
  } catch (error) {
    console.error('Super admin stats error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// ─── Workers ──────────────────────────────────────────────────────────────────

// @route   GET /api/super-admin/workers
// @desc    All workers (including archived). Optional ?locationId= filter.
router.get('/workers', async (req, res) => {
  try {
    let workers = await User.find({ role: 'worker' })
      .select('name email phone isActive isArchived workerProfile.specialization workerProfile.assignedApartments workerProfile.rating workerProfile.availability workerProfile.completedJobs workerProfile.totalEarnings workerProfile.experience currentLocation addresses createdAt')
      .sort({ createdAt: -1 });

    if (req.query.locationId) {
      const { locationId } = req.query;
      workers = workers.filter((w) => {
        const locIds = w.workerProfile?.assignedApartments?.map((a) => a.locationId?.toString()).filter(Boolean) || [];
        return locIds.includes(locationId.toString());
      });
    }

    res.json({ success: true, workers });
  } catch (error) {
    console.error('Super admin get workers error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/super-admin/workers
// @desc    Create a new worker
router.post(
  '/workers',
  uploadWorkerFiles.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 }
  ]),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('specialization').isArray().withMessage('Specialization must be an array'),
    body('assignedApartmentIds').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg, status: 400 } });
      }

      const { name, email, phone, gender, religion, experience, hourlyRate, aadhaarNumber } = req.body;

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

      const normalizedEmail = email.toLowerCase().trim();

      if (await User.findOne({ email: normalizedEmail })) {
        return res.status(400).json({ error: { message: 'Email already exists', status: 400 } });
      }

      if (!assignedApartmentIds || assignedApartmentIds.length === 0) {
        return res.status(400).json({ error: { message: 'Worker must be assigned to at least one location', status: 400 } });
      }

      const locations = await Location.find({ _id: { $in: assignedApartmentIds } });
      if (locations.length === 0) {
        return res.status(404).json({ error: { message: 'No valid locations found', status: 404 } });
      }

      const temporaryPassword = generateTemporaryPassword();
      const settings = await Settings.getSettings();
      const assignedApartments = locations.map((loc) => ({
        locationId: loc._id,
        apartmentName: loc.apartmentName,
        building: loc.building,
        area: loc.area,
        city: loc.city,
        location: loc.location,
        maxWalkingDistance: loc.maxServiceRadius
      }));

      const worker = new User({
        name,
        email: normalizedEmail,
        password: temporaryPassword,
        temporaryPassword,
        isFirstLogin: true,
        phone,
        gender: gender || 'prefer_not_to_say',
        religion: religion || undefined,
        role: 'worker',
        isActive: true,
        isVerified: false,
        profileImage: profileImagePath,
        workerProfile: {
          specialization,
          experience: experience || 0,
          hourlyRate: hourlyRate || 0,
          assignedApartments,
          availability: true,
          serviceRadius: settings.booking.serviceRadius,
          documents: {
            aadhaarFront: aadhaarFrontPath,
            aadhaarBack: aadhaarBackPath,
            aadhaarNumber: aadhaarNumber || null,
            uploadedAt: (aadhaarFrontPath || aadhaarBackPath) ? new Date() : null
          }
        }
      });

      await worker.save();

      await Location.updateMany(
        { _id: { $in: assignedApartmentIds } },
        { $push: { assignedWorkers: { worker: worker._id, assignedAt: new Date() } } }
      );

      // Send credentials via the channel chosen by the admin
      const credentialDelivery = req.body.credentialDelivery || 'email';
      const deliveryResults = {};

      if (credentialDelivery === 'email' || credentialDelivery === 'both') {
        const result = await sendTemporaryPasswordEmail(normalizedEmail, name, temporaryPassword);
        deliveryResults.email = result.success ? 'sent' : `failed: ${result.reason}`;
      }
      if (credentialDelivery === 'phone' || credentialDelivery === 'both') {
        const result = await sendTemporaryPasswordSMS(phone, name, temporaryPassword);
        deliveryResults.sms = result.success ? 'sent' : `failed: ${result.reason}`;
      }

      const deliveryMessage =
        credentialDelivery === 'both'
          ? `Credentials sent via email (${deliveryResults.email}) and SMS (${deliveryResults.sms}).`
          : credentialDelivery === 'phone'
          ? `Credentials sent via SMS (${deliveryResults.sms}).`
          : `Credentials sent via email (${deliveryResults.email}).`;

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
          role: worker.role
        },
        temporaryPassword
      });
    } catch (error) {
      console.error('Super admin create worker error:', error);
      if (error.code === 11000) {
        return res.status(400).json({ error: { message: 'A user with this email already exists', status: 400 } });
      }
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   PATCH /api/super-admin/workers/:workerId/archive
router.patch('/workers/:workerId/archive', async (req, res) => {
  try {
    const worker = await User.findById(req.params.workerId);
    if (!worker || worker.role !== 'worker') {
      return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
    }

    const activeBookings = await Booking.countDocuments({
      worker: req.params.workerId,
      status: { $in: ['pending', 'confirmed', 'in-progress'] }
    });
    if (activeBookings > 0) {
      return res.status(400).json({
        error: { message: `Cannot archive worker with ${activeBookings} active booking(s)`, status: 400 }
      });
    }

    worker.isActive = false;
    worker.isArchived = true;
    await worker.save({ validateBeforeSave: false });

    res.json({ success: true, message: 'Worker archived successfully' });
  } catch (error) {
    console.error('Super admin archive worker error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PATCH /api/super-admin/workers/:workerId/unarchive
router.patch('/workers/:workerId/unarchive', async (req, res) => {
  try {
    const worker = await User.findById(req.params.workerId);
    if (!worker || worker.role !== 'worker') {
      return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
    }

    worker.isActive = true;
    worker.isArchived = false;
    await worker.save({ validateBeforeSave: false });

    res.json({ success: true, message: 'Worker unarchived successfully' });
  } catch (error) {
    console.error('Super admin unarchive worker error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// ─── Bookings ─────────────────────────────────────────────────────────────────

// @route   GET /api/super-admin/bookings
// @desc    All bookings. Optional ?locationId= and ?status= filters.
router.get('/bookings', authenticate, authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const { locationId, status, limit = 50 } = req.query;

    let bookings = await Booking.find()
      .populate('customer', 'name email')
      .populate('worker', 'name email')
      .populate('service', 'name category')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) * 3);

    if (locationId) {
      const workersInLocation = await User.find({
        role: 'worker',
        'workerProfile.assignedApartments.locationId': locationId
      }).select('_id').lean();
      const workerIds = new Set(workersInLocation.map((w) => w._id.toString()));
      bookings = bookings.filter(
        (b) => b.worker && workerIds.has(b.worker._id?.toString() || b.worker.toString())
      );
    }

    if (status && status !== 'all') {
      bookings = bookings.filter((b) => b.status === status);
    }

    bookings = bookings.slice(0, parseInt(limit));

    res.json({ success: true, bookings });
  } catch (error) {
    console.error('Super admin get bookings error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// ─── Locations ────────────────────────────────────────────────────────────────

// @route   GET /api/super-admin/locations
router.get('/locations', async (req, res) => {
  try {
    const locations = await Location.find({ isActive: true })
      .populate('assignedAdmin', 'name email')
      .populate('assignedWorkers.worker', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({ success: true, locations });
  } catch (error) {
    console.error('Super admin get locations error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/super-admin/locations
router.post(
  '/locations',
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
    body('coordinates').isArray().withMessage('Coordinates must be an array [longitude, latitude]')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg, status: 400 } });
      }

      const { apartmentName, building, area, city, state, zipCode, coordinates, maxServiceRadius } = req.body;
      // Normalise city to canonical capitalisation
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
        location: { type: 'Point', coordinates },
        maxServiceRadius: maxServiceRadius || settings.booking.serviceRadius,
        isServiceAvailable: true,
        createdBy: req.user._id
      });

      await location.save();
      res.status(201).json({ success: true, message: 'Location created successfully', location });
    } catch (error) {
      console.error('Super admin create location error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   PATCH /api/super-admin/locations/:locationId
router.patch('/locations/:locationId', async (req, res) => {
  try {
    const location = await Location.findByIdAndUpdate(
      req.params.locationId,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('assignedAdmin', 'name email');

    if (!location) {
      return res.status(404).json({ error: { message: 'Location not found', status: 404 } });
    }

    res.json({ success: true, message: 'Location updated successfully', location });
  } catch (error) {
    console.error('Super admin update location error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   DELETE /api/super-admin/locations/:locationId
router.delete('/locations/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const location = await Location.findById(locationId);
    if (!location) {
      return res.status(404).json({ error: { message: 'Location not found', status: 404 } });
    }

    const [workersCount, activeBookings] = await Promise.all([
      User.countDocuments({ role: 'worker', 'workerProfile.assignedApartments.locationId': locationId }),
      Booking.countDocuments({ 'location.locationId': locationId, status: { $in: ['pending', 'confirmed', 'in-progress'] } })
    ]);

    if (workersCount > 0) {
      return res.status(400).json({ error: { message: `Cannot delete location with ${workersCount} assigned worker(s)`, status: 400 } });
    }
    if (activeBookings > 0) {
      return res.status(400).json({ error: { message: `Cannot delete location with ${activeBookings} active booking(s)`, status: 400 } });
    }

    await Location.findByIdAndDelete(locationId);
    res.json({ success: true, message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Super admin delete location error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// ─── Admins ───────────────────────────────────────────────────────────────────

// @route   GET /api/super-admin/admins
router.get('/admins', async (req, res) => {
  try {
    const { city } = req.query;
    let admins = await User.find({ role: 'admin', isActive: true })
      .select('-password')
      .sort({ createdAt: -1 });

    if (city) {
      admins = admins.filter((a) =>
        a.adminProfile?.assignedLocations?.some((loc) =>
          loc.city.toLowerCase().includes(city.toLowerCase())
        )
      );
    }

    const adminsWithStats = await Promise.all(
      admins.map(async (admin) => {
        const locationIds = admin.adminProfile?.assignedLocations?.map((loc) => loc.locationId) || [];
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
          workerCount,
          createdAt: admin.createdAt
        };
      })
    );

    res.json({ success: true, admins: adminsWithStats });
  } catch (error) {
    console.error('Super admin get admins error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/super-admin/admins
router.post(
  '/admins',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('assignedLocationIds').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg, status: 400 } });
      }

      const { name, email, password, phone, assignedLocationIds } = req.body;
      const normalizedEmail = email.toLowerCase().trim();

      if (await User.findOne({ email: normalizedEmail })) {
        return res.status(400).json({ error: { message: 'Email already exists', status: 400 } });
      }

      let assignedLocations = [];
      if (assignedLocationIds && assignedLocationIds.length > 0) {
        const locations = await Location.find({ _id: { $in: assignedLocationIds } });
        assignedLocations = locations.map((loc) => ({
          locationId: loc._id,
          locationName: loc.apartmentName,
          area: loc.area,
          city: loc.city
        }));
      }

      const admin = new User({
        name,
        email: normalizedEmail,
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
          createdBy: req.user._id
        }
      });

      await admin.save();

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
      console.error('Super admin create admin error:', error);
      if (error.code === 11000) {
        return res.status(400).json({ error: { message: 'A user with this email already exists', status: 400 } });
      }
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   PATCH /api/super-admin/admins/:adminId
router.patch('/admins/:adminId', async (req, res) => {
  try {
    const { adminId } = req.params;
    const { name, phone, assignedLocationIds } = req.body;

    const admin = await User.findOne({ _id: adminId, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ error: { message: 'Admin not found', status: 404 } });
    }

    if (name) admin.name = name;
    if (phone) admin.phone = phone;

    if (assignedLocationIds) {
      const locations = await Location.find({ _id: { $in: assignedLocationIds } });
      admin.adminProfile.assignedLocations = locations.map((loc) => ({
        locationId: loc._id,
        locationName: loc.apartmentName,
        area: loc.area,
        city: loc.city
      }));

      await Location.updateMany({ assignedAdmin: adminId }, { $unset: { assignedAdmin: '' } });
      await Location.updateMany({ _id: { $in: assignedLocationIds } }, { $set: { assignedAdmin: adminId } });
    }

    await admin.save();
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
    console.error('Super admin update admin error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   DELETE /api/super-admin/admins/:adminId
router.delete('/admins/:adminId', async (req, res) => {
  try {
    const { adminId } = req.params;
    const admin = await User.findOne({ _id: adminId, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ error: { message: 'Admin not found', status: 404 } });
    }

    const locationIds = admin.adminProfile?.assignedLocations?.map((loc) => loc.locationId) || [];
    const workersCount = await User.countDocuments({
      role: 'worker',
      'workerProfile.assignedApartments.locationId': { $in: locationIds }
    });

    if (workersCount > 0) {
      return res.status(400).json({
        error: { message: `Cannot delete admin with ${workersCount} worker(s) in their locations`, status: 400 }
      });
    }

    await Location.updateMany({ assignedAdmin: adminId }, { $unset: { assignedAdmin: '' } });
    await User.findByIdAndDelete(adminId);

    res.json({ success: true, message: 'Admin deleted successfully' });
  } catch (error) {
    console.error('Super admin delete admin error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// ─── Admin Leave Management ───────────────────────────────────────────────────

// @route   GET /api/super-admin/admin-leaves
// @desc    All admin leave requests (pending / all). Optional ?status= filter.
router.get('/admin-leaves', async (req, res) => {
  try {
    const { status } = req.query;

    const admins = await User.find({ role: 'admin', isActive: true })
      .select('name email phone adminProfile.leaves')
      .populate('adminProfile.leaves.approvedBy', 'name email')
      .lean();

    const result = admins
      .map((admin) => {
        let leaves = admin.adminProfile?.leaves || [];
        if (status && status !== 'all') {
          leaves = leaves.filter((l) => l.status === status);
        }
        return {
          adminId: admin._id,
          adminName: admin.name,
          adminEmail: admin.email,
          adminPhone: admin.phone,
          leaves
        };
      })
      .filter((a) => a.leaves.length > 0);

    res.json({
      success: true,
      adminLeaves: result,
      totalPending: result.reduce((sum, a) => sum + a.leaves.filter((l) => l.status === 'pending').length, 0)
    });
  } catch (error) {
    console.error('Super admin get admin leaves error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PUT /api/super-admin/admin-leaves/:adminId/:leaveId/status
// @desc    Approve or reject an admin leave request
router.put('/admin-leaves/:adminId/:leaveId/status', async (req, res) => {
  try {
    const { adminId, leaveId } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: { message: 'Status must be approved or rejected', status: 400 } });
    }

    const admin = await User.findOne({ _id: adminId, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ error: { message: 'Admin not found', status: 404 } });
    }

    const leave = admin.adminProfile?.leaves?.id(leaveId);
    if (!leave) {
      return res.status(404).json({ error: { message: 'Leave request not found', status: 404 } });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({ error: { message: `Leave request already ${leave.status}`, status: 400 } });
    }

    leave.status = status;
    leave.approvedBy = req.user._id;
    await admin.save();

    res.json({
      success: true,
      message: `Leave request ${status} successfully`,
      leave
    });
  } catch (error) {
    console.error('Super admin update admin leave status error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// ─── Service Requests ─────────────────────────────────────────────────────────

// @route   GET /api/super-admin/service-requests
// @desc    List service creation requests from admins
router.get('/service-requests', async (req, res) => {
  try {
    const ServiceRequest = (await import('../models/ServiceRequest.js')).default;
    const { status = 'pending' } = req.query;
    const query = status === 'all' ? {} : { status };
    const requests = await ServiceRequest.find(query)
      .populate('requestedBy', 'name email')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ requests, total: requests.length });
  } catch (error) {
    console.error('Get service requests error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/super-admin/service-requests/:id/approve
// @desc    Approve an admin service request — creates the Service document
router.post('/service-requests/:id/approve', async (req, res) => {
  try {
    const ServiceRequest = (await import('../models/ServiceRequest.js')).default;
    const Service = (await import('../models/Service.js')).default;

    const request = await ServiceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: { message: 'Request not found', status: 404 } });
    if (request.status !== 'pending') return res.status(400).json({ error: { message: `Request already ${request.status}`, status: 400 } });

    const service = new Service({
      ...request.serviceData,
      createdBy: request.requestedBy,
      isActive: true
    });
    await service.save();

    request.status = 'approved';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.superAdminNote = req.body.note || '';
    await request.save();

    res.json({ message: 'Service request approved and service is now live', service, request });
  } catch (error) {
    console.error('Approve service request error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/super-admin/service-requests/:id/reject
// @desc    Reject an admin service request
router.post('/service-requests/:id/reject', async (req, res) => {
  try {
    const ServiceRequest = (await import('../models/ServiceRequest.js')).default;

    const request = await ServiceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: { message: 'Request not found', status: 404 } });
    if (request.status !== 'pending') return res.status(400).json({ error: { message: `Request already ${request.status}`, status: 400 } });

    request.status = 'rejected';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.superAdminNote = req.body.reason || '';
    await request.save();

    res.json({ message: 'Service request rejected', request });
  } catch (error) {
    console.error('Reject service request error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// ─── Price Change Requests ────────────────────────────────────────────────────

// @route   GET /api/super-admin/price-change-requests
// @desc    List admin-submitted pricing update requests
router.get('/price-change-requests', async (req, res) => {
  try {
    const PriceChangeRequest = (await import('../models/PriceChangeRequest.js')).default;
    const { status = 'pending' } = req.query;
    const query = status === 'all' ? {} : { status };
    const requests = await PriceChangeRequest.find(query)
      .populate('service', 'name price')
      .populate('requestedBy', 'name email')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ requests, total: requests.length });
  } catch (error) {
    console.error('Get price change requests error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/super-admin/price-change-requests/:id/approve
// @desc    Approve a price change request — applies proposed pricing to the service
router.post('/price-change-requests/:id/approve', async (req, res) => {
  try {
    const PriceChangeRequest = (await import('../models/PriceChangeRequest.js')).default;
    const Service = (await import('../models/Service.js')).default;

    const request = await PriceChangeRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: { message: 'Request not found', status: 404 } });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: { message: `Request already ${request.status}`, status: 400 } });
    }

    const proposed = request.proposedPricing;
    const updateData = {};
    if (proposed.price !== undefined) updateData.price = proposed.price;
    if (proposed.originalPrice !== undefined) updateData.originalPrice = proposed.originalPrice;
    if (proposed.pricingPlans !== undefined) updateData.pricingPlans = proposed.pricingPlans;
    if (proposed.subscriptionPlans !== undefined) updateData.subscriptionPlans = proposed.subscriptionPlans;
    if (proposed.durationOptions !== undefined) updateData.durationOptions = proposed.durationOptions;
    if (proposed.pricingTiers !== undefined) updateData.pricingTiers = proposed.pricingTiers;

    const service = await Service.findByIdAndUpdate(
      request.service,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    if (!service) return res.status(404).json({ error: { message: 'Service not found', status: 404 } });

    request.status = 'approved';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.superAdminNote = req.body.note || '';
    await request.save();

    res.json({ message: 'Price change approved and applied to service', service, request });
  } catch (error) {
    console.error('Approve price change request error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/super-admin/price-change-requests/:id/reject
// @desc    Reject a price change request
router.post('/price-change-requests/:id/reject', async (req, res) => {
  try {
    const PriceChangeRequest = (await import('../models/PriceChangeRequest.js')).default;

    const request = await PriceChangeRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: { message: 'Request not found', status: 404 } });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: { message: `Request already ${request.status}`, status: 400 } });
    }

    request.status = 'rejected';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.superAdminNote = req.body.reason || '';
    await request.save();

    res.json({ message: 'Price change request rejected', request });
  } catch (error) {
    console.error('Reject price change request error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// ─── Business Hours ──────────────────────────────────────────────────────────

const parseClockToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const value = timeStr.trim().toLowerCase();

  const hhmm24 = value.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm24) {
    const h = Number(hhmm24[1]);
    const m = Number(hhmm24[2]);
    if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }

  const hhmm12 = value.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (hhmm12) {
    let h = Number(hhmm12[1]);
    const m = Number(hhmm12[2]);
    const meridiem = hhmm12[3];
    if (Number.isNaN(h) || Number.isNaN(m) || h < 1 || h > 12 || m < 0 || m > 59) return null;
    if (meridiem === 'pm' && h !== 12) h += 12;
    if (meridiem === 'am' && h === 12) h = 0;
    return h * 60 + m;
  }

  return null;
};

const minutesToHHMM = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const normalizeClock = (timeStr) => {
  const mins = parseClockToMinutes(timeStr);
  return mins === null ? null : minutesToHHMM(mins);
};

// Helper: generate time slots from a day config + slot duration
function generateSlotsFromDayConfig(dayConfig, slotDurationMinutes) {
  const slots = [];
  const openMinutes = parseClockToMinutes(dayConfig.openTime);
  const closeMinutes = parseClockToMinutes(dayConfig.closeTime);
  if (openMinutes === null || closeMinutes === null || closeMinutes <= openMinutes) return slots;

  const breaks = (dayConfig.breaks || []).map((b) => {
    const start = parseClockToMinutes(b.start);
    const end = parseClockToMinutes(b.end);
    if (start === null || end === null) return null;
    return { start, end };
  }).filter(Boolean);

  for (let t = openMinutes; t + slotDurationMinutes <= closeMinutes; t += slotDurationMinutes) {
    const slotEnd = t + slotDurationMinutes;
    const inBreak = breaks.some((b) => t < b.end && slotEnd > b.start);
    if (!inBreak) {
      const hh = String(Math.floor(t / 60)).padStart(2, '0');
      const mm = String(t % 60).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
  }
  return slots;
}

// @route   GET /api/super-admin/business-hours
// @desc    Get the current business hours configuration
router.get('/business-hours', async (req, res) => {
  try {
    const config = await BusinessHours.getConfig();
    res.json({ success: true, businessHours: config });
  } catch (error) {
    console.error('Get business hours error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PUT /api/super-admin/business-hours
// @desc    Update business hours configuration (Super Admin only)
router.put(
  '/business-hours',
  [
    body('slotDurationMinutes')
      .optional()
      .isInt({ min: 15, max: 120 })
      .withMessage('Slot duration must be between 15 and 120 minutes'),
    body('timezone')
      .optional()
      .notEmpty()
      .withMessage('Timezone cannot be empty'),
    body('schedule')
      .optional()
      .isArray()
      .withMessage('Schedule must be an array'),
    body('holidays')
      .optional()
      .isArray()
      .withMessage('Holidays must be an array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg, status: 400 } });
      }

      const { schedule, timezone, slotDurationMinutes, holidays } = req.body;
      const config = await BusinessHours.getConfig();

      if (schedule !== undefined) {
        const normalizedSchedule = [];

        // Validate break end > start for every day
        for (const day of schedule) {
          const openNorm = normalizeClock(day.openTime);
          const closeNorm = normalizeClock(day.closeTime);

          if (!openNorm || !closeNorm) {
            return res.status(400).json({
              error: {
                message: `Invalid opening/closing time for ${day.day}. Use HH:MM or h:mm am/pm format.`,
                status: 400
              }
            });
          }

          if (openNorm >= closeNorm) {
            return res.status(400).json({
              error: {
                message: `Close time must be after open time (${day.day}: ${openNorm}–${closeNorm})`,
                status: 400
              }
            });
          }

          const nextDay = { ...day, openTime: openNorm, closeTime: closeNorm };

          if (Array.isArray(day.breaks)) {
            const nextBreaks = [];
            for (const br of day.breaks) {
              const startNorm = normalizeClock(br.start);
              const endNorm = normalizeClock(br.end);
              if (!startNorm || !endNorm) {
                return res.status(400).json({
                  error: {
                    message: `Invalid break time format (${day.day}: ${br.start}–${br.end})`,
                    status: 400
                  }
                });
              }
              if (startNorm >= endNorm) {
                return res.status(400).json({
                  error: {
                    message: `Break end time must be after start time (${day.day}: ${startNorm}–${endNorm})`,
                    status: 400
                  }
                });
              }

              // Break should stay within open/close window.
              if (startNorm < openNorm || endNorm > closeNorm) {
                return res.status(400).json({
                  error: {
                    message: `Break must be inside business hours (${day.day}: ${startNorm}–${endNorm})`,
                    status: 400
                  }
                });
              }

              nextBreaks.push({ ...br, start: startNorm, end: endNorm });
            }
            nextDay.breaks = nextBreaks;
          }

          normalizedSchedule.push(nextDay);
        }
        config.schedule = normalizedSchedule;
      }
      if (timezone !== undefined) config.timezone = timezone;
      if (slotDurationMinutes !== undefined) config.slotDurationMinutes = slotDurationMinutes;
      if (holidays !== undefined) config.holidays = holidays;
      config.updatedBy = req.user._id;

      await config.save();
      res.json({ success: true, message: 'Business hours updated successfully', businessHours: config });
    } catch (error) {
      console.error('Update business hours error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/super-admin/business-hours/available-slots
// @desc    Preview the slots generated for a given date
// @query   date=YYYY-MM-DD
router.get('/business-hours/available-slots', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: { message: 'Query param ?date=YYYY-MM-DD is required', status: 400 } });
    }

    const config = await BusinessHours.getConfig();
    const targetDate = new Date(date);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[targetDate.getDay()];
    const dayConfig = config.schedule.find((d) => d.day === dayName);

    if (!dayConfig || !dayConfig.isActive) {
      return res.json({
        success: true,
        slots: [],
        date,
        day: dayName,
        reason: 'Business is closed on this day'
      });
    }

    const slots = generateSlotsFromDayConfig(dayConfig, config.slotDurationMinutes);
    res.json({
      success: true,
      slots,
      date,
      day: dayName,
      config: {
        openTime: dayConfig.openTime,
        closeTime: dayConfig.closeTime,
        breaks: dayConfig.breaks,
        slotDurationMinutes: config.slotDurationMinutes,
        timezone: config.timezone
      }
    });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;
