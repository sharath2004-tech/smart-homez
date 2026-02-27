/**
 * Advanced Worker Assignment System
 * 
 * REQ-B-001: Primary Worker Assignment
 * - Assignment criteria priority:
 *   1. Customer preferences (for monthly subscriptions)
 *   2. Worker skills and specialization match
 *   3. Proximity to customer location (within 5km radius)
 *   4. Worker availability status
 *   5. Worker rating and performance history
 *   6. Current workload balance
 * - Assignment completion time: Within 2 minutes of booking
 * 
 * REQ-B-002: Backup Worker Assignment
 * - 2 backup workers assigned per booking
 * - Backup assignment criteria:
 *   - Same skill set as primary worker
 *   - Within 7km radius
 *   - Availability during booking window
 * - Automatic backup activation triggers:
 *   - Primary worker unavailability
 *   - Primary worker emergency logout
 *   - Primary worker running late (>15 minutes)
 */

import Booking from '../models/Booking.js';
import User from '../models/User.js';

/**
 * Calculate distance between two points using Haversine formula
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Check if worker is on approved leave for a specific date
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
 * Calculate comprehensive worker score
 * Higher score = better candidate
 */
const calculateWorkerScore = (worker, bookingDetails, distance, priorityWeights) => {
  let score = 0;
  const weights = priorityWeights || {
    customerPreference: 40, // Highest priority for monthly subscriptions
    skillMatch: 25,
    proximity: 15,
    availability: 10,
    rating: 5,
    workload: 5
  };

  // 1. Customer preference score (0-40 points)
  if (bookingDetails.hasCustomerPreference && bookingDetails.preferenceLevel) {
    const preferenceScore = {
      1: 40, // P1 preference
      2: 30, // P2 preference
      3: 20  // P3 preference
    };
    score += preferenceScore[bookingDetails.preferenceLevel] || 0;
  }

  // 2. Skill match score (0-25 points)
  if (bookingDetails.service?.category && worker.workerProfile?.specialization) {
    const hasSkill = worker.workerProfile.specialization.includes(bookingDetails.service.category);
    if (hasSkill) {
      score += weights.skillMatch;
    }
  }

  // 3. Proximity score (0-15 points)
  if (distance !== null) {
    // Within 2km: 15 points, 2-5km: 10 points, 5-7km: 5 points
    if (distance <= 2) {
      score += weights.proximity;
    } else if (distance <= 5) {
      score += weights.proximity * 0.67;
    } else if (distance <= 7) {
      score += weights.proximity * 0.33;
    }
  }

  // 4. Availability score (0-10 points)
  if (worker.workerProfile?.availability === true) {
    score += weights.availability;
  }

  // 5. Rating and performance score (0-5 points)
  if (worker.workerProfile?.rating) {
    score += (worker.workerProfile.rating / 5) * weights.rating;
  }

  // Bonus for completion rate
  if (worker.workerProfile?.completionRate) {
    score += (worker.workerProfile.completionRate / 100) * 3;
  }

  // Bonus for on-time arrival
  if (worker.workerProfile?.onTimeArrivalRate) {
    score += (worker.workerProfile.onTimeArrivalRate / 100) * 2;
  }

  return score;
};

/**
 * Get current workload for a worker
 */
const getWorkerWorkload = async (workerId, bookingDate, startTime, endTime) => {
  try {
    const bookingTime = new Date(`${bookingDate}T${startTime}`);
    
    const concurrentBookings = await Booking.countDocuments({
      worker: workerId,
      bookingDate: new Date(bookingDate),
      status: { $in: ['confirmed', 'in-progress', 'pending'] },
      $or: [
        // Overlapping time slots
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime }
        }
      ]
    });

    // Count total bookings for the day
    const dailyBookings = await Booking.countDocuments({
      worker: workerId,
      bookingDate: new Date(bookingDate),
      status: { $ne: 'cancelled' }
    });

    return {
      concurrent: concurrentBookings,
      daily: dailyBookings,
      isOverloaded: dailyBookings >= 8 // Maximum 8 bookings per day
    };
  } catch (error) {
    console.error('Error getting worker workload:', error);
    return { concurrent: 0, daily: 0, isOverloaded: false };
  }
};

