/**
 * Worker Pool Management System
 * 
 * REQ-B-003: Worker Pool Management
 * - Maintain 2 backup workers per 10 active workers
 * - Dynamic pool adjustment based on:
 *   - Time of day
 *   - Day of week
 *   - Seasonal demand
 *   - Historical booking patterns
 * - Real-time worker capacity monitoring
 */

import Booking from '../models/Booking.js';
import User from '../models/User.js';

/**
 * Get current hour and determine peak time
 */
const getPeakTimeMultiplier = () => {
  const hour = new Date().getHours();
  
  // Peak hours: 8 AM - 12 PM and 4 PM - 8 PM
  if ((hour >= 8 && hour < 12) || (hour >= 16 && hour < 20)) {
    return 1.5; // 50% more capacity needed during peak
  }
  
  // Off-peak hours: 12 PM - 4 PM
  if (hour >= 12 && hour < 16) {
    return 1.2; // 20% more capacity
  }
  
  // Early morning / late evening
  return 0.8; // 20% less capacity needed
};

/**
 * Get day of week multiplier
 */
const getDayOfWeekMultiplier = () => {
  const day = new Date().getDay();
  
  // Weekend (Saturday = 6, Sunday = 0)
  if (day === 0 || day === 6) {
    return 1.8; // 80% more capacity on weekends
  }
  
  // Friday
  if (day === 5) {
    return 1.4; // 40% more capacity on Friday
  }
  
  // Monday-Thursday
  return 1.0;
};

/**
 * Get seasonal multiplier
 */
const getSeasonalMultiplier = () => {
  const month = new Date().getMonth() + 1; // 1-12
  
  // Peak Season: March-May (Spring Cleaning), November-December (Holiday)
  if ((month >= 3 && month <= 5) || (month >= 11 && month <= 12)) {
    return 1.5; // 50% more capacity
  }
  
  // Monsoon Season: June-September (slightly less demand)
  if (month >= 6 && month <= 9) {
    return 0.9; // 10% less capacity
  }
  
  // Regular season
  return 1.0;
};

/**
 * Calculate required worker pool size
 * 
 * @param {Number} activeBookings - Current active bookings
 * @param {Number} totalWorkers - Total workers in system
 * @returns {Object} Pool size recommendations
 */
export const calculateRequiredPoolSize = (activeBookings, totalWorkers) => {
  // Base requirement: 2 backup workers per 10 active workers
  const baseBackupRatio = 0.2; // 20% (2 per 10)
  
  // Apply multipliers
  const peakMultiplier = getPeakTimeMultiplier();
  const dayMultiplier = getDayOfWeekMultiplier();
  const seasonMultiplier = getSeasonalMultiplier();
  
  // Combined multiplier
  const combinedMultiplier = peakMultiplier * dayMultiplier * seasonMultiplier;
  
  // Calculate required pool
  const requiredActiveWorkers = Math.ceil(activeBookings * 1.1); // 10% buffer
  const requiredBackupWorkers = Math.ceil(requiredActiveWorkers * baseBackupRatio * combinedMultiplier);
  const totalRequired = requiredActiveWorkers + requiredBackupWorkers;
  
  return {
    activeWorkers: requiredActiveWorkers,
    backupWorkers: requiredBackupWorkers,
    totalRequired,
    currentTotal: totalWorkers,
    shortage: Math.max(0, totalRequired - totalWorkers),
    surplus: Math.max(0, totalWorkers - totalRequired),
    multipliers: {
      peak: peakMultiplier,
      day: dayMultiplier,
      season: seasonMultiplier,
      combined: combinedMultiplier
    }
  };
};

/**
 * Get real-time worker capacity status
 * 
 * @returns {Object} Capacity metrics
 */
export const getWorkerCapacityStatus = async () => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Get all active workers
    const totalWorkers = await User.countDocuments({
      role: 'worker',
      isActive: true
    });
    
    // Get available workers (not on leave, available status)
    const availableWorkers = await User.countDocuments({
      role: 'worker',
      isActive: true,
      'workerProfile.availability': true
    });
    
    // Get workers on leave today
    const workersOnLeave = await User.countDocuments({
      role: 'worker',
      isActive: true,
      'workerProfile.leaves': {
        $elemMatch: {
          date: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
          },
          status: 'approved'
        }
      }
    });
    
    // Get current active bookings
    const activeBookings = await Booking.countDocuments({
      bookingDate: { $gte: today },
      status: { $in: ['confirmed', 'in-progress'] }
    });
    
    // Get pending bookings (need assignment)
    const pendingBookings = await Booking.countDocuments({
      bookingDate: { $gte: today },
      status: 'pending',
      worker: { $exists: false }
    });
    
    // Calculate worker utilization
    const utilizationRate = totalWorkers > 0 
      ? ((activeBookings / totalWorkers) * 100).toFixed(2)
      : 0;
    
    // Get capacity per worker (average bookings per worker today)
    const avgBookingsPerWorker = totalWorkers > 0
      ? (activeBookings / totalWorkers).toFixed(2)
      : 0;
    
    // Calculate pool requirements
    const poolRequirements = calculateRequiredPoolSize(activeBookings, totalWorkers);
    
    // Determine capacity status
    let status = 'optimal';
    if (poolRequirements.shortage > 0) {
      status = 'understaffed';
    } else if (utilizationRate > 80) {
      status = 'high-utilization';
    } else if (utilizationRate < 30) {
      status = 'overstaffed';
    }
    
    return {
      timestamp: now,
      workers: {
        total: totalWorkers,
        available: availableWorkers,
        onLeave: workersOnLeave,
        unavailable: totalWorkers - availableWorkers
      },
      bookings: {
        active: activeBookings,
        pending: pendingBookings,
        avgPerWorker: parseFloat(avgBookingsPerWorker)
      },
      capacity: {
        utilizationRate: parseFloat(utilizationRate),
        status,
        poolRequirements
      },
      recommendations: generateRecommendations(poolRequirements, utilizationRate, pendingBookings)
    };
    
  } catch (error) {
    console.error('Error getting worker capacity status:', error);
    throw error;
  }
};

