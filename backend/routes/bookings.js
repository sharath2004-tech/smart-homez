import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import Booking from '../models/Booking.js';
import BusinessHours from '../models/BusinessHours.js';
import Location from '../models/Location.js';
import Service from '../models/Service.js';
import Settings from '../models/Settings.js';
import User from '../models/User.js';
import WorkerEarnings from '../models/WorkerEarnings.js';
import {
    activateBackupWorker,
    assignWorkersWithBackup,
    checkBackupActivationNeeded
} from '../utils/advancedWorkerAssignment.js';
import { processQueuedBookings, updateBookingStatuses } from '../utils/bookingStatusUpdater.js';
import notificationService from '../utils/notificationService.js';
import { findWorkerWithPreferences } from '../utils/preferenceAssignment.js';
import { checkIfOnTime, updateWorkerStats } from '../utils/updateWorkerStats.js';
import { assignWorkerToBooking, reassignWorker } from '../utils/workerAssignment.js';
import {
    getWorkerAvailabilityForecast,
    getWorkerCapacityStatus,
    monitorWorkerPool
} from '../utils/workerPoolManager.js';

const router = express.Router();

// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err) {
    console.error('❌ Multer error:', err);
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: { message: 'File size too large. Maximum 5MB allowed.', status: 400 } 
      });
    }
    
    if (err.message && err.message.includes('Only image files')) {
      return res.status(400).json({ 
        error: { message: err.message, status: 400 } 
      });
    }
    
    return res.status(400).json({ 
      error: { message: err.message || 'File upload error', status: 400 } 
    });
  }
  next();
};

// @route   GET /api/bookings
// @desc    Get bookings (filtered by user role and location)
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    // Update booking statuses before fetching
    try {
      await updateBookingStatuses();
    } catch (statusUpdateError) {
      console.error('Error updating booking statuses:', statusUpdateError);
      // Continue even if status update fails
    }
    
    const { status, page = 1, limit = 10 } = req.query;
    
    let query = {};
    
    // Filter based on user role
    if (req.user.role === 'customer') {
      query.customer = req.user._id;
    } else if (req.user.role === 'worker') {
      // Workers only see bookings assigned to them
      query.worker = req.user._id;
    } else if (req.user.role === 'admin') {
      // Admins only see bookings within their assigned locations
      const admin = await User.findById(req.user._id).select('adminProfile').lean();
      const assignedLocationIds = (admin?.adminProfile?.assignedLocations || [])
        .map(l => l.locationId)
        .filter(Boolean);
      if (assignedLocationIds.length > 0) {
        query['location.locationId'] = { $in: assignedLocationIds };
      } else {
        // Admin has no assigned locations — return nothing
        return res.json({ bookings: [], totalPages: 0, currentPage: 1, totalBookings: 0 });
      }
    }
    // super_admin sees all bookings (no filter applied)

    // Handle comma-separated status values (e.g., "pending,confirmed")
    if (status) {
      const statusArray = status.split(',').map(s => s.trim());
      if (statusArray.length > 1) {
        query.status = { $in: statusArray };
      } else {
        query.status = statusArray[0];
      }
    }

    console.log('Fetching bookings with query:', JSON.stringify(query));

    const bookings = await Booking.find(query)
      .populate({
        path: 'customer',
        select: 'name email phone',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'worker',
        select: 'name email phone gender religion workerProfile',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'service',
        select: 'name description price duration',
        options: { strictPopulate: false }
      })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ bookingDate: -1 })
      .lean();

    console.log(`Found ${bookings.length} bookings`);

    const count = await Booking.countDocuments(query);

    res.json({
      bookings,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalBookings: count
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    res.status(500).json({ 
      error: { 
        message: 'Server error', 
        status: 500,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      } 
    });
  }
});

