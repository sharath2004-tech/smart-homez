import Booking from '../models/Booking.js';
import Location from '../models/Location.js';
import User from '../models/User.js';
import { checkSlotAvailability } from './slotManagement.js';
import { isWorkerAvailableForTimeRange, isWorkerEligibleForAssignment } from './workerAvailability.js';

/**
 * Worker Assignment Algorithm
 * Center point = super-admin-added Location document coordinates
 * Radius       = service.workerSearchRadiusKm
 */

/**
 * Calculate distance between two points using Haversine formula
 * @returns {Number} Distance in kilometers
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
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
 * Calculate worker assignment score
 * Higher score = better candidate
 * @param {Number} locationDistance - km from Location center to customer
 */
const calculateWorkerScore = (worker, booking, locationDistance = null) => {
  let score = 0;
  const weights = {
    rating: 25,
    availability: 20,
    distance: 20,
    leaveStatus: 15,
    completionRate: 12,
    onTimeRate: 8
  };

  // 1. Rating score (0-25 points)
  if (worker.workerProfile?.rating) {
    score += (worker.workerProfile.rating / 5) * weights.rating;
  }

  // 2. Availability score (0-20 points)
  if (worker.workerProfile?.availability) {
    score += weights.availability;
  }

  // 3. Distance score (0-20 points) — distance from Location center to customer
  if (locationDistance !== null) {
    const maxDistance = booking?.service?.workerSearchRadiusKm || 10;
    const distanceScore = Math.max(0, 1 - (locationDistance / maxDistance));
    score += distanceScore * weights.distance;
  }

  // 4. Leave status (0-15 points)
  const leavesUsed = worker.workerProfile?.leavesUsedThisMonth || 0;
  const leaveQuota = worker.workerProfile?.monthlyLeaveQuota || 2;
  score += Math.max(0, (1 - leavesUsed / leaveQuota) * weights.leaveStatus);

  // 5. Completion rate (0-12 points)
  if (worker.workerProfile?.completionRate) {
    score += (worker.workerProfile.completionRate / 100) * weights.completionRate;
  }

  // 6. On-time arrival rate (0-8 points)
  if (worker.workerProfile?.onTimeArrivalRate) {
    score += (worker.workerProfile.onTimeArrivalRate / 100) * weights.onTimeRate;
  }

  return score;
};

/**
 * Find best available workers for a booking.
 *
 * Radius check uses the super-admin Location document as the center point,
 * NOT the worker's current GPS position.
 *
 * Flow:
 *  1. Convert service radius to meters.
 *  2. Find Location docs whose center is within that radius of the customer.
 *  3. Collect workers assigned to those locations.
 *  4. Filter: online, within leave quota.
 *  5. Score by (rating, distance-from-location-center, leaves, completion, on-time).
 *  6. Penalise by concurrent bookings, return top N.
 */