/**
 * Generate recommendations based on capacity status
 */
const generateRecommendations = (poolRequirements, utilizationRate, pendingBookings) => {
  const recommendations = [];
  
  // Check staffing levels
  if (poolRequirements.shortage > 5) {
    recommendations.push({
      priority: 'high',
      type: 'staffing',
      message: `Critical shortage: Need ${poolRequirements.shortage} more workers`,
      action: 'Recruit or activate backup workers immediately'
    });
  } else if (poolRequirements.shortage > 0) {
    recommendations.push({
      priority: 'medium',
      type: 'staffing',
      message: `Minor shortage: Need ${poolRequirements.shortage} more workers`,
      action: 'Consider recruiting or activating backup workers'
    });
  }
  
  // Check utilization
  if (utilizationRate > 85) {
    recommendations.push({
      priority: 'high',
      type: 'utilization',
      message: `High utilization: ${utilizationRate}% worker capacity`,
      action: 'Consider adding more workers or limiting new bookings'
    });
  } else if (utilizationRate < 30) {
    recommendations.push({
      priority: 'low',
      type: 'utilization',
      message: `Low utilization: ${utilizationRate}% worker capacity`,
      action: 'Consider reducing standby workers or promoting services'
    });
  }
  
  // Check pending bookings
  if (pendingBookings > 10) {
    recommendations.push({
      priority: 'high',
      type: 'pending',
      message: `${pendingBookings} bookings awaiting worker assignment`,
      action: 'Review auto-assignment system or manually assign workers'
    });
  }
  
  // Seasonal recommendations
  const seasonMultiplier = getSeasonalMultiplier();
  if (seasonMultiplier > 1.2) {
    recommendations.push({
      priority: 'medium',
      type: 'seasonal',
      message: 'Peak season detected',
      action: 'Ensure adequate worker pool for increased demand'
    });
  }
  
  // Time-based recommendations
  const peakMultiplier = getPeakTimeMultiplier();
  if (peakMultiplier > 1.3) {
    recommendations.push({
      priority: 'medium',
      type: 'timing',
      message: 'Peak hours - higher than usual demand',
      action: 'Ensure all available workers are ready'
    });
  }
  
  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'low',
      type: 'status',
      message: 'Worker pool is optimally sized',
      action: 'Continue monitoring capacity'
    });
  }
  
  return recommendations;
};

/**
 * Get historical booking patterns
 * 
 * @param {Number} days - Number of days to analyze
 * @returns {Object} Historical patterns
 */