// @route   GET /api/bookings/available-orders
// @desc    Get available orders in worker's assigned locations (pending/unassigned)
// @access  Private/Worker
router.get('/available-orders', authenticate, authorize('worker'), async (req, res) => {
  try {
    const worker = await User.findById(req.user._id);
    
    if (!worker || !worker.workerProfile?.assignedApartments?.length) {
      return res.json({ 
        orders: [],
        message: 'No locations assigned to you yet'
      });
    }

    // Get location IDs assigned to this worker
    const assignedLocationIds = worker.workerProfile.assignedApartments.map(
      apt => apt.locationId
    );

    // Find pending bookings in worker's assigned locations
    const availableOrders = await Booking.find({
      'location.locationId': { $in: assignedLocationIds },
      status: 'pending',
      $or: [
        { worker: null },
        { worker: { $exists: false } }
      ]
    })
      .populate('customer', 'name email phone')
      .populate('service', 'name description price duration')
      .populate('location.locationId', 'apartmentName area city')
      .sort({ bookingDate: 1, startTime: 1 })
      .limit(20);

    res.json({
      orders: availableOrders,
      totalOrders: availableOrders.length,
      assignedLocations: worker.workerProfile.assignedApartments.map(apt => ({
        apartmentName: apt.apartmentName,
        area: apt.area,
        city: apt.city
      }))
    });
  } catch (error) {
    console.error('Get available orders error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/bookings/:id/accept-order
// @desc    Worker accepts an available order in their region
// @access  Private/Worker
router.post('/:id/accept-order', authenticate, authorize('worker'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('location.locationId');
    
    if (!booking) {
      return res.status(404).json({ 
        error: { message: 'Booking not found', status: 404 } 
      });
    }

    // Check if booking is still available
    if (booking.worker) {
      return res.status(400).json({ 
        error: { message: 'This order has already been accepted by another worker', status: 400 } 
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ 
        error: { message: 'This order is no longer available', status: 400 } 
      });
    }

    // Verify worker is assigned to this location
    const worker = await User.findById(req.user._id);
    const workerInLocation = worker.workerProfile?.assignedApartments?.some(
      apt => apt.locationId.toString() === booking.location.locationId._id.toString()
    );

    if (!workerInLocation) {
      return res.status(403).json({ 
        error: { message: 'You are not assigned to this location', status: 403 } 
      });
    }

    // Check for time conflicts
    const conflictingBooking = await Booking.findOne({
      worker: req.user._id,
      bookingDate: booking.bookingDate,
      status: { $in: ['confirmed', 'in-progress'] },
      $or: [
        {
          startTime: { $lt: booking.endTime },
          endTime: { $gt: booking.startTime }
        }
      ]
    });

    if (conflictingBooking) {
      return res.status(400).json({ 
        error: { message: 'You have a conflicting booking at this time', status: 400 } 
      });
    }

    // Assign worker to booking
    booking.worker = req.user._id;
    booking.status = 'confirmed';
    booking.assignmentMethod = 'worker-accepted';
    booking.assignedAt = new Date();
    await booking.save();

    const updatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name email phone')
      .populate('worker', 'name email phone gender religion workerProfile')
      .populate('service', 'name description price duration')
      .populate('location.locationId', 'apartmentName area city');

    res.json({ 
      message: 'Order accepted successfully', 
      booking: updatedBooking 
    });
  } catch (error) {
    console.error('Accept order error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/bookings/booked-slots
// @desc    Get booked time ranges for a specific date (for slot availability UI)
// @access  Private/Customer
router.get('/booked-slots', authenticate, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: { message: 'date query param required (YYYY-MM-DD)', status: 400 } });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // All active bookings on this date
    const bookings = await Booking.find({
      bookingDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'confirmed', 'in-progress'] }
    }).select('worker startTime endTime').lean();

    // Build per-worker booked ranges
    const bookedRanges = bookings.map(b => ({
      workerId: b.worker ? b.worker.toString() : null,
      startTime: b.startTime,
      endTime: b.endTime
    }));

    // Count total active workers in the system
    const totalWorkers = await User.countDocuments({ role: 'worker', isActive: true });

    res.json({ success: true, bookedRanges, totalWorkers });
  } catch (error) {
    console.error('Get booked slots error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get booking by ID
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('worker', 'name email phone gender religion workerProfile')
      .populate('service', 'name description price duration');
    
    if (!booking) {
      return res.status(404).json({ 
        error: { message: 'Booking not found', status: 404 } 
      });
    }

    // Check access permissions
    const isAuthorized = 
      req.user.role === 'admin' ||
      booking.customer._id.toString() === req.user._id.toString() ||
      (booking.worker && booking.worker._id && booking.worker._id.toString() === req.user._id.toString());

    if (!isAuthorized) {
      return res.status(403).json({ 
        error: { message: 'Forbidden', status: 403 } 
      });
    }

    res.json({ booking });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/bookings
// @desc    Create a new booking (with automatic worker assignment)
// @access  Private/Customer
router.post('/',
  authenticate,
  authorize('customer', 'admin'),
  [
    body('worker').optional().isString(),
    body('service').optional().isString(),
    body('bookingDate').isISO8601().withMessage('Valid booking date is required'),
    body('startTime').notEmpty().withMessage('Start time is required'),
    body('endTime').notEmpty().withMessage('End time is required'),
    body('totalAmount').isNumeric().withMessage('Total amount must be a number'),
    body('autoAssign').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      let { 
        worker, 
        service, 
        bookingDate, 
        startTime, 
        endTime, 
        totalAmount, 
        location, 
        notes, 
        autoAssign,
        bookingType,
        preferences,
        isSubscription,
        subscriptionDetails,
        serviceDetails
      } = req.body;

      // Resolve service: if not provided, find a matching active service by bookingType
      if (!service) {
        const serviceTypeMap = {
          'adhoc': 'instant_hourly',
          'monthly': 'monthly_subscription',
        };
        const targetType = serviceTypeMap[bookingType] || null;
        const filter = { isActive: true, ...(targetType ? { serviceType: targetType } : {}) };
        const fallbackService = await Service.findOne(filter).lean();
        if (!fallbackService) {
          return res.status(400).json({
            error: {
              message: 'No matching service found. Please ask your admin to create an active service.',
              status: 400,
              code: 'SERVICE_NOT_FOUND'
            }
          });
        }
        service = fallbackService._id.toString();
        console.log(`✅ Service auto-resolved: ${fallbackService.name} (${fallbackService.serviceType})`);
      }

      // Validate subscription bookings require a worker
      if (isSubscription && !worker) {
        return res.status(400).json({ 
          error: { 
            message: 'Subscription bookings require a worker to be selected for consistency.', 
            status: 400,
            code: 'WORKER_REQUIRED_FOR_SUBSCRIPTION'
          } 
        });
      }
      
      // Validate subscription details
      if (isSubscription && subscriptionDetails) {
        if (!subscriptionDetails.startDate) {
          return res.status(400).json({ 
            error: { 
              message: 'Subscription start date is required', 
              status: 400 
            } 
          });
        }
        if (subscriptionDetails.frequency === 'weekly' && (!subscriptionDetails.selectedDays || subscriptionDetails.selectedDays.length === 0)) {
          return res.status(400).json({ 
            error: { 
              message: 'Weekly subscriptions require at least one day to be selected', 
              status: 400 
            } 
          });
        }
      }

      // ── Holiday guard ──────────────────────────────────────────────────
      // Reject bookings on days declared as holidays by the super admin.
      const effectiveBookingDate = isSubscription
        ? (subscriptionDetails?.startDate || bookingDate)
        : bookingDate;
      if (effectiveBookingDate) {
        try {
          const bhConfig = await BusinessHours.getConfig();
          const bookingDateStr = typeof effectiveBookingDate === 'string'
            ? effectiveBookingDate.slice(0, 10)
            : new Date(effectiveBookingDate).toISOString().slice(0, 10);
          const holiday = bhConfig.holidays?.find(h => h.date === bookingDateStr);
          if (holiday) {
            return res.status(400).json({
              error: {
                message: `Bookings are not available on ${holiday.label || 'this holiday'} (${bookingDateStr}). Please choose a different date.`,
                status: 400,
                code: 'DATE_IS_HOLIDAY',
                holidayLabel: holiday.label || 'Holiday',
                holidayDate: bookingDateStr
              }
            });
          }
        } catch (bhErr) {
          console.error('Holiday check error (non-fatal):', bhErr.message);
          // Non-fatal — continue if BH config cannot be read
        }
      }
      // ───────────────────────────────────────────────────────────────────

      // ⚠️ IMPORTANT: Get customer location with fallback to saved addresses
      let customerLocation = location;
      let customerLng, customerLat;

      // Check if location coordinates are provided and valid
      const hasValidCoordinates = 
        location?.coordinates && 
        location.coordinates.length === 2 &&
        location.coordinates[0] !== null && 
        location.coordinates[0] !== undefined &&
        location.coordinates[1] !== null && 
        location.coordinates[1] !== undefined &&
        !isNaN(location.coordinates[0]) && 
        !isNaN(location.coordinates[1]) &&
        location.coordinates[0] >= -180 && 
        location.coordinates[0] <= 180 &&
        location.coordinates[1] >= -90 && 
        location.coordinates[1] <= 90;

      if (!hasValidCoordinates) {
        // Fallback: Try to use customer's saved location
        console.log('⚠️ Invalid or missing coordinates, fetching customer saved location...');
        const customer = await User.findById(req.user._id);
        
        if (!customer) {
          return res.status(400).json({ 
            error: { 
              message: 'Customer not found.', 
              status: 400,
              code: 'CUSTOMER_NOT_FOUND'
            } 
          });
        }

        // Try to use default address first
        const defaultAddress = customer.addresses?.find(addr => addr.isDefault);
        const fallbackAddress = defaultAddress || customer.addresses?.[0];
        
        if (fallbackAddress?.location?.coordinates?.length === 2) {
          customerLng = fallbackAddress.location.coordinates[0];
          customerLat = fallbackAddress.location.coordinates[1];
          customerLocation = {
            coordinates: [customerLng, customerLat],
            address: fallbackAddress.street || '',
            area: fallbackAddress.area || '',
            city: fallbackAddress.city || '',
            apartment: fallbackAddress.apartment || '',
            building: fallbackAddress.building || ''
          };
          console.log(`✅ Using customer's saved address: ${fallbackAddress.area}, ${fallbackAddress.city}`);
        } 
        // Try currentLocation as last resort
        else if (customer.currentLocation?.coordinates?.length === 2) {
          customerLng = customer.currentLocation.coordinates[0];
          customerLat = customer.currentLocation.coordinates[1];
          customerLocation = {
            coordinates: [customerLng, customerLat],
            address: location?.address || '',
            area: location?.area || '',
            city: location?.city || ''
          };
          console.log(`✅ Using customer's current location`);
        } 
        // No valid location found
        else {
          return res.status(400).json({ 
            error: { 
              message: 'No valid location found. Please add your address in your profile or select a location on the map.', 
              status: 400,
              code: 'NO_LOCATION_AVAILABLE'
            } 
          });
        }
      } else {
        customerLng = location.coordinates[0];
        customerLat = location.coordinates[1];
      }

      console.log(`🔍 Searching for service location near: [${customerLng}, ${customerLat}]`);
      const nearbyLocation = await Location.findOne({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [customerLng, customerLat]
            },
            $maxDistance: 5000 // 5km radius
          }
        },
        isActive: true,
        isServiceAvailable: true
      });

      if (!nearbyLocation) {
        return res.status(400).json({ 
          error: { 
            message: 'Service not available in your area. Please select a location within our service coverage.', 
            status: 400,
            code: 'SERVICE_NOT_AVAILABLE_IN_AREA',
            suggestion: 'Try selecting a different location or check available service areas.'
          } 
        });
      }

      // Check if the requested service is available at this location
      const serviceAvailableAtLocation = nearbyLocation.availableServices?.some(
        s => s.service.toString() === service && s.isActive
      ) || nearbyLocation.availableServices?.length === 0; // If no services specified, assume all available

      if (!serviceAvailableAtLocation && nearbyLocation.availableServices?.length > 0) {
        return res.status(400).json({ 
          error: { 
            message: 'This service is not available at your selected location.', 
            status: 400,
            code: 'SERVICE_NOT_AT_LOCATION'
          } 
        });
      }

      console.log(`✅ Booking location validated: ${nearbyLocation.apartmentName}, ${nearbyLocation.area}`);

      // If worker is provided, verify they exist and are available in this location
      if (worker) {
        const workerUser = await User.findById(worker);
        if (!workerUser || workerUser.role !== 'worker') {
          return res.status(400).json({ 
            error: { message: 'Invalid worker', status: 400 } 
          });
        }
        
        // IMPORTANT: Check if worker account is active
        if (!workerUser.isActive) {
          return res.status(400).json({ 
            error: { message: 'Cannot assign task to deactivated worker', status: 400 } 
          });
        }
        
        // Check if worker is available
        if (!workerUser.workerProfile?.availability) {
          return res.status(400).json({ 
            error: { message: 'Worker is currently unavailable', status: 400 } 
          });
        }

        // ✅ STRICT VERIFICATION: Worker must be assigned to the customer's location
        const workerInLocation = workerUser.workerProfile.assignedApartments?.some(apt => 
          apt.locationId.toString() === nearbyLocation._id.toString()
        );

        if (!workerInLocation) {
          return res.status(403).json({ 
            error: { 
              message: `This worker is not available in ${nearbyLocation.apartmentName}. Workers can only serve their assigned locations.`, 
              status: 403,
              code: 'WORKER_NOT_IN_LOCATION'
            } 
          });
        }

        console.log(`✅ Worker ${workerUser.name} verified for location ${nearbyLocation.apartmentName}`);
      }

      // Prepare booking data with validated location reference
      const bookingData = {
        customer: req.user._id,
        worker: worker || undefined,
        service,
        bookingDate: isSubscription ? subscriptionDetails.startDate : bookingDate,
        startTime: isSubscription ? subscriptionDetails.preferredTime : startTime,
        endTime: isSubscription ? subscriptionDetails.preferredTime : endTime,
        totalAmount,
        location: {
          ...customerLocation,
          coordinates: [customerLng, customerLat],
          locationId: nearbyLocation._id,
          apartmentName: nearbyLocation.apartmentName,
          area: nearbyLocation.area || customerLocation.area,
          city: nearbyLocation.city || customerLocation.city,
          state: nearbyLocation.state
        },
        notes,
        assignmentMethod: worker ? 'manual' : 'auto',
        bookingType: bookingType || 'oneTime',
        isRecurring: ['daily', 'weekly', 'monthly', 'recurring-short', 'monthly-subscription'].includes(bookingType),
        preferences: preferences || {},
        ...(serviceDetails && { serviceDetails })
      };

      // Add subscription details if it's a subscription booking
      if (isSubscription && subscriptionDetails) {
        bookingData.subscription = {
          isSubscription: true,
          subscriptionStartDate: new Date(subscriptionDetails.startDate),
          subscriptionEndDate: subscriptionDetails.endDate ? new Date(subscriptionDetails.endDate) : null,
          autoRenewal: subscriptionDetails.autoRenewal || false,
          allowPause: subscriptionDetails.allowPause || false,
          fixedWorker: worker, // Store the fixed worker for this subscription
          durationPerSession: subscriptionDetails.durationPerSession || 1,
          preferredTime: subscriptionDetails.preferredTime
        };
        
        // Add recurring schedule for subscription
        bookingData.recurringSchedule = {
          frequency: subscriptionDetails.frequency || bookingType,
          startDate: new Date(subscriptionDetails.startDate),
          endDate: subscriptionDetails.endDate ? new Date(subscriptionDetails.endDate) : null,
          nextScheduledDate: new Date(subscriptionDetails.startDate),
          selectedDays: subscriptionDetails.selectedDays || [],
          preferredTime: subscriptionDetails.preferredTime
        };
        
        // Auto-confirm subscription bookings since worker is pre-assigned
        bookingData.status = 'confirmed';
        bookingData.confirmedAt = new Date();
        bookingData.assignedAt = new Date();
      }

      // Add recurring schedule if it's a recurring booking (non-subscription)
      else if (bookingData.isRecurring) {
        bookingData.recurringSchedule = {
          frequency: bookingType,
          startDate: new Date(bookingDate),
          nextScheduledDate: new Date(bookingDate)
        };
      }

      const booking = new Booking(bookingData);

      await booking.save();

      // Always attempt auto-assignment unless explicitly disabled (autoAssign !== false)
      // This ensures workers are automatically assigned when available nearby
      // Uses advanced assignment system with primary + 2 backup workers
      let populatedBooking;
      const shouldAutoAssign = autoAssign !== false; // Default to true unless explicitly disabled
      
      if (!worker && shouldAutoAssign) {
        try {
          console.log('🚀 Using advanced worker assignment (primary + backups)...');
          
          // Use advanced assignment system for primary + 2 backup workers
          const assignmentResult = await assignWorkersWithBackup({
            customerId: req.user._id,
            service: bookingData.service,
            bookingDate: bookingData.bookingDate,
            startTime: bookingData.startTime,
            endTime: bookingData.endTime,
            location: bookingData.location,
            bookingType: bookingData.bookingType,
            preferences: bookingData.preferences
          });

          if (assignmentResult.success) {
            // Assign primary worker and backup workers
            booking.worker = assignmentResult.primaryWorker;
            booking.backupWorkers = assignmentResult.backupWorkers || [];
            booking.assignmentMethod = assignmentResult.assignmentMethod;
            booking.assignedAt = new Date();
            
            // Auto-confirm booking when worker is assigned
            if (booking.status === 'pending') {
              booking.status = 'confirmed';
              booking.confirmedAt = new Date();
            }
            
            await booking.save();

            // ── Race-condition guard ─────────────────────────────────────────
            // Two simultaneous bookings can both pick the same worker before
            // either is saved. Re-check for conflicts NOW that this booking is
            // in the DB, and unassign if another booking already owns this slot.
            const startOfDay = new Date(bookingData.bookingDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(bookingData.bookingDate);
            endOfDay.setHours(23, 59, 59, 999);
            const raceConflict = await Booking.findOne({
              worker: booking.worker,
              _id: { $ne: booking._id },
              bookingDate: { $gte: startOfDay, $lte: endOfDay },
              status: { $in: ['confirmed', 'in-progress', 'pending'] },
              startTime: { $lt: bookingData.endTime },
              endTime: { $gt: bookingData.startTime }
            }).lean();
            if (raceConflict) {
              console.warn(`⚠️ Race-condition double-booking detected for worker ${booking.worker}. Unassigning.`);
              booking.worker = undefined;
              booking.backupWorkers = [];
              booking.status = 'pending';
              booking.assignedAt = undefined;
              booking.confirmedAt = undefined;
              await booking.save();
            }
            // ────────────────────────────────────────────────────────────────

            console.log(`✅ Primary worker assigned via ${assignmentResult.assignmentMethod}`);
            console.log(`✅ ${assignmentResult.backupWorkers?.length ?? 0} backup workers assigned`);
            console.log(`⏱️ Assignment completed in ${assignmentResult.assignmentDetails.assignmentTime}ms`);
          } else {
            console.log(`⚠️ Advanced assignment failed: ${assignmentResult.error}`);
            
            // Fallback to preference-based assignment
            console.log('🔄 Falling back to preference-based assignment...');
            const fallbackResult = await findWorkerWithPreferences({
              customerId: req.user._id,
              bookingDate: bookingData.bookingDate,
              startTime: bookingData.startTime,
              endTime: bookingData.endTime,
              location: bookingData.location,
              radius: 5000, // 5km radius
              genderPreference: bookingData.preferences?.workerGenderPreference || 'any',
              religionPreference: bookingData.preferences?.religionPreference
            }, Booking);
            
            if (fallbackResult.success) {
              booking.worker = fallbackResult.worker._id;
              booking.assignmentMethod = fallbackResult.assignmentMethod;
              booking.assignedAt = new Date();
              
              if (booking.status === 'pending') {
                booking.status = 'confirmed';
                booking.confirmedAt = new Date();
              }
              
              await booking.save();
              console.log(`✅ Fallback worker assigned: ${fallbackResult.worker.name}`);
            } else {
              console.log(`⚠️ No worker assigned. Booking remains pending for manual assignment.`);
            }
          }
          
          populatedBooking = await Booking.findById(booking._id)
            .populate('customer', 'name email phone')
            .populate('worker', 'name email phone gender religion workerProfile')
            .populate('backupWorkers.worker', 'name email phone workerProfile')
            .populate('service', 'name description price duration');
        } catch (assignError) {
          console.error('Worker assignment error:', assignError);
          // Booking created but no worker assigned yet - will need manual assignment
          populatedBooking = await Booking.findById(booking._id)
            .populate('customer', 'name email phone')
            .populate('service', 'name description price duration');
        }
      } else {
        // Manual worker selection or auto-assign disabled
        if (worker) {
          booking.status = 'confirmed';
          booking.assignedAt = new Date();
          booking.confirmedAt = new Date();
          await booking.save();
        }
        
        populatedBooking = await Booking.findById(booking._id)
          .populate('customer', 'name email phone')
          .populate('worker', 'name email phone gender religion workerProfile')
          .populate('backupWorkers.worker', 'name email phone workerProfile')
          .populate('service', 'name description price duration');
      }

      res.status(201).json({ 
        message: 'Booking created successfully', 
        booking: populatedBooking 
      });
    } catch (error) {
      console.error('Create booking error:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        code: error.code
      });
      res.status(500).json({ error: { message: error.message || 'Server error', status: 500 } });
    }
  }
);

// @route   PUT /api/bookings/:id
// @desc    Update booking
// @access  Private
router.put('/:id', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ 
        error: { message: 'Booking not found', status: 404 } 
      });
    }

    // Check permissions
    const isAuthorized = 
      req.user.role === 'admin' ||
      booking.customer.toString() === req.user._id.toString() ||
      (booking.worker && booking.worker.toString() === req.user._id.toString());

    if (!isAuthorized) {
      return res.status(403).json({ 
        error: { message: 'Forbidden', status: 403 } 
      });
    }

    const { status, notes, rating, review, cancellationReason, actualEndTime } = req.body;

    if (status) booking.status = status;
    if (notes) booking.notes = notes;
    if (rating) booking.rating = rating;
    if (review) booking.review = review;
    if (cancellationReason) booking.cancellationReason = cancellationReason;
    if (actualEndTime) booking.actualEndTime = actualEndTime;

    // Calculate overtime charges when completing the booking
    if (status === 'completed' && booking.actualStartTime) {
      const endTime = actualEndTime ? new Date(actualEndTime) : new Date();
      booking.actualEndTime = endTime;

      // Calculate actual duration
      const actualDurationMs = endTime - new Date(booking.actualStartTime);
      const actualDurationMinutes = Math.floor(actualDurationMs / 60000);
      booking.actualDurationMinutes = actualDurationMinutes;

      // Calculate scheduled end time
      const scheduledEndDate = new Date(booking.bookingDate);
      const [endHours, endMinutes] = booking.endTime.split(':');
      scheduledEndDate.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);

      // Calculate overtime
      const overtimeMs = endTime - scheduledEndDate;
      if (overtimeMs > 0) {
        const overtimeMinutes = Math.ceil(overtimeMs / 60000);
        booking.overtimeMinutes = overtimeMinutes;
        
        // ₹2.5 per minute overtime charge
        const OVERTIME_RATE = 2.5;
        const overtimeCharges = overtimeMinutes * OVERTIME_RATE;
        booking.overtimeCharges = overtimeCharges;
        
        // Update total amount
        booking.totalAmount = (booking.totalAmount || 0) + overtimeCharges;
      }
    }

    await booking.save();

    // ✅ AUTO-CREATE WORKER EARNINGS when booking is completed
    if (status === 'completed' && booking.worker) {
      try {
        // Get worker ID (handle both populated and non-populated cases)
        const workerId = booking.worker._id || booking.worker;
        
        // Check if earnings already exist for this booking
        const existingEarnings = await WorkerEarnings.findOne({ booking: booking._id });
        
        if (!existingEarnings) {
          // Get platform settings
          const settings = await Settings.getSettings();
          const commissionRate = settings.earnings?.platformCommissionRate || 0;

          // Calculate earnings
          const baseAmount = booking.totalAmount - (booking.overtimeCharges || 0);
          const overtimeAmount = booking.overtimeCharges || 0;
          const totalEarning = baseAmount + overtimeAmount;
          
          // Calculate platform commission (only on base amount, not overtime)
          const platformCommission = baseAmount * commissionRate;
          
          // Worker gets: base + overtime - commission
          const netEarning = totalEarning - platformCommission;

          const earnings = new WorkerEarnings({
            worker: workerId,
            booking: booking._id,
            baseAmount: baseAmount,
            overtimeAmount: overtimeAmount,
            bonus: 0,
            incentive: 0,
            totalEarning: totalEarning,
            platformCommission: platformCommission,
            netEarning: netEarning,
            payoutStatus: 'pending',
            workDuration: booking.actualDurationMinutes || 0,
            date: new Date()
          });
          
          await earnings.save();
          console.log(`✅ Earnings auto-created: ₹${netEarning.toFixed(2)} (Booking ${booking._id})`);
        }
      } catch (earningsError) {
        // Log error but don't fail the booking update
        console.error('❌ Error creating worker earnings:', earningsError);
        console.error('Error details:', earningsError.message);
      }
    }

    // Update worker statistics if booking is completed with a rating
    if (status === 'completed' && booking.worker) {
      const onTime = checkIfOnTime(booking);
      await updateWorkerStats(booking.worker, {
        rating: rating || booking.rating,
        onTime,
        completed: true,
        bookingId: booking._id
      });
    }

    const updatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name email phone')
      .populate('worker', 'name email phone gender religion workerProfile')
      .populate('service', 'name description price duration');

    res.json({ message: 'Booking updated successfully', booking: updatedBooking });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   DELETE /api/bookings/:id
