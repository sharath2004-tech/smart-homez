/**
 * Preference-based Worker Assignment Engine
 * 
 * Assignment Priority:
 * 1. Preference P1 (if available and not in exception list and not on leave)
 * 2. Preference P2 (if P1 unavailable)
 * 3. Preference P3 (if P2 unavailable)
 * 4. Any available worker (excluding exception list and on leave)
 * 
 * Exception List overrides ALL preferences and proximity rules
 * Leave Management: Workers on approved leave are automatically excluded
 */

import User from '../models/User.js';
import { checkSlotAvailability } from './slotManagement.js';

/**
 * Check if worker is on approved leave for a specific date
 * @param {Object} worker - Worker user object
 * @param {Date} bookingDate - Date to check
 * @returns {boolean} True if worker is on leave
 */
const isWorkerOnLeave = (worker, bookingDate) => {
  if (!worker.workerProfile?.leaves || worker.workerProfile.leaves.length === 0) {
    return false;
  }

  const bookingDateOnly = new Date(bookingDate);
  bookingDateOnly.setHours(0, 0, 0, 0);

  return worker.workerProfile.leaves.some(leave => {
    if (leave.status !== 'approved') {
      return false;
    }

    const leaveDate = new Date(leave.date);
    leaveDate.setHours(0, 0, 0, 0);

    return leaveDate.getTime() === bookingDateOnly.getTime();
  });
};

/**
 * Find available worker based on customer preferences
 * @param {Object} params - Assignment parameters
 * @param {ObjectId} params.customerId - Customer ID
 * @param {Date} params.bookingDate - Booking date
 * @param {string} params.startTime - Start time (HH:MM)
 * @param {string} params.endTime - End time (HH:MM)
 * @param {Object} params.location - Location coordinates {latitude, longitude}
 * @param {number} params.radius - Search radius in meters (default: 500)
 * @param {string} params.genderPreference - Gender preference ('any', 'male', 'female')
 * @param {Object} Booking - Booking model
 * @returns {Promise<Object>} Assignment result
 */
export const findWorkerWithPreferences = async (params, Booking) => {
  const {
    customerId,
    bookingDate,
    startTime,
    endTime,
    location,
    radius = 500,
    genderPreference = 'any'
  } = params;

  try {
    // Get customer with preferences and exception list
    const customer = await User.findById(customerId)
      .populate('preferences.preferredWorkerP1')
      .populate('preferences.preferredWorkerP2')
      .populate('preferences.preferredWorkerP3');

    if (!customer) {
      return {
        success: false,
        reason: 'Customer not found'
      };
    }

    // Extract exception worker IDs
    const exceptionWorkerIds = customer.preferences.exceptionWorkers.map(
      ex => ex.workerId.toString()
    );

    // Priority 1: Check Preference P1
    if (customer.preferences.preferredWorkerP1) {
      const p1Worker = customer.preferences.preferredWorkerP1;
      
      if (!exceptionWorkerIds.includes(p1Worker._id.toString())) {
        const availability = await checkWorkerAvailability(
          p1Worker,
          bookingDate,
          startTime,
          endTime,
          location,
          radius,
          genderPreference,
          params.religionPreference || 'any',
          Booking
        );

        if (availability.available) {
          return {
            success: true,
            worker: p1Worker,
            assignmentMethod: 'preference-p1',
            reason: 'Preference P1 assigned',
            preferenceLevel: 1
          };
        }
      }
    }

    // Priority 2: Check Preference P2
    if (customer.preferences.preferredWorkerP2) {
      const p2Worker = customer.preferences.preferredWorkerP2;
      
      if (!exceptionWorkerIds.includes(p2Worker._id.toString())) {
        const availability = await checkWorkerAvailability(
          p2Worker,
          bookingDate,
          startTime,
          endTime,
          location,
          radius,
          genderPreference,
          params.religionPreference || 'any',
          Booking
        );

        if (availability.available) {
          return {
            success: true,
            worker: p2Worker,
            assignmentMethod: 'preference-p2',
            reason: 'Preference P2 assigned (P1 unavailable)',
            preferenceLevel: 2
          };
        }
      }
    }

    // Priority 3: Check Preference P3
    if (customer.preferences.preferredWorkerP3) {
      const p3Worker = customer.preferences.preferredWorkerP3;
      
      if (!exceptionWorkerIds.includes(p3Worker._id.toString())) {
        const availability = await checkWorkerAvailability(
          p3Worker,
          bookingDate,
          startTime,
          endTime,
          location,
          radius,
          genderPreference,
          params.religionPreference || 'any',
          Booking
        );

        if (availability.available) {
          return {
            success: true,
            worker: p3Worker,
            assignmentMethod: 'preference-p3',
            reason: 'Preference P3 assigned (P1 & P2 unavailable)',
            preferenceLevel: 3
          };
        }
      }
    }

    // Priority 4: Find any available worker (excluding exceptions)
    const availableWorker = await findNearestAvailableWorker(
      location,
      bookingDate,
      startTime,
      endTime,
      radius,
      genderPreference,
      params.religionPreference || 'any',
      exceptionWorkerIds,
      Booking
    );

    if (availableWorker) {
      return {
        success: true,
        worker: availableWorker,
        assignmentMethod: 'auto-nearest',
        reason: 'Auto-assigned nearest available worker (preferences unavailable)',
        preferenceLevel: 0
      };
    }

    // No worker found
    return {
      success: false,
      reason: 'No available workers found',
      checkedPreferences: {
        p1: !!customer.preferences.preferredWorkerP1,
        p2: !!customer.preferences.preferredWorkerP2,
        p3: !!customer.preferences.preferredWorkerP3
      }
    };
  } catch (error) {
    console.error('Find worker with preferences error:', error);
    return {
      success: false,
      reason: 'Error finding worker',
      error: error.message
    };
  }
};

