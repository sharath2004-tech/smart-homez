import Booking from '../models/Booking.js';
import { assignWorkersWithBackup } from './advancedWorkerAssignment.js';
import notificationService from './notificationService.js';

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

    const pendingToConfirm = [];
    for (const booking of pendingBookings) {
      const bookingDateTime = new Date(`${booking.bookingDate.toISOString().split('T')[0]}T${booking.startTime}`);
      if (bookingDateTime <= twoHoursFromNow && bookingDateTime > now) {
        pendingToConfirm.push(booking._id);
      }
    }
    if (pendingToConfirm.length > 0) {
      await Booking.updateMany({ _id: { $in: pendingToConfirm } }, { $set: { status: 'confirmed' } });
      console.log(`Confirmed ${pendingToConfirm.length} pending booking(s)`);
    }

    // 2. Start confirmed bookings (only if NOT using QR code workflow)
    const confirmedBookings = await Booking.find({
      status: 'confirmed',
      bookingDate: today,
      serviceStartQRCode: { $exists: false } // Only auto-start if no QR code workflow
    });

    const confirmedToStart = [];
    for (const booking of confirmedBookings) {
      if (booking.startTime <= currentTime) {
        confirmedToStart.push(booking._id);
      }
    }
    if (confirmedToStart.length > 0) {
      await Booking.updateMany({ _id: { $in: confirmedToStart } }, { $set: { status: 'in-progress' } });
      console.log(`Started ${confirmedToStart.length} confirmed booking(s) (in-progress)`);
    }

    // 3. Complete in-progress bookings
    const inProgressBookings = await Booking.find({
      status: 'in-progress',
      bookingDate: { $lte: today }
    });

    const inProgressToComplete = [];
    for (const booking of inProgressBookings) {
      const bookingDate = booking.bookingDate.toISOString().split('T')[0];
      
      // If booking was manually started (actualStartTime exists), don't auto-complete
      // Let worker/customer complete it manually or based on actual elapsed time
      if (booking.actualStartTime) {
        console.log(`Booking ${booking._id} manually started - skipping auto-completion`);
        continue;
      }
      
      // If booking is today, check if end time has passed
      if (bookingDate === today) {
        if (booking.endTime < currentTime) {
          inProgressToComplete.push(booking._id);
        }
      } 
      // If booking date is in the past, mark as completed
      else if (bookingDate < today) {
        inProgressToComplete.push(booking._id);
      }
    }
    if (inProgressToComplete.length > 0) {
      await Booking.updateMany({ _id: { $in: inProgressToComplete } }, { $set: { status: 'completed' } });
      console.log(`Completed ${inProgressToComplete.length} in-progress booking(s)`);
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

/**
 * Process queued (pending/unassigned) bookings for a location when a worker slot opens up.
 * Called after booking completion or cancellation to automatically confirm waiting bookings.
 */
export const processQueuedBookings = async (locationId) => {
  if (!locationId) return { processed: 0, confirmed: 0 };
  try {
    const pendingBookings = await Booking.find({
      'location.locationId': locationId,
      status: 'pending',
      $or: [{ worker: null }, { worker: { $exists: false } }]
    })
      .populate('service')
      .populate('customer', 'name email preferences')
      .sort({ createdAt: 1 }) // FIFO - oldest pending first
      .limit(10);

    if (pendingBookings.length === 0) return { processed: 0, confirmed: 0 };

    console.log(`🔄 Processing ${pendingBookings.length} queued booking(s) at location ${locationId}`);
    let confirmed = 0;

    for (const pendingBooking of pendingBookings) {
      try {
        const assignmentResult = await assignWorkersWithBackup({
          customerId: pendingBooking.customer._id || pendingBooking.customer,
          service: pendingBooking.service?._id || pendingBooking.service,
          bookingDate: pendingBooking.bookingDate,
          startTime: pendingBooking.startTime,
          endTime: pendingBooking.endTime,
          location: pendingBooking.location,
          bookingType: pendingBooking.bookingType,
          preferences: pendingBooking.preferences || {}
        });

        if (assignmentResult.success) {
          pendingBooking.worker = assignmentResult.primaryWorker;
          pendingBooking.backupWorkers = assignmentResult.backupWorkers || [];
          pendingBooking.assignmentMethod = assignmentResult.assignmentMethod;
          pendingBooking.assignedAt = new Date();
          pendingBooking.status = 'confirmed';
          pendingBooking.confirmedAt = new Date();
          await pendingBooking.save();
          confirmed++;

          console.log(`✅ Queued booking ${pendingBooking._id} confirmed — worker assigned from queue`);

          // Notify customer that their queued booking is now confirmed
          try {
            await notificationService.sendNotification({
              userId: pendingBooking.customer._id || pendingBooking.customer,
              type: 'booking',
              title: 'Booking Confirmed',
              message: `Great news! A worker has been assigned to your booking. Your service is now confirmed.`,
              priority: 'high',
              data: { bookingId: pendingBooking._id }
            });
          } catch (notifErr) {
            console.error(`Notification error for booking ${pendingBooking._id}:`, notifErr.message);
          }
        }
      } catch (err) {
        console.error(`Failed to process queued booking ${pendingBooking._id}:`, err.message);
      }
    }

    console.log(`📊 Queue result: ${confirmed}/${pendingBookings.length} booking(s) confirmed`);
    return { processed: pendingBookings.length, confirmed };
  } catch (error) {
    console.error('Error in processQueuedBookings:', error);
    return { processed: 0, confirmed: 0 };
  }
};
