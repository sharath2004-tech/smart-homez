import Booking from '../models/Booking.js';
import User from '../models/User.js';

/**
 * Worker Assignment Algorithm based on BRD requirements
 * Considers: leaves, ratings, availability, proximity, workload
 */

/**
 * Calculate distance between two points using Haversine formula
 * @param {Number} lat1 - Latitude of point 1
 * @param {Number} lng1 - Longitude of point 1
 * @param {Number} lat2 - Latitude of point 2
 * @param {Number} lng2 - Longitude of point 2
 * @returns {Number} - Distance in kilometers
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
 * Calculate worker assignment score
 * Higher score = better candidate
 */
const calculateWorkerScore = (worker, booking, distance = null) => {
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

  // 3. Distance score (0-20 points) - closer is better
  if (distance !== null) {
    // Workers within 5km get full points, beyond that decreases linearly
    const maxDistance = 10; // km
    const distanceScore = Math.max(0, 1 - (distance / maxDistance));
    score += distanceScore * weights.distance;
  }

  // 4. Leave status (0-15 points)
  const leavesUsed = worker.workerProfile?.leavesUsedThisMonth || 0;
  const leaveQuota = worker.workerProfile?.monthlyLeaveQuota || 2;
  const leaveRatio = 1 - (leavesUsed / leaveQuota);
  score += Math.max(0, leaveRatio * weights.leaveStatus);

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
 * Find best available workers for a booking
 * @param {Object} bookingDetails - Booking details
 * @param {Number} count - Number of workers to return (1 primary + backups)
 * @returns {Array} - Array of worker IDs sorted by score
 */
export const findBestWorkers = async (bookingDetails, count = 3) => {
  try {
    const { service, bookingDate, location } = bookingDetails;

    // Build query for available workers
    const query = {
      role: 'worker',
      isActive: true
    };

    // Filter by service specialization if provided (specialization is an array)
    if (service?.category) {
      query['workerProfile.specialization'] = { $in: [service.category] };
    }

    console.log('🔍 Finding workers with query:', JSON.stringify(query));

    // Get all potential workers with location data
    let workers = await User.find(query).select(
      'name email phone workerProfile currentLocation addresses'
    );

    console.log(`📊 Found ${workers.length} workers matching base criteria`);

    // If no workers found with specialization, try without that filter
    if (workers.length === 0 && service?.category) {
      console.log('⚠️ No workers found with specialization, trying all workers...');
      delete query['workerProfile.specialization'];
      workers = await User.find(query).select(
        'name email phone workerProfile currentLocation addresses'
      );
      console.log(`📊 Found ${workers.length} workers without specialization filter`);
    }

    if (workers.length === 0) {
      throw new Error('No available workers found');
    }

    // Filter by availability (prefer available, but include unavailable as backup)
    const availableWorkers = workers.filter(w => w.workerProfile?.availability === true);
    const unavailableWorkers = workers.filter(w => w.workerProfile?.availability !== true);
    
    console.log(`✅ ${availableWorkers.length} available workers, ⏸️ ${unavailableWorkers.length} unavailable workers`);

    // Extract customer location from booking
    const customerLat = location?.coordinates?.[1]; // [lng, lat] format
    const customerLng = location?.coordinates?.[0];

    console.log(`📍 Customer location: ${customerLat ? `${customerLat}, ${customerLng}` : 'Not provided'}`);

    // Prioritize available workers, but include unavailable as backup
    const prioritizedWorkers = [...availableWorkers, ...unavailableWorkers];

    // Check if workers have reached leave limit
    const eligibleWorkers = prioritizedWorkers.filter(worker => {
      const leavesUsed = worker.workerProfile?.leavesUsedThisMonth || 0;
      const leaveQuota = worker.workerProfile?.monthlyLeaveQuota || 2;
      return leavesUsed < leaveQuota; // Can still work if under quota
    });

    if (eligibleWorkers.length === 0) {
      // If all workers exhausted leaves, use all workers but prioritize by rating
      console.warn('⚠️ All workers have exhausted leaves, using rating priority');
    }

    const workersToScore = eligibleWorkers.length > 0 ? eligibleWorkers : prioritizedWorkers;
    console.log(`🎯 Scoring ${workersToScore.length} workers for assignment`);

    // Calculate distance and scores for each worker
    const workersWithScores = workersToScore
      .map(worker => {
        let distance = null;
        
        // Get worker location from multiple possible sources
        const workerLat = worker.currentLocation?.coordinates?.[1] 
          || worker.addresses?.[0]?.location?.coordinates?.[1]
          || worker.workerProfile?.assignedApartments?.[0]?.location?.coordinates?.[1];
          
        const workerLng = worker.currentLocation?.coordinates?.[0] 
          || worker.addresses?.[0]?.location?.coordinates?.[0]
          || worker.workerProfile?.assignedApartments?.[0]?.location?.coordinates?.[0];
        
        // Calculate distance if both locations available
        if (customerLat && customerLng && workerLat && workerLng) {
          distance = calculateDistance(customerLat, customerLng, workerLat, workerLng);
        }
        
        return {
          worker,
          distance,
          score: calculateWorkerScore(worker, bookingDetails, distance)
        };
      })
      .filter(({ worker, distance }) => {
        // Filter out workers beyond maximum service radius (50km - more lenient for service availability)
        if (distance === null) {
          console.log(`ℹ️ Worker ${worker.name} has no location data, including anyway`);
          return true; // Include workers without location data
        }
        
        const maxRadius = 50; // Increased from 10km to 50km for better availability
        const isWithinRadius = distance <= maxRadius;
        
        if (!isWithinRadius) {
          console.log(`❌ Worker ${worker.name} too far: ${distance.toFixed(2)}km (max ${maxRadius}km)`);
        } else {
          console.log(`✅ Worker ${worker.name} within range: ${distance.toFixed(2)}km`);
        }
        
        return isWithinRadius;
      });

    console.log(`🔧 ${workersWithScores.length} workers passed distance filter`);

    if (workersWithScores.length === 0) {
      throw new Error('No workers found within service radius or matching criteria');
    }

    // Check current workload (concurrent bookings)
    const bookingTime = new Date(bookingDate);
    const workloadPromises = workersWithScores.map(async ({ worker, score, distance }) => {
      const concurrentBookings = await Booking.countDocuments({
        worker: worker._id,
        bookingDate: {
          $gte: new Date(bookingTime.getTime() - 2 * 60 * 60 * 1000), // 2 hours before
          $lte: new Date(bookingTime.getTime() + 2 * 60 * 60 * 1000)  // 2 hours after
        },
        status: { $in: ['confirmed', 'in-progress'] }
      });

      // Reduce score if worker has concurrent bookings
      const workloadPenalty = concurrentBookings * 5;
      
      return {
        workerId: worker._id,
        worker,
        distance,
        score: Math.max(0, score - workloadPenalty),
        concurrentBookings
      };
    });

    const workersWithWorkload = await Promise.all(workloadPromises);

    // Sort by score (highest first)
    workersWithWorkload.sort((a, b) => b.score - a.score);

    console.log('🏆 Top workers by score:');
    workersWithWorkload.slice(0, 5).forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.worker.name} - Score: ${w.score.toFixed(2)}, Distance: ${w.distance ? w.distance.toFixed(2) + 'km' : 'N/A'}, Concurrent: ${w.concurrentBookings}`);
    });

    // Return top N workers
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
 * @param {String} bookingId - Booking ID
 * @returns {Object} - Updated booking with assigned worker
 */
export const assignWorkerToBooking = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId).populate('service');
    
    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.worker) {
      throw new Error('Worker already assigned to this booking');
    }

    // Find best workers (1 primary + 2 backup)
    const bestWorkers = await findBestWorkers(booking, 3);

    if (bestWorkers.length === 0) {
      throw new Error('No suitable workers found');
    }

    // Assign primary worker
    booking.worker = bestWorkers[0].workerId;
    booking.assignedAt = new Date();
    booking.assignmentMethod = 'auto';
    
    // Auto-confirm booking when worker is assigned
    if (booking.status === 'pending') {
      booking.status = 'confirmed';
    }

    // Assign backup workers
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
    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Try backup workers first
    if (booking.backupWorkers && booking.backupWorkers.length > 0) {
      const backupWorker = booking.backupWorkers[0];
      
      // Check if backup worker is still available and active
      const worker = await User.findById(backupWorker.worker);
      if (worker && worker.isActive && worker.workerProfile?.availability) {
        booking.worker = backupWorker.worker;
        booking.backupWorkers = booking.backupWorkers.slice(1);
        booking.assignedAt = new Date();
        booking.notes = `${booking.notes}\nReassigned: ${reason}`;
        await booking.save();
        
        return await Booking.findById(bookingId)
          .populate('worker', 'name email phone workerProfile');
      }
    }

    // If no backup available, find new workers
    const bestWorkers = await findBestWorkers(booking, 3);
    
    if (bestWorkers.length === 0) {
      throw new Error('No workers available for reassignment');
    }

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
 * Reset monthly leaves for all workers (to be run monthly via cron)
 */
export const resetMonthlyLeaves = async () => {
  try {
    const result = await User.updateMany(
      { role: 'worker' },
      {
        $set: {
          'workerProfile.leavesUsedThisMonth': 0,
          'workerProfile.lastLeaveReset': new Date()
        }
      }
    );

    console.log(`Reset leaves for ${result.modifiedCount} workers`);
    return result;
  } catch (error) {
    console.error('Error in resetMonthlyLeaves:', error);
    throw error;
  }
};

/**
 * Reset daily working hours for all workers (to be run daily via cron)
 */
export const resetDailyWorkingHours = async () => {
  try {
    const result = await User.updateMany(
      { role: 'worker' },
      {
        $set: {
          'workerProfile.workingHoursToday': 0,
          'workerProfile.lastWorkingHoursReset': new Date()
        }
      }
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
