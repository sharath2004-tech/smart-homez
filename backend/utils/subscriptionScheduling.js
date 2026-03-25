import { addDays, getNextRecurringScheduleDate, startOfDay } from './recurringSchedule.js';

export const SUBSCRIPTION_PAST_TIME_BUFFER_MINUTES = 30;
export const SUBSCRIPTION_CONFLICT_LOOKAHEAD_DAYS = 365;

export const parseTimeToMinutes = (time) => {
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }

  const [hours, minutes] = time.split(':').map(Number);
  if (
    !Number.isInteger(hours)
    || !Number.isInteger(minutes)
    || hours < 0
    || hours > 23
    || minutes < 0
    || minutes > 59
  ) {
    return null;
  }

  return (hours * 60) + minutes;
};

export const timeRangesOverlap = (startA, endA, startB, endB) => {
  const startMinutesA = parseTimeToMinutes(startA);
  const endMinutesA = parseTimeToMinutes(endA);
  const startMinutesB = parseTimeToMinutes(startB);
  const endMinutesB = parseTimeToMinutes(endB);

  if (
    startMinutesA === null
    || endMinutesA === null
    || startMinutesB === null
    || endMinutesB === null
  ) {
    return false;
  }

  return startMinutesA < endMinutesB && endMinutesA > startMinutesB;
};

export const getSubscriptionConflictWindowEnd = (startDate, explicitEndDate = null, lookaheadDays = SUBSCRIPTION_CONFLICT_LOOKAHEAD_DAYS) => {
  const start = startOfDay(startDate);
  const lookaheadEnd = addDays(start, lookaheadDays);

  if (!explicitEndDate) {
    return lookaheadEnd;
  }

  const normalizedEndDate = startOfDay(explicitEndDate);
  return normalizedEndDate < lookaheadEnd ? normalizedEndDate : lookaheadEnd;
};

export const buildRecurringOccurrences = ({
  frequency,
  startDate,
  selectedDays = [],
  endDate = null,
  rangeStart = null,
  rangeEnd = null,
  maxOccurrences = SUBSCRIPTION_CONFLICT_LOOKAHEAD_DAYS + 1,
}) => {
  const normalizedStartDate = startOfDay(startDate);
  const normalizedRangeStart = rangeStart ? startOfDay(rangeStart) : null;
  const normalizedRangeEnd = rangeEnd ? startOfDay(rangeEnd) : null;
  const normalizedEndDate = endDate ? startOfDay(endDate) : null;
  const hardEnd = [normalizedRangeEnd, normalizedEndDate]
    .filter(Boolean)
    .sort((left, right) => left.getTime() - right.getTime())[0] || null;

  const occurrences = [];
  let currentDate = normalizedStartDate;
  let guard = 0;

  while (currentDate && guard < maxOccurrences) {
    if (hardEnd && currentDate > hardEnd) {
      break;
    }

    if (!normalizedRangeStart || currentDate >= normalizedRangeStart) {
      occurrences.push(new Date(currentDate));
    }

    const nextDate = getNextRecurringScheduleDate({
      frequency,
      startDate: currentDate,
      selectedDays,
    });

    if (!(nextDate instanceof Date) || Number.isNaN(nextDate.getTime())) {
      break;
    }

    const normalizedNextDate = startOfDay(nextDate);
    if (normalizedNextDate.getTime() === currentDate.getTime()) {
      break;
    }

    currentDate = normalizedNextDate;
    guard += 1;
  }

  return occurrences;
};

export const findFirstOverlappingOccurrence = ({
  proposedSchedule,
  existingSchedule,
  rangeStart = null,
  rangeEnd = null,
}) => {
  if (!timeRangesOverlap(
    proposedSchedule.startTime,
    proposedSchedule.endTime,
    existingSchedule.startTime,
    existingSchedule.endTime,
  )) {
    return null;
  }

  const proposedOccurrences = buildRecurringOccurrences({
    frequency: proposedSchedule.frequency,
    startDate: proposedSchedule.startDate,
    selectedDays: proposedSchedule.selectedDays || [],
    endDate: proposedSchedule.endDate || null,
    rangeStart,
    rangeEnd,
  });

  const existingOccurrences = buildRecurringOccurrences({
    frequency: existingSchedule.frequency,
    startDate: existingSchedule.startDate,
    selectedDays: existingSchedule.selectedDays || [],
    endDate: existingSchedule.endDate || null,
    rangeStart,
    rangeEnd,
  });

  const proposedKeys = new Set(proposedOccurrences.map((date) => startOfDay(date).getTime()));

  return existingOccurrences.find((date) => proposedKeys.has(startOfDay(date).getTime())) || null;
};

export const isRequestedDateTimeInPast = ({
  date,
  time,
  now = new Date(),
  bufferMinutes = SUBSCRIPTION_PAST_TIME_BUFFER_MINUTES,
}) => {
  const requestedMinutes = parseTimeToMinutes(time);
  if (requestedMinutes === null) {
    return false;
  }

  const requestedDate = startOfDay(date);
  const currentDate = startOfDay(now);
  if (requestedDate.getTime() !== currentDate.getTime()) {
    return false;
  }

  const nowMinutes = (now.getHours() * 60) + now.getMinutes() + bufferMinutes;
  return requestedMinutes <= nowMinutes;
};

export const getNextBookableDate = (now = new Date()) => addDays(now, 1);
