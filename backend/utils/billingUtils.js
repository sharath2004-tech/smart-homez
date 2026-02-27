/**
 * Utility functions for time rounding and billing
 * 
 * Billing Rules:
 * - Billing interval = 15 minutes
 * - Extra < 5 minutes → round down
 * - Extra >= 5 minutes → round up to next 15-min slot
 */

/**
 * Calculate actual duration in minutes from start and end timestamps
 * @param {Date} startTime - Actual start time
 * @param {Date} endTime - Actual end time
 * @returns {number} Duration in minutes
 */
export const calculateActualDuration = (startTime, endTime) => {
  const durationMs = endTime.getTime() - startTime.getTime();
  return Math.floor(durationMs / 60000); // Convert milliseconds to minutes
};

/**
 * Round duration according to billing rules
 * @param {number} actualMinutes - Actual duration in minutes
 * @returns {Object} {
 *   roundedMinutes: number,
 *   slots: number,
 *   extraMinutes: number,
 *   roundedUp: boolean,
 *   roundedDown: boolean
 * }
 */
export const roundDurationForBilling = (actualMinutes) => {
  const baseSlots = Math.floor(actualMinutes / 15);
  const extraMinutes = actualMinutes % 15;
  
  let roundedMinutes;
  let slots;
  let roundedUp = false;
  let roundedDown = false;
  
  if (extraMinutes === 0) {
    // Exact 15-minute interval
    roundedMinutes = actualMinutes;
    slots = baseSlots;
  } else if (extraMinutes < 5) {
    // Round down (< 5 minutes extra)
    roundedMinutes = baseSlots * 15;
    slots = baseSlots;
    roundedDown = true;
  } else {
    // Round up (>= 5 minutes extra)
    roundedMinutes = (baseSlots + 1) * 15;
    slots = baseSlots + 1;
    roundedUp = true;
  }
  
  return {
    roundedMinutes,
    slots,
    extraMinutes,
    roundedUp,
    roundedDown,
    originalMinutes: actualMinutes
  };
};

/**
 * Calculate billing amount based on rounded duration
 * @param {number} actualMinutes - Actual duration in minutes
 * @param {number} ratePerHour - Hourly rate
 * @param {number} overtimeRate - Overtime rate per minute (optional)
 * @param {number} scheduledMinutes - Scheduled duration (optional, for overtime calculation)
 * @returns {Object} Billing details
 */
