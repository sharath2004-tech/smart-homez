import Booking from '../models/Booking.js';
import { resolveAssignedWorkerForOccurrence } from './bookingStatusUpdater.js';
import { sendNotification } from './notificationService.js';

const DAY_INDEX_BY_NAME = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
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

const cloneValue = (value) => {
  if (value === undefined || value === null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
};

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

const getNextRecurringScheduleDate = ({ frequency, startDate, selectedDays = [], isSubscription = false }) => {
  const normalizedFrequency = String(frequency || '').toLowerCase();

  if ((isSubscription && normalizedFrequency === 'monthly') || normalizedFrequency === 'daily') {
    return addDays(startDate, 1);
  }

  if (normalizedFrequency === 'weekly') {
    return selectedDays.length > 0
      ? findNextSelectedDay(startDate, selectedDays)
      : addDays(startDate, 7);
  }

  if (normalizedFrequency === 'biweekly') {
    return addDays(startDate, 14);
  }

  if (normalizedFrequency === '3-days' || normalizedFrequency === 'alt-days') {
    return selectedDays.length > 0
      ? findNextSelectedDay(startDate, selectedDays)
      : addDays(startDate, 2);
  }

  if (normalizedFrequency === 'monthly') {
    const nextDate = startOfDay(startDate);
    nextDate.setMonth(nextDate.getMonth() + 1);
    return nextDate;
  }

  return addDays(startDate, 1);
};

const getSubscriptionCycleLengthDays = (booking) => {
  const cycleStart = booking.subscription?.subscriptionStartDate || booking.recurringSchedule?.startDate || booking.bookingDate;
  const cycleEnd = booking.subscription?.subscriptionEndDate || booking.recurringSchedule?.endDate;

  if (cycleStart && cycleEnd) {
    const diffInDays = Math.round(
      (startOfDay(cycleEnd).getTime() - startOfDay(cycleStart).getTime()) / (24 * 60 * 60 * 1000)
    );

    if (diffInDays >= 0) {
      return diffInDays + 1;
    }
  }

  return 30;
};

const buildRenewedSubscriptionPayload = async (booking) => {
  const previousEndDate = booking.subscription?.subscriptionEndDate || booking.recurringSchedule?.endDate || booking.bookingDate;
  const renewalStartDate = addDays(previousEndDate, 1);
  const cycleLengthDays = getSubscriptionCycleLengthDays(booking);
  const renewalEndDate = addDays(renewalStartDate, cycleLengthDays - 1);
  const selectedDays = booking.recurringSchedule?.selectedDays || [];
  const frequency = booking.recurringSchedule?.frequency || booking.bookingType || 'monthly';
  const assignment = await resolveAssignedWorkerForOccurrence(booking, renewalStartDate);
  const previousFixedWorker = booking.subscription?.fixedWorker || booking.worker?._id || booking.worker || null;
  const assignedWorkerId = assignment.worker || previousFixedWorker || null;
  const timestamps = assignment.worker
    ? { assignedAt: new Date(), confirmedAt: new Date() }
    : {};

  return {
    customer: booking.customer?._id || booking.customer,
    worker: assignment.worker || undefined,
    backupWorkers: assignment.backupWorkers || [],
    service: booking.service?._id || booking.service,
    bookingDate: renewalStartDate,
    startTime: booking.startTime,
    endTime: booking.endTime,
    totalAmount: booking.totalAmount,
    location: cloneValue(booking.location),
    notes: booking.notes,
    bookingType: booking.bookingType,
    isRecurring: true,
    parentBooking: null,
    assignmentMethod: assignment.assignmentMethod || booking.assignmentMethod || 'auto',
    preferences: cloneValue(booking.preferences),
    scheduledDurationMinutes: booking.scheduledDurationMinutes,
    serviceDetails: cloneValue(booking.serviceDetails),
    slotDetails: cloneValue(booking.slotDetails),
    workforce: cloneValue(booking.workforce),
    status: assignment.status,
    subscription: {
      ...cloneValue(booking.subscription),
      isSubscription: true,
      renewedFrom: booking._id,
      subscriptionStartDate: renewalStartDate,
      subscriptionEndDate: renewalEndDate,
      isPaused: false,
      pausedAt: null,
      resumedAt: null,
      fixedWorker: assignedWorkerId || undefined,
    },
    recurringSchedule: {
      ...cloneValue(booking.recurringSchedule),
      frequency,
      startDate: renewalStartDate,
      endDate: renewalEndDate,
      nextScheduledDate: getNextRecurringScheduleDate({
        frequency,
        startDate: renewalStartDate,
        selectedDays,
        isSubscription: true,
      }),
      completedOccurrences: 0,
    },
    ...timestamps,
  };
};

const completeExpiredRootSubscription = async (bookingId) => {
  await Booking.findByIdAndUpdate(bookingId, {
    $set: {
      status: 'completed',
      'recurringSchedule.nextScheduledDate': null,
      'subscription.isPaused': false,
      'subscription.pausedAt': null,
    },
  });
};

const autoRenewExpiredSubscriptions = async () => {
  const today = startOfDay(new Date());
  const renewableSubscriptions = await Booking.find({
    parentBooking: null,
    'subscription.isSubscription': true,
    'subscription.autoRenewal': true,
    'subscription.subscriptionEndDate': { $lt: today },
    status: { $nin: ['cancelled', 'completed'] },
  }).populate('service customer worker');

  let renewedCount = 0;

  for (const booking of renewableSubscriptions) {
    const existingRenewal = await Booking.findOne({
      'subscription.renewedFrom': booking._id,
    })
      .select('_id')
      .lean();

    if (existingRenewal) {
      await completeExpiredRootSubscription(booking._id);
      continue;
    }

    const renewedBooking = new Booking(await buildRenewedSubscriptionPayload(booking));
    await renewedBooking.save();
    await completeExpiredRootSubscription(booking._id);

    const hasAssignedWorker = Boolean(renewedBooking.worker);

    await sendNotification({
      userId: booking.customer?._id?.toString?.() || booking.customer.toString(),
      type: 'subscription-renewal',
      title: 'Subscription Renewed',
      message: hasAssignedWorker
        ? 'Your subscription renewed automatically and your next cycle is ready to go.'
        : 'Your subscription renewed automatically. We are assigning a worker for the next cycle now.',
      data: {
        previousBookingId: booking._id.toString(),
        renewedBookingId: renewedBooking._id.toString(),
      },
      priority: 'high',
      channels: ['in-app'],
    });

    if (hasAssignedWorker) {
      await sendNotification({
        userId: renewedBooking.worker.toString(),
        type: 'booking-confirmed',
        title: 'Renewed subscription assigned',
        message: 'A renewed subscription cycle has been added to your schedule.',
        data: {
          bookingId: renewedBooking._id.toString(),
        },
        priority: 'medium',
        channels: ['in-app'],
      });
    }

    renewedCount += 1;
  }

  if (renewedCount > 0) {
    console.log(`♻️ Auto-renewed ${renewedCount} subscription(s)`);
  }
};

/**
 * Check for subscriptions expiring within 3 days and send renewal reminders.
 * Runs once per day via setInterval.
 */
export const checkSubscriptionRenewals = async () => {
  try {
    const now = new Date();
    const today = startOfDay(now);
    const in3Days = addDays(today, 3);

    // Find active subscription bookings expiring within the next 3 days
    const expiring = await Booking.find({
      parentBooking: null,
      'subscription.isSubscription': true,
      'subscription.subscriptionEndDate': { $gte: today, $lte: in3Days },
      status: { $nin: ['cancelled', 'completed'] }
    }).select('_id customer service subscription');

    for (const booking of expiring) {
      const endDate = new Date(booking.subscription.subscriptionEndDate);
      const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      const label = daysLeft <= 1 ? 'tomorrow' : `in ${daysLeft} days`;

      await sendNotification({
        userId: booking.customer.toString(),
        type: 'subscription-renewal',
        title: 'Subscription Expiring Soon',
        message: `Your subscription expires ${label}. Renew now to keep your services uninterrupted.`,
        data: { bookingId: booking._id.toString() },
        priority: daysLeft <= 1 ? 'high' : 'medium',
        channels: ['in-app']
      });
    }

    if (expiring.length > 0) {
      console.log(`📅 Sent renewal reminders for ${expiring.length} expiring subscription(s)`);
    }

    await autoRenewExpiredSubscriptions();
  } catch (err) {
    console.error('Subscription renewal checker error:', err);
  }
};

export const runRenewalChecker = () => {
  checkSubscriptionRenewals(); // Run immediately on startup
  setInterval(checkSubscriptionRenewals, 24 * 60 * 60 * 1000); // Re-run every 24 hours
};
