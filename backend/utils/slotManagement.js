/**
 * Utility functions for slot management.
 * Slots are derived at runtime from the BusinessHours config (never hardcoded).
 */

/**
 * Generate time slots from the live BusinessHours configuration.
 * Falls back to a default 06:00–22:00 / 30-min grid if no config is available.
 *
 * @param {Date}   date               - The date to generate slots for
 * @param {Object} BusinessHoursModel - The BusinessHours mongoose model
 * @returns {Promise<string[]>} Array of slot start times in HH:MM format
 */
export const generateTimeSlotsFromConfig = async (date = new Date(), BusinessHoursModel) => {
  try {
    const config = await BusinessHoursModel.getConfig();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()];
    const dayConfig = config.schedule.find((d) => d.day === dayName);

    if (!dayConfig || !dayConfig.isActive) return []; // closed day

    const slotDuration = config.slotDurationMinutes || 30;
    const [openHour, openMin] = dayConfig.openTime.split(':').map(Number);
    const [closeHour, closeMin] = dayConfig.closeTime.split(':').map(Number);
    const openMinutes  = openHour  * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;

    const breaks = (dayConfig.breaks || []).map((b) => {
      const [sh, sm] = b.start.split(':').map(Number);
      const [eh, em] = b.end.split(':').map(Number);
      return { start: sh * 60 + sm, end: eh * 60 + em };
    });

    const slots = [];
    for (let t = openMinutes; t + slotDuration <= closeMinutes; t += slotDuration) {
      const slotEnd = t + slotDuration;
      const inBreak = breaks.some((b) => t < b.end && slotEnd > b.start);
      if (!inBreak) {
        const hh = String(Math.floor(t / 60)).padStart(2, '0');
        const mm = String(t % 60).padStart(2, '0');
        slots.push(`${hh}:${mm}`);
      }
    }
    return slots;
  } catch (err) {
    console.error('generateTimeSlotsFromConfig fallback:', err.message);
    return generateTimeSlots(date); // graceful fallback
  }
};

/**
 * Legacy: Generate 15-minute time slots for a given date (hardcoded range).
 * Prefer generateTimeSlotsFromConfig() for runtime-configurable slots.
 *
 * @param {Date} date - The date to generate slots for
 * @param {number} startHour - Start hour (default: 6 for 6 AM)
 * @param {number} endHour - End hour (default: 22 for 10 PM)
 * @returns {string[]} Array of time slots in HH:MM format
 */
export const generateTimeSlots = (date = new Date(), startHour = 6, endHour = 22) => {
  const slots = [];
  
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      slots.push(timeString);
    }
  }
  
  // Add the last slot at end hour
  slots.push(`${String(endHour).padStart(2, '0')}:00`);
  
  return slots;
};

/**
 * Check if a time slot is available for a worker
 * @param {ObjectId} workerId - Worker ID
 * @param {Date} date - Booking date
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @param {Object} Booking - Booking model
 * @param {number} bufferMinutes - Buffer time between bookings (default: 15)
 * @returns {Promise<Object>} {available: boolean, reason: string}
 */
export const checkSlotAvailability = async (workerId, date, startTime, endTime, Booking, bufferMinutes = 15, excludeBookingId = null) => {
  try {
    // Convert times to minutes for comparison
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const requestedStart = startHour * 60 + startMin;
    const requestedEnd = endHour * 60 + endMin;

    // Get worker's bookings for the date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookingQuery = {
      worker: workerId,
      bookingDate: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      status: { $in: ['confirmed', 'in-progress', 'pending'] }
    };

    if (excludeBookingId) {
      bookingQuery._id = { $ne: excludeBookingId };
    }

    const existingBookings = await Booking.find(bookingQuery).select('startTime endTime');

    // Check for conflicts with buffer
    for (const booking of existingBookings) {
      const [bookingStartHour, bookingStartMin] = booking.startTime.split(':').map(Number);
      const [bookingEndHour, bookingEndMin] = booking.endTime.split(':').map(Number);
      const bookingStart = bookingStartHour * 60 + bookingStartMin;
      const bookingEnd = bookingEndHour * 60 + bookingEndMin;

      // Check if there's an overlap (with buffer)
      const requestedStartWithBuffer = requestedStart - bufferMinutes;
      const requestedEndWithBuffer = requestedEnd + bufferMinutes;

      if (
        (requestedStartWithBuffer < bookingEnd && requestedEndWithBuffer > bookingStart) ||
        (requestedStart >= bookingStart && requestedStart < bookingEnd) ||
        (requestedEnd > bookingStart && requestedEnd <= bookingEnd)
      ) {
        return {
          available: false,
          reason: 'Worker has a conflicting booking',
          conflictingBooking: {
            startTime: booking.startTime,
            endTime: booking.endTime
          }
        };
      }
    }

    return { available: true, reason: 'Slot is available' };
  } catch (error) {
    console.error('Check slot availability error:', error);
    return { available: false, reason: 'Error checking availability' };
  }
};