/**
 * Check if a specific worker is available for the booking
 * @param {Object} worker - Worker user object
 * @param {Date} bookingDate - Booking date
 * @param {string} startTime - Start time
 * @param {string} endTime - End time
 * @param {Object} location - Location {latitude, longitude}
 * @param {number} radius - Search radius
 * @param {string} genderPreference - Gender preference
 * @param {string} religionPreference - Religion preference
 * @param {Object} Booking - Booking model
 * @returns {Promise<Object>} Availability result
 */
const checkWorkerAvailability = async (
  worker,
  bookingDate,
  startTime,
  endTime,
  location,
  radius,
  genderPreference,
  religionPreference,
  Booking
) => {
  // Check if worker is active and available
  if (!worker.isActive || !worker.workerProfile?.availability) {
    return {
      available: false,
      reason: 'Worker is not active or available'
    };
  }

  // Check if worker is on approved leave for this date
  if (isWorkerOnLeave(worker, bookingDate)) {
    return {
      available: false,
      reason: 'Worker is on approved leave for this date'
    };
  }

  // Check gender preference
  if (genderPreference !== 'any' && worker.gender !== genderPreference) {
    return {
      available: false,
      reason: 'Gender preference not matched'
    };
  }

  // Check religion preference
  if (religionPreference && religionPreference !== 'any' && worker.religion !== religionPreference) {
    return {
      available: false,
      reason: 'Religion preference not matched'
    };
  }

  // Check location proximity (if location provided)
  const hasLatLng = location && location.latitude && location.longitude;
  const hasCoords = location && Array.isArray(location.coordinates) && location.coordinates.length === 2;
  if (hasLatLng || hasCoords) {
    const isInRadius = await checkWorkerInRadius(worker._id, location, radius);
    if (!isInRadius) {
      return {
        available: false,
        reason: 'Worker outside service radius'
      };
    }
  }

  // Check time slot availability
  const slotCheck = await checkSlotAvailability(
    worker._id,
    bookingDate,
    startTime,
    endTime,
    Booking
  );

  return slotCheck;
};

/**
 * Find nearest available worker (excluding exception list)
 * @returns {Promise<Object|null>} Worker object or null
 */
