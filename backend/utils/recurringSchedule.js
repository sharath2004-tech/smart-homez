const DAY_INDEX_BY_NAME = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const addDays = (value, days) => {
  const date = startOfDay(value);
  date.setDate(date.getDate() + days);
  return date;
};

export const sameDay = (left, right) => startOfDay(left).getTime() === startOfDay(right).getTime();

export const findNextSelectedDay = (fromDate, selectedDays = []) => {
  const allowedDayIndexes = selectedDays
    .map((day) => DAY_INDEX_BY_NAME[String(day || '').toLowerCase()])
    .filter((day) => Number.isInteger(day));

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

export const getNextRecurringScheduleDate = ({ frequency, startDate, selectedDays = [] }) => {
  const normalizedFrequency = String(frequency || '').toLowerCase();

  if (normalizedFrequency === 'daily') {
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

/**
 * Given an existing (ordered) list of session rows for a subscription root booking,
 * generates projected future session entries up to the subscription end date
 * (or 60 days ahead when there is no end date).
 *
 * Projected entries have status 'scheduled' and isProjected=true so callers can
 * render them differently from real DB-backed sessions.
 *
 * @param {object} rootBooking - Lean root booking document (with recurringSchedule, subscription, startTime, endTime)
 * @param {Array}  existingRows - Already-built session row array (may be empty, root included)
 * @returns {Array} Array of projected session row objects to append
 */
export const projectSubscriptionSessions = (rootBooking, existingRows) => {
  const frequency = rootBooking.recurringSchedule?.frequency;
  const selectedDays = rootBooking.recurringSchedule?.selectedDays || [];
  const rawEnd = rootBooking.subscription?.subscriptionEndDate
    || rootBooking.recurringSchedule?.endDate;

  // Horizon: subscription end date, or 60 days from today (for open-ended plans)
  const horizon = rawEnd
    ? startOfDay(rawEnd)
    : addDays(new Date(), 60);

  // Build a set of existing dates for deduplication
  const existingDateSet = new Set(
    existingRows.map(s => startOfDay(s.bookingDate).toISOString().split('T')[0])
  );

  // Start projecting from the date of the last known session
  let cursor;
  if (existingRows.length > 0) {
    const maxTs = Math.max(...existingRows.map(s => new Date(s.bookingDate).getTime()));
    cursor = new Date(maxTs);
  } else {
    cursor = startOfDay(rootBooking.subscription?.subscriptionStartDate || rootBooking.bookingDate || new Date());
  }

  const projected = [];
  let sessionNum = existingRows.length + 1;
  let safety = 0;

  while (safety++ < 300) {
    const next = getNextRecurringScheduleDate({ frequency, startDate: cursor, selectedDays });
    if (next > horizon) break;

    const dateKey = next.toISOString().split('T')[0];
    if (!existingDateSet.has(dateKey)) {
      projected.push({
        sessionNumber: sessionNum++,
        _id: `proj-${dateKey}`,
        bookingDate: next.toISOString(),
        startTime: rootBooking.startTime,
        endTime: rootBooking.endTime,
        status: 'scheduled',
        worker: null,
        actualStartTime: null,
        actualEndTime: null,
        actualDurationMinutes: null,
        scheduledDurationMinutes: null,
        overtimeMinutes: 0,
        overtimeCharges: 0,
        isProjected: true,
      });
      existingDateSet.add(dateKey);
    }
    cursor = next;
  }

  return projected;
};