/**
 * Calculate duration in minutes from start and end time strings
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @returns {number} Duration in minutes
 */
export const calculateDuration = (startTime, endTime) => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return endMinutes - startMinutes;
};

/**
 * Validate minimum booking duration (1 hour) and 15-minute increments
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @param {number} minimumMinutes - Minimum duration (default: 60)
 * @returns {Object} {valid: boolean, message: string, durationMinutes: number}
 */
export const validateBookingDuration = (startTime, endTime, minimumMinutes = 60) => {
  const duration = calculateDuration(startTime, endTime);
  
  if (duration < minimumMinutes) {
    return {
      valid: false,
      message: `Booking must be at least ${minimumMinutes} minutes (${minimumMinutes / 60} hour)`,
      durationMinutes: duration
    };
  }
  
  if (duration % 15 !== 0) {
    return {
      valid: false,
      message: 'Booking duration must be in 15-minute increments',
      durationMinutes: duration
    };
  }
  
  return {
    valid: true,
    message: 'Duration is valid',
    durationMinutes: duration
  };
};

/**
 * Get available slots for a worker on a specific date
 * @param {ObjectId} workerId - Worker ID
 * @param {Date} date - Date to check
 * @param {Object} Booking - Booking model
 * @param {number} minimumDuration - Minimum booking duration in minutes (default: 60)
 * @returns {Promise<Array>} Array of available time slots
 */
export const getAvailableSlots = async (workerId, date, Booking, minimumDuration = 60) => {
  const allSlots = generateTimeSlots(date);
  const availableSlots = [];

  // Get worker's bookings for the date
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const existingBookings = await Booking.find({
    worker: workerId,
    bookingDate: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    status: { $in: ['confirmed', 'in-progress', 'pending'] }
  }).select('startTime endTime');

  // Check each slot
  for (let i = 0; i < allSlots.length - (minimumDuration / 15); i++) {
    const startTime = allSlots[i];
    const endTime = allSlots[i + (minimumDuration / 15)];
    
    const result = await checkSlotAvailability(workerId, date, startTime, endTime, Booking);
    
    if (result.available) {
      availableSlots.push({
        startTime,
        endTime,
        durationMinutes: minimumDuration
      });
    }
  }

  return availableSlots;
};

/**
 * Check if extension is possible (no upcoming booking)
 * @param {ObjectId} bookingId - Current booking ID
 * @param {number} extensionMinutes - Minutes to extend
 * @param {Object} Booking - Booking model
 * @returns {Promise<Object>} {canExtend: boolean, reason: string}
 */
export const checkExtensionPossibility = async (bookingId, extensionMinutes, Booking) => {
  try {
    const currentBooking = await Booking.findById(bookingId);
    if (!currentBooking) {
      return { canExtend: false, reason: 'Booking not found' };
    }

    const [endHour, endMin] = currentBooking.endTime.split(':').map(Number);
    const currentEndMinutes = endHour * 60 + endMin;
    const newEndMinutes = currentEndMinutes + extensionMinutes;
    
    // Convert back to time string
    const newEndHour = Math.floor(newEndMinutes / 60);
    const newEndMin = newEndMinutes % 60;
    const newEndTime = `${String(newEndHour).padStart(2, '0')}:${String(newEndMin).padStart(2, '0')}`;

    // Check if worker has any booking after current end time
    const nextBooking = await Booking.findOne({
      worker: currentBooking.worker,
      bookingDate: currentBooking.bookingDate,
      startTime: { $gte: currentBooking.endTime },
      status: { $in: ['confirmed', 'in-progress', 'pending'] },
      _id: { $ne: bookingId }
    }).sort({ startTime: 1 });

    if (nextBooking) {
      // Check if extension would conflict
      const [nextStartHour, nextStartMin] = nextBooking.startTime.split(':').map(Number);
      const nextStartMinutes = nextStartHour * 60 + nextStartMin;
      
      if (newEndMinutes + 15 > nextStartMinutes) { // Including 15-min buffer
        return {
          canExtend: false,
          reason: 'Worker has upcoming booking',
          nextBooking: {
            startTime: nextBooking.startTime,
            service: nextBooking.service
          }
        };
      }
    }

    return {
      canExtend: true,
      reason: 'Extension is possible',
      newEndTime
    };
  } catch (error) {
    console.error('Check extension possibility error:', error);
    return { canExtend: false, reason: 'Error checking extension' };
  }
};

export default {
  generateTimeSlots,
  checkSlotAvailability,
  calculateDuration,
  validateBookingDuration,
  getAvailableSlots,
  checkExtensionPossibility
};