// @desc    Cancel booking with refund calculation (REQ-C-010)
// @access  Private
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('service', 'name');
    
    if (!booking) {
      return res.status(404).json({ 
        error: { message: 'Booking not found', status: 404 } 
      });
    }

    // Only customer or admin can cancel
    if (req.user.role !== 'admin' && booking.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        error: { message: 'Forbidden', status: 403 } 
      });
    }

    // Check if booking can be cancelled
    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ 
        error: { message: `Cannot cancel ${booking.status} booking`, status: 400 } 
      });
    }

    // Get cancellation policy from settings
    const settings = await Settings.findOne();
    const policy = settings?.cancellationPolicy || {
      fullRefundHours: 1,
      cancellationCharge: 100,
      partialRefundPercentage: 0
    };

    // Calculate time difference
    // booking.scheduledDate does not exist on the schema; derive from bookingDate + startTime
    const now = new Date();
    let scheduledTime;
    if (booking.scheduledDate) {
      scheduledTime = new Date(booking.scheduledDate);
    } else {
      const bookingDateObj = new Date(booking.bookingDate);
      const [startH, startM] = (booking.startTime || '00:00').split(':').map(Number);
      scheduledTime = new Date(bookingDateObj);
      scheduledTime.setHours(startH, startM, 0, 0);
    }
    const hoursUntilBooking = (scheduledTime - now) / (1000 * 60 * 60);

    // Calculate refund based on policy
    let refundAmount = 0;
    let refundPercentage = 0;
    let cancellationCharge = 0;
    let refundReason = '';

    const bookingAmount = booking.totalAmount || 0;

    if (hoursUntilBooking >= policy.fullRefundHours) {
      // FREE cancellation - Full refund
      refundAmount = bookingAmount;
      refundPercentage = 100;
      refundReason = `Free cancellation (${hoursUntilBooking.toFixed(1)} hours before booking)`;
    } else if (hoursUntilBooking > 0) {
      // Within 1-hour window - Apply cancellation charge
      cancellationCharge = policy.cancellationCharge || 100;
      refundAmount = Math.max(0, bookingAmount - cancellationCharge);
      refundPercentage = (refundAmount / bookingAmount) * 100;
      refundReason = `Cancellation within 1-hour window. ₹${cancellationCharge} charge applied.`;
    } else {
      // Booking has already started - No refund
      refundAmount = 0;
      refundPercentage = 0;
      refundReason = 'Booking has already started. No refund applicable.';
    }

    // Update booking
    booking.status = 'cancelled';
    booking.cancellationReason = req.body.reason || 'Cancelled by customer';
    booking.cancellationDate = now;
    booking.refund = {
      amount: refundAmount,
      percentage: refundPercentage,
      reason: refundReason,
      processedAt: refundAmount > 0 ? now : null,
      status: refundAmount > 0 ? 'processed' : 'not-applicable'
    };
    
    await booking.save();

    // Trigger queue — freed slot should be assigned to waiting pending bookings
    processQueuedBookings(booking.location?.locationId).catch(err =>
      console.error('Queue processing error after cancellation:', err.message)
    );

    // Send multi-channel notifications
    // Notify customer about cancellation
    await notificationService.sendTemplatedNotification(
      booking.customer._id,
      'BOOKING_CANCELLED',
      {
        bookingId: booking._id,
        serviceName: booking.service.name,
        refundAmount: refundAmount > 0 ? refundAmount : null,
        reason: booking.cancellationReason
      }
    );

    // Send refund notification if applicable
    if (refundAmount > 0) {
      await notificationService.sendTemplatedNotification(
        booking.customer._id,
        'REFUND_PROCESSED',
        {
          bookingId: booking._id,
          amount: refundAmount,
          refundReason
        }
      );
    }

    // Notify worker if assigned
    if (booking.worker) {
      await notificationService.sendNotification({
        userId: booking.worker,
        type: 'cancellation',
        title: '❌ Booking Cancelled',
        message: `Customer cancelled booking for ${booking.service.name}. ${refundReason}`,
        priority: 'medium',
        data: {
          bookingId: booking._id
        }
      });
    }

    res.json({ 
      message: 'Booking cancelled successfully', 
      booking,
      refund: {
        amount: refundAmount,
        percentage: refundPercentage,
        reason: refundReason,
        cancellationCharge: cancellationCharge
      }
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PUT /api/bookings/:id/reschedule
// @desc    Reschedule booking with auto worker reassignment (REQ-C-010)
// @access  Private
router.put('/:id/reschedule', authenticate, async (req, res) => {
  try {
    const { newDate, newTime } = req.body;
    
    console.log('📅 Reschedule request received:', {
      bookingId: req.params.id,
      newDate,
      newTime,
      userId: req.user._id,
      userRole: req.user.role
    });
    
    if (!newDate || !newTime) {
      return res.status(400).json({ 
        error: { message: 'New date and time are required', status: 400 } 
      });
    }

    const booking = await Booking.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('service', 'name')
      .populate('worker', 'name phone');
    
    if (!booking) {
      return res.status(404).json({ 
        error: { message: 'Booking not found', status: 404 } 
      });
    }

    // Only customer or admin can reschedule
    if (req.user.role !== 'admin' && booking.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        error: { message: 'Forbidden', status: 403 } 
      });
    }

    // Check if booking can be rescheduled
    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ 
        error: { message: `Cannot reschedule ${booking.status} booking`, status: 400 } 
      });
    }

    // Validate timing constraints
    const now = new Date();
    
    // Validate booking has required fields
    if (!booking.bookingDate || !booking.startTime) {
      return res.status(400).json({ 
        error: { message: 'Booking has invalid date/time data', status: 400 } 
      });
    }
    
    // Combine bookingDate and startTime to get current scheduled datetime for comparison
    const currentBookingDate = new Date(booking.bookingDate);
    const [startHour, startMinute] = booking.startTime.split(':').map(Number);
    currentBookingDate.setHours(startHour, startMinute, 0, 0);

    // Parse and validate new schedule date
    // Handle various date formats: YYYY-MM-DD, DD-MM-YYYY, etc.
    let parsedNewDate;
    
    // Try ISO format first (YYYY-MM-DD)
    if (newDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      parsedNewDate = newDate;
    } 
    // Handle DD-MM-YYYY format
    else if (newDate.match(/^\d{2}-\d{2}-\d{4}$/)) {
      const [day, month, year] = newDate.split('-');
      parsedNewDate = `${year}-${month}-${day}`;
    }
    // Handle MM/DD/YYYY format
    else if (newDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [month, day, year] = newDate.split('/');
      parsedNewDate = `${year}-${month}-${day}`;
    }
    else {
      console.error('Invalid date format received:', newDate);
      return res.status(400).json({ 
        error: { message: `Invalid date format: ${newDate}. Expected YYYY-MM-DD`, status: 400 } 
      });
    }

    const newScheduledDate = new Date(`${parsedNewDate}T${newTime}`);
    
    // Validate the date is valid
    if (isNaN(newScheduledDate.getTime())) {
      console.error('Failed to parse date:', { newDate, newTime, parsedNewDate });
      return res.status(400).json({ 
        error: { message: 'Invalid date or time provided', status: 400 } 
      });
    }
    
    console.log('Reschedule validation:', {
      originalDate: newDate,
      parsedDate: parsedNewDate,
      newTime,
      scheduledDate: newScheduledDate.toISOString(),
      now: now.toISOString()
    });
    
    // Check 1: New date/time cannot be in the past
    if (newScheduledDate <= now) {
      return res.status(400).json({ 
        error: { message: 'Cannot reschedule to past date/time', status: 400 } 
      });
    }

    // Check 2: New date/time must be at least 1 hour from now (worker prep/travel time)
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    if (newScheduledDate < oneHourFromNow) {
      return res.status(400).json({ 
        error: { 
          message: 'Please schedule at least 1 hour from now to allow worker preparation and travel time', 
          status: 400 
        } 
      });
    }

    // Check 3: Must change either date or time
    const oldDateStr = booking.bookingDate.toISOString().split('T')[0];
    if (parsedNewDate === oldDateStr && newTime === booking.startTime) {
      return res.status(400).json({ 
        error: { message: 'Please select a different date or time', status: 400 } 
      });
    }

    const oldDate = currentBookingDate;
    const oldWorker = booking.worker;
    
    // Update booking schedule - update bookingDate and startTime
    booking.bookingDate = new Date(parsedNewDate);
    booking.startTime = newTime;
    
    // Calculate and update endTime based on duration
    // Note: duration is in hours, estimatedDuration is in minutes
    let durationMinutes;
    if (booking.estimatedDuration) {
      durationMinutes = booking.estimatedDuration; // Already in minutes
    } else if (booking.duration) {
      durationMinutes = booking.duration * 60; // Convert hours to minutes
    } else {
      durationMinutes = 120; // Default 2 hours
    }
    
    const [newStartHour, newStartMinute] = newTime.split(':').map(Number);
    const totalMinutes = newStartHour * 60 + newStartMinute + durationMinutes;
    
    // Handle day wrap-around properly
    let endHour = Math.floor(totalMinutes / 60);
    const endMinute = totalMinutes % 60;
    
    // If endHour >= 24, we crossed midnight
    if (endHour >= 24) {
      endHour = endHour % 24;
      // Note: If booking crosses midnight, you may want to track this differently
      // For now, we'll just modulo the hours
    }
    
    booking.endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
    
    // Check if original worker is available at new time
    // checkWorkerAvailability expects duration in hours
    const durationHours = durationMinutes / 60;
    const workerAvailable = oldWorker ? await checkWorkerAvailability(oldWorker._id, newScheduledDate, durationHours) : false;
    
    let workerReassigned = false;
    let newWorkerInfo = null;

    if (!workerAvailable && oldWorker) {
      // Worker not available - need to reassign
      try {
        // Temporarily remove current worker
        booking.worker = null;
        await booking.save();
        
        // Assign new worker
        const updatedBooking = await assignWorkerToBooking(booking._id);
        
        if (updatedBooking.worker) {
          workerReassigned = true;
          newWorkerInfo = await User.findById(updatedBooking.worker).select('name phone');
          booking.worker = updatedBooking.worker;
        }
      } catch (assignError) {
        console.error('Worker reassignment failed:', assignError);
        // Continue with booking update even if reassignment fails
      }
    }

    await booking.save();

    // Format dates for display (used in notifications and response)
    const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
    const formatTime = (date) => new Date(date).toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Send notifications (wrapped in try-catch to prevent notification failures from breaking reschedule)
    try {
      // Notify customer about reschedule
      await notificationService.sendTemplatedNotification(
        booking.customer._id,
        'SCHEDULE_CHANGE',
        {
          bookingId: booking._id,
          serviceName: booking.service.name,
          newDate: formatDate(newScheduledDate),
          newTime: formatTime(newScheduledDate)
        }
      );

      // If worker was reassigned, send additional notifications
      if (workerReassigned && newWorkerInfo) {
        // Notify customer about worker reassignment
        await notificationService.sendTemplatedNotification(
          booking.customer._id,
          'WORKER_REASSIGNMENT',
          {
            bookingId: booking._id,
            newWorkerName: newWorkerInfo.name,
            reason: 'Original worker was not available at the new scheduled time.'
          }
        );

        // Notify old worker about booking removal
        if (oldWorker) {
          await notificationService.sendNotification({
            userId: oldWorker._id,
            type: 'schedule-change',
            title: '📅 Booking Rescheduled',
            message: `Customer rescheduled booking for ${booking.service.name}. Booking reassigned to another worker.`,
            priority: 'medium',
            data: { bookingId: booking._id }
          });
        }

        // Notify new worker about assignment
        await notificationService.sendTemplatedNotification(
          newWorkerInfo._id,
          'WORKER_ASSIGNED',
          {
            bookingId: booking._id,
            workerName: newWorkerInfo.name,
            serviceName: booking.service.name,
            date: formatDate(newScheduledDate),
            time: formatTime(newScheduledDate)
          }
        );
      } else if (oldWorker) {
        // Same worker, just notify about time change
        await notificationService.sendNotification({
          userId: oldWorker._id,
          type: 'schedule-change',
          title: '📅 Booking Rescheduled',
          message: `Customer rescheduled booking for ${booking.service.name} to ${formatDate(newScheduledDate)} at ${formatTime(newScheduledDate)}.`,
          priority: 'medium',
          data: { 
            bookingId: booking._id,
            newDate: formatDate(newScheduledDate),
            newTime: formatTime(newScheduledDate)
          }
        });
      }
    } catch (notificationError) {
      console.error('Notification error during reschedule:', notificationError);
      // Don't fail the reschedule if notifications fail
    }

    console.log('✅ Booking rescheduled successfully:', {
      bookingId: booking._id,
      oldDate: oldDate.toISOString(),
      newDate: newScheduledDate.toISOString(),
      workerReassigned
    });

    res.json({ 
      message: 'Booking rescheduled successfully', 
      booking,
      rescheduleInfo: {
        oldDate: formatDate(oldDate),
        oldTime: formatTime(oldDate),
        newDate: formatDate(newScheduledDate),
        newTime: formatTime(newScheduledDate),
        workerReassigned,
        newWorker: workerReassigned ? {
          name: newWorkerInfo.name,
          phone: newWorkerInfo.phone
        } : null
      }
    });
  } catch (error) {
    console.error('Reschedule booking error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      bookingId: req.params.id,
      newDate: req.body.newDate,
      newTime: req.body.newTime,
      errorMessage: error.message
    });
    res.status(500).json({ 
      error: { 
        message: `Failed to reschedule: ${error.message}`, 
        status: 500 
      } 
    });
  }
});