const findNearestAvailableWorker = async (
  location,
  bookingDate,
  startTime,
  endTime,
  radius,
  genderPreference,
  religionPreference,
  exceptionWorkerIds,
  Booking
) => {
  try {
    // Build query
    const query = {
      role: 'worker',
      isActive: true,
      'workerProfile.availability': true,
      _id: { $nin: exceptionWorkerIds } // Exclude exception list
    };

    // Add gender filter if specified
    if (genderPreference !== 'any') {
      query.gender = genderPreference;
    }

    // Add religion filter if specified
    if (religionPreference && religionPreference !== 'any') {
      query.religion = religionPreference;
    }

    // Add location filter if provided
    if (location && location.latitude && location.longitude) {
      query['workerProfile.assignedApartments.location'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(location.longitude), parseFloat(location.latitude)]
          },
          $maxDistance: radius
        }
      };
    }

    // Get potential workers sorted by rating and proximity
    const workers = await User.find(query)
      .sort({
        'workerProfile.rating': -1,
        'workerProfile.onTimeArrivalRate': -1,
        'workerProfile.completionRate': -1
      })
      .limit(20); // Check top 20 workers

    // Check availability for each worker
    for (const worker of workers) {
      // Check if worker is on leave for this date
      if (isWorkerOnLeave(worker, bookingDate)) {
        continue; // Skip this worker
      }

      const availability = await checkSlotAvailability(
        worker._id,
        bookingDate,
        startTime,
        endTime,
        Booking
      );

      if (availability.available) {
        return worker;
      }
    }

    return null;
  } catch (error) {
    console.error('Find nearest available worker error:', error);
    return null;
  }
};

/**
 * Check if worker is within service radius
 * @param {ObjectId} workerId - Worker ID
 * @param {Object} location - {latitude, longitude}
 * @param {number} radius - Radius in meters
 * @returns {Promise<boolean>} True if in radius
 */
const checkWorkerInRadius = async (workerId, location, radius) => {
  try {
    let lng, lat;
    if (Array.isArray(location.coordinates) && location.coordinates.length === 2) {
      [lng, lat] = location.coordinates;
    } else {
      lng = parseFloat(location.longitude);
      lat = parseFloat(location.latitude);
    }
    const worker = await User.findOne({
      _id: workerId,
      'workerProfile.assignedApartments.location': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          $maxDistance: radius
        }
      }
    });

    return !!worker;
  } catch (error) {
    console.error('Check worker in radius error:', error);
    return false;
  }
};

/**
 * Handle worker unavailability and auto-reassignment
 * @param {ObjectId} bookingId - Booking ID
 * @param {Object} Booking - Booking model
 * @param {string} reason - Reason for reassignment
 * @returns {Promise<Object>} Reassignment result
 */
export const handleWorkerReassignment = async (bookingId, Booking, reason = 'worker-unavailable') => {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('customer')
      .populate('worker');

    if (!booking) {
      return {
        success: false,
        reason: 'Booking not found'
      };
    }

    // Find new worker using preferences
    const assignmentResult = await findWorkerWithPreferences({
      customerId: booking.customer._id,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      location: booking.location,
      genderPreference: booking.preferences.workerGenderPreference
    }, Booking);

    if (!assignmentResult.success) {
      // No worker available - cancel booking
      booking.status = 'cancelled';
      booking.cancellationReason = 'No workers available for reassignment';
      await booking.save();

      return {
        success: false,
        reason: 'No workers available',
        bookingCancelled: true
      };
    }

    // Record reassignment history
    booking.reassignmentHistory.push({
      previousWorker: booking.worker._id,
      newWorker: assignmentResult.worker._id,
      reason,
      reassignedAt: new Date(),
      customerNotified: true
    });

    // Update booking with new worker
    booking.worker = assignmentResult.worker._id;
    booking.assignmentMethod = assignmentResult.assignmentMethod;
    await booking.save();

    return {
      success: true,
      newWorker: assignmentResult.worker,
      previousWorker: booking.worker,
      reason: assignmentResult.reason
    };
  } catch (error) {
    console.error('Worker reassignment error:', error);
    return {
      success: false,
      reason: 'Error during reassignment',
      error: error.message
    };
  }
};

export default {
  findWorkerWithPreferences,
  handleWorkerReassignment
};
