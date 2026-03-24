import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { assignWorkersWithBackup } from './advancedWorkerAssignment.js';
import notificationService from './notificationService.js';
import { checkSlotAvailability } from './slotManagement.js';

const DAY_INDEX_BY_NAME = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (value, days) => {
  const date = startOfDay(value);
  date.setDate(date.getDate() + days);
  return date;
};

const sameDay = (left, right) => startOfDay(left).getTime() === startOfDay(right).getTime();

const findNextSelectedDay = (fromDate, selectedDays = []) => {
  const allowedDayIndexes = selectedDays
    .map(day => DAY_INDEX_BY_NAME[String(day || '').toLowerCase()])
    .filter(day => Number.isInteger(day));

  if (allowedDayIndexes.length === 0) {
    return addDays(fromDate, 7);
  }

  for (let offset = 1; offset <= 14; offset += 1) {
    const candidate = addDays(fromDate, offset);
    if (allowedDayIndexes.includes(candidate.getDay())) {
      return candidate;
    }
  }

  return addDays(fromDate, 7);
};

const resolveScheduleEndDate = (booking) => {
  if (booking.recurringSchedule?.endDate) {
    return startOfDay(booking.recurringSchedule.endDate);
  }

  if (booking.subscription?.subscriptionEndDate) {
    return startOfDay(booking.subscription.subscriptionEndDate);
  }

  if (booking.subscription?.isSubscription && booking.recurringSchedule?.frequency === 'monthly') {
    return addDays(booking.recurringSchedule?.startDate || booking.bookingDate, 29);
  }

  return null;
};

const getNextScheduledDate = (booking, currentDate) => {
  const frequency = String(booking.recurringSchedule?.frequency || '').toLowerCase();
  const selectedDays = booking.recurringSchedule?.selectedDays || [];
  const isMonthlyDailySubscription = booking.subscription?.isSubscription && frequency === 'monthly';

  if (isMonthlyDailySubscription || frequency === 'daily') {
    return addDays(currentDate, 1);
  }

  if (frequency === 'weekly') {
    return selectedDays.length > 0
      ? findNextSelectedDay(currentDate, selectedDays)
      : addDays(currentDate, 7);
  }

  if (frequency === 'biweekly') {
    return addDays(currentDate, 14);
  }

  if (frequency === '3-days' || frequency === 'alt-days') {
    return selectedDays.length > 0
      ? findNextSelectedDay(currentDate, selectedDays)
      : addDays(currentDate, 2);
  }

  if (frequency === 'monthly') {
    const nextDate = startOfDay(currentDate);
    nextDate.setMonth(nextDate.getMonth() + 1);
    return nextDate;
  }

  return addDays(currentDate, 1);
};

const occurrenceAlreadyExists = async (booking, occurrenceDate) => {
  if (sameDay(booking.bookingDate, occurrenceDate)) {
    return true;
  }

  const endOfOccurrenceDate = startOfDay(occurrenceDate);
  endOfOccurrenceDate.setHours(23, 59, 59, 999);

  return Boolean(await Booking.findOne({
    parentBooking: booking._id,
    bookingDate: { $gte: startOfDay(occurrenceDate), $lte: endOfOccurrenceDate },
    startTime: booking.startTime,
    status: { $ne: 'cancelled' }
  }).select('_id').lean());
};

const resolveAssignedWorkerForOccurrence = async (booking, occurrenceDate) => {
  const fixedWorkerId = booking.subscription?.fixedWorker || booking.worker?._id || booking.worker || null;

  if (fixedWorkerId) {
    const workerDoc = await User.findById(fixedWorkerId)
      .select('isActive workerProfile.availability workerProfile.leaves workerProfile.workingTimeWindow');

    if (workerDoc?.isActive && workerDoc.workerProfile?.availability) {
      const slotAvailability = await checkSlotAvailability(
        fixedWorkerId,
        occurrenceDate,
        booking.startTime,
        booking.endTime,
        Booking,
        15
      );

      if (slotAvailability.available) {
        return {
          worker: fixedWorkerId,
          backupWorkers: [],
          assignmentMethod: booking.assignmentMethod || 'manual',
          status: 'confirmed'
        };
      }
    }
  }

  const assignmentResult = await assignWorkersWithBackup({
    customerId: booking.customer._id || booking.customer,
    service: booking.service?._id || booking.service,
    bookingDate: occurrenceDate,
    startTime: booking.startTime,
    endTime: booking.endTime,
    location: booking.location,
    bookingType: booking.bookingType,
    preferences: booking.preferences || {}
  });

  if (assignmentResult.success) {
    return {
      worker: assignmentResult.primaryWorker,
      backupWorkers: assignmentResult.backupWorkers || [],
      assignmentMethod: assignmentResult.assignmentMethod,
      status: 'confirmed'
    };
  }

  return {
    worker: null,
    backupWorkers: [],
    assignmentMethod: booking.assignmentMethod || 'auto',
    status: 'pending'
  };
};

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
      status: { $ne: 'cancelled' },
      'subscription.isPaused': { $ne: true }
    }).populate('service customer worker');

    for (const booking of recurringBookings) {
      // Skip if required references are missing
      if (!booking.customer || !booking.service) {
        console.log(`Skipping recurring booking ${booking._id}: missing customer or service reference`);
        continue;
      }

      const occurrenceDate = startOfDay(booking.recurringSchedule.nextScheduledDate);
      const scheduleEndDate = resolveScheduleEndDate(booking);
      const nextDate = getNextScheduledDate(booking, occurrenceDate);

      if (scheduleEndDate && occurrenceDate > scheduleEndDate) {
        booking.recurringSchedule.nextScheduledDate = null;
        await booking.save();
        continue;
      }

      const alreadyExists = await occurrenceAlreadyExists(booking, occurrenceDate);

      if (!alreadyExists) {
        const assignment = await resolveAssignedWorkerForOccurrence(booking, occurrenceDate);
        const timestamps = assignment.worker
          ? { assignedAt: new Date(), confirmedAt: new Date() }
          : {};

        const nextBooking = new Booking({
          customer: booking.customer._id,
          worker: assignment.worker || undefined,
          backupWorkers: assignment.backupWorkers || [],
          service: booking.service._id,
          bookingDate: occurrenceDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
          totalAmount: booking.totalAmount,
          location: booking.location,
          bookingType: booking.bookingType,
          isRecurring: false,
          parentBooking: booking._id,
          assignmentMethod: assignment.assignmentMethod,
          preferences: booking.preferences,
          scheduledDurationMinutes: booking.scheduledDurationMinutes,
          serviceDetails: booking.serviceDetails,
          slotDetails: booking.slotDetails,
          workforce: booking.workforce,
          status: assignment.status,
          ...timestamps
        });

        await nextBooking.save();
        console.log(`Created recurring booking ${nextBooking._id} from parent ${booking._id}`);
      }

      booking.recurringSchedule.nextScheduledDate = scheduleEndDate && nextDate > scheduleEndDate
        ? null
        : nextDate;
      booking.recurringSchedule.completedOccurrences += 1;
      await booking.save();
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
