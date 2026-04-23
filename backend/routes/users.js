import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import Booking from '../models/Booking.js';
import Location from '../models/Location.js';
import User from '../models/User.js';
import WorkerEarnings from '../models/WorkerEarnings.js';
import { calculateDistance } from '../utils/geolocation.js';
import { getWorkerPerformance } from '../utils/updateWorkerStats.js';
import { evaluateWorkerEffectiveAvailability, isWorkerEligibleForAssignment } from '../utils/workerAvailability.js';

const router = express.Router();

const getUserCoordinates = (user) => {
  const defaultAddress = user?.addresses?.find(address => address?.isDefault) || user?.addresses?.[0];
  const coordinates = defaultAddress?.location?.coordinates || user?.currentLocation?.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return null;
  }

  const [longitude, latitude] = coordinates;
  if ([longitude, latitude].some(value => typeof value !== 'number' || Number.isNaN(value))) {
    return null;
  }

  return { longitude, latitude };
};

const resolveStrictLocationIdForUser = async (user) => {
  const coordinates = getUserCoordinates(user);
  if (!coordinates) {
    return null;
  }

  const nearestLocation = await Location.findOne({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [coordinates.longitude, coordinates.latitude]
        },
        $maxDistance: 50000
      }
    },
    isActive: true,
    isServiceAvailable: true
  }).select('_id location maxServiceRadius').lean();

  if (!nearestLocation?.location?.coordinates?.length) {
    return null;
  }

  const distanceMeters = calculateDistance(
    coordinates.latitude,
    coordinates.longitude,
    nearestLocation.location.coordinates[1],
    nearestLocation.location.coordinates[0]
  );
  const maxRadiusMeters = Math.max(nearestLocation.maxServiceRadius || 500, 100);

  return distanceMeters <= maxRadiusMeters ? nearestLocation._id.toString() : null;
};

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role, search, page = 1, limit = 10 } = req.query;

    // Validate and sanitize pagination parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10));

    const query = {};
    if (role) query.role = role;
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: -1 });

    const count = await User.countDocuments(query);

    // Enrich worker records with live stats from Bookings + WorkerEarnings
    let enrichedUsers = users;
    if (role === 'worker' && users.length > 0) {
      const workerIds = users.map(u => u._id);

      const [jobsAgg, earningsAgg] = await Promise.all([
        Booking.aggregate([
          { $match: { worker: { $in: workerIds }, status: 'completed' } },
          { $group: { _id: '$worker', count: { $sum: 1 } } }
        ]),
        WorkerEarnings.aggregate([
          { $match: { worker: { $in: workerIds } } },
          { $group: { _id: '$worker', total: { $sum: '$netEarning' } } }
        ])
      ]);

      const jobsMap = new Map(jobsAgg.map(r => [r._id.toString(), r.count]));
      const earningsMap = new Map(earningsAgg.map(r => [r._id.toString(), r.total]));

      enrichedUsers = users.map(u => {
        const obj = u.toObject();
        if (obj.workerProfile) {
          obj.workerProfile.completedJobs = jobsMap.get(u._id.toString()) || 0;
          obj.workerProfile.totalEarnings = Math.round((earningsMap.get(u._id.toString()) || 0) * 100) / 100;
        }
        return obj;
      });
    }

    res.json({
      users: enrichedUsers,
      totalPages: Math.ceil(count / limitNum),
      currentPage: pageNum,
      totalUsers: count
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', authenticate, async (req, res) => {
  try {
    const { default: Booking } = await import('../models/Booking.js');
    
    const userId = req.user._id;
    
    // Get booking statistics
    const totalBookings = await Booking.countDocuments({ customer: userId });
    const completedBookings = await Booking.countDocuments({ 
      customer: userId, 
      status: 'completed' 
    });
    
    // Get preferred workers (workers user booked most)
    const preferredWorkersData = await Booking.aggregate([
      { $match: { customer: userId, worker: { $exists: true } } },
      { $group: { _id: '$worker', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'workerDetails'
        }
      },
      { $unwind: '$workerDetails' },
      {
        $project: {
          name: '$workerDetails.name',
          rating: '$workerDetails.workerProfile.rating',
          specialization: '$workerDetails.workerProfile.specialization',
          jobsCount: '$count'
        }
      }
    ]);
    
    // Calculate months active
    const firstBooking = await Booking.findOne({ customer: userId }).sort({ createdAt: 1 });
    const monthsActive = firstBooking 
      ? Math.ceil((Date.now() - firstBooking.createdAt) / (1000 * 60 * 60 * 24 * 30))
      : 0;
    
    res.json({
      success: true,
      stats: {
        totalBookings,
        completedBookings,
        preferredWorkers: preferredWorkersData,
        monthsActive
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        error: { message: 'User not found', status: 404 } 
      });
    }

    // Only allow users to view their own profile unless admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ 
        error: { message: 'Forbidden', status: 403 } 
      });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PUT /api/users/toggle-availability
// @desc    Toggle worker availability (online/offline)
// @access  Private/Worker
router.put('/toggle-availability', authenticate, authorize('worker'), async (req, res) => {
  try {
    const { availability } = req.body;

    if (typeof availability !== 'boolean') {
      return res.status(400).json({ 
        error: { message: 'Availability must be a boolean value', status: 400 } 
      });
    }

    if (availability === true) {
      const eligibility = isWorkerEligibleForAssignment(req.user);
      if (!eligibility.eligible) {
        return res.status(403).json({
          error: {
            message: eligibility.reason,
            status: 403
          }
        });
      }
    }

    const worker = await User.findByIdAndUpdate(
      req.user._id,
      { 
        $set: { 
          'workerProfile.availability': availability,
          'workerProfile.lastAvailabilityUpdate': new Date()
        } 
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!worker) {
      return res.status(404).json({ 
        error: { message: 'Worker not found', status: 404 } 
      });
    }

    const effectiveAvailability = await evaluateWorkerEffectiveAvailability(worker);

    console.log(`🔄 Worker ${worker.name} availability changed to: ${availability ? 'ONLINE' : 'OFFLINE'}`);

    res.json({ 
      message: availability
        ? (effectiveAvailability.effectiveAvailability
            ? 'You are now online'
            : effectiveAvailability.reason || 'Availability saved. You will go online during your configured working hours.')
        : 'You are now offline',
      worker,
      availability: effectiveAvailability.effectiveAvailability,
      manualAvailability: worker.workerProfile.availability,
      availabilityReason: effectiveAvailability.reason
    });
  } catch (error) {
    console.error('Toggle availability error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private
router.put('/:id', authenticate, async (req, res) => {
  try {
    // Only allow users to update their own profile unless admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ 
        error: { message: 'Forbidden', status: 403 } 
      });
    }

    const { name, phone, address, profileImage, workerProfile, addresses, currentLocation } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    if (profileImage) updateData.profileImage = profileImage;
    if (addresses) updateData.addresses = addresses;
    if (currentLocation) updateData.currentLocation = currentLocation;
    if (workerProfile && req.user.role === 'worker') {
      updateData.workerProfile = workerProfile;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ 
        error: { message: 'User not found', status: 404 } 
      });
    }

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user permanently
// @access  Private/Admin
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        error: { message: 'User not found', status: 404 } 
      });
    }

    // Check for active bookings if user is a worker
    if (user.role === 'worker') {
      const activeBookings = await Booking.countDocuments({
        worker: user._id,
        status: { $in: ['pending', 'confirmed', 'in-progress'] }
      });

      if (activeBookings > 0) {
        return res.status(400).json({ 
          error: { 
            message: `Cannot delete worker with ${activeBookings} active booking(s). Please reassign or complete them first.`,
            status: 400 
          } 
        });
      }

      // Remove from location assignments
      await Location.updateMany(
        { 'assignedWorkers.worker': user._id },
        { $pull: { assignedWorkers: { worker: user._id } } }
      );
    }

    // Check for active bookings if user is a customer
    if (user.role === 'customer') {
      const activeBookings = await Booking.countDocuments({
        customer: user._id,
        status: { $in: ['pending', 'confirmed', 'in-progress'] }
      });

      if (activeBookings > 0) {
        return res.status(400).json({ 
          error: { 
            message: `Cannot delete customer with ${activeBookings} active booking(s). Please cancel them first.`,
            status: 400 
          } 
        });
      }
    }

    // Permanently delete user from database
    await User.findByIdAndDelete(req.params.id);

    console.log(`✅ User ${user.name} (${user._id}) with role ${user.role} permanently deleted from database`);

    res.json({ 
      success: true,
      message: `User permanently deleted from database` 
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/users/workers/available
// @desc    Get available workers
// @access  Private
router.get('/workers/available', authenticate, async (req, res) => {
  try {
    const { specialization, minRating } = req.query;
    const currentUser = req.user.role === 'customer'
      ? await User.findById(req.user._id).select('role addresses currentLocation').lean()
      : req.user;
    const customerLocationId = req.user.role === 'customer'
      ? await resolveStrictLocationIdForUser(currentUser)
      : null;

    if (req.user.role === 'customer' && !customerLocationId) {
      return res.json({ workers: [] });
    }

    const query = {
      role: 'worker',
      isActive: true
    };

    if (customerLocationId) {
      query['workerProfile.assignedApartments.locationId'] = customerLocationId;
    }

    // Specialization is an array field, check if it contains the value
    if (specialization) {
      query['workerProfile.specialization'] = specialization;
    }
    if (minRating) {
      const rating = parseFloat(minRating);
      if (isNaN(rating) || rating < 0 || rating > 5) {
        return res.status(400).json({ error: { message: 'minRating must be a number between 0 and 5', status: 400 } });
      }
      query['workerProfile.rating'] = { $gte: rating };
    }

    console.log('🔍 GET /workers/available query:', JSON.stringify(query));

    const workers = await User.find(query)
      .select('-password')
      .sort({ 'workerProfile.rating': -1 });

    const workerEntries = await Promise.all(
      workers.map(async worker => ({
        worker,
        effectiveAvailability: await evaluateWorkerEffectiveAvailability(worker)
      }))
    );

    const availableWorkers = workerEntries
      .filter(entry => entry.effectiveAvailability.effectiveAvailability)
      .map(entry => {
        const worker = entry.worker.toObject();
        worker.workerProfile = {
          ...worker.workerProfile,
          manualAvailability: worker.workerProfile?.availability,
          availability: true,
          effectiveAvailability: true,
          availabilityReason: null
        };
        return worker;
      });

    console.log(`✅ Found ${availableWorkers.length} available workers`);

    res.json({ workers: availableWorkers });
  } catch (error) {
    console.error('Get workers error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/users/addresses
// @desc    Add new address
// @access  Private
router.post('/addresses', authenticate, async (req, res) => {
  try {
    const { label, street, blockNo, flatNo, apartment, building, area, city, state, zipCode, location, isDefault } = req.body;

    // Validate required fields
    const areaVal = (area || '').trim();
    const cityVal = (city || '').trim();
    const zipVal = (zipCode || '').trim();
    const aptVal = (apartment || '').trim();

    if (!areaVal || !cityVal) {
      return res.status(400).json({ error: { message: 'Area and City are required.', status: 400 } });
    }

    // Helper: check value is a meaningful name (at least 3 chars, contains a vowel, mostly alphabetic)
    const isValidName = (val) => {
      if (val.length < 3) return false;
      if (!/[aeiouAEIOU]/.test(val)) return false;
      const alphaCount = (val.match(/[a-zA-Z]/g) || []).length;
      if (alphaCount / val.length < 0.4) return false;
      return true;
    };

    if (!isValidName(areaVal)) {
      return res.status(400).json({ error: { message: 'Please enter a valid area name.', status: 400 } });
    }
    if (!isValidName(cityVal)) {
      return res.status(400).json({ error: { message: 'Please enter a valid city name.', status: 400 } });
    }
    if (aptVal && !isValidName(aptVal)) {
      return res.status(400).json({ error: { message: 'Please enter a valid apartment/building name.', status: 400 } });
    }
    const flatVal = (flatNo || '').trim();
    if (flatVal && !/^[a-zA-Z0-9\s/,.-]{1,20}$/.test(flatVal)) {
      return res.status(400).json({ error: { message: 'Please enter a valid flat number.', status: 400 } });
    }
    if (zipVal && !/^\d{6}$/.test(zipVal)) {
      return res.status(400).json({ error: { message: 'ZIP code must be exactly 6 digits.', status: 400 } });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found', status: 404 } });
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    // Add new address
    user.addresses.push({
      label: label || 'Home',
      street,
      blockNo: (blockNo || '').trim() || undefined,
      flatNo: flatVal || undefined,
      apartment: aptVal || undefined,
      building,
      area: areaVal,
      city: cityVal,
      state,
      zipCode: zipVal || undefined,
      location,
      isDefault: isDefault || user.addresses.length === 0 // First address is default
    });

    await user.save();

    res.status(201).json({ 
      success: true,
      message: 'Address added successfully', 
      addresses: user.addresses 
    });
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PATCH /api/users/addresses/:addressId
// @desc    Update address
// @access  Private
router.patch('/addresses/:addressId', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found', status: 404 } });
    }

    const address = user.addresses.id(req.params.addressId);
    if (!address) {
      return res.status(404).json({ error: { message: 'Address not found', status: 404 } });
    }

    // Update fields — only allow safe, known address fields
    const allowedFields = ['label', 'street', 'apartment', 'building', 'area', 'city', 'state', 'zipCode', 'location', 'isDefault'];
    allowedFields.forEach(key => {
      if (req.body[key] !== undefined) {
        address[key] = req.body[key];
      }
    });

    // If setting as default, unset others
    if (req.body.isDefault === true) {
      user.addresses.forEach(addr => {
        if (addr._id.toString() !== req.params.addressId) {
          addr.isDefault = false;
        }
      });
    }

    await user.save();

    res.json({ 
      success: true,
      message: 'Address updated successfully', 
      addresses: user.addresses 
    });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   DELETE /api/users/addresses/:addressId
// @desc    Delete address
// @access  Private
router.delete('/addresses/:addressId', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found', status: 404 } });
    }

    const address = user.addresses.id(req.params.addressId);
    if (!address) {
      return res.status(404).json({ error: { message: 'Address not found', status: 404 } });
    }

    const wasDefault = address.isDefault;
    address.deleteOne();

    // If deleted address was default, make first remaining address default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.json({ 
      success: true,
      message: 'Address deleted successfully', 
      addresses: user.addresses 
    });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/users/addresses/:addressId/set-default
// @desc    Set address as default
// @access  Private
router.post('/addresses/:addressId/set-default', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found', status: 404 } });
    }

    const address = user.addresses.id(req.params.addressId);
    if (!address) {
      return res.status(404).json({ error: { message: 'Address not found', status: 404 } });
    }

    // Unset all defaults
    user.addresses.forEach(addr => addr.isDefault = false);
    // Set this one as default
    address.isDefault = true;

    await user.save();

    res.json({ 
      success: true,
      message: 'Default address updated', 
      addresses: user.addresses 
    });
  } catch (error) {
    console.error('Set default address error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/users/worker/dashboard-stats
// @desc    Get worker dashboard statistics
// @access  Private/Worker
router.get('/worker/dashboard-stats', authenticate, authorize('worker'), async (req, res) => {
  try {
    const Booking = (await import('../models/Booking.js')).default;
    const workerId = req.user._id;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Jobs count — filter by bookingDate (the actual service date), run in parallel
    const [todayCount, weekCount, monthCount] = await Promise.all([
      Booking.countDocuments({
        worker: workerId,
        status: 'completed',
        bookingDate: { $gte: today, $lt: tomorrow }
      }),
      Booking.countDocuments({
        worker: workerId,
        status: 'completed',
        bookingDate: { $gte: startOfWeek }
      }),
      Booking.countDocuments({
        worker: workerId,
        status: 'completed',
        bookingDate: { $gte: startOfMonth }
      })
    ]);

    // Worked minutes — all completed bookings, with fallback duration chain:
    // 1) actualDurationMinutes  2) actualStartTime/actualEndTime  3) scheduledDurationMinutes
    const workedMinutesAgg = await Booking.aggregate([
      {
        $match: {
          worker: workerId,
          status: 'completed'
        }
      },
      {
        $addFields: {
          computedMinutes: {
            $cond: {
              if: { $gt: ['$actualDurationMinutes', 0] },
              then: '$actualDurationMinutes',
              else: {
                $cond: {
                  if: { $and: [
                    { $ifNull: ['$actualStartTime', false] },
                    { $ifNull: ['$actualEndTime', false] }
                  ]},
                  then: { $divide: [{ $subtract: ['$actualEndTime', '$actualStartTime'] }, 60000] },
                  else: { $ifNull: ['$scheduledDurationMinutes', 0] }
                }
              }
            }
          }
        }
      },
      {
        $facet: {
          today: [
            { $match: { bookingDate: { $gte: today, $lt: tomorrow } } },
            { $group: { _id: null, total: { $sum: '$computedMinutes' } } }
          ],
          week: [
            { $match: { bookingDate: { $gte: startOfWeek } } },
            { $group: { _id: null, total: { $sum: '$computedMinutes' } } }
          ],
          month: [
            { $match: { bookingDate: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$computedMinutes' } } }
          ]
        }
      }
    ]);

    const wm = workedMinutesAgg[0] || {};
    const minutesToday  = Math.round(wm.today?.[0]?.total  || 0);
    const minutesWeek   = Math.round(wm.week?.[0]?.total   || 0);
    const minutesMonth  = Math.round(wm.month?.[0]?.total  || 0);
    
    res.json({
      success: true,
      stats: {
        today: todayCount,
        thisWeek: weekCount,
        thisMonth: monthCount,
        minutesToday,
        minutesThisWeek: minutesWeek,
        minutesThisMonth: minutesMonth
      }
    });
  } catch (error) {
    console.error('Get worker dashboard stats error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/users/worker/current-task
// @desc    Get worker's current active task
// @access  Private/Worker
router.get('/worker/current-task', authenticate, authorize('worker'), async (req, res) => {
  try {
    const Booking = (await import('../models/Booking.js')).default;
    const workerId = req.user._id;
    
    const currentTask = await Booking.findOne({
      $or: [
        { worker: workerId },
        { 'supportStaff.worker': workerId }
      ],
      status: 'in-progress'
    })
    .populate('customer', 'name email phone')
    .populate('service', 'name description price duration allowBreakRequests')
    .populate('worker', 'name email phone')
    .populate('supportStaff.worker', 'name email phone')
    .sort({ bookingDate: -1 });
    
    res.json({
      success: true,
      task: currentTask
    });
  } catch (error) {
    console.error('Get current task error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/users/worker/upcoming-tasks
// @desc    Get worker's upcoming tasks
// @access  Private/Worker
router.get('/worker/upcoming-tasks', authenticate, authorize('worker'), async (req, res) => {
  try {
    const Booking = (await import('../models/Booking.js')).default;
    const workerId = req.user._id;
    const { limit = 10 } = req.query;
    
    const now = new Date();
    
    console.log('🔍 Fetching upcoming tasks for worker:', workerId);
    console.log('   Current date:', now.toISOString().split('T')[0]);
    
    const upcomingTasks = await Booking.find({
      $or: [
        { worker: workerId },
        { 'supportStaff.worker': workerId }
      ],
      status: { $in: ['confirmed', 'pending'] },
      bookingDate: { $gte: now.toISOString().split('T')[0] }
    })
    .populate('customer', 'name email phone')
    .populate('service', 'name description price duration allowBreakRequests')
    .populate('worker', 'name email phone')
    .populate('supportStaff.worker', 'name email phone')
    .sort({ bookingDate: 1, startTime: 1 })
    .limit(parseInt(limit));
    
    console.log(`✅ Found ${upcomingTasks.length} upcoming tasks`);
    if (upcomingTasks.length > 0) {
      upcomingTasks.forEach(task => {
        console.log(`   - ${task.service?.name ?? 'Unknown service'} on ${task.bookingDate} at ${task.startTime} (${task.status})`);
      });
    }
    
    res.json({
      success: true,
      tasks: upcomingTasks
    });
  } catch (error) {
    console.error('Get upcoming tasks error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/users/worker/earnings
// @desc    Get worker earnings history
// @access  Private/Worker
router.get('/worker/earnings', authenticate, authorize('worker'), async (req, res) => {
  try {
    const workerId = req.user._id;
    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    
    const query = {
      worker: workerId,
      status: 'completed',
      customer: { $ne: null },
      service: { $ne: null }
    };
    
    if (startDate || endDate) {
      query.completedAt = {};
      if (startDate) query.completedAt.$gte = new Date(startDate);
      if (endDate) query.completedAt.$lte = new Date(endDate);
    }
    
    const earnings = await Booking.find(query)
      .populate('customer', 'name')
      .populate('service', 'name')
      .select('service customer completedAt totalAmount bookingDate startTime duration actualStartTime actualEndTime actualDurationMinutes overtimeMinutes overtimeCharges workforce')
      .sort({ completedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const totalEarnings = await Booking.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ['$workforce.totalWorkerWage', 0] }] },
                { $divide: ['$workforce.totalWorkerWage', { $max: [{ $ifNull: ['$workforce.workerCount', 1] }, 1] }] },
                '$totalAmount'
              ]
            }
          }
        }
      }
    ]);
    
    const count = await Booking.countDocuments(query);
    
    res.json({
      success: true,
      earnings,
      totalEarnings: totalEarnings[0]?.total || 0,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalRecords: count
    });
  } catch (error) {
    console.error('Get worker earnings error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/users/admin/dashboard-stats
// @desc    Get admin dashboard statistics
// @access  Private/Admin
router.get('/admin/dashboard-stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const Booking = (await import('../models/Booking.js')).default;
    const revenueBookingMatch = {
      status: 'completed',
      cancellationDate: null
    };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Today's bookings
    const todayBookings = await Booking.countDocuments({
      createdAt: { $gte: today }
    });
    
    // Yesterday's bookings for comparison
    const yesterdayBookings = await Booking.countDocuments({
      createdAt: { $gte: yesterday, $lt: today }
    });
    
    // Active workers (workers with bookings today or status available)
    const activeWorkers = await User.countDocuments({
      role: 'worker',
      $or: [
        { 'workerProfile.availability': true },
        { _id: { $in: await Booking.distinct('worker', { 
          bookingDate: today.toISOString().split('T')[0],
          status: { $in: ['confirmed', 'in-progress'] }
        }) } }
      ]
    });
    
    // Total workers count for percentage
    const totalWorkers = await User.countDocuments({ role: 'worker' });
    
    // Today's revenue
    const todayRevenue = await Booking.aggregate([
      {
        $match: {
          ...revenueBookingMatch,
          completedAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    // Yesterday's revenue
    const yesterdayRevenue = await Booking.aggregate([
      {
        $match: {
          ...revenueBookingMatch,
          completedAt: { $gte: yesterday, $lt: today }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    // Fulfillment rate (completed / total bookings in last 7 days)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const last7DaysBookings = await Booking.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });
    
    const last7DaysCompleted = await Booking.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
      ...revenueBookingMatch
    });
    
    const fulfillmentRate = last7DaysBookings > 0 
      ? ((last7DaysCompleted / last7DaysBookings) * 100).toFixed(1)
      : 0;
    
    // Previous week for comparison
    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    
    const previous7DaysBookings = await Booking.countDocuments({
      createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo }
    });
    
    const previous7DaysCompleted = await Booking.countDocuments({
      createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo },
      ...revenueBookingMatch
    });
    
    const previousFulfillmentRate = previous7DaysBookings > 0
      ? ((previous7DaysCompleted / previous7DaysBookings) * 100).toFixed(1)
      : 0;
    
    // Calculate changes
    const bookingsChange = yesterdayBookings > 0
      ? (((todayBookings - yesterdayBookings) / yesterdayBookings) * 100).toFixed(1)
      : '+100';
    
    const revenueChange = yesterdayRevenue[0]?.total > 0
      ? (((todayRevenue[0]?.total - yesterdayRevenue[0]?.total) / yesterdayRevenue[0]?.total) * 100).toFixed(1)
      : '+100';
    
    const fulfillmentChange = previousFulfillmentRate > 0
      ? (fulfillmentRate - previousFulfillmentRate).toFixed(1)
      : '+0';
    
    res.json({
      success: true,
      stats: {
        todayBookings,
        bookingsChange: `${bookingsChange >= 0 ? '+' : ''}${bookingsChange}%`,
        activeWorkers,
        workersOnlineInfo: `${activeWorkers} of ${totalWorkers} online`,
        todayRevenue: todayRevenue[0]?.total || 0,
        revenueChange: `${revenueChange >= 0 ? '+' : ''}${revenueChange}%`,
        fulfillmentRate,
        fulfillmentChange: `${fulfillmentChange >= 0 ? '+' : ''}${fulfillmentChange}%`
      }
    });
  } catch (error) {
    console.error('Get admin dashboard stats error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/users/admin/recent-bookings
// @desc    Get recent bookings for admin dashboard
// @access  Private/Admin
router.get('/admin/recent-bookings', authenticate, authorize('admin'), async (req, res) => {
  try {
    const Booking = (await import('../models/Booking.js')).default;
    const { limit = 10 } = req.query;
    
    const recentBookings = await Booking.find()
      .populate('customer', 'name')
      .populate('worker', 'name')
      .populate('service', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      bookings: recentBookings
    });
  } catch (error) {
    console.error('Get recent bookings error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/users/admin/alerts
// @desc    Get system alerts for admin
// @access  Private/Admin
router.get('/admin/alerts', authenticate, authorize('admin'), async (req, res) => {
  try {
    const Booking = (await import('../models/Booking.js')).default;
    const alerts = [];
    
    // Alert 1: Bookings without workers
    const unassignedBookings = await Booking.countDocuments({
      status: 'pending',
      worker: null
    });
    
    if (unassignedBookings > 0) {
      alerts.push({
        type: 'warning',
        message: `${unassignedBookings} booking${unassignedBookings > 1 ? 's have' : ' has'} no worker assigned — auto-reassignment in progress`,
        action: 'assign-workers',
        count: unassignedBookings
      });
    }
    
    // Alert 2: Workers offline during shift (simplified - based on no recent activity)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const inactiveWorkers = await User.find({
      role: 'worker',
      'workerProfile.availability': true,
      updatedAt: { $lt: twoHoursAgo }
    }).select('name').limit(5);
    
    if (inactiveWorkers.length > 0) {
      const workerNames = inactiveWorkers.map(w => w.name).join(', ');
      alerts.push({
        type: 'error',
        message: `Worker${inactiveWorkers.length > 1 ? 's' : ''} ${workerNames} ${inactiveWorkers.length > 1 ? 'have' : 'has'} been offline for 2+ hours during active shift`,
        action: 'contact-workers',
        workers: inactiveWorkers
      });
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

// @route   GET /api/users/:id/performance
// @desc    Get worker performance statistics
// @access  Private
router.get('/:id/performance', authenticate, async (req, res) => {
  try {
    const workerId = req.params.id;
    
    // Check if user is authorized to view this data
    const isAuthorized = 
      req.user.role === 'admin' || 
      req.user._id.toString() === workerId;

    if (!isAuthorized) {
      return res.status(403).json({ 
        error: { message: 'Forbidden', status: 403 } 
      });
    }

    const performance = await getWorkerPerformance(workerId);
    
    if (!performance) {
      return res.status(404).json({ 
        error: { message: 'Worker not found', status: 404 } 
      });
    }

    res.json({ 
      success: true,
      performance 
    });
  } catch (error) {
    console.error('Get worker performance error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/users/worker/documents
// @desc    Get worker's own documents (profile picture, Aadhaar front/back)
// @access  Private/Worker
router.get('/worker/documents', authenticate, authorize('worker'), async (req, res) => {
  try {
    const workerId = req.user._id;
    
    const worker = await User.findById(workerId)
      .select('name email profileImage workerProfile.documents')
      .lean();
    
    if (!worker) {
      return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
    }
    
    res.json({
      success: true,
      documents: {
        profileImage: worker.profileImage,
        aadhaarFront: worker.workerProfile?.documents?.aadhaarFront,
        aadhaarBack: worker.workerProfile?.documents?.aadhaarBack,
        aadhaarNumber: worker.workerProfile?.documents?.aadhaarNumber,
        uploadedAt: worker.workerProfile?.documents?.uploadedAt
      }
    });
  } catch (error) {
    console.error('Get worker documents error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;