// Helper function to check worker availability
async function checkWorkerAvailability(workerId, scheduledDate, duration) {
  try {
    // Check if worker exists and is available
    const worker = await User.findById(workerId);
    if (!worker || !worker.workerDetails?.isAvailable) {
      return false;
    }

    // Check for conflicting bookings
    const startTime = new Date(scheduledDate);
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);
    
    // Get all bookings for this worker in the relevant time period
    const existingBookings = await Booking.find({
      worker: workerId,
      status: { $in: ['pending', 'confirmed', 'in-progress'] }
    });

    // Check if any existing booking conflicts with the new time slot
    for (const existingBooking of existingBookings) {
      // Parse existing booking's start and end times
      const existingDate = new Date(existingBooking.bookingDate);
      const [existingStartHour, existingStartMinute] = existingBooking.startTime.split(':').map(Number);
      existingDate.setHours(existingStartHour, existingStartMinute, 0, 0);
      
      const existingEndDate = new Date(existingDate);
      // Handle both duration (hours) and estimatedDuration (minutes)
      if (existingBooking.estimatedDuration) {
        existingEndDate.setTime(existingEndDate.getTime() + existingBooking.estimatedDuration * 60 * 1000);
      } else if (existingBooking.duration) {
        existingEndDate.setTime(existingEndDate.getTime() + existingBooking.duration * 60 * 60 * 1000);
      }
      
      // Check for overlap: new booking overlaps if it starts before existing ends AND ends after existing starts
      if (startTime < existingEndDate && endTime > existingDate) {
        return false; // Conflict found
      }
    }

    return true; // No conflicts
  } catch (error) {
    console.error('Check worker availability error:', error);
    return false;
  }
}

