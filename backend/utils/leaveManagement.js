/**
 * Leave Management Utilities
 * Handles proactive leave checking and booking reassignment
 */

import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { handleWorkerReassignment } from './preferenceAssignment.js';

/**
 * Check all approved leaves for upcoming dates and reassign bookings
 * This should be run as a daily cron job
 * @param {number} daysAhead - How many days to look ahead (default: 7)
 * @returns {Promise<Object>} Result summary
 */
export const checkUpcomingLeavesAndReassign = async (daysAhead = 7) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    // Find all workers with approved leaves in the date range
    const workers = await User.find({
      role: 'worker',
      'workerProfile.leaves.status': 'approved'
    }).select('_id name workerProfile.leaves');

    const reassignmentResults = [];
    let totalBookingsChecked = 0;
    let totalBookingsReassigned = 0;
    let totalBookingsCancelled = 0;

    for (const worker of workers) {
      const leaves = worker.workerProfile.leaves.filter(leave => {
        if (leave.status !== 'approved') return false;
        
        const leaveDate = new Date(leave.date);
        leaveDate.setHours(0, 0, 0, 0);
        
        return leaveDate >= today && leaveDate <= futureDate;
      });

      for (const leave of leaves) {
        const leaveDate = new Date(leave.date);
        leaveDate.setHours(0, 0, 0, 0);
        
        const nextDay = new Date(leaveDate);
        nextDay.setDate(nextDay.getDate() + 1);

        // Find all bookings for this worker on this leave date
        const bookings = await Booking.find({
          worker: worker._id,
          bookingDate: { $gte: leaveDate, $lt: nextDay },
          status: { $in: ['pending', 'confirmed'] }
        });

        totalBookingsChecked += bookings.length;

        for (const booking of bookings) {
          const result = await handleWorkerReassignment(
            booking._id,
            Booking,
            'worker-on-leave'
          );

          if (result.success) {
            totalBookingsReassigned++;
          } else if (result.bookingCancelled) {
            totalBookingsCancelled++;
          }

          reassignmentResults.push({
            bookingId: booking._id,
            workerId: worker._id,
            workerName: worker.name,
            leaveDate: leave.date,
            ...result
          });
        }
      }
    }

    return {
      success: true,
      summary: {
        totalBookingsChecked,
        totalBookingsReassigned,
        totalBookingsCancelled,
        daysChecked: daysAhead
      },
      details: reassignmentResults
    };
  } catch (error) {
    console.error('Check upcoming leaves error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Check if a worker will be on leave for a specific booking date
 * Use before assigning worker to a booking
 * @param {ObjectId} workerId - Worker ID
 * @param {Date} bookingDate - Booking date
 * @returns {Promise<Object>} Leave status
 */
export const checkWorkerLeaveForDate = async (workerId, bookingDate) => {
  try {
    const worker = await User.findById(workerId);
    if (!worker) {
      return {
        onLeave: false,
        reason: 'Worker not found'
      };
    }

    const bookingDateOnly = new Date(bookingDate);
    bookingDateOnly.setHours(0, 0, 0, 0);

    const approvedLeave = worker.workerProfile.leaves.find(leave => {
      if (leave.status !== 'approved') return false;
      
      const leaveDate = new Date(leave.date);
      leaveDate.setHours(0, 0, 0, 0);
      
      return leaveDate.getTime() === bookingDateOnly.getTime();
    });

    if (approvedLeave) {
      return {
        onLeave: true,
        leaveDetails: {
          date: approvedLeave.date,
          reason: approvedLeave.reason,
          approvedBy: approvedLeave.approvedBy
        }
      };
    }

    return {
      onLeave: false
    };
  } catch (error) {
    console.error('Check worker leave error:', error);
    return {
      onLeave: false,
      error: error.message
    };
  }
};

/**
 * Reset monthly leave counters for all workers
 * Should be run on the 1st of each month as a cron job
 * @returns {Promise<Object>} Reset result
 */
export const resetMonthlyLeaveCounters = async () => {
  try {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const workers = await User.find({ role: 'worker' });
    
    let resetCount = 0;
    
    for (const worker of workers) {
      const lastResetDate = worker.workerProfile.lastLeaveReset 
        ? new Date(worker.workerProfile.lastLeaveReset) 
        : null;
      
      const lastResetMonth = lastResetDate ? lastResetDate.getMonth() : -1;
      const lastResetYear = lastResetDate ? lastResetDate.getFullYear() : -1;
      
      // Reset if it's a new month
      if (lastResetMonth !== currentMonth || lastResetYear !== currentYear) {
        worker.workerProfile.leavesUsedThisMonth = 0;
        worker.workerProfile.lastLeaveReset = new Date();
        await worker.save();
        resetCount++;
      }
    }

    return {
      success: true,
      workersReset: resetCount,
      totalWorkers: workers.length
    };
  } catch (error) {
    console.error('Reset monthly leave counters error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get workers available for a specific date (excluding those on leave)
 * @param {Date} bookingDate - Date to check
 * @param {Object} filters - Additional filters (gender, location, etc.)
 * @returns {Promise<Array>} Available workers
 */
export const getAvailableWorkersExcludingLeaves = async (bookingDate, filters = {}) => {
  try {
    const bookingDateOnly = new Date(bookingDate);
    bookingDateOnly.setHours(0, 0, 0, 0);

    // Base query
    const query = {
      role: 'worker',
      isActive: true,
      'workerProfile.availability': true,
      ...filters
    };

    const workers = await User.find(query);

    // Filter out workers with approved leave on this date
    const availableWorkers = workers.filter(worker => {
      const hasLeave = worker.workerProfile.leaves.some(leave => {
        if (leave.status !== 'approved') return false;
        
        const leaveDate = new Date(leave.date);
        leaveDate.setHours(0, 0, 0, 0);
        
        return leaveDate.getTime() === bookingDateOnly.getTime();
      });

      return !hasLeave;
    });

    return availableWorkers;
  } catch (error) {
    console.error('Get available workers error:', error);
    return [];
  }
};

/**
 * Send notification to customers about worker reassignment due to leave
 * @param {ObjectId} bookingId - Booking ID
 * @param {Object} reassignmentDetails - Details of reassignment
 * @returns {Promise<boolean>} Success status
 */
export const notifyCustomerAboutLeaveReassignment = async (bookingId, reassignmentDetails) => {
  try {
    // This is a placeholder for notification logic
    // In production, this would:
    // 1. Send email to customer
    // 2. Send push notification
    // 3. Send SMS if configured
    // 4. Create in-app notification

    console.log(`📧 Notification: Booking ${bookingId} reassigned due to worker leave`);
    console.log('Reassignment details:', reassignmentDetails);

    // TODO: Implement actual notification service
    // - Email service integration
    // - SMS service integration
    // - Push notification service

    return true;
  } catch (error) {
    console.error('Send notification error:', error);
    return false;
  }
};

/**
 * Generate leave report for admin dashboard
 * @param {Date} startDate - Report start date
 * @param {Date} endDate - Report end date
 * @returns {Promise<Object>} Leave report
 */
export const generateLeaveReport = async (startDate, endDate) => {
  try {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const workers = await User.find({ role: 'worker' })
      .select('name email workerProfile.leaves workerProfile.monthlyLeaveQuota workerProfile.leavesUsedThisMonth');

    const report = {
      period: {
        start: startDate,
        end: endDate
      },
      summary: {
        totalWorkers: workers.length,
        totalLeavesTaken: 0,
        totalPendingRequests: 0,
        totalApprovedLeaves: 0,
        totalRejectedLeaves: 0,
        averageLeavesPerWorker: 0
      },
      workerDetails: [],
      topReasons: {}
    };

    workers.forEach(worker => {
      const leavesInPeriod = (worker.workerProfile.leaves || []).filter(leave => {
        const leaveDate = new Date(leave.date);
        return leaveDate >= start && leaveDate <= end;
      });

      if (leavesInPeriod.length > 0) {
        report.workerDetails.push({
          workerId: worker._id,
          workerName: worker.name,
          workerEmail: worker.email,
          leavesInPeriod: leavesInPeriod.length,
          leaveQuota: worker.workerProfile.monthlyLeaveQuota,
          leavesUsed: worker.workerProfile.leavesUsedThisMonth,
          leaves: leavesInPeriod
        });

        // Count reasons
        leavesInPeriod.forEach(leave => {
          if (leave.reason) {
            report.topReasons[leave.reason] = (report.topReasons[leave.reason] || 0) + 1;
          }
          
          if (leave.status === 'approved') report.summary.totalApprovedLeaves++;
          if (leave.status === 'rejected') report.summary.totalRejectedLeaves++;
          if (leave.status === 'pending') report.summary.totalPendingRequests++;
        });

        report.summary.totalLeavesTaken += leavesInPeriod.filter(l => l.status === 'approved').length;
      }
    });

    report.summary.averageLeavesPerWorker = (report.summary.totalLeavesTaken / workers.length).toFixed(2);

    // Sort top reasons
    report.topReasons = Object.entries(report.topReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .reduce((obj, [reason, count]) => ({ ...obj, [reason]: count }), {});

    return report;
  } catch (error) {
    console.error('Generate leave report error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  checkUpcomingLeavesAndReassign,
  checkWorkerLeaveForDate,
  resetMonthlyLeaveCounters,
  getAvailableWorkersExcludingLeaves,
  notifyCustomerAboutLeaveReassignment,
  generateLeaveReport
};