/**
 * Find and assign primary worker with 2 backups
 * 
 * @param {Object} bookingDetails - Booking details
 * @returns {Object} Assignment result with primary and backup workers
 */
export const assignWorkersWithBackup = async (bookingDetails) => {
  const startTime = Date.now();
  
  try {
    const {
      customerId,
      service,
      bookingDate,
      startTime: bookingStartTime,
      endTime: bookingEndTime,
      location,
      bookingType,
      preferences
    } = bookingDetails;

    console.log('🎯 Starting advanced worker assignment...');
    console.log(`📋 Booking Type: ${bookingType}`);
    console.log(`📍 Service: ${service?.name || service?.category}`);

    // Step 1: Get customer with preferences
    const customer = await User.findById(customerId)
      .populate('preferences.preferredWorkerP1')
      .populate('preferences.preferredWorkerP2')
      .populate('preferences.preferredWorkerP3');

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Check if this is a monthly subscription (preferences apply)
    const isMonthlySubscription = bookingType === 'monthly-subscription' || bookingType === 'monthly';
    const hasCustomerPreference = isMonthlySubscription && (
      customer.preferences?.preferredWorkerP1 ||
      customer.preferences?.preferredWorkerP2 ||
      customer.preferences?.preferredWorkerP3
    );

    // Exception list - workers to exclude
    const exceptionWorkerIds = customer.preferences?.exceptionWorkers?.map(
      ex => ex.workerId.toString()
    ) || [];

    console.log(`🚫 Exception list: ${exceptionWorkerIds.length} workers excluded`);

    // Step 2: Build worker query
    const workerQuery = {
      role: 'worker',
      isActive: true,
      _id: { $nin: exceptionWorkerIds } // Exclude exception workers
    };

    // Filter by service specialization
    if (service?.category) {
      workerQuery['workerProfile.specialization'] = { $in: [service.category] };
    }

    console.log('🔍 Searching for eligible workers...');

    // Get all potential workers
    let workers = await User.find(workerQuery).select(
      'name email phone workerProfile currentLocation addresses'
    );

    console.log(`📊 Found ${workers.length} workers matching criteria`);

    if (workers.length === 0) {
      // Fallback: try without specialization filter
      delete workerQuery['workerProfile.specialization'];
      workers = await User.find(workerQuery).select(
        'name email phone workerProfile currentLocation addresses'
      );
      console.log(`📊 Fallback: Found ${workers.length} workers without specialization filter`);
    }

    if (workers.length === 0) {
      throw new Error('No eligible workers found');
    }

    // Step 3: Filter workers on leave
    const availableWorkers = workers.filter(worker => !isWorkerOnLeave(worker, bookingDate));
    
    console.log(`✅ ${availableWorkers.length} workers not on leave`);

    if (availableWorkers.length === 0) {
      throw new Error('All workers are on leave for this date');
    }

    // Step 4: Calculate distance and scores for all workers
    const customerLat = location?.coordinates?.[1];
    const customerLng = location?.coordinates?.[0];

    if (!customerLat || !customerLng) {
      console.warn('⚠️ Customer location not available, proceeding without distance calculation');
    }

    const workersWithScores = [];

    for (const worker of availableWorkers) {
      // Get worker location
      const workerLat = worker.currentLocation?.coordinates?.[1] 
        || worker.addresses?.[0]?.location?.coordinates?.[1];
      const workerLng = worker.currentLocation?.coordinates?.[0] 
        || worker.addresses?.[0]?.location?.coordinates?.[0];

      // Calculate distance
      let distance = null;
      if (customerLat && customerLng && workerLat && workerLng) {
        distance = calculateDistance(customerLat, customerLng, workerLat, workerLng);
      }

      // Check if worker matches customer preference
      let preferenceLevel = null;
      if (hasCustomerPreference) {
        if (customer.preferences.preferredWorkerP1?.toString() === worker._id.toString()) {
          preferenceLevel = 1;
        } else if (customer.preferences.preferredWorkerP2?.toString() === worker._id.toString()) {
          preferenceLevel = 2;
        } else if (customer.preferences.preferredWorkerP3?.toString() === worker._id.toString()) {
          preferenceLevel = 3;
        }
      }

      // Get workload
      const workload = await getWorkerWorkload(
        worker._id,
        bookingDate,
        bookingStartTime,
        bookingEndTime
      );

      // Skip if worker has concurrent booking
      if (workload.concurrent > 0) {
        console.log(`⏩ Skipping ${worker.name} - concurrent booking at this time`);
        continue;
      }

      // Skip if worker is overloaded
      if (workload.isOverloaded) {
        console.log(`⏩ Skipping ${worker.name} - overloaded (${workload.daily} bookings)`);
        continue;
      }

      // Calculate score
      const score = calculateWorkerScore(
        worker,
        {
          ...bookingDetails,
          hasCustomerPreference,
          preferenceLevel
        },
        distance,
        null // Use default weights
      );

      workersWithScores.push({
        worker,
        distance,
        score,
        preferenceLevel,
        workload
      });
    }

    console.log(`🎯 ${workersWithScores.length} workers scored and eligible`);

    if (workersWithScores.length === 0) {
      throw new Error('No workers available at this time slot or within service area');
    }

    // Step 5: Sort by score (highest first)
    workersWithScores.sort((a, b) => b.score - a.score);

    console.log('🏆 Top 5 workers by score:');
    workersWithScores.slice(0, 5).forEach((w, i) => {
      console.log(
        `  ${i + 1}. ${w.worker.name} - Score: ${w.score.toFixed(2)}, ` +
        `Distance: ${w.distance ? w.distance.toFixed(2) + 'km' : 'N/A'}, ` +
        `Preference: ${w.preferenceLevel ? 'P' + w.preferenceLevel : 'None'}, ` +
        `Workload: ${w.workload.daily} bookings`
      );
    });

    // Step 6: Select primary worker (within 5km if distance available)
    let primaryWorker = null;
    let primaryWorkerData = null;

    for (const workerData of workersWithScores) {
      // Check distance constraint for primary worker (5km)
      if (workerData.distance !== null && workerData.distance > 5) {
        console.log(`❌ ${workerData.worker.name} too far for primary: ${workerData.distance.toFixed(2)}km`);
        continue;
      }

      primaryWorker = workerData.worker;
      primaryWorkerData = workerData;
      break;
    }

    if (!primaryWorker) {
      throw new Error('No worker found within 5km radius');
    }

    console.log(`✅ Primary worker assigned: ${primaryWorker.name}`);

    // Step 7: Select 2 backup workers (within 7km)
    const backupWorkers = [];
    const primaryWorkerId = primaryWorker._id.toString();

    for (const workerData of workersWithScores) {
      // Skip primary worker
      if (workerData.worker._id.toString() === primaryWorkerId) {
        continue;
      }

      // Check distance constraint for backup workers (7km)
      if (workerData.distance !== null && workerData.distance > 7) {
        console.log(`❌ ${workerData.worker.name} too far for backup: ${workerData.distance.toFixed(2)}km`);
        continue;
      }

      // Must have same skill set as primary
      const primarySkills = primaryWorker.workerProfile?.specialization || [];
      const workerSkills = workerData.worker.workerProfile?.specialization || [];
      const hasMatchingSkills = primarySkills.some(skill => workerSkills.includes(skill));

      if (!hasMatchingSkills && primarySkills.length > 0) {
        console.log(`❌ ${workerData.worker.name} doesn't have matching skills`);
        continue;
      }

      backupWorkers.push({
        worker: workerData.worker._id,
        assignedAt: new Date(),
        priority: backupWorkers.length + 1,
        distance: workerData.distance,
        score: workerData.score
      });

      console.log(
        `✅ Backup ${backupWorkers.length} assigned: ${workerData.worker.name} ` +
        `(${workerData.distance ? workerData.distance.toFixed(2) + 'km' : 'N/A'})`
      );

      if (backupWorkers.length >= 2) {
        break; // We have 2 backups
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`⏱️ Assignment completed in ${elapsed}ms (target: <2000ms)`);

    if (elapsed > 2000) {
      console.warn('⚠️ Assignment took longer than 2 seconds!');
    }

    // Return assignment result
    return {
      success: true,
      primaryWorker: primaryWorker._id,
      backupWorkers,
      assignmentMethod: primaryWorkerData.preferenceLevel 
        ? `preference-p${primaryWorkerData.preferenceLevel}`
        : 'auto',
      assignmentDetails: {
        score: primaryWorkerData.score,
        distance: primaryWorkerData.distance,
        preferenceLevel: primaryWorkerData.preferenceLevel,
        backupCount: backupWorkers.length,
        assignmentTime: elapsed
      }
    };

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error('❌ Worker assignment failed:', error.message);
    console.log(`⏱️ Failed after ${elapsed}ms`);
    
    return {
      success: false,
      error: error.message,
      assignmentTime: elapsed
    };
  }
};

/**
 * Activate backup worker
 * 
 * @param {Object} booking - Booking document
 * @param {String} reason - Reason for backup activation
 * @returns {Object} Activation result
 */
export const activateBackupWorker = async (booking, reason) => {
  try {
    console.log(`🔄 Activating backup worker for booking ${booking._id}`);
    console.log(`📝 Reason: ${reason}`);

    if (!booking.backupWorkers || booking.backupWorkers.length === 0) {
      throw new Error('No backup workers available');
    }

    // Get the next available backup worker (priority order)
    const nextBackup = booking.backupWorkers
      .sort((a, b) => a.priority - b.priority)
      .find(backup => {
        // Check if this backup hasn't been used yet
        return !booking.backupActivations?.some(
          activation => activation.backupWorker.toString() === backup.worker.toString()
        );
      });

    if (!nextBackup) {
      throw new Error('All backup workers have been activated already');
    }

    // Populate backup worker details
    await booking.populate('backupWorkers.worker');
    const backupWorkerData = booking.backupWorkers.find(
      b => b.worker._id.toString() === nextBackup.worker.toString()
    );

    // Update booking with backup activation
    booking.worker = nextBackup.worker;
    booking.assignmentMethod = 'backup-activated';
    
    // Track backup activation
    if (!booking.backupActivations) {
      booking.backupActivations = [];
    }
    
    booking.backupActivations.push({
      previousWorker: booking.worker,
      backupWorker: nextBackup.worker,
      activatedAt: new Date(),
      reason,
      backupPriority: nextBackup.priority
    });

    await booking.save();

    console.log(`✅ Backup worker activated: ${backupWorkerData.worker.name}`);

    // TODO: Send notifications to new worker and customer

    return {
      success: true,
      backupWorker: nextBackup.worker,
      priority: nextBackup.priority,
      reason
    };

  } catch (error) {
    console.error('❌ Backup activation failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Check if backup activation is needed
 * 
 * @param {Object} booking - Booking document
 * @returns {Object} Check result
 */
export const checkBackupActivationNeeded = async (booking) => {
  try {
    const reasons = [];

    // Check 1: Primary worker unavailable
    const worker = await User.findById(booking.worker);
    if (!worker || !worker.isActive || !worker.workerProfile?.availability) {
      reasons.push('Primary worker unavailable');
    }

    // Check 2: Primary worker on emergency leave
    if (worker && isWorkerOnLeave(worker, booking.bookingDate)) {
      reasons.push('Primary worker on emergency leave');
    }

    // Check 3: Primary worker running late (>15 minutes)
    if (booking.status === 'confirmed' && booking.workerArrivalTime) {
      const scheduledTime = new Date(`${booking.bookingDate}T${booking.startTime}`);
      const arrivalTime = new Date(booking.workerArrivalTime);
      const delayMinutes = (arrivalTime - scheduledTime) / (1000 * 60);
      
      if (delayMinutes > 15) {
        reasons.push(`Primary worker running late (${Math.floor(delayMinutes)} minutes)`);
      }
    }

    return {
      needsActivation: reasons.length > 0,
      reasons
    };

  } catch (error) {
    console.error('Error checking backup activation:', error);
    return {
      needsActivation: false,
      reasons: [],
      error: error.message
    };
  }
};