// @route   POST /api/bookings/:id/assign-worker
// @desc    Auto-assign best worker to booking
// @access  Private/Admin
router.post('/:id/assign-worker', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ 
        error: { message: 'Booking not found', status: 404 } 
      });
    }

    if (booking.worker) {
      return res.status(400).json({ 
        error: { message: 'Worker already assigned. Use reassign if needed.', status: 400 } 
      });
    }

    const assignedBooking = await assignWorkerToBooking(req.params.id);

    res.json({ 
      message: 'Worker assigned successfully', 
      booking: assignedBooking 
    });

  } catch (error) {
    console.error('Assign worker error:', error);
    res.status(500).json({ error: { message: error.message || 'Server error', status: 500 } });
  }
});

// @route   POST /api/bookings/:id/reassign-worker
// @desc    Reassign worker (use backup or find new)
// @access  Private/Admin
router.post('/:id/reassign-worker', 
  authenticate, 
  authorize('admin', 'super_admin'),
  [body('reason').notEmpty().withMessage('Reason for reassignment is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { reason } = req.body;

      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      const reassignedBooking = await reassignWorker(req.params.id, reason);

      res.json({ 
        message: 'Worker reassigned successfully', 
        booking: reassignedBooking 
      });

    } catch (error) {
      console.error('Reassign worker error:', error);
      res.status(500).json({ error: { message: error.message || 'Server error', status: 500 } });
    }
  }
);

// ==================== SERVICE QR CODE WORKFLOW ====================

