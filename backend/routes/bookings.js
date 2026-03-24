import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import Booking from '../models/Booking.js';
import BusinessHours from '../models/BusinessHours.js';
import Location from '../models/Location.js';
import Service from '../models/Service.js';
import Settings from '../models/Settings.js';
import SubscriptionWorkerChangeRequest from '../models/SubscriptionWorkerChangeRequest.js';
import User from '../models/User.js';
import WorkerEarnings from '../models/WorkerEarnings.js';
import {
    activateBackupWorker,
    assignWorkersWithBackup,
    checkBackupActivationNeeded
} from '../utils/advancedWorkerAssignment.js';
import {
    processQueuedBookings,
    retryPendingBookingAssignment,
    updateBookingStatuses
} from '../utils/bookingStatusUpdater.js';
import { calculateDistance } from '../utils/geolocation.js';
import notificationService from '../utils/notificationService.js';
import { findWorkerWithPreferences } from '../utils/preferenceAssignment.js';
import { checkSlotAvailability } from '../utils/slotManagement.js';
import { checkIfOnTime, updateWorkerStats } from '../utils/updateWorkerStats.js';
import { assignWorkerToBooking, reassignWorker } from '../utils/workerAssignment.js';
import {
    getWorkerBlockedTimeRanges,
    getWorkerOperationalAvailabilityFromBookings,
    isWorkerAvailableForTimeRange,
    isWorkerEligibleForAssignment
} from '../utils/workerAvailability.js';
import {
    getWorkerAvailabilityForecast,
    getWorkerCapacityStatus,
    monitorWorkerPool
} from '../utils/workerPoolManager.js';

const router = express.Router();

const DAY_INDEX_BY_NAME = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

const findDeepCleaningServiceFallback = async () => {
  const directMatch = await Service.findOne({
    serviceCategory: 'deep_cleaning',
    isActive: true,
  })
    .select('_id name description price duration allowBreakRequests')
    .sort({ displayOrder: 1, createdAt: 1 })
    .lean();

  if (directMatch) {
    return directMatch;
  }

  return Service.findOne({
    isActive: true,
    $or: [
      { serviceType: { $regex: '^deep_cleaning', $options: 'i' } },
      { name: { $regex: 'deep cleaning|move in|move out', $options: 'i' } },
    ],
  })
    .select('_id name description price duration allowBreakRequests')
    .sort({ createdAt: 1 })
    .lean();
};

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

const parsePositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const timeStringToMinutes = (time) => {
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }

  const [hours, minutes] = time.split(':').map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
};

const minutesToTimeString = (minutes) => {
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const addMinutesToTimeString = (startTime, durationMinutes) => {
  const startMinutes = timeStringToMinutes(startTime);
  if (startMinutes === null) {
    return startTime;
  }

  return minutesToTimeString(startMinutes + durationMinutes);
};

const clampMinutesToTimeString = (minutes) => {
  const clampedMinutes = Math.max(0, Math.min(1439, minutes));
  const hours = Math.floor(clampedMinutes / 60);
  const mins = clampedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDaysToDate = (value, days) => {
  const date = startOfDay(value);
  date.setDate(date.getDate() + days);
  return date;
};

const findNextSelectedDay = (fromDate, selectedDays = []) => {
  const allowedDayIndexes = selectedDays
    .map(day => DAY_INDEX_BY_NAME[String(day || '').toLowerCase()])
    .filter(day => Number.isInteger(day));

  if (allowedDayIndexes.length === 0) {
    return addDaysToDate(fromDate, 7);
  }

  for (let offset = 1; offset <= 14; offset += 1) {
    const candidate = addDaysToDate(fromDate, offset);
    if (allowedDayIndexes.includes(candidate.getDay())) {
      return candidate;
    }
  }

  return addDaysToDate(fromDate, 7);
};

const resolveDefaultSubscriptionEndDate = (frequency, startDate, explicitEndDate = null) => {
  if (explicitEndDate) {
    return new Date(explicitEndDate);
  }

  if (String(frequency || '').toLowerCase() === 'monthly') {
    return addDaysToDate(startDate, 29);
  }

  return null;
};

const getNextRecurringScheduleDate = ({ frequency, startDate, selectedDays = [], isSubscription = false }) => {
  const normalizedFrequency = String(frequency || '').toLowerCase();

  if ((isSubscription && normalizedFrequency === 'monthly') || normalizedFrequency === 'daily') {
    return addDaysToDate(startDate, 1);
  }

  if (normalizedFrequency === 'weekly') {
    return selectedDays.length > 0
      ? findNextSelectedDay(startDate, selectedDays)
      : addDaysToDate(startDate, 7);
  }

  if (normalizedFrequency === 'biweekly') {
    return addDaysToDate(startDate, 14);
  }

  if (normalizedFrequency === '3-days' || normalizedFrequency === 'alt-days') {
    return selectedDays.length > 0
      ? findNextSelectedDay(startDate, selectedDays)
      : addDaysToDate(startDate, 2);
  }

  if (normalizedFrequency === 'monthly') {
    const nextDate = startOfDay(startDate);
    nextDate.setMonth(nextDate.getMonth() + 1);
    return nextDate;
  }

  return addDaysToDate(startDate, 1);
};

const getBookingScheduledStartDateTime = (booking) => {
  const scheduledStart = new Date(booking.bookingDate);
  const [hours, minutes] = (booking.startTime || '00:00').split(':').map(Number);
  scheduledStart.setHours(hours || 0, minutes || 0, 0, 0);
  return scheduledStart;
};

const getSubscriptionRootBookingId = (booking) => booking.parentBooking || booking._id;

const notifySubscriptionWorkerChangeAdmins = async (booking, requestedWorker, requestedBy, reason = '') => {
  const adminFilter = { role: { $in: ['admin', 'super_admin'] }, isActive: true };

  const admins = await User.find(adminFilter).select('_id adminProfile.assignedLocations role').lean();
  const bookingLocationId = booking.location?.locationId?.toString?.() || null;

  const relevantAdmins = admins.filter(admin => {
    if (admin.role === 'super_admin') return true;
    const assignedLocationIds = (admin.adminProfile?.assignedLocations || [])
      .map(location => location.locationId?.toString())
      .filter(Boolean);

    if (!bookingLocationId) return true;
    if (assignedLocationIds.length === 0) return false;
    return assignedLocationIds.includes(bookingLocationId);
  });

  await Promise.all(relevantAdmins.map(admin => notificationService.sendNotification({
    userId: admin._id,
    type: 'system',
    title: 'Subscription worker change request',
    message: `${requestedBy.name || 'A customer'} requested ${requestedWorker.name} for subscription ${booking.service?.name || booking._id}.`,
    priority: 'high',
    data: {
      bookingId: booking._id,
      requestedWorkerId: requestedWorker._id,
      requestedBy: requestedBy._id,
      reason
    }
  })));
};

const getTimeWindowMinutes = (startTime, endTime) => {
  const startMinutes = timeStringToMinutes(startTime);
  const endMinutes = timeStringToMinutes(endTime);

  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return null;
  }

  return endMinutes - startMinutes;
};

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

const resolveStrictLocationFromCoordinates = async ({ longitude, latitude, minRadiusMeters = 0 }) => {
  const nearestLocation = await Location.findOne({
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
        $maxDistance: 50000
      }
    },
    isActive: true,
    isServiceAvailable: true
  }).select('_id assignedWorkers location maxServiceRadius').lean();

  if (!nearestLocation?.location?.coordinates?.length) {
    console.log('📍 resolveStrictLocation: No nearest location found with valid coordinates');
    return null;
  }

  const distanceMeters = calculateDistance(
    latitude,
    longitude,
    nearestLocation.location.coordinates[1],
    nearestLocation.location.coordinates[0]
  );
  // Use the larger of: location's own radius, the caller's service radius, or 5 km minimum.
  // The 5 km minimum prevents overly restrictive matching when neither the location
  // nor the service has configured a meaningful radius.
  const maxRadiusMeters = Math.max(nearestLocation.maxServiceRadius || 5000, minRadiusMeters, 5000);

  console.log(`📍 resolveStrictLocation: distance=${Math.round(distanceMeters)}m, maxRadius=${maxRadiusMeters}m, locationRadius=${nearestLocation.maxServiceRadius || 'default'}, serviceRadius=${minRadiusMeters}m`);
  return distanceMeters <= maxRadiusMeters ? nearestLocation : null;
};