export const findBestWorkers = async (bookingDetails, count = 3) => {
  try {
    const { _id, service, bookingDate, startTime, endTime, location } = bookingDetails;
    const serviceRadiusKm = service?.workerSearchRadiusKm || 50;
    const serviceRadiusMeters = serviceRadiusKm * 1000;

    console.log(`📏 Service radius: ${serviceRadiusKm}km (service: ${service?.name || 'unknown'})`);

    // ── 1. Customer coordinates ───────────────────────────────────────────────
    const customerLng = location?.coordinates?.[0]; // GeoJSON: [lng, lat]
    const customerLat = location?.coordinates?.[1];

    console.log(`📍 Customer location: ${customerLat != null ? `${customerLat}, ${customerLng}` : 'Not provided'}`);

    // ── 2. Find Location documents within service radius of customer ──────────
    let nearbyLocations = [];
    let eligibleWorkerIds = null; // null = no location filter (fallback)

    if (customerLat != null && customerLng != null) {
      nearbyLocations = await Location.find({
        isActive: true,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [customerLng, customerLat] },
            $maxDistance: serviceRadiusMeters
          }
        }
      }).select('_id apartmentName location assignedWorkers maxServiceRadius');

      console.log(`🏢 ${nearbyLocations.length} Location(s) within ${serviceRadiusKm}km of customer`);
      nearbyLocations.forEach(loc => {
        const locLat = loc.location?.coordinates?.[1];
        const locLng = loc.location?.coordinates?.[0];
        const dist = locLat != null
          ? calculateDistance(customerLat, customerLng, locLat, locLng).toFixed(2)
          : '?';
        console.log(`   📌 ${loc.apartmentName} — ${dist}km away, ${loc.assignedWorkers?.length || 0} worker(s)`);
      });

      if (nearbyLocations.length === 0) {
        throw new Error(`No service locations found within ${serviceRadiusKm}km of the booking address. Service is not available in this area yet.`);
      }

      // Collect all worker IDs from those locations
      eligibleWorkerIds = nearbyLocations.flatMap(loc =>
        (loc.assignedWorkers || []).map(aw => aw.worker)
      );

      console.log(`👷 ${eligibleWorkerIds.length} worker(s) assigned to nearby locations`);

      if (eligibleWorkerIds.length === 0) {
        throw new Error('No workers are assigned to any location in this area. Please contact support.');
      }
    } else {
      console.warn('⚠️ No customer coordinates — skipping location-based filter, using all workers');
    }

    // ── 3. Fetch candidate workers ────────────────────────────────────────────
    const query = { role: 'worker', isActive: true };

    if (service?.category) {
      query['workerProfile.specialization'] = { $in: [service.category] };
    }

    if (eligibleWorkerIds !== null) {
      query['_id'] = { $in: eligibleWorkerIds };
    }

    console.log('🔍 Worker query:', JSON.stringify(query));

    let workers = await User.find(query).select(
      'name email phone workerProfile currentLocation addresses'
    );

    console.log(`📊 ${workers.length} worker(s) matching base criteria`);

    // Retry without specialization filter if nothing found
    if (workers.length === 0 && service?.category) {
      console.log('⚠️ No workers with matching specialization, retrying without it...');
      delete query['workerProfile.specialization'];
      workers = await User.find(query).select(
        'name email phone workerProfile currentLocation addresses'
      );
      console.log(`📊 ${workers.length} worker(s) without specialization filter`);
    }

    if (workers.length === 0) {
      throw new Error('No workers available in this area for the selected service.');
    }

    // ── 4. Online filter ───────────────────────────────────────────────────────
    const onlineWorkers = workers.filter((worker) => {
      const eligibility = isWorkerEligibleForAssignment(worker);
      if (!eligibility.eligible) {
        return false;
      }

      return worker.workerProfile?.availability === true;
    });
    console.log(`✅ ${onlineWorkers.length} ONLINE / ${workers.length - onlineWorkers.length} OFFLINE`);

    if (onlineWorkers.length === 0) {
      throw new Error('No workers are currently online in this area. Please try again later.');
    }

    // ── 5. Leave-quota filter ─────────────────────────────────────────────────
    const eligibleByLeave = onlineWorkers.filter(worker => {
      const leavesUsed = worker.workerProfile?.leavesUsedThisMonth || 0;
      const leaveQuota = worker.workerProfile?.monthlyLeaveQuota || 2;
      return leavesUsed < leaveQuota;
    });

    if (eligibleByLeave.length === 0) {
      console.warn('⚠️ All workers exhausted leaves — using all online workers by rating');
    }

    const workersToCheck = eligibleByLeave.length > 0 ? eligibleByLeave : onlineWorkers;
    console.log(`🎯 Checking ${workersToCheck.length} worker(s) for slot availability and score`);

    const workersToScore = [];
    for (const worker of workersToCheck) {
      const timeRangeAvailability = isWorkerAvailableForTimeRange(
        worker,
        bookingDate,
        startTime,
        endTime
      );

      if (!timeRangeAvailability.available) {
        continue;
      }

      if (bookingDate && startTime && endTime) {
        const slotAvailability = await checkSlotAvailability(
          worker._id,
          bookingDate,
          startTime,
          endTime,
          Booking,
          15,
          _id || null
        );

        if (!slotAvailability.available) {
          continue;
        }
      }

      workersToScore.push(worker);
    }

    console.log(`🗓️ ${workersToScore.length} worker(s) remain after slot conflict filtering`);

    if (workersToScore.length === 0) {
      throw new Error('No workers available for the selected date and time slot.');
    }

    // ── 6. Build location-to-customer distance map ────────────────────────────
    // key: workerId string → distance (km) from their assigned Location center to customer
    const workerLocationDistanceMap = new Map();

    if (customerLat != null && nearbyLocations.length > 0) {
      for (const loc of nearbyLocations) {
        const locLat = loc.location?.coordinates?.[1];
        const locLng = loc.location?.coordinates?.[0];
        if (locLat == null) continue;

        const dist = calculateDistance(customerLat, customerLng, locLat, locLng);

        for (const aw of (loc.assignedWorkers || [])) {
          const wid = aw.worker?.toString();
          if (!wid) continue;
          // Keep the shortest distance if a worker is in multiple nearby locations
          if (!workerLocationDistanceMap.has(wid) || dist < workerLocationDistanceMap.get(wid)) {
            workerLocationDistanceMap.set(wid, dist);
          }
        }
      }
    }

    // ── 7. Score workers ──────────────────────────────────────────────────────
    const workersWithScores = workersToScore.map(worker => {
      const locationDistance = workerLocationDistanceMap.get(worker._id.toString()) ?? null;
      return {
        worker,
        distance: locationDistance,
        score: calculateWorkerScore(worker, bookingDetails, locationDistance)
      };
    });

    // ── 8. Workload check ─────────────────────────────────────────────────────
    const bookingTime = new Date(bookingDate);
    const workloadPromises = workersWithScores.map(async ({ worker, score, distance }) => {
      const concurrentBookings = await Booking.countDocuments({
        worker: worker._id,
        _id: { $ne: _id || null },
        bookingDate: {
          $gte: new Date(bookingTime.getTime() - 2 * 60 * 60 * 1000),
          $lte: new Date(bookingTime.getTime() + 2 * 60 * 60 * 1000)
        },
        status: { $in: ['confirmed', 'in-progress'] }
      });

      return {
        workerId: worker._id,
        worker,
        distance,
        score: Math.max(0, score - concurrentBookings * 5),
        concurrentBookings
      };
    });

    const workersWithWorkload = await Promise.all(workloadPromises);
    workersWithWorkload.sort((a, b) => b.score - a.score);

    console.log('🏆 Top workers by score:');
    workersWithWorkload.slice(0, 5).forEach((w, i) => {
      console.log(
        `  ${i + 1}. ${w.worker.name} — Score: ${w.score.toFixed(2)},` +
        ` Location→Customer: ${w.distance != null ? w.distance.toFixed(2) + 'km' : 'N/A'},` +
        ` Concurrent: ${w.concurrentBookings}`
      );
    });

    const selectedWorkers = workersWithWorkload.slice(0, count);
    console.log(`✅ Returning ${selectedWorkers.length} worker(s) for assignment`);

    return selectedWorkers;

  } catch (error) {
    console.error('Error in findBestWorkers:', error);
    throw error;
  }
};