export const calculateBillingAmount = (
  actualMinutes,
  ratePerHour,
  overtimeRate = 0,
  scheduledMinutes = 0
) => {
  const roundingResult = roundDurationForBilling(actualMinutes);
  const { roundedMinutes, slots } = roundingResult;
  
  // Calculate base amount
  const ratePerMinute = ratePerHour / 60;
  let baseAmount = roundedMinutes * ratePerMinute;
  
  // Calculate overtime if applicable
  let overtimeMinutes = 0;
  let overtimeAmount = 0;
  
  if (scheduledMinutes > 0 && actualMinutes > scheduledMinutes) {
    overtimeMinutes = actualMinutes - scheduledMinutes;
    if (overtimeRate > 0) {
      overtimeAmount = overtimeMinutes * overtimeRate;
    }
  }
  
  const totalAmount = baseAmount + overtimeAmount;
  
  return {
    ...roundingResult,
    baseAmount: parseFloat(baseAmount.toFixed(2)),
    overtimeMinutes,
    overtimeAmount: parseFloat(overtimeAmount.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    ratePerMinute: parseFloat(ratePerMinute.toFixed(2))
  };
};

/**
 * Calculate overtime charges
 * @param {Date} scheduledEndTime - Scheduled end time from booking
 * @param {Date} actualEndTime - Actual end time
 * @param {number} overtimeRate - Rate per minute for overtime (default: 2.5)
 * @returns {Object} Overtime details
 */
export const calculateOvertime = (scheduledEndTime, actualEndTime, overtimeRate = 2.5) => {
  if (actualEndTime <= scheduledEndTime) {
    return {
      hasOvertime: false,
      overtimeMinutes: 0,
      overtimeCharges: 0
    };
  }
  
  const overtimeDuration = calculateActualDuration(scheduledEndTime, actualEndTime);
  const overtimeCharges = overtimeDuration * overtimeRate;
  
  return {
    hasOvertime: true,
    overtimeMinutes: overtimeDuration,
    overtimeCharges: parseFloat(overtimeCharges.toFixed(2))
  };
};

/**
 * Generate invoice/bill details for a completed booking
 * @param {Object} booking - Booking document
 * @param {number} ratePerHour - Hourly rate
 * @param {number} overtimeRate - Overtime rate per minute
 * @returns {Object} Complete billing details
 */
export const generateBillingDetails = (booking, ratePerHour, overtimeRate = 2.5) => {
  if (!booking.actualStartTime || !booking.actualEndTime) {
    throw new Error('Booking must have actual start and end times');
  }
  
  const actualMinutes = calculateActualDuration(
    booking.actualStartTime,
    booking.actualEndTime
  );
  
  // Calculate scheduled duration
  const [startHour, startMin] = booking.startTime.split(':').map(Number);
  const [endHour, endMin] = booking.endTime.split(':').map(Number);
  const scheduledMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  
  // Calculate billing
  const billingDetails = calculateBillingAmount(
    actualMinutes,
    ratePerHour,
    overtimeRate,
    scheduledMinutes
  );
  
  // Prepare scheduled end time for overtime calculation
  const scheduledEndTime = new Date(booking.bookingDate);
  scheduledEndTime.setHours(endHour, endMin, 0, 0);
  
  const overtimeDetails = calculateOvertime(
    scheduledEndTime,
    booking.actualEndTime,
    overtimeRate
  );
  
  return {
    bookingId: booking._id,
    scheduledDuration: {
      startTime: booking.startTime,
      endTime: booking.endTime,
      minutes: scheduledMinutes,
      hours: parseFloat((scheduledMinutes / 60).toFixed(2))
    },
    actualDuration: {
      startTime: booking.actualStartTime,
      endTime: booking.actualEndTime,
      minutes: actualMinutes,
      hours: parseFloat((actualMinutes / 60).toFixed(2))
    },
    billing: billingDetails,
    overtime: overtimeDetails,
    finalAmount: parseFloat((
      billingDetails.baseAmount + overtimeDetails.overtimeCharges
    ).toFixed(2))
  };
};

/**
 * Update booking with billing details
 * @param {Object} booking - Booking document
 * @param {Object} billingDetails - Billing details from generateBillingDetails
 * @returns {Object} Updated booking data
 */
export const updateBookingBilling = (booking, billingDetails) => {
  // Update actual duration
  booking.actualDurationMinutes = billingDetails.actualDuration.minutes;
  booking.scheduledDurationMinutes = billingDetails.scheduledDuration.minutes;
  
  // Update overtime
  booking.overtimeMinutes = billingDetails.overtime.overtimeMinutes;
  booking.overtimeCharges = billingDetails.overtime.overtimeCharges;
  
  // Update billing section
  booking.billing = {
    roundedDurationMinutes: billingDetails.billing.roundedMinutes,
    billingSlots: billingDetails.billing.slots,
    roundingApplied: billingDetails.billing.roundedUp || billingDetails.billing.roundedDown,
    roundingDetails: {
      originalMinutes: billingDetails.billing.originalMinutes,
      extraMinutes: billingDetails.billing.extraMinutes,
      roundedUp: billingDetails.billing.roundedUp
    }
  };
  
  // Update total amount
  booking.totalAmount = billingDetails.finalAmount;
  
  return booking;
};

export default {
  calculateActualDuration,
  roundDurationForBilling,
  calculateBillingAmount,
  calculateOvertime,
  generateBillingDetails,
  updateBookingBilling
};
