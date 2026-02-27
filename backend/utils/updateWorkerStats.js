import Booking from '../models/Booking.js';
import User from '../models/User.js';

/**
 * Update worker's performance statistics after a booking is completed
 * @param {ObjectId} workerId - Worker's user ID
 * @param {Object} bookingData - Booking completion data
 */
export const updateWorkerStats = async (workerId, bookingData) => {
  try {
    const worker = await User.findById(workerId);
    if (!worker || worker.role !== 'worker') {
      console.log('Worker not found or invalid role');
      return;
    }

    const { rating, onTime, completed, bookingId } = bookingData;

    // Update rating if provided
    if (rating && rating >= 0 && rating <= 5) {
      const currentRating = worker.workerProfile?.rating || 0;
      const currentReviews = worker.workerProfile?.totalReviews || 0;
      
      // Calculate new average rating
      const totalRating = (currentRating * currentReviews) + rating;
      const newTotalReviews = currentReviews + 1;
      
      worker.workerProfile.rating = totalRating / newTotalReviews;
      worker.workerProfile.totalReviews = newTotalReviews;
      
      console.log(`Worker ${worker.name} rating updated: ${worker.workerProfile.rating.toFixed(2)} (${newTotalReviews} reviews)`);
    }

    // Update completion rate
    if (completed !== undefined) {
      const totalCompleted = await Booking.countDocuments({
        worker: workerId,
        status: 'completed'
      });
      
      const totalBookings = await Booking.countDocuments({
        worker: workerId,
        status: { $in: ['completed', 'cancelled'] }
      });
      
      if (totalBookings > 0) {
        worker.workerProfile.completionRate = (totalCompleted / totalBookings) * 100;
        worker.workerProfile.totalBookingsCompleted = totalCompleted;
        console.log(`Worker ${worker.name} completion rate: ${worker.workerProfile.completionRate.toFixed(1)}%`);
      }
    }

    // Update on-time arrival rate
    if (onTime !== undefined) {
      // Count bookings where worker arrived on time
      const onTimeBookings = await Booking.countDocuments({
        worker: workerId,
        status: 'completed',
        workerArrivalTime: { $exists: true },
        $expr: {
          $lte: [
            { $subtract: ['$workerArrivalTime', '$bookingDate'] },
            15 * 60 * 1000 // 15 minutes in milliseconds
          ]
        }
      });
      
      const completedBookings = await Booking.countDocuments({
        worker: workerId,
        status: 'completed',
        workerArrivalTime: { $exists: true }
      });
      
      if (completedBookings > 0) {
        worker.workerProfile.onTimeArrivalRate = (onTimeBookings / completedBookings) * 100;
        console.log(`Worker ${worker.name} on-time rate: ${worker.workerProfile.onTimeArrivalRate.toFixed(1)}%`);
      }
    }

    await worker.save();
    console.log(`✅ Worker stats updated successfully for ${worker.name}`);
    
    return {
      success: true,
      rating: worker.workerProfile.rating,
      totalReviews: worker.workerProfile.totalReviews,
      completionRate: worker.workerProfile.completionRate,
      onTimeArrivalRate: worker.workerProfile.onTimeArrivalRate
    };
  } catch (error) {
    console.error('Error updating worker stats:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if worker arrived on time for a booking
 * @param {Object} booking - Booking document
 * @returns {boolean} - True if on time (within 15 minutes)
 */
export const checkIfOnTime = (booking) => {
  if (!booking.workerArrivalTime || !booking.bookingDate || !booking.startTime) {
    return null;
  }

  // Create scheduled start time
  const scheduledStart = new Date(booking.bookingDate);
  const [hours, minutes] = booking.startTime.split(':');
  scheduledStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  // Calculate delay in minutes
  const arrivalTime = new Date(booking.workerArrivalTime);
  const delayMs = arrivalTime - scheduledStart;
  const delayMinutes = Math.floor(delayMs / 60000);

  // On time if arrived within 15 minutes of scheduled time
  return delayMinutes <= 15;
};

/**
 * Get worker performance summary
 * @param {ObjectId} workerId - Worker's user ID
 */
export const getWorkerPerformance = async (workerId) => {
  try {
    const worker = await User.findById(workerId).select('name workerProfile');
    if (!worker) {
      return null;
    }

    const totalBookings = await Booking.countDocuments({
      worker: workerId
    });

    const completedBookings = await Booking.countDocuments({
      worker: workerId,
      status: 'completed'
    });

    const ratedBookings = await Booking.countDocuments({
      worker: workerId,
      rating: { $exists: true, $ne: null }
    });

    const avgRatingResult = await Booking.aggregate([
      { $match: { worker: workerId, rating: { $exists: true, $ne: null } } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);

    return {
      name: worker.name,
      profileRating: worker.workerProfile?.rating || 0,
      totalReviews: worker.workerProfile?.totalReviews || 0,
      completionRate: worker.workerProfile?.completionRate || 0,
      onTimeArrivalRate: worker.workerProfile?.onTimeArrivalRate || 0,
      totalBookings,
      completedBookings,
      ratedBookings,
      avgRatingFromBookings: avgRatingResult[0]?.avgRating || 0
    };
  } catch (error) {
    console.error('Error getting worker performance:', error);
    return null;
  }
};

export default { updateWorkerStats, checkIfOnTime, getWorkerPerformance };