/**
 * Assign worker to booking
 */
export const assignWorkerToBooking = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId).populate('service');

    if (!booking) throw new Error('Booking not found');
    if (booking.worker) throw new Error('Worker already assigned to this booking');

    const bestWorkers = await findBestWorkers(booking, 3);
    if (bestWorkers.length === 0) throw new Error('No suitable workers found');

    booking.worker = bestWorkers[0].workerId;
    booking.assignedAt = new Date();
    booking.assignmentMethod = 'auto';

    if (booking.status === 'pending') {
      booking.status = 'confirmed';
    }

    if (bestWorkers.length > 1) {
      booking.backupWorkers = bestWorkers.slice(1).map((w, index) => ({
        worker: w.workerId,
        assignedAt: new Date(),
        priority: index + 1
      }));
    }

    await booking.save();

    return await Booking.findById(bookingId)
      .populate('customer', 'name email phone')
      .populate('worker', 'name email phone workerProfile')
      .populate('service');

  } catch (error) {
    console.error('Error in assignWorkerToBooking:', error);
    throw error;
  }
};

/**
 * Reassign worker if primary worker is unavailable
 */
export const reassignWorker = async (bookingId, reason) => {
  try {
    const booking = await Booking.findById(bookingId).populate('service');
    if (!booking) throw new Error('Booking not found');

    // Try backup workers first
    if (booking.backupWorkers?.length > 0) {
      const backupWorker = booking.backupWorkers[0];
      const worker = await User.findById(backupWorker.worker);
      const eligibility = isWorkerEligibleForAssignment(worker);
      const timeRangeAvailability = worker
        ? isWorkerAvailableForTimeRange(worker, booking.bookingDate, booking.startTime, booking.endTime)
        : { available: false };

      if (worker && eligibility.eligible && timeRangeAvailability.available && worker.workerProfile?.availability) {
        booking.worker = backupWorker.worker;
        booking.backupWorkers = booking.backupWorkers.slice(1);
        booking.assignedAt = new Date();
        booking.notes = `${booking.notes}\nReassigned: ${reason}`;
        await booking.save();
        return await Booking.findById(bookingId)
          .populate('worker', 'name email phone workerProfile');
      }
    }

    // Find new workers via location-based search
    const bestWorkers = await findBestWorkers(booking, 3);
    if (bestWorkers.length === 0) throw new Error('No workers available for reassignment');

    booking.worker = bestWorkers[0].workerId;
    booking.assignedAt = new Date();
    booking.assignmentMethod = 'auto';
    booking.notes = `${booking.notes}\nReassigned: ${reason} at ${new Date().toISOString()}`;

    if (bestWorkers.length > 1) {
      booking.backupWorkers = bestWorkers.slice(1).map((w, index) => ({
        worker: w.workerId,
        assignedAt: new Date(),
        priority: index + 1
      }));
    }

    await booking.save();

    return await Booking.findById(bookingId)
      .populate('worker', 'name email phone workerProfile');

  } catch (error) {
    console.error('Error in reassignWorker:', error);
    throw error;
  }
};

/**
 * Reset monthly leaves for all workers (cron job)
 */
export const resetMonthlyLeaves = async () => {
  try {
    const result = await User.updateMany(
      { role: 'worker' },
      { $set: { 'workerProfile.leavesUsedThisMonth': 0, 'workerProfile.lastLeaveReset': new Date() } }
    );
    console.log(`Reset leaves for ${result.modifiedCount} workers`);
    return result;
  } catch (error) {
    console.error('Error in resetMonthlyLeaves:', error);
    throw error;
  }
};

/**
 * Reset daily working hours for all workers (cron job)
 */
export const resetDailyWorkingHours = async () => {
  try {
    const result = await User.updateMany(
      { role: 'worker' },
      { $set: { 'workerProfile.workingHoursToday': 0, 'workerProfile.lastWorkingHoursReset': new Date() } }
    );
    console.log(`Reset working hours for ${result.modifiedCount} workers`);
    return result;
  } catch (error) {
    console.error('Error in resetDailyWorkingHours:', error);
    throw error;
  }
};

export default {
  findBestWorkers,
  assignWorkerToBooking,
  reassignWorker,
  resetMonthlyLeaves,
  resetDailyWorkingHours
};