const resolveServiceDurationMinutes = ({ serviceConfig, subscriptionDetails, serviceDetails, estimatedDuration }) => {
  const explicitDurationMinutes = parsePositiveNumber(estimatedDuration) || parsePositiveNumber(serviceDetails?.durationMinutes);
  if (explicitDurationMinutes) {
    return explicitDurationMinutes;
  }

  const requestedPackage = [
    serviceDetails?.package,
    serviceDetails?.selectedPackage,
    serviceDetails?.size,
    serviceDetails?.sizeValue,
  ].find(value => typeof value === 'string' && value.trim());
  const sizeOptions = serviceConfig?.sizeParameters?.options || serviceConfig?.sizeParameters?.sizes || [];
  if (requestedPackage && Array.isArray(sizeOptions)) {
    const normalizedRequestedPackage = requestedPackage.trim().toLowerCase();
    const matchingSize = sizeOptions.find(option => {
      const optionValue = typeof option?.value === 'string' ? option.value.trim().toLowerCase() : null;
      const optionLabel = typeof option?.label === 'string' ? option.label.trim().toLowerCase() : null;
      return optionValue === normalizedRequestedPackage || optionLabel === normalizedRequestedPackage;
    });
    const sizeDuration = parsePositiveNumber(matchingSize?.duration);
    if (sizeDuration) {
      return sizeDuration;
    }
  }

  const hourlyDuration = parsePositiveNumber(
    serviceDetails?.hours ?? serviceDetails?.sessionDurationHours ?? subscriptionDetails?.durationPerSession
  );
  if (hourlyDuration) {
    return hourlyDuration * 60;
  }

  const quantity = parsePositiveNumber(
    serviceDetails?.quantity ?? serviceDetails?.qty ?? serviceDetails?.units ?? serviceDetails?.count
  );
  if (quantity && Array.isArray(serviceConfig?.pricingTiers)) {
    const matchingTier = serviceConfig.pricingTiers.find(tier => {
      const from = parsePositiveNumber(tier?.quantityFrom) ?? 0;
      const to = parsePositiveNumber(tier?.quantityTo) ?? Number.POSITIVE_INFINITY;
      return quantity >= from && quantity <= to;
    });
    const tierDuration = parsePositiveNumber(matchingTier?.duration);
    if (tierDuration) {
      return tierDuration;
    }
  }

  return parsePositiveNumber(serviceConfig?.duration);
};

