import Booking from '../models/Booking.js';

/**
 * Update booking statuses based on current time
 * - pending -> confirmed (2 hours before booking)
 * - confirmed -> in-progress (at start time)
 * - in-progress -> completed (at end time)
 */
export const updateBookingStatuses = async () => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // 1. Confirm pending bookings that are within 2 hours
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const pendingBookings = await Booking.find({
      status: 'pending',
      bookingDate: { $gte: today },
      worker: { $ne: null } // Only confirm if worker is assigned
    });

    for (const booking of pendingBookings) {
      const bookingDateTime = new Date(`${booking.bookingDate.toISOString().split('T')[0]}T${booking.startTime}`);
      if (bookingDateTime <= twoHoursFromNow && bookingDateTime > now) {
        booking.status = 'confirmed';
        await booking.save();
        console.log(`Booking ${booking._id} confirmed`);
      }
    }

    // 2. Start confirmed bookings (in-progress)
    const confirmedBookings = await Booking.find({
      status: 'confirmed',
      bookingDate: today
    });

    for (const booking of confirmedBookings) {
      if (booking.startTime <= currentTime) {
        booking.status = 'in-progress';
        await booking.save();
        console.log(`Booking ${booking._id} started (in-progress)`);
      }
    }

    // 3. Complete in-progress bookings
    const inProgressBookings = await Booking.find({
      status: 'in-progress',
      bookingDate: { $lte: today }
    });

    for (const booking of inProgressBookings) {
      const bookingDate = booking.bookingDate.toISOString().split('T')[0];
      
      // If booking is today, check if end time has passed
      if (bookingDate === today) {
        if (booking.endTime < currentTime) {
          booking.status = 'completed';
          await booking.save();
          console.log(`Booking ${booking._id} completed`);
        }
      } 
      // If booking date is in the past, mark as completed
      else if (bookingDate < today) {
        booking.status = 'completed';
        await booking.save();
        console.log(`Booking ${booking._id} completed (past date)`);
      }
    }

    return {
      success: true,
      message: 'Booking statuses updated'
    };
  } catch (error) {
    console.error('Error updating booking statuses:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Schedule recurring bookings that are due
 */
export const scheduleRecurringBookings = async () => {
  try {
    const now = new Date();
    const recurringBookings = await Booking.find({
      isRecurring: true,
      'recurringSchedule.nextScheduledDate': { $lte: now },
      status: { $ne: 'cancelled' }
    }).populate('service customer worker');

    for (const booking of recurringBookings) {
      // Skip if required references are missing
      if (!booking.customer || !booking.service) {
        console.log(`Skipping recurring booking ${booking._id}: missing customer or service reference`);
        continue;
      }

      // Create next occurrence
      const nextBooking = new Booking({
        customer: booking.customer._id,
        worker: booking.worker?._id,
        service: booking.service._id,
        bookingDate: booking.recurringSchedule.nextScheduledDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        totalAmount: booking.totalAmount,
        location: booking.location,
        bookingType: booking.bookingType,
        isRecurring: false,
        parentBooking: booking._id,
        assignmentMethod: booking.assignmentMethod,
        preferences: booking.preferences
      });

      await nextBooking.save();

      // Update parent booking's next scheduled date
      const frequency = booking.recurringSchedule.frequency;
      let nextDate = new Date(booking.recurringSchedule.nextScheduledDate);
      
      if (frequency === 'daily') {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (frequency === 'weekly') {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (frequency === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }

      booking.recurringSchedule.nextScheduledDate = nextDate;
      booking.recurringSchedule.completedOccurrences += 1;
      await booking.save();

      console.log(`Created recurring booking ${nextBooking._id} from parent ${booking._id}`);
    }

    return {
      success: true,
      message: 'Recurring bookings scheduled'
    };
  } catch (error) {
    console.error('Error scheduling recurring bookings:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Run both update functions
export const runBookingUpdates = async () => {
  await updateBookingStatuses();
  await scheduleRecurringBookings();
};