export const getHistoricalBookingPatterns = async (days = 30) => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Get bookings in date range
    const bookings = await Booking.find({
      bookingDate: {
        $gte: startDate,
        $lte: endDate
      },
      status: { $ne: 'cancelled' }
    }).select('bookingDate startTime status createdAt');
    
    // Analyze patterns by hour
    const hourlyPattern = Array(24).fill(0);
    bookings.forEach(booking => {
      const hour = parseInt(booking.startTime.split(':')[0]);
      hourlyPattern[hour]++;
    });
    
    // Analyze patterns by day of week
    const weeklyPattern = Array(7).fill(0);
    bookings.forEach(booking => {
      const day = new Date(booking.bookingDate).getDay();
      weeklyPattern[day]++;
    });
    
    // Calculate daily averages
    const totalBookings = bookings.length;
    const dailyAverage = (totalBookings / days).toFixed(2);
    
    // Find peak hours (top 3)
    const peakHours = hourlyPattern
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(h => `${h.hour}:00 (${h.count} bookings)`);
    
    // Find peak days
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const peakDays = weeklyPattern
      .map((count, day) => ({ day: dayNames[day], count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    
    return {
      period: {
        startDate,
        endDate,
        days
      },
      summary: {
        totalBookings,
        dailyAverage: parseFloat(dailyAverage)
      },
      patterns: {
        hourly: hourlyPattern,
        weekly: weeklyPattern,
        peakHours,
        peakDays
      }
    };
    
  } catch (error) {
    console.error('Error getting historical booking patterns:', error);
    throw error;
  }
};

/**
 * Monitor worker pool and send alerts if needed
 * 
 * @returns {Object} Monitoring result
 */
export const monitorWorkerPool = async () => {
  try {
    console.log('🔍 Monitoring worker pool...');
    
    const capacityStatus = await getWorkerCapacityStatus();
    const alerts = [];
    
    // Check for critical staffing shortage
    if (capacityStatus.capacity.poolRequirements.shortage > 5) {
      alerts.push({
        level: 'critical',
        type: 'staffing',
        message: `Critical worker shortage: Need ${capacityStatus.capacity.poolRequirements.shortage} more workers`,
        timestamp: new Date()
      });
    }
    
    // Check for high utilization
    if (capacityStatus.capacity.utilizationRate > 85) {
      alerts.push({
        level: 'warning',
        type: 'utilization',
        message: `High worker utilization: ${capacityStatus.capacity.utilizationRate}%`,
        timestamp: new Date()
      });
    }
    
    // Check for pending bookings backlog
    if (capacityStatus.bookings.pending > 10) {
      alerts.push({
        level: 'warning',
        type: 'backlog',
        message: `${capacityStatus.bookings.pending} bookings awaiting assignment`,
        timestamp: new Date()
      });
    }
    
    // Check for workers on leave
    if (capacityStatus.workers.onLeave > capacityStatus.workers.total * 0.2) {
      alerts.push({
        level: 'info',
        type: 'leaves',
        message: `${capacityStatus.workers.onLeave} workers on leave (${((capacityStatus.workers.onLeave / capacityStatus.workers.total) * 100).toFixed(1)}%)`,
        timestamp: new Date()
      });
    }
    
    // Log monitoring results
    console.log(`📊 Worker Pool Status: ${capacityStatus.capacity.status}`);
    console.log(`👥 Workers: ${capacityStatus.workers.available}/${capacityStatus.workers.total} available`);
    console.log(`📅 Bookings: ${capacityStatus.bookings.active} active, ${capacityStatus.bookings.pending} pending`);
    console.log(`📈 Utilization: ${capacityStatus.capacity.utilizationRate}%`);
    
    if (alerts.length > 0) {
      console.log(`⚠️ ${alerts.length} alerts generated`);
      alerts.forEach(alert => {
        console.log(`  [${alert.level.toUpperCase()}] ${alert.message}`);
      });
    } else {
      console.log('✅ No alerts - worker pool is healthy');
    }
    
    return {
      status: capacityStatus.capacity.status,
      alerts,
      metrics: capacityStatus,
      timestamp: new Date()
    };
    
  } catch (error) {
    console.error('Error monitoring worker pool:', error);
    return {
      status: 'error',
      error: error.message,
      timestamp: new Date()
    };
  }
};

/**
 * Get worker availability forecast
 * 
 * @param {Date} date - Date to forecast
 * @returns {Object} Availability forecast
 */
export const getWorkerAvailabilityForecast = async (date) => {
  try {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    // Get workers expected to be available
    const totalWorkers = await User.countDocuments({
      role: 'worker',
      isActive: true
    });
    
    // Get workers on leave for that date
    const workersOnLeave = await User.countDocuments({
      role: 'worker',
      isActive: true,
      'workerProfile.leaves': {
        $elemMatch: {
          date: {
            $gte: targetDate,
            $lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
          },
          status: 'approved'
        }
      }
    });
    
    // Get existing bookings for that date
    const existingBookings = await Booking.countDocuments({
      bookingDate: targetDate,
      status: { $in: ['confirmed', 'pending'] }
    });
    
    // Calculate expected availability
    const expectedAvailable = totalWorkers - workersOnLeave;
    const capacityRemaining = Math.max(0, (expectedAvailable * 8) - existingBookings); // 8 bookings per worker max
    
    // Forecast demand based on historical patterns
    const dayOfWeek = targetDate.getDay();
    const demandMultiplier = getDayOfWeekMultiplier();
    const seasonalMultiplier = getSeasonalMultiplier();
    
    // Get historical average for this day of week
    const historicalData = await getHistoricalBookingPatterns(30);
    const avgBookingsForDay = historicalData.patterns.weekly[dayOfWeek] / 4; // Divide by ~4 weeks
    
    const forecastedDemand = Math.ceil(avgBookingsForDay * demandMultiplier * seasonalMultiplier);
    const forecastedCapacity = expectedAvailable * 8;
    
    return {
      date: targetDate,
      workers: {
        total: totalWorkers,
        onLeave: workersOnLeave,
         expectedAvailable
      },
      bookings: {
        existing: existingBookings,
        forecasted: forecastedDemand,
        capacityRemaining
      },
      forecast: {
        capacity: forecastedCapacity,
        demand: forecastedDemand,
        utilizationForecast: ((forecastedDemand / forecastedCapacity) * 100).toFixed(2),
        status: forecastedDemand > forecastedCapacity ? 'over-capacity' : 'sufficient'
      }
    };
    
  } catch (error) {
    console.error('Error forecasting worker availability:', error);
    throw error;
  }
};
