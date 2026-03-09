/**
 * Super Admin Routes — /api/super-admin/*
 * All routes here are exclusively for the super_admin role.
 * Regular admins are blocked at the authorize() middleware level.
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import Booking from '../models/Booking.js';
import Location from '../models/Location.js';
import User from '../models/User.js';
import { generateTemporaryPassword, sendTemporaryPasswordEmail } from '../utils/emailService.js';

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
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
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

      const { name, email, phone, gender, religion, experience, specialization, hourlyRate, assignedApartmentIds } = req.body;
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
        workerProfile: {
          specialization,
          experience: experience || 0,
          hourlyRate: hourlyRate || 0,
          assignedApartments,
          availability: true,
          serviceRadius: 500
        }
      });

      await worker.save();

      await Location.updateMany(
        { _id: { $in: assignedApartmentIds } },
        { $push: { assignedWorkers: { worker: worker._id, assignedAt: new Date() } } }
      );

      sendTemporaryPasswordEmail(normalizedEmail, name, temporaryPassword).catch(() => {});

      res.status(201).json({
        success: true,
        message: 'Worker created successfully',
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
router.get('/bookings', async (req, res) => {
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
    body('city').notEmpty().withMessage('City is required'),
    body('coordinates').isArray().withMessage('Coordinates must be an array [longitude, latitude]')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg, status: 400 } });
      }

      const { apartmentName, building, area, city, state, zipCode, coordinates, maxServiceRadius } = req.body;

      const location = new Location({
        apartmentName,
        building,
        area,
        city,
        state: state || 'Maharashtra',
        zipCode,
        location: { type: 'Point', coordinates },
        maxServiceRadius: maxServiceRadius || 500,
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

    const leave = admin.adminProfile.leaves.id(leaveId);
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

export default router;