const resolveBookingWindow = ({ serviceConfig, startTime, endTime, subscriptionDetails, serviceDetails, estimatedDuration }) => {
  const normalizedStartTime = typeof startTime === 'string' ? startTime : '';
  if (timeStringToMinutes(normalizedStartTime) === null) {
    return null;
  }

  const hasSplitSessions = Array.isArray(subscriptionDetails?.splitSessions) && subscriptionDetails.splitSessions.length > 0;
  const requestedWindowMinutes = getTimeWindowMinutes(normalizedStartTime, endTime);
  if (hasSplitSessions && requestedWindowMinutes) {
    return {
      startTime: normalizedStartTime,
      endTime,
      durationMinutes: requestedWindowMinutes,
    };
  }

  const resolvedDurationMinutes = resolveServiceDurationMinutes({
    serviceConfig,
    subscriptionDetails,
    serviceDetails,
    estimatedDuration,
  });

  if (resolvedDurationMinutes) {
    return {
      startTime: normalizedStartTime,
      endTime: addMinutesToTimeString(normalizedStartTime, resolvedDurationMinutes),
      durationMinutes: resolvedDurationMinutes,
    };
  }

  if (requestedWindowMinutes) {
    return {
      startTime: normalizedStartTime,
      endTime,
      durationMinutes: requestedWindowMinutes,
    };
  }

  return null;
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
      // Workers see bookings where they are team head OR support staff
      query.$or = [
        { worker: req.user._id },
        { 'supportStaff.worker': req.user._id }
      ];
    } else if (req.user.role === 'admin') {
      // Admins only see bookings within their assigned region
      const admin = await User.findById(req.user._id).select('adminProfile').lean();
      const assignedLocationIds = (admin?.adminProfile?.assignedLocations || [])
        .map(l => l.locationId)
        .filter(Boolean);
      if (assignedLocationIds.length > 0) {
        query['location.locationId'] = { $in: assignedLocationIds };
      } else {
        // No region assigned — return empty with flag so frontend can show helpful message
        return res.json({ bookings: [], totalPages: 0, currentPage: 1, totalBookings: 0, noRegionAssigned: true });
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
        path: 'supportStaff.worker',
        select: 'name email phone',
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
      .populate('service', 'name description price duration allowBreakRequests')
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
    const bookingLocationId = (booking.location.locationId?._id || booking.location.locationId)?.toString();
    const workerInLocation = worker.workerProfile?.assignedApartments?.some(
      apt => apt.locationId?.toString() === bookingLocationId
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
      .populate('worker', 'name email phone gender religion workerProfile profileImage')
      .populate('service', 'name description price duration allowBreakRequests')
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
// @desc    Get booked time ranges + worker availability for a date
//          Supports: gender filter, service specialization filter, business-hours timings
// @access  Private/Customer
router.get('/booked-slots', authenticate, async (req, res) => {
  try {
    const { date, locationId, lng, lat, gender, service: serviceId } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: { message: 'date query param required (YYYY-MM-DD)', status: 400 } });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    // ── Business hours for this day (admin-configured) ────────────────────────
    const bhConfig = await BusinessHours.getConfig();
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(date).getDay()];
    const dayConfig = bhConfig.schedule?.find(d => d.day === dayName);
    const openTime = dayConfig?.openTime || '09:00';
    const closeTime = dayConfig?.closeTime || '18:00';
    const slotDurationMinutes = bhConfig.slotDurationMinutes || 30;
    const isDayActive = dayConfig?.isActive ?? true;

    // ── Resolve nearest Location from coordinates/profile ────────────────────
    // Fetch the service radius early so location resolution uses the same
    // "max(maxServiceRadius, serviceSearchRadius)" logic as booking creation.
    let serviceSearchRadiusMeters = 0;
    if (serviceId) {
      const svcRadiusDoc = await Service.findById(serviceId)
        .select('workerSearchRadiusKm')
        .lean();
      // Use nullish coalescing so missing field uses Service model default (10km)
      serviceSearchRadiusMeters = (svcRadiusDoc?.workerSearchRadiusKm ?? 10) * 1000;
    }

    let targetLocationId = locationId;
    let targetLocation = null;
    if (!targetLocationId && lng && lat) {
      const customerLng = parseFloat(lng);
      const customerLat = parseFloat(lat);
      if (!isNaN(customerLng) && !isNaN(customerLat)) {
        const nearbyLocation = await resolveStrictLocationFromCoordinates({
          longitude: customerLng,
          latitude: customerLat,
          minRadiusMeters: serviceSearchRadiusMeters
        });
        if (nearbyLocation) {
          targetLocation = nearbyLocation;
          targetLocationId = nearbyLocation._id.toString();
        }
      }
    }

    if (!targetLocationId) {
      const currentUser = await User.findById(req.user._id).select('addresses currentLocation').lean();
      const userCoordinates = getUserCoordinates(currentUser);
      if (userCoordinates) {
        const nearbyLocation = await resolveStrictLocationFromCoordinates({
          ...userCoordinates,
          minRadiusMeters: serviceSearchRadiusMeters
        });
        if (nearbyLocation) {
          targetLocation = nearbyLocation;
          targetLocationId = nearbyLocation._id.toString();
        }
      }
    }

    if (!targetLocation && targetLocationId) {
      targetLocation = await Location.findById(targetLocationId)
        .select('_id assignedWorkers location maxServiceRadius')
        .lean();
    }

    if (!targetLocationId) {
      console.log('⚠️ booked-slots: No location resolved for customer coordinates. Returning 0 workers.');
      return res.json({
        success: true,
        bookedRanges: [],
        totalWorkers: 0,
        maleWorkers: 0,
        femaleWorkers: 0,
        openTime,
        closeTime,
        slotDurationMinutes,
        isDayActive,
        locationId: null,
        _debug: { reason: 'No serviceable location found near your address' }
      });
    }

    // ── Booked ranges for this date ───────────────────────────────────────────
    const bookings = await Booking.find({
      bookingDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'confirmed', 'in-progress'] },
      worker: { $ne: null }
    }).select('worker startTime endTime').lean();

    // ── Build worker query ────────────────────────────────────────────────────
    const workerQuery = {
      role: 'worker',
      isActive: true,
      'workerProfile.availability': true
    };

    let serviceDoc = null;

    // Filter by service specialization — only show specialists for this service
    if (serviceId) {
      serviceDoc = await Service.findById(serviceId)
        .select('category')
        .lean();
      if (serviceDoc?.category) {
        workerQuery['workerProfile.specialization'] = { $in: [serviceDoc.category] };
      }
    }

    // Region-only worker visibility: count only workers mapped to the resolved
    // location, never all workers from other regions.
    if (targetLocationId) {
      const locationAssignedWorkerIds = (targetLocation?.assignedWorkers || [])
        .map(entry => entry?.worker?.toString())
        .filter(Boolean);

      if (locationAssignedWorkerIds.length > 0) {
        workerQuery.$or = [
          { _id: { $in: locationAssignedWorkerIds } },
          { 'workerProfile.assignedApartments.locationId': targetLocationId }
        ];
      } else {
        workerQuery['workerProfile.assignedApartments.locationId'] = targetLocationId;
      }
    }

    // Filter by gender preference
    const genderFilter = gender && gender !== 'any' ? gender : null;
    if (genderFilter) {
      workerQuery['gender'] = genderFilter;
    }

    // ── Fetch workers (include gender for breakdown) ──────────────────────────
    let workers = await User.find(workerQuery)
      .select('_id gender isActive isFirstLogin hasCustomPassword workerProfile.availability workerProfile.leaves workerProfile.workingTimeWindow')
      .lean();

    console.log(`📊 booked-slots: ${workers.length} worker(s) matched DB query for location ${targetLocationId}`);

    // If specialization mapping is too strict for current worker data,
    // gracefully retry without it. This mirrors the worker assignment logic
    // and prevents false 0-availability in the customer UI.
    if (workers.length === 0 && workerQuery['workerProfile.specialization']) {
      const fallbackWithoutSpecialization = { ...workerQuery };
      delete fallbackWithoutSpecialization['workerProfile.specialization'];
      workers = await User.find(fallbackWithoutSpecialization)
        .select('_id gender isActive isFirstLogin hasCustomPassword workerProfile.availability workerProfile.leaves workerProfile.workingTimeWindow')
        .lean();
      console.log(`📊 booked-slots: ${workers.length} worker(s) after specialization fallback`);
    }

    const eligibleWorkers = workers.filter((worker) => {
      const result = isWorkerEligibleForAssignment(worker);
      if (!result.eligible) {
        console.log(`   ❌ Worker ${worker._id} ineligible: ${result.reason}`);
      }
      return result.eligible;
    });
    console.log(`📊 booked-slots: ${eligibleWorkers.length}/${workers.length} workers passed eligibility check`);

    // Remove workers on approved leave for this date
    const leaveEligibleWorkers = eligibleWorkers.filter(worker => {
      if (!worker.workerProfile?.leaves?.length) return true;
      const onLeave = worker.workerProfile.leaves.some(leave => {
        if (leave.status !== 'approved') return false;
        const leaveDate = new Date(leave.date);
        leaveDate.setHours(0, 0, 0, 0);
        return leaveDate.getTime() === bookingDate.getTime();
      });
      if (onLeave) console.log(`   🏖️ Worker ${worker._id} on approved leave for ${date}`);
      return !onLeave;
    });
    console.log(`📊 booked-slots: ${leaveEligibleWorkers.length}/${eligibleWorkers.length} workers passed leave check`);

    const workerIds = leaveEligibleWorkers.map(worker => worker._id);
    const workerDayBookings = workerIds.length > 0
      ? await Booking.find({
          bookingDate: { $gte: startOfDay, $lte: endOfDay },
          status: { $ne: 'cancelled' },
          $or: [
            { worker: { $in: workerIds } },
            { 'supportStaff.worker': { $in: workerIds } }
          ]
        }).select('worker supportStaff.worker status startTime endTime actualEndTime').lean()
      : [];

    const now = new Date();
    const isRequestedDateToday = startOfDay.toDateString() === now.toDateString();
    const dailyPrimaryBookingCounts = new Map();
    workerDayBookings.forEach((booking) => {
      if (!booking?.worker) return;
      const workerId = booking.worker.toString();
      dailyPrimaryBookingCounts.set(workerId, (dailyPrimaryBookingCounts.get(workerId) || 0) + 1);
    });

    const nonOverloadedWorkers = leaveEligibleWorkers.filter((worker) => {
      const dailyBookings = dailyPrimaryBookingCounts.get(worker._id.toString()) || 0;
      if (dailyBookings >= 8) {
        console.log(`   📦 Worker ${worker._id} overloaded with ${dailyBookings} bookings`);
      }
      return dailyBookings < 8;
    });

    const availableWorkers = nonOverloadedWorkers.filter(worker => {
      if (!isRequestedDateToday) {
        return true;
      }

      const operationalStatus = getWorkerOperationalAvailabilityFromBookings(worker, workerDayBookings, now);
      if (operationalStatus.operationsCompleted) {
        console.log(`   ✅ Worker ${worker._id} operations completed for today`);
      }
      return !operationalStatus.operationsCompleted;
    });

    console.log(`📊 booked-slots: Final available workers: ${availableWorkers.length} (overload: ${leaveEligibleWorkers.length - nonOverloadedWorkers.length} dropped, operational: ${nonOverloadedWorkers.length - availableWorkers.length} dropped)`);

    // Filter bookedRanges to only the available workers so the frontend
    // slot availability count matches the worker pool (important for gender filter)
    const normalizeGender = (genderValue) => {
      if (typeof genderValue !== 'string') return null;
      const normalized = genderValue.trim().toLowerCase();
      return ['male', 'female'].includes(normalized) ? normalized : null;
    };

    const availableWorkerIdSet = new Set(availableWorkers.map(w => w._id.toString()));
    const workerGenderMap = new Map(
      availableWorkers.map(w => [w._id.toString(), normalizeGender(w.gender)])
    );
    const bookedRanges = bookings
      .filter(b => b.worker && availableWorkerIdSet.has(b.worker.toString()))
      .map(b => ({
        workerId: b.worker.toString(),
        workerGender: workerGenderMap.get(b.worker.toString()) ?? null,
        startTime: clampMinutesToTimeString((timeStringToMinutes(b.startTime) ?? 0) - 15),
        endTime: clampMinutesToTimeString((timeStringToMinutes(b.endTime) ?? 0) + 15)
      }));

    availableWorkers.forEach(worker => {
      const blockedRanges = getWorkerBlockedTimeRanges(worker, bookingDate);
      blockedRanges.forEach(range => {
        bookedRanges.push({
          workerId: worker._id.toString(),
          workerGender: workerGenderMap.get(worker._id.toString()) ?? null,
          startTime: range.startTime,
          endTime: range.endTime,
          reason: range.reason
        });
      });
    });

    const totalWorkers = availableWorkers.length;
    const maleWorkers = availableWorkers.filter(w => normalizeGender(w.gender) === 'male').length;
    const femaleWorkers = availableWorkers.filter(w => normalizeGender(w.gender) === 'female').length;

    res.json({
      success: true,
      bookedRanges,
      totalWorkers,
      maleWorkers,
      femaleWorkers,
      openTime,
      closeTime,
      slotDurationMinutes,
      isDayActive,
      locationId: targetLocationId
    });
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
      .populate('worker', 'name email phone gender religion workerProfile profileImage')
      .populate('supportStaff.worker', 'name email phone')
      .populate('service', 'name description price duration allowBreakRequests');

    if (!booking) {
      return res.status(404).json({
        error: { message: 'Booking not found', status: 404 }
      });
    }

    // Check access permissions (also allow support staff workers)
    const isSupportStaff = booking.supportStaff?.some(
      s => s.worker && s.worker._id && s.worker._id.toString() === req.user._id.toString()
    );
    const isAuthorized =
      req.user.role === 'admin' ||
      req.user.role === 'super_admin' ||
      booking.customer._id.toString() === req.user._id.toString() ||
      (booking.worker && booking.worker._id && booking.worker._id.toString() === req.user._id.toString()) ||
      isSupportStaff;

    if (!isAuthorized) {
      return res.status(403).json({ 
        error: { message: 'Forbidden', status: 403 } 
      });
    }

    let bookingResponse = booking;

    if (!booking.service && booking.bookingType === 'deep-cleaning-cart') {
      const deepCleaningService = await findDeepCleaningServiceFallback();
      if (deepCleaningService) {
        bookingResponse = booking.toObject();
        bookingResponse.service = deepCleaningService;
      }
    }

    res.json({ booking: bookingResponse });
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
        serviceDetails,
        estimatedDuration
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

      const serviceConfig = await Service.findById(service)
        .select('name category duration durationOptions sizeParameters pricingTiers workerSearchRadiusKm defaultWorkerCount workerWage')
        .lean();

      if (!serviceConfig) {
        return res.status(400).json({
          error: {
            message: 'Selected service no longer exists. Please refresh and try again.',
            status: 400,
            code: 'SERVICE_NOT_FOUND'
          }
        });
      }

      // ── Subscription price validation: override totalAmount from service.durationOptions ──
      if (isSubscription && subscriptionDetails?.durationPerSession != null) {
        if (serviceConfig?.durationOptions?.length) {
          const tier = serviceConfig.durationOptions.find(d => d.hours === subscriptionDetails.durationPerSession);
          if (tier?.price) {
            totalAmount = tier.price; // Use server-authoritative price, not client-sent value
          }
        }
      }

      // ── Holiday guard ──────────────────────────────────────────────────
      // Reject bookings on days declared as holidays by the super admin.
      const effectiveBookingDate = isSubscription
        ? (subscriptionDetails?.startDate || bookingDate)
        : bookingDate;
      if (effectiveBookingDate) {
        const bookingDateStr = typeof effectiveBookingDate === 'string'
          ? effectiveBookingDate.slice(0, 10)
          : new Date(effectiveBookingDate).toISOString().slice(0, 10);
        try {
          const bhConfig = await BusinessHours.getConfig();
          const holiday = (bhConfig.holidays || []).find(h => h.date === bookingDateStr);
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
          // Only skip holiday check if MongoDB call itself fails (e.g., connection issue)
          console.error('Holiday check DB error — skipping guard:', bhErr.message);
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

      // Fetch service radius — use admin-configured workerSearchRadiusKm as the search perimeter
      const serviceRadiusMeters = (serviceConfig?.workerSearchRadiusKm ?? 10) * 1000;

      console.log(`🔍 Searching for service location near: [${customerLng}, ${customerLat}] (radius: ${serviceRadiusMeters / 1000}km)`);
      const nearbyLocation = await Location.findOne({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [customerLng, customerLat]
            },
            $maxDistance: serviceRadiusMeters // from service.workerSearchRadiusKm (admin-configured)
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

      // ── Strict service radius check ─────────────────────────────────────
      // Verify customer is actually within the location's defined service area,
      // not just the broad $near pre-filter radius (5km).
      {
        const locLng = nearbyLocation.location.coordinates[0];
        const locLat = nearbyLocation.location.coordinates[1];
        // Effective radius = larger of: location's maxServiceRadius (admin set per location)
        //                              OR service's workerSearchRadiusKm (admin set per service)
        // e.g. Insta Maid location=500m, service=500m → 500m
        //      Deep Clean  location=500m, service=30000m → 30000m
        const serviceRadiusM = Math.max(nearbyLocation.maxServiceRadius || 500, serviceRadiusMeters);
        const R = 6371000; // Earth radius in metres
        const φ1 = customerLat * Math.PI / 180;
        const φ2 = locLat * Math.PI / 180;
        const Δφ = (locLat - customerLat) * Math.PI / 180;
        const Δλ = (locLng - customerLng) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const actualDistanceM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        if (actualDistanceM > serviceRadiusM) {
          console.log(`⛔ Booking rejected: customer is ${Math.round(actualDistanceM)}m away, service radius is ${serviceRadiusM}m (${nearbyLocation.apartmentName})`);
          return res.status(400).json({
            error: {
              message: `Service is not available at your location. You are ${Math.round(actualDistanceM)}m away from the nearest service area (${nearbyLocation.apartmentName}). Our service covers within ${serviceRadiusM}m of that location.`,
              status: 400,
              code: 'OUTSIDE_SERVICE_RADIUS',
              details: {
                yourDistanceMeters: Math.round(actualDistanceM),
                serviceRadiusMeters: serviceRadiusM,
                nearestServiceArea: nearbyLocation.apartmentName
              }
            }
          });
        }

        console.log(`✅ Customer is ${Math.round(actualDistanceM)}m from ${nearbyLocation.apartmentName} (within ${serviceRadiusM}m radius)`);
      }
      // ────────────────────────────────────────────────────────────────────

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
          apt.locationId?.toString() === nearbyLocation._id.toString()
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

      const resolvedStartTime = isSubscription ? subscriptionDetails?.preferredTime : startTime;
      const bookingWindow = resolveBookingWindow({
        serviceConfig,
        startTime: resolvedStartTime,
        endTime,
        subscriptionDetails,
        serviceDetails,
        estimatedDuration,
      });

      if (!bookingWindow) {
        return res.status(400).json({
          error: {
            message: 'Booking time could not be calculated because this service duration is not configured. Please ask admin or super admin to set the service duration.',
            status: 400,
            code: 'SERVICE_DURATION_NOT_CONFIGURED'
          }
        });
      }

      const requestedBookingDate = new Date(isSubscription ? subscriptionDetails.startDate : bookingDate);
      const startOfRequestedDay = new Date(requestedBookingDate);
      startOfRequestedDay.setHours(0, 0, 0, 0);
      const endOfRequestedDay = new Date(requestedBookingDate);
      endOfRequestedDay.setHours(23, 59, 59, 999);

      const customerConflict = await Booking.findOne({
        customer: req.user._id,
        bookingDate: { $gte: startOfRequestedDay, $lte: endOfRequestedDay },
        status: { $in: ['pending', 'confirmed', 'in-progress'] },
        startTime: { $lt: bookingWindow.endTime },
        endTime: { $gt: bookingWindow.startTime }
      })
        .select('bookingId startTime endTime')
        .lean();

      if (customerConflict) {
        return res.status(400).json({
          error: {
            message: `You already have another booking between ${customerConflict.startTime} and ${customerConflict.endTime}. Please choose a different time.`,
            status: 400,
            code: 'CUSTOMER_BOOKING_CONFLICT'
          }
        });
      }

      if (worker) {
        const workerAvailability = await checkSlotAvailability(
          worker,
          requestedBookingDate,
          bookingWindow.startTime,
          bookingWindow.endTime,
          Booking,
          15
        );

        if (!workerAvailability.available) {
          return res.status(400).json({
            error: {
              message: workerAvailability.reason || 'Selected worker has a conflicting booking at this time.',
              status: 400,
              code: 'WORKER_BOOKING_CONFLICT',
              conflictingBooking: workerAvailability.conflictingBooking || null
            }
          });
        }
      }

      // Prepare booking data with validated location reference
      const bookingData = {
        customer: req.user._id,
        worker: worker || undefined,
        service,
        bookingDate: isSubscription ? subscriptionDetails.startDate : bookingDate,
        startTime: bookingWindow.startTime,
        endTime: bookingWindow.endTime,
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
        scheduledDurationMinutes: bookingWindow.durationMinutes,
        ...(serviceDetails && { serviceDetails })
      };

      // Add subscription details if it's a subscription booking
      if (isSubscription && subscriptionDetails) {
        const normalizedSubscriptionStartDate = new Date(subscriptionDetails.startDate);
        const resolvedSubscriptionEndDate = resolveDefaultSubscriptionEndDate(
          subscriptionDetails.frequency || bookingType,
          normalizedSubscriptionStartDate,
          subscriptionDetails.endDate || null
        );
        const initialNextScheduledDate = getNextRecurringScheduleDate({
          frequency: subscriptionDetails.frequency || bookingType,
          startDate: normalizedSubscriptionStartDate,
          selectedDays: subscriptionDetails.selectedDays || [],
          isSubscription: true
        });

        bookingData.subscription = {
          isSubscription: true,
          subscriptionStartDate: normalizedSubscriptionStartDate,
          subscriptionEndDate: resolvedSubscriptionEndDate,
          autoRenewal: subscriptionDetails.autoRenewal || false,
          allowPause: subscriptionDetails.allowPause || false,
          fixedWorker: worker, // Store the fixed worker for this subscription
          durationPerSession: subscriptionDetails.durationPerSession || 1,
          preferredTime: subscriptionDetails.preferredTime,
          // Split sessions: store multiple time windows when customer splits work across day
          ...(subscriptionDetails.splitSessions?.length > 0 && {
            splitSessions: subscriptionDetails.splitSessions
          })
        };
        
        // Add recurring schedule for subscription
        bookingData.recurringSchedule = {
          frequency: subscriptionDetails.frequency || bookingType,
          startDate: normalizedSubscriptionStartDate,
          endDate: resolvedSubscriptionEndDate,
          nextScheduledDate: initialNextScheduledDate,
          selectedDays: subscriptionDetails.selectedDays || [],
          preferredTime: subscriptionDetails.preferredTime
        };
        
        // Status: confirmed if worker already known (manual), pending if auto-assignment will run
        bookingData.status = worker ? 'confirmed' : 'pending';
        if (worker) {
          bookingData.confirmedAt = new Date();
          bookingData.assignedAt = new Date();
        }
      }

      // Add recurring schedule if it's a recurring booking (non-subscription)
      else if (bookingData.isRecurring) {
        bookingData.recurringSchedule = {
          frequency: bookingType,
          startDate: new Date(bookingDate),
          nextScheduledDate: new Date(bookingDate)
        };
      }

      // Snapshot workforce details from service at booking creation time
      if (service) {
        try {
          if (serviceConfig) {
            bookingData.workforce = {
              workerCount: serviceConfig.defaultWorkerCount || 1,
              wageType: serviceConfig.workerWage?.type || 'per_hour',
              wageRate: serviceConfig.workerWage?.rate || 0,
              totalWorkerWage: 0 // will be calculated when admin updates after visit
            };
          }
        } catch (wErr) {
          console.error('Workforce snapshot error (non-fatal):', wErr.message);
        }
      }

      const booking = new Booking(bookingData);

      await booking.save();

      // Always attempt auto-assignment unless explicitly disabled (autoAssign !== false)
      // This ensures workers are automatically assigned when available nearby
      // Uses advanced assignment system with primary + 2 backup workers
      let populatedBooking;
      const shouldAutoAssign = autoAssign !== false; // Default to true unless explicitly disabled
      const mustAssignImmediately = !booking.subscription?.isSubscription && ['adhoc', 'oneTime'].includes(booking.bookingType);
      
      if (!worker && shouldAutoAssign) {
        try {
          console.log('🚀 Using advanced worker assignment (primary + backups)...');
          
          // Use advanced assignment system for primary + 2 backup workers
          const assignmentResult = await assignWorkersWithBackup({
            customerId: req.user._id,
            service: serviceConfig
              ? {
                  _id: service,
                  name: serviceConfig.name,
                  category: serviceConfig.category,
                  workerSearchRadiusKm: serviceConfig.workerSearchRadiusKm
                }
              : bookingData.service,
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

            // For subscription bookings, pin the auto-assigned worker as the fixed daily worker
            if (booking.subscription?.isSubscription) {
              booking.subscription.fixedWorker = assignmentResult.primaryWorker;
            }

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
              if (mustAssignImmediately) {
                await Booking.findByIdAndDelete(booking._id);
                return res.status(409).json({
                  error: {
                    message: 'That time slot was just taken by another booking. Please choose another time.',
                    status: 409,
                    code: 'SLOT_JUST_FILLED'
                  }
                });
              }

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
              radius: serviceRadiusMeters, // from service.workerSearchRadiusKm (admin-configured)
              genderPreference: bookingData.preferences?.workerGenderPreference || 'any',
              religionPreference: bookingData.preferences?.religionPreference
            }, Booking);
            
            if (fallbackResult.success) {
              booking.worker = fallbackResult.worker._id;
              booking.assignmentMethod = fallbackResult.assignmentMethod;
              booking.assignedAt = new Date();

              // Pin fallback-assigned worker as fixed worker for subscriptions
              if (booking.subscription?.isSubscription) {
                booking.subscription.fixedWorker = fallbackResult.worker._id;
              }

              if (booking.status === 'pending') {
                booking.status = 'confirmed';
                booking.confirmedAt = new Date();
              }
              
              await booking.save();
              console.log(`✅ Fallback worker assigned: ${fallbackResult.worker.name}`);
            } else {
              if (mustAssignImmediately) {
                await Booking.findByIdAndDelete(booking._id);
                return res.status(409).json({
                  error: {
                    message: 'No workers are available for the selected time slot. Please choose another slot.',
                    status: 409,
                    code: 'NO_WORKER_AVAILABLE_FOR_SLOT'
                  }
                });
              }

              console.log(`⚠️ No worker assigned. Booking remains pending for manual assignment.`);
            }
          }
          
          populatedBooking = await Booking.findById(booking._id)
            .populate('customer', 'name email phone')
            .populate('worker', 'name email phone gender religion workerProfile profileImage')
            .populate('backupWorkers.worker', 'name email phone workerProfile profileImage')
            .populate('service', 'name description price duration allowBreakRequests');
        } catch (assignError) {
          console.error('Worker assignment error:', assignError);
          if (mustAssignImmediately) {
            await Booking.findByIdAndDelete(booking._id);
            return res.status(409).json({
              error: {
                message: 'Unable to assign a worker for the selected slot right now. Please choose another time.',
                status: 409,
                code: 'WORKER_ASSIGNMENT_FAILED'
              }
            });
          }

          // Booking created but no worker assigned yet - will need manual assignment
          populatedBooking = await Booking.findById(booking._id)
            .populate('customer', 'name email phone')
            .populate('service', 'name description price duration allowBreakRequests');
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
          .populate('worker', 'name email phone gender religion workerProfile profileImage')
          .populate('backupWorkers.worker', 'name email phone workerProfile profileImage')
          .populate('service', 'name description price duration allowBreakRequests');
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

        // Read overtime rate from DB settings (super_admin configurable)
        const overtimeSettings = await Settings.getSettings();
        const OVERTIME_RATE = overtimeSettings.booking?.overtimeRate ?? 2.5;
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
          // Validate commission rate is between 0 and 1
          const rawCommissionRate = settings.earnings?.platformCommissionRate || 0;
          const commissionRate = Math.min(1, Math.max(0, rawCommissionRate));

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
          
          // Create earnings BEFORE marking booking complete
          try {
            await earnings.save();
            console.log(`✅ Earnings auto-created: ₹${netEarning.toFixed(2)} (Booking ${booking._id})`);
          } catch (saveError) {
            console.error('❌ Failed to create earnings record:', saveError);
            return res.status(500).json({ 
              error: { 
                message: 'Failed to create earnings record for worker', 
                status: 500 
              }
            });
          }
        }
      } catch (earningsError) {
        // Log error and fail the booking update
        console.error('❌ Error processing worker earnings:', earningsError);
        return res.status(500).json({ 
          error: { 
            message: 'Error processing worker earnings', 
            status: 500 
          }
        });
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
      .populate('worker', 'name email phone gender religion workerProfile profileImage')
      .populate('service', 'name description price duration allowBreakRequests');

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
        serviceName: booking.service?.name ?? 'Move In / Move Out Cleaning',
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
        message: `Customer cancelled booking for ${booking.service?.name ?? 'Move In / Move Out Cleaning'}. ${refundReason}`,
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
      .populate('service', 'name duration')
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
    
    // Calculate and update endTime based on the existing booking window / service duration
    let durationMinutes =
      parsePositiveNumber(booking.scheduledDurationMinutes) ||
      getTimeWindowMinutes(booking.startTime, booking.endTime) ||
      parsePositiveNumber(booking.subscription?.durationPerSession) * 60 ||
      parsePositiveNumber(booking.service?.duration) ||
      120;
    
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
    const workerAvailable = oldWorker ? await checkWorkerAvailability(oldWorker._id, newScheduledDate, durationHours, booking._id) : false;
    
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
          serviceName: booking.service?.name ?? 'Move In / Move Out Cleaning',
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
            message: `Customer rescheduled booking for ${booking.service?.name ?? 'Move In / Move Out Cleaning'}. Booking reassigned to another worker.`,
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
            serviceName: booking.service?.name ?? 'Move In / Move Out Cleaning',
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
          message: `Customer rescheduled booking for ${booking.service?.name ?? 'Move In / Move Out Cleaning'} to ${formatDate(newScheduledDate)} at ${formatTime(newScheduledDate)}.`,
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
async function checkWorkerAvailability(workerId, scheduledDate, duration, excludeBookingId = null) {
  try {
    // Check if worker exists and is available
    const worker = await User.findById(workerId);
    const eligibility = isWorkerEligibleForAssignment(worker);
    if (!eligibility.eligible) {
      return false;
    }

    const startTime = new Date(scheduledDate);
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);

    const startTimeString = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;
    const endTimeString = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;

    const timeRangeAvailability = isWorkerAvailableForTimeRange(
      worker,
      startTime,
      startTimeString,
      endTimeString
    );

    if (!timeRangeAvailability.available) {
      return false;
    }

    const slotAvailability = await checkSlotAvailability(
      workerId,
      startTime,
      startTimeString,
      endTimeString,
      Booking,
      15,
      excludeBookingId
    );

    if (!slotAvailability.available) {
      return false;
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

// @route   POST /api/bookings/:id/retry-assignment
// @desc    Retry automatic worker assignment for a stuck pending booking
// @access  Private/Admin
router.post('/:id/retry-assignment', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).select('status worker location.locationId');

    if (!booking) {
      return res.status(404).json({
        error: { message: 'Booking not found', status: 404 }
      });
    }

    const bookingLocationId = booking.location?.locationId?.toString() || null;
    const adminLocationIds = (req.user.adminProfile?.assignedLocations || [])
      .map((location) => location.locationId?.toString())
      .filter(Boolean);

    if (req.user.role === 'admin' && (!bookingLocationId || !adminLocationIds.includes(bookingLocationId))) {
      return res.status(403).json({
        error: { message: 'You can only retry bookings in your assigned region', status: 403 }
      });
    }

    if (booking.worker) {
      return res.status(400).json({
        error: { message: 'Booking already has an assigned worker', status: 400 }
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        error: { message: `Only pending bookings can be retried. Current status: ${booking.status}`, status: 400 }
      });
    }

    const retryResult = await retryPendingBookingAssignment(req.params.id, { notifyCustomer: true });

    if (!retryResult.success) {
      return res.status(409).json({
        error: {
          message: retryResult.reason || 'No worker is available for this booking yet',
          status: 409
        }
      });
    }

    const updatedBooking = await Booking.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('worker', 'name email phone gender religion workerProfile profileImage')
      .populate('backupWorkers.worker', 'name email phone workerProfile profileImage')
      .populate('service', 'name description price duration allowBreakRequests');

    res.json({
      success: true,
      message: 'Worker assignment retried successfully',
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Retry assignment error:', error);
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


// ==================== SUPPORT STAFF MANAGEMENT ====================

// @route   POST /api/bookings/:id/support-staff
// @desc    Admin adds a support staff worker to a deep cleaning booking (max 4)
// @access  Private/Admin
router.post('/:id/support-staff', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { workerId } = req.body;
    if (!workerId) {
      return res.status(400).json({ error: { message: 'workerId is required', status: 400 } });
    }

    const booking = await Booking.findById(req.params.id).populate('supportStaff.worker', 'name email');
    if (!booking) {
      return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
    }

    if (booking.bookingType !== 'deep-cleaning-cart') {
      return res.status(400).json({ error: { message: 'Support staff only applies to deep cleaning bookings', status: 400 } });
    }

    if ((booking.supportStaff?.length ?? 0) >= 4) {
      return res.status(400).json({ error: { message: 'Maximum 4 support staff allowed', status: 400 } });
    }

    const alreadyAdded = booking.supportStaff?.some(s => s.worker._id.toString() === workerId);
    if (alreadyAdded) {
      return res.status(400).json({ error: { message: 'Worker already in support staff', status: 400 } });
    }

    if (booking.worker && booking.worker.toString() === workerId) {
      return res.status(400).json({ error: { message: 'Team head cannot be added as support staff', status: 400 } });
    }

    const worker = await User.findById(workerId).select('name email');
    if (!worker) {
      return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
    }

    booking.supportStaff.push({ worker: workerId, name: worker.name });
    await booking.save();
    await booking.populate('supportStaff.worker', 'name email phone');

    res.json({ message: 'Support staff added', supportStaff: booking.supportStaff });
  } catch (error) {
    console.error('Add support staff error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   DELETE /api/bookings/:id/support-staff/:workerId
// @desc    Admin removes a support staff worker from a booking
// @access  Private/Admin
router.delete('/:id/support-staff/:workerId', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
    }

    const beforeLen = booking.supportStaff?.length ?? 0;
    booking.supportStaff = (booking.supportStaff || []).filter(
      s => s.worker.toString() !== req.params.workerId
    );

    if (booking.supportStaff.length === beforeLen) {
      return res.status(404).json({ error: { message: 'Worker not in support staff', status: 404 } });
    }

    await booking.save();
    await booking.populate('supportStaff.worker', 'name email phone');

    res.json({ message: 'Support staff removed', supportStaff: booking.supportStaff });
  } catch (error) {
    console.error('Remove support staff error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// ==================== TEAM HEAD MANAGEMENT ====================

// @route   PATCH /api/bookings/:id/team-head
// @desc    Admin sets a worker as team head for a deep cleaning booking
// @access  Private/Admin
router.patch('/:id/team-head', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { workerId } = req.body;
    if (!workerId) {
      return res.status(400).json({ error: { message: 'workerId is required', status: 400 } });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
    }

    if (booking.bookingType !== 'deep-cleaning-cart') {
      return res.status(400).json({ error: { message: 'Team head only applies to deep cleaning bookings', status: 400 } });
    }

    const worker = await User.findById(workerId).select('name email phone');
    if (!worker) {
      return res.status(404).json({ error: { message: 'Worker not found', status: 404 } });
    }

    const previousHead = booking.worker ? booking.worker.toString() : null;

    // If the new head is currently in support staff, remove them from support staff
    booking.supportStaff = (booking.supportStaff || []).filter(
      s => s.worker.toString() !== workerId
    );

    // If there was a previous head who is not the new head, move them to support staff
    if (previousHead && previousHead !== workerId) {
      const prevWorker = await User.findById(previousHead).select('name');
      if (prevWorker) {
        booking.supportStaff.push({ worker: previousHead, name: prevWorker.name });
      }
    }

    // Set the new team head
    booking.worker = workerId;
    booking.assignmentMethod = 'manual';
    await booking.save();

    await booking.populate('worker', 'name email phone');
    await booking.populate('supportStaff.worker', 'name email phone');

    res.json({
      message: 'Team head updated',
      worker: booking.worker,
      supportStaff: booking.supportStaff
    });
  } catch (error) {
    console.error('Set team head error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// ==================== BREAK TIME MANAGEMENT ====================

// @route   POST /api/bookings/:id/break-request
// @desc    Worker requests a break during an in-progress booking
// @access  Private/Worker
router.post('/:id/break-request', authenticate, authorize('worker', 'admin', 'super_admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id).populate('worker', 'name').populate('service', 'name allowBreakRequests');
    if (!booking) {
      return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
    }

    if (booking.status !== 'in-progress') {
      return res.status(400).json({ error: { message: 'Break can only be requested for in-progress bookings', status: 400 } });
    }

    const effectiveService = booking.service || (
      booking.bookingType === 'deep-cleaning-cart'
        ? await findDeepCleaningServiceFallback()
        : null
    );

    // Check if service allows break requests
    if (effectiveService && effectiveService.allowBreakRequests === false) {
      return res.status(403).json({ error: { message: 'Break requests are not allowed for this service', status: 403 } });
    }

    if (booking.isOnBreak) {
      return res.status(400).json({ error: { message: 'A break is already active', status: 400 } });
    }

    // Check requesting worker is part of the team
    const isTeamHead = booking.worker && booking.worker._id.toString() === req.user._id.toString();
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

    if (!isTeamHead && !isAdmin) {
      return res.status(403).json({ error: { message: 'Only the team head can request breaks for this booking', status: 403 } });
    }

    const breakRequest = {
      requestedBy: req.user._id,
      requestedByName: req.user.name,
      reason: reason || '',
      requestedAt: new Date(),
      status: 'pending'
    };

    booking.breakRequests.push(breakRequest);
    await booking.save();

    const newBreak = booking.breakRequests[booking.breakRequests.length - 1];

    res.json({
      message: 'Break requested — waiting for customer approval',
      breakRequest: newBreak,
      breakRequests: booking.breakRequests
    });
  } catch (error) {
    console.error('Break request error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PATCH /api/bookings/:id/break-approve/:breakId
// @desc    Customer approves a break request (service timer pauses)
// @access  Private/Customer
router.patch('/:id/break-approve/:breakId', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
    }

    // Allow customer, admin, or super_admin to approve
    const isCustomer = booking.customer.toString() === req.user._id.toString();
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    if (!isCustomer && !isAdmin) {
      return res.status(403).json({ error: { message: 'Only the customer or admin can approve breaks', status: 403 } });
    }

    const breakReq = booking.breakRequests.id(req.params.breakId);
    if (!breakReq) {
      return res.status(404).json({ error: { message: 'Break request not found', status: 404 } });
    }

    if (breakReq.status !== 'pending') {
      return res.status(400).json({ error: { message: `Break is already ${breakReq.status}`, status: 400 } });
    }

    breakReq.status = 'active';
    breakReq.startedAt = new Date();
    breakReq.approvedBy = req.user._id;
    booking.isOnBreak = true;
    await booking.save();

    res.json({
      message: 'Break approved — service timer paused',
      breakRequest: breakReq,
      breakRequests: booking.breakRequests,
      isOnBreak: true
    });
  } catch (error) {
    console.error('Break approve error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PATCH /api/bookings/:id/break-resume/:breakId
// @desc    Customer resumes work after a break (service timer resumes)
// @access  Private/Customer
router.patch('/:id/break-resume/:breakId', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
    }

    const isCustomer = booking.customer.toString() === req.user._id.toString();
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    if (!isCustomer && !isAdmin) {
      return res.status(403).json({ error: { message: 'Only the customer or admin can resume work', status: 403 } });
    }

    const breakReq = booking.breakRequests.id(req.params.breakId);
    if (!breakReq) {
      return res.status(404).json({ error: { message: 'Break request not found', status: 404 } });
    }

    if (breakReq.status !== 'active') {
      return res.status(400).json({ error: { message: 'Break is not currently active', status: 400 } });
    }

    breakReq.endedAt = new Date();
    breakReq.status = 'completed';
    breakReq.durationMinutes = Math.round((breakReq.endedAt - breakReq.startedAt) / 60000);

    booking.isOnBreak = false;

    // Recalculate total break minutes
    booking.totalBreakMinutes = booking.breakRequests
      .filter(b => b.status === 'completed' && b.durationMinutes > 0)
      .reduce((sum, b) => sum + b.durationMinutes, 0);

    await booking.save();

    res.json({
      message: 'Work resumed — service timer restarted',
      breakRequest: breakReq,
      breakRequests: booking.breakRequests,
      isOnBreak: false,
      totalBreakMinutes: booking.totalBreakMinutes
    });
  } catch (error) {
    console.error('Break resume error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PATCH /api/bookings/:id/break-reject/:breakId
// @desc    Customer rejects a break request
// @access  Private/Customer
router.patch('/:id/break-reject/:breakId', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
    }

    const isCustomer = booking.customer.toString() === req.user._id.toString();
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    if (!isCustomer && !isAdmin) {
      return res.status(403).json({ error: { message: 'Only the customer or admin can reject breaks', status: 403 } });
    }

    const breakReq = booking.breakRequests.id(req.params.breakId);
    if (!breakReq) {
      return res.status(404).json({ error: { message: 'Break request not found', status: 404 } });
    }

    if (breakReq.status !== 'pending') {
      return res.status(400).json({ error: { message: `Break is already ${breakReq.status}`, status: 400 } });
    }

    breakReq.status = 'rejected';
    await booking.save();

    res.json({
      message: 'Break request rejected',
      breakRequest: breakReq,
      breakRequests: booking.breakRequests,
      isOnBreak: false
    });
  } catch (error) {
    console.error('Break reject error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

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

      // Check booking status — allow confirmed or in-progress (auto-status can advance before worker scans QR)
      if (booking.status !== 'confirmed' && booking.status !== 'in-progress') {
        return res.status(400).json({
          error: { message: 'Booking must be confirmed or in-progress to generate start QR', status: 400 }
        });
      }

      // Check if already started
      if (booking.actualStartTime) {
        return res.status(400).json({ 
          error: { message: 'Service already started', status: 400 } 
        });
      }

      if (req.user.role !== 'admin') {
        const now = new Date();
        const scheduledStartTime = getBookingScheduledStartDateTime(booking);
        const earliestQrGenerationTime = new Date(scheduledStartTime.getTime() - (15 * 60 * 1000));

        if (now < earliestQrGenerationTime) {
          return res.status(400).json({
            error: {
              message: 'Start QR can only be generated within 15 minutes of the scheduled service start time.',
              status: 400
            }
          });
        }
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
        .populate('worker', 'name email phone gender religion workerProfile profileImage');
      
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
// @route   POST /api/bookings/:id/upload-arrival-photo
// @desc    Worker uploads a selfie on arrival before service starts
// @access  Private/Worker
router.post('/:id/upload-arrival-photo',
  authenticate,
  authorize('worker'),
  (req, res, next) => {
    upload.single('arrivalPhoto')(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);
      if (!booking) return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });

      if (!booking.worker || booking.worker.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: { message: 'You are not assigned to this booking', status: 403 } });
      }
      if (booking.status !== 'confirmed') {
        return res.status(400).json({ error: { message: 'Arrival photo can only be uploaded for confirmed bookings', status: 400 } });
      }
      if (!req.file) {
        return res.status(400).json({ error: { message: 'Arrival photo file is required', status: 400 } });
      }

      booking.arrivalPhoto = {
        url: `/uploads/${req.file.filename}`,
        timestamp: new Date(),
        uploadedBy: req.user._id
      };
      if (!booking.workerArrivalTime) booking.workerArrivalTime = new Date();
      await booking.save();

      // Notify customer that worker has arrived
      try {
        await notificationService.sendNotification({
          userId: booking.customer._id || booking.customer,
          type: 'worker-enroute',
          title: 'Worker Has Arrived',
          message: 'Your worker has arrived and is ready to start. Service will begin shortly.',
          data: { bookingId: booking._id }
        });
      } catch (_) { /* non-critical */ }

      res.json({ message: 'Arrival photo uploaded', arrivalPhoto: booking.arrivalPhoto });
    } catch (error) {
      console.error('Upload arrival photo error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

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

// @route   POST /api/bookings/:id/add-completion-photo
// @desc    Worker adds one completion photo to the completionPhotos array (min 2 required)
// @access  Private/Worker
router.post('/:id/add-completion-photo',
  authenticate,
  authorize('worker', 'admin'),
  (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
      }

      if (!booking.worker || (booking.worker.toString() !== req.user._id.toString() && req.user.role !== 'admin')) {
        return res.status(403).json({ error: { message: 'You are not assigned to this booking', status: 403 } });
      }

      if (booking.status !== 'in-progress' && booking.status !== 'pending-review') {
        return res.status(400).json({ error: { message: 'Service must be in-progress to add completion photos', status: 400 } });
      }

      if (!req.file) {
        return res.status(400).json({ error: { message: 'Photo file is required', status: 400 } });
      }

      const photoUrl = `/uploads/completion-photos/${req.file.filename}`;
      if (!booking.completionPhotos) booking.completionPhotos = [];

      booking.completionPhotos.push({
        url: photoUrl,
        timestamp: new Date(),
        uploadedBy: req.user._id,
        verified: false
      });

      // Keep legacy single completionPhoto field in sync with the latest photo
      booking.completionPhoto = {
        url: photoUrl,
        timestamp: new Date(),
        uploadedBy: req.user._id,
        verified: true
      };

      await booking.save();

      console.log(`✅ Completion photo added (${booking.completionPhotos.length} total) for booking ${booking._id}`);

      res.json({
        message: 'Completion photo added successfully',
        completionPhotos: booking.completionPhotos,
        totalPhotos: booking.completionPhotos.length
      });
    } catch (error) {
      console.error('❌ Add completion photo error:', error);
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: { message: 'File size too large. Maximum 5MB allowed.', status: 400 } });
      }
      res.status(500).json({ error: { message: error.message || 'Server error', status: 500 } });
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

      // Check if service is completed or pending admin review
      if (booking.status !== 'completed' && booking.status !== 'pending-review') {
        return res.status(400).json({ 
          error: { message: 'Service must be completed or pending review to upload payment proof', status: 400 } 
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
        .populate('worker', 'name email phone gender religion workerProfile profileImage');
      
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

        // Read overtime rate from DB settings (super_admin configurable)
        const overtimeSettings = await Settings.getSettings();
        const overtimeRate = overtimeSettings.booking?.overtimeRate ?? 2.5;
        booking.overtimeCharges = booking.overtimeMinutes * overtimeRate;

        // Update total amount to include overtime
        booking.totalAmount += booking.overtimeCharges;
      } else {
        booking.overtimeMinutes = 0;
        booking.overtimeCharges = 0;
      }

      booking.status = 'pending-review';
      await booking.save();

      // Trigger queue — this worker's slot is now free; assign to next pending booking
      processQueuedBookings(booking.location?.locationId).catch(err =>
        console.error('Queue processing error after completion:', err.message)
      );

      console.log(`✅ Service ended for booking ${booking._id}. Status set to pending-review, awaiting admin approval.`);

      res.json({ 
        message: 'Service ended. Awaiting admin review before marking complete.',
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
          completionPhotos: booking.completionPhotos,
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

// @route   POST /api/bookings/:id/admin-approve
// @desc    Admin approves booking completion and creates worker earnings
// @access  Private/Admin
router.post('/:id/admin-approve',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id)
        .populate('worker', 'name email phone');

      if (!booking) {
        return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
      }

      if (booking.status !== 'pending-review') {
        return res.status(400).json({
          error: { message: `Booking is not pending review. Current status: ${booking.status}`, status: 400 }
        });
      }

      // Require payment proof to be uploaded before approval
      if (!booking.paymentProof || !booking.paymentProof.url) {
        return res.status(400).json({
          error: { message: 'Payment proof must be uploaded before admin can approve completion', status: 400 }
        });
      }

      booking.status = 'completed';
      booking.completedAt = new Date();

      // Mark all photos as verified
      if (booking.completionPhotos && booking.completionPhotos.length > 0) {
        booking.completionPhotos.forEach(p => { p.verified = true; });
      }
      if (booking.completionPhoto && booking.completionPhoto.url) {
        booking.completionPhoto.verified = true;
      }
      if (booking.paymentProof && booking.paymentProof.url) {
        booking.paymentProof.verified = true;
      }

      await booking.save();

      // ✅ CREATE WORKER EARNINGS on admin approval
      if (booking.worker) {
        try {
          const workerId = booking.worker._id || booking.worker;
          const settings = await Settings.getSettings();
          const commissionRate = settings.earnings?.platformCommissionRate || 0;

          const baseAmount = booking.totalAmount - (booking.overtimeCharges || 0);
          const overtimeAmount = booking.overtimeCharges || 0;
          const totalEarning = baseAmount + overtimeAmount;
          const platformCommission = baseAmount * commissionRate;
          const netEarning = totalEarning - platformCommission;

          const existingEarnings = await WorkerEarnings.findOne({ booking: booking._id });
          if (!existingEarnings) {
            const earnings = new WorkerEarnings({
              worker: workerId,
              booking: booking._id,
              baseAmount,
              overtimeAmount,
              bonus: 0,
              incentive: 0,
              totalEarning,
              platformCommission,
              netEarning,
              payoutStatus: 'pending',
              workDuration: booking.actualDurationMinutes || 0,
              date: new Date()
            });
            await earnings.save();
            const workerName = booking.worker.name || 'Worker';
            console.log(`✅ Earnings created on admin approval for ${workerName}: ₹${netEarning.toFixed(2)}`);
          }
        } catch (earningsError) {
          console.error('❌ Error creating worker earnings on approval:', earningsError);
        }
      }

      // Notify worker
      try {
        const workerId = booking.worker?._id || booking.worker;
        if (workerId) {
          await notificationService.sendNotification({
            userId: workerId,
            type: 'booking-confirmed',
            title: 'Service Approved',
            message: 'Your completed service has been reviewed and approved by the admin.',
            data: { bookingId: booking._id },
            priority: 'high'
          });
        }
      } catch (notifError) {
        console.error('Notification error on approval:', notifError);
      }

      res.json({
        message: 'Booking approved and marked as completed',
        booking: { _id: booking._id, status: booking.status }
      });

    } catch (error) {
      console.error('Admin approve error:', error);
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
        .populate('backupWorkers.worker', 'name email phone workerProfile profileImage');

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
        .populate('worker', 'name email phone workerProfile profileImage')
        .populate('backupWorkers.worker', 'name email phone workerProfile profileImage')
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
        .populate('worker', 'name email phone workerProfile profileImage');

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
      const { workerId, reason = '' } = req.body;
      const booking = await Booking.findById(req.params.id)
        .populate('customer', 'name email')
        .populate('service', 'name category')
        .populate('worker', 'name');
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Subscription not found', status: 404 } 
        });
      }

      const subscriptionBookingId = getSubscriptionRootBookingId(booking);
      const subscriptionBooking = subscriptionBookingId.toString() === booking._id.toString()
        ? booking
        : await Booking.findById(subscriptionBookingId)
            .populate('customer', 'name email')
            .populate('service', 'name category')
            .populate('worker', 'name');

      if (!subscriptionBooking) {
        return res.status(404).json({ 
          error: { message: 'Subscription root booking not found', status: 404 } 
        });
      }

      // Verify this is a subscription booking
      if (!subscriptionBooking.subscription?.isSubscription) {
        return res.status(400).json({ 
          error: { message: 'This is not a subscription booking', status: 400 } 
        });
      }

      // Verify customer owns this subscription
      if (subscriptionBooking.customer._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
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

      const currentFixedWorkerId = subscriptionBooking.subscription.fixedWorker?.toString?.()
        || subscriptionBooking.worker?._id?.toString?.()
        || subscriptionBooking.worker?.toString?.()
        || null;

      if (currentFixedWorkerId && currentFixedWorkerId === workerId) {
        return res.status(400).json({
          error: { message: 'This worker is already assigned to the subscription', status: 400 }
        });
      }

      const startedVisitCount = await Booking.countDocuments({
        $or: [
          { _id: subscriptionBooking._id },
          { parentBooking: subscriptionBooking._id }
        ],
        actualStartTime: { $ne: null },
        status: { $in: ['in-progress', 'pending-review', 'completed'] }
      });

      if (req.user.role !== 'admin' && startedVisitCount < 1) {
        return res.status(400).json({
          error: {
            message: 'You can request a worker change only after the first visit has started.',
            status: 400
          }
        });
      }

      const existingPendingRequest = await SubscriptionWorkerChangeRequest.findOne({
        subscriptionBooking: subscriptionBooking._id,
        status: 'pending'
      }).select('_id').lean();

      if (existingPendingRequest) {
        return res.status(400).json({
          error: {
            message: 'A worker change request is already pending review for this subscription.',
            status: 400
          }
        });
      }

      const request = await SubscriptionWorkerChangeRequest.create({
        subscriptionBooking: subscriptionBooking._id,
        requestedBy: req.user._id,
        customer: subscriptionBooking.customer._id,
        service: subscriptionBooking.service?._id || null,
        currentWorker: currentFixedWorkerId || null,
        requestedWorker: newWorker._id,
        reason,
        visitCountAtRequest: startedVisitCount
      });

      await notifySubscriptionWorkerChangeAdmins(subscriptionBooking, newWorker, req.user, reason);

      res.json({ 
        message: 'Worker change request sent to admin successfully',
        request
      });

    } catch (error) {
      console.error('Change worker error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/bookings/subscription-worker-change-requests/list
// @desc    List subscription worker change requests for admins
// @access  Private/Admin
router.get('/subscription-worker-change-requests/list', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    const query = {};

    if (status !== 'all') {
      query.status = status;
    }

    let requests = await SubscriptionWorkerChangeRequest.find(query)
      .populate('subscriptionBooking', 'bookingDate startTime endTime location customer worker subscription')
      .populate('requestedBy', 'name email role')
      .populate('customer', 'name email phone')
      .populate('service', 'name category')
      .populate('currentWorker', 'name email phone')
      .populate('requestedWorker', 'name email phone workerProfile profileImage')
      .populate('reviewedBy', 'name role')
      .sort({ createdAt: -1 });

    if (req.user.role === 'admin') {
      const admin = await User.findById(req.user._id).select('adminProfile.assignedLocations').lean();
      const assignedLocationIds = (admin?.adminProfile?.assignedLocations || [])
        .map(location => location.locationId?.toString())
        .filter(Boolean);

      requests = requests.filter(request => {
        const locationId = request.subscriptionBooking?.location?.locationId?.toString?.();
        if (!locationId) return assignedLocationIds.length === 0;
        return assignedLocationIds.includes(locationId);
      });
    }

    res.json({ success: true, requests });
  } catch (error) {
    console.error('Get subscription worker change requests error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/bookings/subscription-worker-change-requests/:requestId/review
// @desc    Review subscription worker change request
// @access  Private/Admin
router.post('/subscription-worker-change-requests/:requestId/review', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { status, reviewNote = '' } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        error: { message: 'Status must be approved or rejected', status: 400 }
      });
    }

    const request = await SubscriptionWorkerChangeRequest.findById(req.params.requestId)
      .populate('subscriptionBooking')
      .populate('requestedWorker', 'name email phone workerProfile profileImage')
      .populate('customer', 'name email');

    if (!request) {
      return res.status(404).json({
        error: { message: 'Worker change request not found', status: 404 }
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        error: { message: `Request already ${request.status}`, status: 400 }
      });
    }

    const subscriptionBooking = await Booking.findById(request.subscriptionBooking._id)
      .populate('service', 'name');

    if (!subscriptionBooking) {
      return res.status(404).json({
        error: { message: 'Subscription booking not found', status: 404 }
      });
    }

    if (status === 'approved') {
      const approvedWorker = await User.findById(request.requestedWorker._id);
      if (!approvedWorker || approvedWorker.role !== 'worker' || !approvedWorker.isActive) {
        return res.status(400).json({
          error: { message: 'Requested worker is no longer available', status: 400 }
        });
      }

      subscriptionBooking.worker = approvedWorker._id;
      subscriptionBooking.subscription.fixedWorker = approvedWorker._id;
      subscriptionBooking.assignmentMethod = 'manual';
      subscriptionBooking.assignedAt = new Date();
      await subscriptionBooking.save();

      const today = startOfDay(new Date());
      const futureBookings = await Booking.find({
        parentBooking: subscriptionBooking._id,
        bookingDate: { $gte: today },
        actualStartTime: null,
        status: { $in: ['pending', 'confirmed'] }
      });

      for (const futureBooking of futureBookings) {
        const requestedWorkerAvailability = await checkSlotAvailability(
          approvedWorker._id,
          futureBooking.bookingDate,
          futureBooking.startTime,
          futureBooking.endTime,
          Booking,
          15,
          futureBooking._id
        );

        if (requestedWorkerAvailability.available) {
          futureBooking.worker = approvedWorker._id;
          futureBooking.assignmentMethod = 'manual';
          futureBooking.assignedAt = new Date();
          futureBooking.status = 'confirmed';
          futureBooking.confirmedAt = futureBooking.confirmedAt || new Date();
          await futureBooking.save();
          continue;
        }

        const fallbackAssignment = await assignWorkersWithBackup({
          customerId: futureBooking.customer,
          service: futureBooking.service,
          bookingDate: futureBooking.bookingDate,
          startTime: futureBooking.startTime,
          endTime: futureBooking.endTime,
          location: futureBooking.location,
          bookingType: futureBooking.bookingType,
          preferences: futureBooking.preferences || {}
        });

        if (fallbackAssignment.success) {
          futureBooking.worker = fallbackAssignment.primaryWorker;
          futureBooking.backupWorkers = fallbackAssignment.backupWorkers || [];
          futureBooking.assignmentMethod = fallbackAssignment.assignmentMethod;
          futureBooking.assignedAt = new Date();
          futureBooking.status = 'confirmed';
          futureBooking.confirmedAt = futureBooking.confirmedAt || new Date();
        } else {
          futureBooking.worker = undefined;
          futureBooking.backupWorkers = [];
          futureBooking.assignmentMethod = 'auto';
          futureBooking.status = 'pending';
          futureBooking.assignedAt = null;
          futureBooking.confirmedAt = null;
        }

        await futureBooking.save();
      }
    }

    request.status = status;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.reviewNote = reviewNote;
    await request.save();

    await notificationService.sendNotification({
      userId: request.customer._id,
      type: 'system',
      title: status === 'approved' ? 'Worker change approved' : 'Worker change request reviewed',
      message: status === 'approved'
        ? `${request.requestedWorker.name} will handle your future subscription visits whenever available.`
        : (reviewNote || 'Your worker change request was not approved at this time.'),
      priority: 'high',
      data: {
        bookingId: subscriptionBooking._id,
        requestId: request._id,
        status
      }
    });

    res.json({
      success: true,
      message: status === 'approved' ? 'Worker change approved successfully' : 'Worker change request rejected',
      request
    });
  } catch (error) {
    console.error('Review subscription worker change request error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

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

// @route   PATCH /api/bookings/:id/checklist
// @desc    Initialize or replace checklist items for the booking (worker only)
// @access  Private/Worker
router.patch('/:id/checklist', authenticate, authorize('worker'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
    if (!booking.worker || booking.worker.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: { message: 'Not assigned to this booking', status: 403 } });
    }
    const items = (req.body.items || []).map(text => ({ text, completed: false }));
    booking.workerChecklist = items;
    await booking.save();
    res.json({ checklist: booking.workerChecklist });
  } catch (error) {
    console.error('Init checklist error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PATCH /api/bookings/:id/checklist/:itemId/toggle
// @desc    Toggle a checklist item completion (worker only)
// @access  Private/Worker
router.patch('/:id/checklist/:itemId/toggle', authenticate, authorize('worker'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
    if (!booking.worker || booking.worker.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: { message: 'Not assigned to this booking', status: 403 } });
    }
    const item = booking.workerChecklist.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: { message: 'Checklist item not found', status: 404 } });

    item.completed = !item.completed;
    item.completedAt = item.completed ? new Date() : null;
    await booking.save();
    res.json({ item });
  } catch (error) {
    console.error('Toggle checklist error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PATCH /api/bookings/:id/workforce
// @desc    Admin/super_admin can only add extra workers after booking; duration comes from QR flow and wage is locked from service snapshot
// @access  Private/Admin, Private/SuperAdmin
router.patch('/:id/workforce', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { workerCount, actualDurationMinutes, wageRate } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
    }

    if (!['confirmed', 'in-progress', 'pending-review', 'completed'].includes(booking.status)) {
      return res.status(400).json({
        error: { message: 'Workforce can only be updated for confirmed or active bookings', status: 400 }
      });
    }
    if (actualDurationMinutes !== undefined || wageRate !== undefined) {
      return res.status(403).json({
        error: {
          message: 'Post-booking duration and wage are locked. Team-head scan flow controls duration, and wage changes must be requested through service price change approval.',
          status: 403
        }
      });
    }

    if (workerCount === undefined) {
      return res.status(400).json({
        error: { message: 'Only workerCount can be updated after booking', status: 400 }
      });
    }

    const current = booking.workforce || {};
    if (!booking.workforce) {
      booking.workforce = {
        workerCount: 1,
        wageType: 'per_hour',
        wageRate: 0,
        totalWorkerWage: 0
      };
    }

    if (typeof workerCount !== 'number' || workerCount < 1) {
      return res.status(400).json({ error: { message: 'workerCount must be a positive number', status: 400 } });
    }
    if (workerCount < (current.workerCount || 1)) {
      return res.status(400).json({ error: { message: 'Worker count can only be increased, not decreased', status: 400 } });
    }
    booking.workforce.workerCount = workerCount;

    // Recalculate totalWorkerWage
    const count = booking.workforce.workerCount || 1;
    const rate = booking.workforce.wageRate || 0;
    const durationMins = booking.actualDurationMinutes || booking.scheduledDurationMinutes || 0;

    if (booking.workforce.wageType === 'per_hour') {
      booking.workforce.totalWorkerWage = Math.round(count * (durationMins / 60) * rate * 100) / 100;
    } else {
      // per_session
      booking.workforce.totalWorkerWage = Math.round(count * rate * 100) / 100;
    }

    booking.workforce.updatedBy = req.user._id;
    booking.workforce.updatedAt = new Date();

    await booking.save();

    res.json({
      message: 'Extra worker count updated successfully',
      workforce: booking.workforce,
      actualDurationMinutes: booking.actualDurationMinutes
    });
  } catch (error) {
    console.error('Update workforce error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;