// @route   POST /api/bookings/:id/generate-start-qr
// @desc    Worker generates QR code for service start
// @access  Private/Worker
router.post('/:id/generate-start-qr', 
  authenticate, 
  authorize('worker', 'admin'),
  [
    body('jobDescriptionAcknowledged').isBoolean().withMessage('Job description acknowledgment is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      // Verify worker is assigned to this booking
      if (!booking.worker || (booking.worker.toString() !== req.user._id.toString() && req.user.role !== 'admin')) {
        return res.status(403).json({ 
          error: { message: 'You are not assigned to this booking', status: 403 } 
        });
      }

      // Check booking status
      if (booking.status !== 'confirmed') {
        return res.status(400).json({ 
          error: { message: 'Booking must be confirmed to generate start QR', status: 400 } 
        });
      }

      // Check if already started
      if (booking.actualStartTime) {
        return res.status(400).json({ 
          error: { message: 'Service already started', status: 400 } 
        });
      }

      const { jobDescriptionAcknowledged } = req.body;

      // Generate unique QR code for service start (includes worker ID for validation)
      const workerId = booking.worker.toString();
      const startQRCode = `START-${booking._id}-${workerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      booking.serviceStartQRCode = startQRCode;
      booking.jobDescriptionAcknowledged = jobDescriptionAcknowledged;
      booking.jobDescriptionAcknowledgedAt = new Date();
      
      await booking.save();

      res.json({ 
        message: 'Service start QR code generated successfully',
        qrCode: startQRCode,
        bookingId: booking._id,
        service: booking.service
      });

    } catch (error) {
      console.error('Generate start QR error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/bookings/:id/scan-start-qr
// @desc    Customer scans QR code to start service with terms acceptance
// @access  Private/Customer
router.post('/:id/scan-start-qr',
  authenticate,
  authorize('customer', 'admin'),
  [
    body('qrCode').notEmpty().withMessage('QR code is required'),
    body('termsAccepted').isBoolean().withMessage('Terms acceptance is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { qrCode, termsAccepted } = req.body;

      const booking = await Booking.findById(req.params.id)
        .populate('service', 'name description price duration')
        .populate('worker', 'name email phone gender religion workerProfile');
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      // Verify customer owns this booking
      if (booking.customer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: { message: 'Forbidden', status: 403 } 
        });
      }

      // Verify QR code matches
      if (booking.serviceStartQRCode !== qrCode) {
        return res.status(400).json({ 
          error: { message: 'Invalid QR code', status: 400 } 
        });
      }

      // Additional validation: Extract and verify worker ID from QR code
      const qrParts = qrCode.split('-');
      if (qrParts.length >= 3) {
        const qrWorkerId = qrParts[2]; // Worker ID is the 3rd part
        const assignedWorkerId = booking.worker._id ? booking.worker._id.toString() : booking.worker.toString();
        
        if (qrWorkerId !== assignedWorkerId) {
          console.error('⚠️ QR code worker mismatch:', { qrWorkerId, assignedWorkerId });
          return res.status(403).json({ 
            error: { message: 'This QR code belongs to a different worker', status: 403 } 
          });
        }
      }

      // Check if already started
      if (booking.actualStartTime) {
        return res.status(400).json({ 
          error: { message: 'Service already started', status: 400 } 
        });
      }

      // Verify terms are accepted
      if (!termsAccepted) {
        return res.status(400).json({ 
          error: { message: 'Terms and conditions must be accepted', status: 400 } 
        });
      }

      // Start the service
      const now = new Date();
      
      // Log for debugging timezone issues
      console.log('🕐 Service Starting:', {
        bookingId: booking._id,
        serverTime: now.toISOString(),
        serverTimeLocal: now.toString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      
      booking.actualStartTime = now;
      booking.termsAccepted = termsAccepted;
      booking.termsAcceptedAt = now;
      booking.status = 'in-progress';
      
      await booking.save();

      res.json({ 
        message: 'Service started successfully',
        booking: {
          _id: booking._id,
          status: booking.status,
          actualStartTime: booking.actualStartTime,
          service: booking.service,
          worker: booking.worker
        },
        startTime: now
      });

    } catch (error) {
      console.error('Scan start QR error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/bookings/:id/generate-end-qr
// @desc    Worker generates QR code for service end
// @access  Private/Worker
router.post('/:id/generate-end-qr', 
  authenticate, 
  authorize('worker', 'admin'),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      // Verify worker is assigned to this booking
      if (!booking.worker || (booking.worker.toString() !== req.user._id.toString() && req.user.role !== 'admin')) {
        return res.status(403).json({ 
          error: { message: 'You are not assigned to this booking', status: 403 } 
        });
      }

      // Check if service has started
      if (!booking.actualStartTime) {
        return res.status(400).json({ 
          error: { message: 'Service must be started first', status: 400 } 
        });
      }

      // Check if already ended
      if (booking.actualEndTime) {
        return res.status(400).json({ 
          error: { message: 'Service already ended', status: 400 } 
        });
      }

      // Generate unique QR code for service end (includes worker ID for validation)
      const workerId = booking.worker.toString();
      const endQRCode = `END-${booking._id}-${workerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      booking.serviceEndQRCode = endQRCode;
      await booking.save();

      res.json({ 
        message: 'Service end QR code generated successfully',
        qrCode: endQRCode,
        bookingId: booking._id,
        startTime: booking.actualStartTime
      });

    } catch (error) {
      console.error('Generate end QR error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/bookings/:id/scan-end-qr
// @route   POST /api/bookings/:id/upload-completion-photo
// @desc    Worker uploads completion photo to prove work is done
// @access  Private/Worker
router.post('/:id/upload-completion-photo',
  authenticate,
  authorize('worker', 'admin'),
  (req, res, next) => {
    upload.single('completionPhoto')(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      next();
    });
  },
  async (req, res) => {
    try {
      console.log('📸 Completion photo upload request:', {
        bookingId: req.params.id,
        userId: req.user._id,
        userRole: req.user.role,
        hasFile: !!req.file,
        fileName: req.file?.filename
      });
      
      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        console.error('❌ Booking not found:', req.params.id);
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      console.log('📋 Booking details:', {
        status: booking.status,
        workerId: booking.worker,
        requestUserId: req.user._id
      });

      // Verify worker is assigned to this booking
      if (!booking.worker || (booking.worker.toString() !== req.user._id.toString() && req.user.role !== 'admin')) {
        console.error('❌ Worker not assigned to booking');
        return res.status(403).json({ 
          error: { message: 'You are not assigned to this booking', status: 403 } 
        });
      }

      // Check if service is in progress or completed
      if (booking.status !== 'in-progress' && booking.status !== 'completed') {
        console.error('❌ Invalid booking status:', booking.status);
        return res.status(400).json({ 
          error: { message: `Service must be in progress or completed to upload completion photo. Current status: ${booking.status}`, status: 400 } 
        });
      }

      // Validate file was uploaded
      if (!req.file) {
        console.error('❌ No file uploaded');
        return res.status(400).json({ 
          error: { message: 'Completion photo is required', status: 400 } 
        });
      }

      // Save completion photo
      const photoUrl = `/uploads/completion-photos/${req.file.filename}`;
      const isReupload = booking.completionPhoto && booking.completionPhoto.url;
      
      booking.completionPhoto = {
        url: photoUrl,
        timestamp: new Date(),
        uploadedBy: req.user._id,
        verified: true
      };

      await booking.save();

      console.log(`✅ Worker ${isReupload ? 're-uploaded' : 'uploaded'} completion photo:`, photoUrl);

      res.json({ 
        message: 'Completion photo uploaded successfully',
        completionPhoto: booking.completionPhoto
      });

    } catch (error) {
      console.error('❌ Upload completion photo error:', error);
      
      // Handle multer errors
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          error: { message: 'File size too large. Maximum 5MB allowed.', status: 400 } 
        });
      }
      
      if (error.message && error.message.includes('Only image files')) {
        return res.status(400).json({ 
          error: { message: error.message, status: 400 } 
        });
      }
      
      res.status(500).json({ 
        error: { message: error.message || 'Server error', status: 500 } 
      });
    }
  }
);

// @route   POST /api/bookings/:id/upload-payment-proof
// @desc    Worker uploads payment proof photo from customer
// @access  Private/Worker
router.post('/:id/upload-payment-proof',
  authenticate,
  authorize('worker', 'admin'),
  (req, res, next) => {
    upload.single('paymentProof')(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      // Verify worker is assigned to this booking
      if (!booking.worker || (booking.worker.toString() !== req.user._id.toString() && req.user.role !== 'admin')) {
        return res.status(403).json({ 
          error: { message: 'You are not assigned to this booking', status: 403 } 
        });
      }

      // Check if service is completed
      if (booking.status !== 'completed') {
        return res.status(400).json({ 
          error: { message: 'Service must be completed to upload payment proof', status: 400 } 
        });
      }

      // Validate file was uploaded
      if (!req.file) {
        return res.status(400).json({ 
          error: { message: 'Payment proof photo is required', status: 400 } 
        });
      }

      // Save payment proof photo
      const photoUrl = `/uploads/completion-photos/${req.file.filename}`;
      const isReupload = booking.paymentProof && booking.paymentProof.url;

      const { transactionId, transactionTime } = req.body;

      booking.paymentProof = {
        url: photoUrl,
        timestamp: new Date(),
        uploadedBy: req.user._id,
        verified: true,
        transactionId: transactionId ? transactionId.trim() : null,
        transactionTime: transactionTime ? new Date(transactionTime) : new Date()
      };

      await booking.save();

      console.log(`✅ Worker ${isReupload ? 're-uploaded' : 'uploaded'} payment proof:`, photoUrl, transactionId ? `| TxnID: ${transactionId}` : '');

      res.json({ 
        message: 'Payment proof uploaded successfully',
        paymentProof: booking.paymentProof
      });

    } catch (error) {
      console.error('Upload payment proof error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @desc    Customer scans QR code to end service
// @access  Private/Customer
router.post('/:id/scan-end-qr',
  authenticate,
  authorize('customer', 'admin'),
  [
    body('qrCode').notEmpty().withMessage('QR code is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { qrCode } = req.body;

      const booking = await Booking.findById(req.params.id)
        .populate('service', 'name description price duration')
        .populate('worker', 'name email phone gender religion workerProfile');
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      // Verify customer owns this booking
      if (booking.customer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: { message: 'Forbidden', status: 403 } 
        });
      }

      // Verify QR code matches OR allow auto-generated end QR from customer
      const isAutoGenerated = qrCode.includes('-AUTO');
      
      if (!isAutoGenerated && booking.serviceEndQRCode !== qrCode) {
        return res.status(400).json({ 
          error: { message: 'Invalid QR code', status: 400 } 
        });
      }
      
      // If auto-generated and no end QR exists yet, set it
      if (isAutoGenerated && !booking.serviceEndQRCode) {
        booking.serviceEndQRCode = qrCode;
      }

      // Additional validation for non-auto QR: Extract and verify worker ID
      if (!isAutoGenerated) {
        const qrParts = qrCode.split('-');
        if (qrParts.length >= 3) {
          const qrWorkerId = qrParts[2]; // Worker ID is the 3rd part
          const assignedWorkerId = booking.worker._id ? booking.worker._id.toString() : booking.worker.toString();
          
          if (qrWorkerId !== assignedWorkerId) {
            console.error('⚠️ End QR code worker mismatch:', { qrWorkerId, assignedWorkerId });
            return res.status(403).json({ 
              error: { message: 'This QR code belongs to a different worker', status: 403 } 
            });
          }
        }
      }

      // Check if service has started
      if (!booking.actualStartTime) {
        return res.status(400).json({ 
          error: { message: 'Service must be started first', status: 400 } 
        });
      }

      // Check if already ended
      if (booking.actualEndTime) {
        return res.status(400).json({ 
          error: { message: 'Service already ended', status: 400 } 
        });
      }

      // Check if worker uploaded completion photo (recommended but not mandatory)
      if (!booking.completionPhoto || !booking.completionPhoto.url) {
        console.log('⚠️ Warning: Service ending without completion photo');
      }

      // End the service and calculate duration
      const now = new Date();
      booking.actualEndTime = now;
      
      // Calculate actual duration in minutes
      const durationMs = now - booking.actualStartTime;
      const actualDurationMinutes = Math.floor(durationMs / (1000 * 60));
      booking.actualDurationMinutes = actualDurationMinutes;

      // Calculate scheduled duration from startTime and endTime
      // Assuming startTime and endTime are in HH:MM format
      const [startHour, startMin] = booking.startTime.split(':').map(Number);
      const [endHour, endMin] = booking.endTime.split(':').map(Number);
      const scheduledDurationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      booking.scheduledDurationMinutes = scheduledDurationMinutes;

      // Calculate overtime if applicable
      if (actualDurationMinutes > scheduledDurationMinutes) {
        booking.overtimeMinutes = actualDurationMinutes - scheduledDurationMinutes;
        
        // Calculate overtime charges at ₹2.5 per minute
        booking.overtimeCharges = booking.overtimeMinutes * 2.5;
        
        // Update total amount to include overtime
        booking.totalAmount += booking.overtimeCharges;
      } else {
        booking.overtimeMinutes = 0;
        booking.overtimeCharges = 0;
      }

      booking.status = 'completed';
      await booking.save();

      // Trigger queue — this worker's slot is now free; assign to next pending booking
      processQueuedBookings(booking.location?.locationId).catch(err =>
        console.error('Queue processing error after completion:', err.message)
      );

      // ✅ AUTO-CREATE WORKER EARNINGS
      if (booking.worker) {
        try {
          // Get worker ID (handle both populated and non-populated cases)
          const workerId = booking.worker._id || booking.worker;
          
          // Get platform settings
          const settings = await Settings.getSettings();
          const commissionRate = settings.earnings?.platformCommissionRate || 0;
          const convenienceFee = settings.earnings?.bookingConvenienceFee || 0;

          // Calculate earnings
          const baseAmount = booking.totalAmount - (booking.overtimeCharges || 0);
          const overtimeAmount = booking.overtimeCharges || 0;
          const totalEarning = baseAmount + overtimeAmount;
          
          // Calculate platform commission (only on base amount, not overtime)
          const platformCommission = baseAmount * commissionRate;
          
          // Worker gets: base + overtime - commission
          const netEarning = totalEarning - platformCommission;

          // Check if earnings already exist for this booking
          const existingEarnings = await WorkerEarnings.findOne({ booking: booking._id });
          
          if (!existingEarnings) {
            const earnings = new WorkerEarnings({
              worker: workerId,
              booking: booking._id,
              baseAmount: baseAmount,
              overtimeAmount: overtimeAmount,
              bonus: 0,
              incentive: 0,
              totalEarning: totalEarning,
              platformCommission: platformCommission,
              netEarning: netEarning,
              payoutStatus: 'pending',
              workDuration: booking.actualDurationMinutes || 0,
              date: new Date()
            });
            
            await earnings.save();
            const workerName = booking.worker.name || 'Worker';
            console.log(`✅ Earnings created for ${workerName}: ₹${netEarning.toFixed(2)} (Commission: ₹${platformCommission.toFixed(2)})`);
          }
        } catch (earningsError) {
          // Log error but don't fail the booking completion
          console.error('❌ Error creating worker earnings:', earningsError);
          console.error('Error details:', earningsError.message);
        }
      }

      res.json({ 
        message: 'Service completed successfully',
        booking: {
          _id: booking._id,
          status: booking.status,
          actualStartTime: booking.actualStartTime,
          actualEndTime: booking.actualEndTime,
          actualDurationMinutes: booking.actualDurationMinutes,
          scheduledDurationMinutes: booking.scheduledDurationMinutes,
          overtimeMinutes: booking.overtimeMinutes,
          overtimeCharges: booking.overtimeCharges,
          totalAmount: booking.totalAmount,
          completionPhoto: booking.completionPhoto,
          service: booking.service,
          worker: booking.worker
        }
      });

    } catch (error) {
      console.error('Scan end QR error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// ==================== WORK DOCUMENTATION (REQ-C-012) ====================

// @route   POST /api/bookings/:id/upload-photo
// @desc    Upload work documentation photo
// @access  Private/Worker
router.post('/:id/upload-photo',
  authenticate,
  authorize('worker', 'admin'),
  [
    body('photoUrl').notEmpty().withMessage('Photo URL is required'),
    body('type').isIn(['before', 'during', 'after']).withMessage('Photo type must be before, during, or after'),
    body('notes').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { photoUrl, type, notes } = req.body;

      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      // Verify worker is assigned to this booking
      if (!booking.worker || (booking.worker.toString() !== req.user._id.toString() && req.user.role !== 'admin')) {
        return res.status(403).json({ 
          error: { message: 'You are not assigned to this booking', status: 403 } 
        });
      }

      // Check photo limit (max 10 photos)
      if (!booking.workDocumentation) {
        booking.workDocumentation = { photos: [], additionalNotes: '' };
      }

      if (booking.workDocumentation.photos.length >= 10) {
        return res.status(400).json({ 
          error: { message: 'Maximum 10 photos allowed per booking', status: 400 } 
        });
      }

      // Add photo to work documentation
      const photo = {
        url: photoUrl,
        type: type,
        timestamp: new Date(),
        notes: notes || '',
        uploadedBy: req.user._id
      };

      booking.workDocumentation.photos.push(photo);
      await booking.save();

      res.json({ 
        message: 'Photo uploaded successfully',
        photo: photo,
        totalPhotos: booking.workDocumentation.photos.length
      });

    } catch (error) {
      console.error('Upload photo error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/bookings/:id/work-documentation
// @desc    Get work documentation for a booking
// @access  Private
router.get('/:id/work-documentation', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('workDocumentation.photos.uploadedBy', 'name email')
      .populate('service', 'name')
      .populate('worker', 'name email gender religion workerProfile');
    
    if (!booking) {
      return res.status(404).json({ 
        error: { message: 'Booking not found', status: 404 } 
      });
    }

    // Check access permissions
    const isAuthorized = 
      req.user.role === 'admin' ||
      booking.customer.toString() === req.user._id.toString() ||
      booking.worker.toString() === req.user._id.toString();

    if (!isAuthorized) {
      return res.status(403).json({ 
        error: { message: 'Forbidden', status: 403 } 
      });
    }

    res.json({ 
      bookingId: booking._id,
      service: booking.service,
      worker: booking.worker,
      workDocumentation: booking.workDocumentation || { photos: [], additionalNotes: '' }
    });

  } catch (error) {
    console.error('Get work documentation error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PUT /api/bookings/:id/work-documentation/notes
// @desc    Update additional notes for work documentation
// @access  Private/Worker
router.put('/:id/work-documentation/notes',
  authenticate,
  authorize('worker', 'admin'),
  [
    body('notes').notEmpty().withMessage('Notes are required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { notes } = req.body;

      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      // Verify worker is assigned to this booking
      if (!booking.worker || (booking.worker.toString() !== req.user._id.toString() && req.user.role !== 'admin')) {
        return res.status(403).json({ 
          error: { message: 'You are not assigned to this booking', status: 403 } 
        });
      }

      // Initialize work documentation if it doesn't exist
      if (!booking.workDocumentation) {
        booking.workDocumentation = { photos: [], additionalNotes: '' };
      }

      booking.workDocumentation.additionalNotes = notes;
      await booking.save();

      res.json({ 
        message: 'Notes updated successfully',
        notes: booking.workDocumentation.additionalNotes
      });

    } catch (error) {
      console.error('Update notes error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   DELETE /api/bookings/:id/work-documentation/photos/:photoId
// @desc    Delete a work documentation photo
// @access  Private/Worker/Admin
router.delete('/:id/work-documentation/photos/:photoId',
  authenticate,
  authorize('worker', 'admin'),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      // Verify worker is assigned to this booking
      if (!booking.worker || (booking.worker.toString() !== req.user._id.toString() && req.user.role !== 'admin')) {
        return res.status(403).json({ 
          error: { message: 'You are not assigned to this booking', status: 403 } 
        });
      }

      if (!booking.workDocumentation || !booking.workDocumentation.photos) {
        return res.status(404).json({ 
          error: { message: 'No work documentation found', status: 404 } 
        });
      }

      // Find and remove the photo
      const photoIndex = booking.workDocumentation.photos.findIndex(
        photo => photo._id.toString() === req.params.photoId
      );

      if (photoIndex === -1) {
        return res.status(404).json({ 
          error: { message: 'Photo not found', status: 404 } 
        });
      }

      booking.workDocumentation.photos.splice(photoIndex, 1);
      await booking.save();

      res.json({ 
        message: 'Photo deleted successfully',
        totalPhotos: booking.workDocumentation.photos.length
      });

    } catch (error) {
      console.error('Delete photo error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// ==================== ADVANCED WORKER ASSIGNMENT ROUTES ====================

// @route   POST /api/bookings/:id/activate-backup
// @desc    Activate backup worker for a booking
// @access  Private/Admin/Worker
router.post('/:id/activate-backup',
  authenticate,
  authorize('admin', 'worker'),
  [
    body('reason').notEmpty().withMessage('Reason is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { reason } = req.body;

      const booking = await Booking.findById(req.params.id)
        .populate('worker', 'name email phone')
        .populate('backupWorkers.worker', 'name email phone workerProfile');

      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      // Check if backup activation is needed
      const checkResult = await checkBackupActivationNeeded(booking);
      
      console.log(`🔍 Backup activation check:`, checkResult);

      // Activate backup worker
      const activationResult = await activateBackupWorker(booking, reason);

      if (!activationResult.success) {
        return res.status(400).json({ 
          error: { 
            message: activationResult.error || 'Backup activation failed', 
            status: 400 
          } 
        });
      }

      // Get updated booking
      const updatedBooking = await Booking.findById(req.params.id)
        .populate('customer', 'name email phone')
        .populate('worker', 'name email phone workerProfile')
        .populate('backupWorkers.worker', 'name email phone workerProfile')
        .populate('service', 'name description price duration');

      res.json({ 
        message: 'Backup worker activated successfully',
        booking: updatedBooking,
        activation: activationResult
      });

    } catch (error) {
      console.error('Backup activation error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/bookings/:id/check-backup
// @desc    Check if backup activation is needed for a booking
// @access  Private
router.get('/:id/check-backup',
  authenticate,
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id)
        .populate('worker', 'name email phone workerProfile');

      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      const checkResult = await checkBackupActivationNeeded(booking);

      res.json({ 
        bookingId: booking._id,
        needsActivation: checkResult.needsActivation,
        reasons: checkResult.reasons,
        backupWorkersAvailable: booking.backupWorkers?.length || 0
      });

    } catch (error) {
      console.error('Check backup error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/bookings/worker-pool/capacity
// @desc    Get real-time worker pool capacity status
// @access  Private/Admin
router.get('/worker-pool/capacity',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const capacityStatus = await getWorkerCapacityStatus();

      res.json({ 
        message: 'Worker pool capacity status',
        ...capacityStatus
      });

    } catch (error) {
      console.error('Get capacity status error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/bookings/worker-pool/monitor
// @desc    Monitor worker pool and get alerts
// @access  Private/Admin
router.get('/worker-pool/monitor',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const monitoringResult = await monitorWorkerPool();

      res.json({ 
        message: 'Worker pool monitoring result',
        ...monitoringResult
      });

    } catch (error) {
      console.error('Monitor worker pool error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/bookings/worker-pool/forecast
// @desc    Get worker availability forecast for a specific date
// @access  Private/Admin
router.get('/worker-pool/forecast',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const { date } = req.query;

      if (!date) {
        return res.status(400).json({ 
          error: { message: 'Date parameter is required', status: 400 } 
        });
      }

      const forecastDate = new Date(date);
      if (isNaN(forecastDate.getTime())) {
        return res.status(400).json({ 
          error: { message: 'Invalid date format', status: 400 } 
        });
      }

      const forecast = await getWorkerAvailabilityForecast(forecastDate);

      res.json({ 
        message: 'Worker availability forecast',
        ...forecast
      });

    } catch (error) {
      console.error('Get forecast error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// ==================== SUBSCRIPTION MANAGEMENT ROUTES ====================

// @route   POST /api/bookings/:id/change-subscription-worker
// @desc    Change the assigned worker for a subscription
// @access  Private/Customer
router.post('/:id/change-subscription-worker',
  authenticate,
  authorize('customer', 'admin'),
  async (req, res) => {
    try {
      const { workerId } = req.body;
      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Subscription not found', status: 404 } 
        });
      }

      // Verify this is a subscription booking
      if (!booking.subscription?.isSubscription) {
        return res.status(400).json({ 
          error: { message: 'This is not a subscription booking', status: 400 } 
        });
      }

      // Verify customer owns this subscription
      if (booking.customer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: { message: 'Not authorized to modify this subscription', status: 403 } 
        });
      }

      // Verify new worker exists and is available
      const newWorker = await User.findById(workerId);
      if (!newWorker || newWorker.role !== 'worker') {
        return res.status(400).json({ 
          error: { message: 'Invalid worker', status: 400 } 
        });
      }

      if (!newWorker.isActive || !newWorker.workerProfile?.availability) {
        return res.status(400).json({ 
          error: { message: 'Worker is not available', status: 400 } 
        });
      }

      // Update the subscription's fixed worker
      booking.worker = workerId;
      booking.subscription.fixedWorker = workerId;
      booking.assignmentMethod = 'manual';
      booking.assignedAt = new Date();
      
      await booking.save();

      // TODO: Update all future bookings for this subscription with the new worker
      // This would require implementing a parent-child booking relationship
      // For now, just update the main subscription booking

      await booking.populate('worker', 'name email phone workerProfile');

      res.json({ 
        message: 'Worker changed successfully',
        booking,
        newWorker: {
          _id: booking.worker._id,
          name: booking.worker.name,
          email: booking.worker.email,
          phone: booking.worker.phone,
          workerProfile: booking.worker.workerProfile
        }
      });

    } catch (error) {
      console.error('Change worker error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/bookings/:id/pause-subscription
// @desc    Pause a subscription
// @access  Private/Customer
router.post('/:id/pause-subscription',
  authenticate,
  authorize('customer', 'admin'),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Subscription not found', status: 404 } 
        });
      }

      // Verify this is a subscription booking
      if (!booking.subscription?.isSubscription) {
        return res.status(400).json({ 
          error: { message: 'This is not a subscription booking', status: 400 } 
        });
      }

      // Verify customer owns this subscription
      if (booking.customer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: { message: 'Not authorized to modify this subscription', status: 403 } 
        });
      }

      // Check if pause is allowed
      if (!booking.subscription.allowPause) {
        return res.status(400).json({ 
          error: { message: 'This subscription does not allow pausing', status: 400 } 
        });
      }

      // Check if already paused
      if (booking.subscription.isPaused) {
        return res.status(400).json({ 
          error: { message: 'Subscription is already paused', status: 400 } 
        });
      }

      // Pause the subscription
      booking.subscription.isPaused = true;
      booking.subscription.pausedAt = new Date();
      
      await booking.save();

      res.json({ 
        message: 'Subscription paused successfully',
        booking
      });

    } catch (error) {
      console.error('Pause subscription error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/bookings/:id/resume-subscription
// @desc    Resume a paused subscription
// @access  Private/Customer
router.post('/:id/resume-subscription',
  authenticate,
  authorize('customer', 'admin'),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Subscription not found', status: 404 } 
        });
      }

      // Verify this is a subscription booking
      if (!booking.subscription?.isSubscription) {
        return res.status(400).json({ 
          error: { message: 'This is not a subscription booking', status: 400 } 
        });
      }

      // Verify customer owns this subscription
      if (booking.customer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: { message: 'Not authorized to modify this subscription', status: 403 } 
        });
      }

      // Check if actually paused
      if (!booking.subscription.isPaused) {
        return res.status(400).json({ 
          error: { message: 'Subscription is not paused', status: 400 } 
        });
      }

      // Resume the subscription
      booking.subscription.isPaused = false;
      booking.subscription.resumedAt = new Date();
      
      await booking.save();

      res.json({ 
        message: 'Subscription resumed successfully',
        booking
      });

    } catch (error) {
      console.error('Resume subscription error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

export default router;
