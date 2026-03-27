/**
 * Shared booking conflict / overlap detection utility.
 *
 * Used by:
 *  - POST /api/bookings             (main booking creation)
 *  - POST /api/deep-cleaning/booking (deep-cleaning cart)
 *  - Booking model pre-save guard    (last-resort safety net)
 */

import Booking from '../models/Booking.js';
import { startOfDay } from './recurringSchedule.js';
import {
    buildRecurringOccurrences,
    getSubscriptionConflictWindowEnd,
    timeRangesOverlap,
} from './subscriptionScheduling.js';

/**
 * Checks whether the proposed booking time / date-range conflicts with any
 * existing non-cancelled booking (one-time, child visit, OR subscription root)
 * for the given customer.
 *
 * @param {Object}   opts
 * @param {ObjectId} opts.customerId          - Mongoose customer _id
 * @param {Date}     opts.proposedDate        - Booking date (or subscription start date)
 * @param {Date|null} opts.proposedEndDate    - Subscription end date (null for one-time)
 * @param {string}   opts.proposedStartTime   - "HH:MM"
 * @param {string}   opts.proposedEndTime     - "HH:MM"
 * @param {string}   [opts.frequency='daily'] - 'daily', 'weekly', 'monthly', etc.
 * @param {string[]} [opts.selectedDays=[]]   - For weekly subscriptions
 * @param {ObjectId} [opts.excludeBookingId]  - Booking _id to exclude (for edits)
 * @returns {Promise<{conflict:boolean, existingBooking?:Object, overlappingDate?:Date}>}
 */
export async function findCustomerConflict({
  customerId,
  proposedDate,
  proposedEndDate = null,
  proposedStartTime,
  proposedEndTime,
  frequency = 'daily',
  selectedDays = [],
  excludeBookingId = null,
}) {
  if (!customerId || !proposedDate || !proposedStartTime || !proposedEndTime) {
    return { conflict: false };
  }

  const effectiveStart = new Date(proposedDate);
  const effectiveEnd = proposedEndDate ? new Date(proposedEndDate) : effectiveStart;

  const comparisonStart = startOfDay(effectiveStart);
  const comparisonEnd = getSubscriptionConflictWindowEnd(effectiveStart, effectiveEnd);

  const exclusionFilter = excludeBookingId
    ? { _id: { $ne: excludeBookingId }, parentBooking: { $ne: excludeBookingId } }
    : {};

  // Two queries in parallel:
  //  1. Regular / child-visit bookings whose bookingDate falls within the window
  //  2. Subscription root bookings whose subscription date-range overlaps the window
  const [candidateBookings, subscriptionRoots] = await Promise.all([
    Booking.find({
      customer: customerId,
      ...exclusionFilter,
      bookingDate: { $gte: comparisonStart, $lte: comparisonEnd },
      status: { $in: ['pending', 'confirmed', 'in-progress'] },
    })
      .select('bookingDate startTime endTime service')
      .lean(),
    Booking.find({
      customer: customerId,
      ...exclusionFilter,
      'subscription.isSubscription': true,
      parentBooking: null,
      status: { $nin: ['cancelled'] },
      bookingDate: { $lte: comparisonEnd },
      $or: [
        { 'subscription.subscriptionEndDate': null },
        { 'subscription.subscriptionEndDate': { $gte: comparisonStart } },
      ],
    })
      .select('bookingDate startTime endTime recurringSchedule subscription bookingType service')
      .lean(),
  ]);

  // De-duplicate (child visits may also appear as subscription roots)
  const candidateMap = new Map();
  for (const b of [...candidateBookings, ...subscriptionRoots]) {
    if (b?._id) candidateMap.set(b._id.toString(), b);
  }

  // Build proposed occurrence dates
  const proposedOccurrences = buildRecurringOccurrences({
    frequency: frequency || 'daily',
    startDate: effectiveStart,
    selectedDays: selectedDays || [],
    endDate: effectiveEnd,
    rangeStart: comparisonStart,
    rangeEnd: comparisonEnd,
  });
  const proposedDateKeys = new Set(
    proposedOccurrences.map((d) => startOfDay(d).getTime()),
  );

  for (const booking of candidateMap.values()) {
    if (booking.status === 'cancelled') continue;

    // Time-range must overlap
    if (!timeRangesOverlap(proposedStartTime, proposedEndTime, booking.startTime, booking.endTime)) {
      continue;
    }

    // Subscription root → build its actual occurrences and check date intersection
    if (booking.subscription?.isSubscription && !booking.parentBooking) {
      if (!['pending', 'confirmed', 'in-progress', 'pending-review', 'completed'].includes(booking.status)) {
        continue;
      }

      const existingOccurrences = buildRecurringOccurrences({
        frequency: booking.recurringSchedule?.frequency || booking.bookingType || 'daily',
        startDate: booking.subscription.subscriptionStartDate || booking.bookingDate,
        selectedDays: booking.recurringSchedule?.selectedDays || [],
        endDate: booking.subscription.subscriptionEndDate || null,
        rangeStart: comparisonStart,
        rangeEnd: comparisonEnd,
      });

      const overlappingDate = existingOccurrences.find(
        (d) => proposedDateKeys.has(startOfDay(d).getTime()),
      );
      if (overlappingDate) {
        return { conflict: true, existingBooking: booking, overlappingDate };
      }
    } else {
      // One-time / child-visit → check if its bookingDate is in proposed dates
      const dateKey = startOfDay(booking.bookingDate).getTime();
      if (proposedDateKeys.has(dateKey)) {
        return { conflict: true, existingBooking: booking, overlappingDate: booking.bookingDate };
      }
    }
  }

  return { conflict: false };
}
