import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import Booking from '../models/Booking.js';
import Location from '../models/Location.js';
import Notification from '../models/Notification.js';
import ServiceArea from '../models/ServiceArea.js';
import Settings from '../models/Settings.js';
import User from '../models/User.js';
import WorkerEarnings from '../models/WorkerEarnings.js';
import { generateTemporaryPassword, sendTemporaryPasswordEmail } from '../utils/emailService.js';

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
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('assignedLocationIds').optional().isArray().withMessage('Assigned locations must be an array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg, status: 400 } });
      }

      const { name, email, password, phone, assignedLocationIds } = req.body;

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
        email,
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
    const updates = req.body;

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
    const { name, phone, assignedLocationIds } = req.body;

    const admin = await User.findOne({ _id: adminId, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ error: { message: 'Admin not found', status: 404 } });
    }

    // Update basic fields
    if (name) admin.name = name;
    if (phone) admin.phone = phone;

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
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_to_say']).withMessage('Invalid gender'),
    body('religion').optional().isString(),
    body('experience').optional().isNumeric().withMessage('Experience must be a number'),
    body('specialization').isArray().withMessage('Specialization must be an array'),
    body('assignedApartmentIds').optional().isArray().withMessage('Assigned apartments must be an array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg, status: 400 } });
      }

      const { name, email, phone, gender, religion, experience, specialization, hourlyRate, assignedApartmentIds } = req.body;

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
          serviceRadius: settings.booking.serviceRadius // configurable walking distance in meters
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

      // Send temporary password email (non-blocking)
      let emailStatus = 'pending';
      console.log(`📧 Attempting to send email to: ${normalizedEmail}`);
      
      // Fire and forget - don't wait for email
      sendTemporaryPasswordEmail(normalizedEmail, name, temporaryPassword)
        .then(result => {
          if (result.success) {
            console.log('✅ Email sent successfully to:', normalizedEmail);
            emailStatus = 'sent';
          } else {
            console.log('⚠️ Email not sent:', result.reason);
            emailStatus = 'failed';
          }
        })
        .catch(error => {
          console.error('❌ Failed to send email:', error.message);
          emailStatus = 'failed';
        });

      // Return response immediately
      res.status(201).json({
        success: true,
        message: 'Worker created successfully. Temporary password is being sent to email.',
        emailStatus, // 'sending' status
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
        workers = [];
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

    // Date boundaries
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Today's stats
    const todayBookings = await Booking.countDocuments({
      createdAt: { $gte: today },
      status: { $in: ['pending', 'confirmed', 'in-progress'] }
    });

    const completedToday = await Booking.countDocuments({
      completedAt: { $gte: today },
      status: 'completed'
    });

    const todayRevenue = await Booking.aggregate([
      { $match: { completedAt: { $gte: today }, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    // Yesterday's stats for change calculation
    const yesterdayBookings = await Booking.countDocuments({
      createdAt: { $gte: yesterday, $lt: today },
      status: { $in: ['pending', 'confirmed', 'in-progress'] }
    });

    const completedYesterday = await Booking.countDocuments({
      completedAt: { $gte: yesterday, $lt: today },
      status: 'completed'
    });

    const yesterdayRevenue = await Booking.aggregate([
      { $match: { completedAt: { $gte: yesterday, $lt: today }, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

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

// @route   GET /api/admin/recent-bookings
// @desc    Get recent bookings for admin's locations
// @access  Private/Admin
router.get('/recent-bookings', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const limitNum = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);

    let bookings = await Booking.find()
      .populate('customer', 'name')
      .populate('worker', 'name')
      .populate('service', 'name')
      .sort({ createdAt: -1 })
      .limit(limitNum * 5); // Fetch more to filter

    // Filter bookings by location scope
    if (req.user.role === 'admin') {
      const adminLocationIds = req.user.adminProfile?.assignedLocations?.map(loc => loc.locationId.toString()) || [];

      bookings = await Promise.all(
        bookings.map(async (booking) => {
          if (!booking.worker) return booking;
          const worker = await User.findById(booking.worker._id);
          if (!worker) return null;
          const workerLocationIds = worker.workerProfile?.assignedApartments?.map(apt => apt.locationId?.toString()).filter(Boolean) || [];
          return workerLocationIds.some(locId => adminLocationIds.includes(locId)) ? booking : null;
        })
      );
      bookings = bookings.filter(b => b !== null).slice(0, limitNum);
    } else if (req.user.role === 'super_admin' && req.query.locationId) {
      // Super Admin: filter bookings by specific locationId via worker assignment
      const { locationId } = req.query;
      const workersInLocation = await User.find({
        role: 'worker',
        'workerProfile.assignedApartments.locationId': locationId
      }).select('_id').lean();
      const workerIds = new Set(workersInLocation.map((w) => w._id.toString()));
      bookings = bookings
        .filter((b) => b.worker && workerIds.has(b.worker._id?.toString() || b.worker.toString()))
        .slice(0, limitNum);
    } else {
      bookings = bookings.slice(0, limitNum);
    }

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

    const workerIds = workers.map(w => w._id);

    // Check for unassigned bookings (only for this admin's area)
    const unassignedBookings = await Booking.countDocuments({
      worker: null,
      status: 'pending'
      // Note: Ideally filter by location/address, but for now showing all unassigned
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
    const workers = await User.find({ 
      role: 'worker', 
      isActive: true 
    })
      .select('name email phone workerProfile.specialization workerProfile.assignedApartments workerProfile.rating workerProfile.availability workerProfile.leaves workerProfile.completedJobs currentLocation')
      .sort({ name: 1 });

    // Get all bookings for today
    const bookings = await Booking.find({
      bookingDate: { $gte: todayStart, $lte: todayEnd },
      status: { $in: ['confirmed', 'in-progress', 'pending'] }
    })
      .populate('customer', 'name')
      .populate('service', 'name')
      .populate('location', 'apartmentName area city')
      .sort({ startTime: 1 });

    // Build worker status map
    const workforceStatus = await Promise.all(workers.map(async (worker) => {
      // Check if worker has leave today
      const todayLeave = worker.workerProfile.leaves?.find(leave => {
        const leaveDate = new Date(leave.date);
        leaveDate.setHours(0, 0, 0, 0);
        return leaveDate.getTime() === todayStart.getTime() && leave.status === 'approved';
      });

      // Find current and upcoming bookings for this worker
      const workerBookings = bookings.filter(b => 
        b.worker && b.worker.toString() === worker._id.toString()
      );

      // Determine current task
      let currentTask = null;
      let status = 'free';
      let statusDetail = 'Available';

      if (todayLeave) {
        status = 'on-leave';
        statusDetail = `On Leave${todayLeave.reason ? `: ${todayLeave.reason}` : ''}`;
      } else if (!worker.workerProfile.availability) {
        status = 'offline';
        statusDetail = 'Offline';
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
        availability: worker.workerProfile.availability,
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
router.post('/manual-assign',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    body('bookingId').isMongoId().withMessage('Valid booking ID is required'),
    body('workerId').isMongoId().withMessage('Valid worker ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg, status: 400 } });
      }

      const { bookingId, workerId } = req.body;

      const booking = await Booking.findById(bookingId)
        .populate('service')
        .populate('location');
      
      if (!booking) {
        return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
      }

      if (!['pending', 'confirmed'].includes(booking.status)) {
        return res.status(400).json({ 
          error: { 
            message: `Cannot reassign booking with status: ${booking.status}`,
            status: 400 
          } 
        });
      }

      const worker = await User.findById(workerId);
      if (!worker || worker.role !== 'worker') {
        return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
      }

      // Check if worker has approved leave on booking date
      const bookingDate = new Date(booking.bookingDate);
      bookingDate.setHours(0, 0, 0, 0);
      
      const workerLeave = worker.workerProfile.leaves?.find(leave => {
        const leaveDate = new Date(leave.date);
        leaveDate.setHours(0, 0, 0, 0);
        return leaveDate.getTime() === bookingDate.getTime() && leave.status === 'approved';
      });

      if (workerLeave) {
        return res.status(400).json({ 
          error: { 
            message: 'Worker has approved leave on this date',
            status: 400 
          } 
        });
      }

      // Check for conflicts
      const [startHours, startMinutes] = booking.startTime.split(':').map(Number);
      const [endHours, endMinutes] = booking.endTime.split(':').map(Number);
      
      const conflictingBooking = await Booking.findOne({
        worker: workerId,
        bookingDate: booking.bookingDate,
        status: { $in: ['confirmed', 'in-progress', 'pending'] },
        _id: { $ne: bookingId },
        $or: [
          {
            $and: [
              { startTime: { $lte: booking.startTime } },
              { endTime: { $gt: booking.startTime } }
            ]
          },
          {
            $and: [
              { startTime: { $lt: booking.endTime } },
              { endTime: { $gte: booking.endTime } }
            ]
          },
          {
            $and: [
              { startTime: { $gte: booking.startTime } },
              { endTime: { $lte: booking.endTime } }
            ]
          }
        ]
      });

      if (conflictingBooking) {
        return res.status(400).json({ 
          error: { 
            message: 'Worker has a conflicting booking at this time',
            status: 400 
          } 
        });
      }

      // Assign worker
      booking.worker = workerId;
      booking.assignmentMethod = 'manual';
      booking.assignedBy = req.user._id;
      booking.assignedAt = new Date();
      
      if (booking.status === 'pending') {
        booking.status = 'confirmed';
      }

      await booking.save();

      await booking.populate('worker', 'name email phone');

      res.json({
        success: true,
        message: 'Worker assigned successfully',
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
              name: b.service?.name,
              category: b.service?.category
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
      .select('name email phone gender profileImage workerProfile.specialization workerProfile.experience workerProfile.accountStatus workerProfile.documents createdAt')
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
    const worker = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'worker' },
      { 'workerProfile.accountStatus': 'active', isVerified: true },
      { new: true }
    );

    if (!worker) return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });

    await Notification.create({
      recipient: worker._id,
      title: 'Application Approved!',
      message: 'Your worker account has been approved. You can now log in and start accepting bookings.',
      type: 'system',
      data: { type: 'account_approved' }
    });

    console.log(`✅ Worker approved: ${worker.name} (${worker._id}) by admin ${req.user._id}`);
    res.json({ success: true, message: 'Worker approved successfully', worker: { id: worker._id, name: worker.name } });
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

export default router;
