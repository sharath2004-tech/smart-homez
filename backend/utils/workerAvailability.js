import Booking from '../models/Booking.js';

const DEFAULT_TIMEZONE = 'Asia/Kolkata';
const WEEKDAY_TO_INDEX = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};

export const timeStringToMinutes = (time) => {
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }

  const [hours, minutes] = time.split(':').map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
};

export const minutesToTimeString = (minutes) => {
  const normalized = Math.max(0, Math.min(1439, minutes));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const getValidTimeZone = (timeZone) => {
  try {
    const resolved = typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : DEFAULT_TIMEZONE;
    new Intl.DateTimeFormat('en-US', { timeZone: resolved }).format(new Date());
    return resolved;
  } catch {
    return DEFAULT_TIMEZONE;
  }
};

const getZonedDateParts = (date = new Date(), timeZone = DEFAULT_TIMEZONE) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: getValidTimeZone(timeZone),
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(date);
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const weekdayKey = (map.weekday || '').slice(0, 3).toLowerCase();

    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hours: Number(map.hour),
      minutes: Number(map.minute),
      weekday: WEEKDAY_TO_INDEX[weekdayKey] ?? date.getDay(),
      dateKey: `${map.year}-${map.month}-${map.day}`
    };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hours: date.getHours(),
      minutes: date.getMinutes(),
      weekday: date.getDay(),
      dateKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    };
  }
};

const getWorkerTimeZone = (worker) => getValidTimeZone(worker?.workerProfile?.workingTimeWindow?.timezone);

export const normalizeWorkingTimeSlots = (workingTimeWindow = {}) => {
  const slots = Array.isArray(workingTimeWindow.timeSlots) && workingTimeWindow.timeSlots.length > 0
    ? workingTimeWindow.timeSlots
    : (workingTimeWindow.startTime && workingTimeWindow.endTime
        ? [{ startTime: workingTimeWindow.startTime, endTime: workingTimeWindow.endTime }]
        : []);

  return slots
    .map(slot => {
      const startMinutes = timeStringToMinutes(slot?.startTime);
      const endMinutes = timeStringToMinutes(slot?.endTime);
      if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
        return null;
      }

      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        startMinutes,
        endMinutes
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.startMinutes - b.startMinutes);
};

export const isWorkerOnLeaveForDate = (worker, referenceDate = new Date()) => {
  if (!worker?.workerProfile?.leaves?.length) {
    return false;
  }

  const timeZone = getWorkerTimeZone(worker);
  const targetDateKey = getZonedDateParts(new Date(referenceDate), timeZone).dateKey;

  return worker.workerProfile.leaves.some(leave => {
    if (leave.status !== 'approved' || !leave.date) {
      return false;
    }

    return getZonedDateParts(new Date(leave.date), timeZone).dateKey === targetDateKey;
  });
};

export const getWorkerWorkingWindowStatus = (worker, referenceDate = new Date()) => {
  const workingTimeWindow = worker?.workerProfile?.workingTimeWindow;
  if (!workingTimeWindow?.enabled) {
    return {
      enabled: false,
      withinWindow: true,
      reason: null,
      currentMinutes: null,
      currentDay: null,
      slots: []
    };
  }

  const timeZone = getWorkerTimeZone(worker);
  const nowParts = getZonedDateParts(new Date(referenceDate), timeZone);
  const currentMinutes = nowParts.hours * 60 + nowParts.minutes;
  const workingDays = Array.isArray(workingTimeWindow.workingDays) && workingTimeWindow.workingDays.length > 0
    ? workingTimeWindow.workingDays.map(Number)
    : null;
  const slots = normalizeWorkingTimeSlots(workingTimeWindow);

  if (workingDays && !workingDays.includes(nowParts.weekday)) {
    return {
      enabled: true,
      withinWindow: false,
      reason: 'outside-working-days',
      currentMinutes,
      currentDay: nowParts.weekday,
      slots,
      timeZone
    };
  }

  if (slots.length === 0) {
    return {
      enabled: true,
      withinWindow: false,
      reason: 'working-hours-not-configured',
      currentMinutes,
      currentDay: nowParts.weekday,
      slots,
      timeZone
    };
  }

  const activeSlot = slots.find(slot => currentMinutes >= slot.startMinutes && currentMinutes < slot.endMinutes);
  if (!activeSlot) {
    return {
      enabled: true,
      withinWindow: false,
      reason: 'outside-working-hours',
      currentMinutes,
      currentDay: nowParts.weekday,
      slots,
      timeZone
    };
  }

  return {
    enabled: true,
    withinWindow: true,
    reason: null,
    currentMinutes,
    currentDay: nowParts.weekday,
    slots,
    activeSlot,
    timeZone
  };
};

export const isWorkerAvailableForTimeRange = (worker, bookingDate, startTime, endTime) => {
  const requestedStart = timeStringToMinutes(startTime);
  const requestedEnd = timeStringToMinutes(endTime);

  if (requestedStart === null || requestedEnd === null || requestedEnd <= requestedStart) {
    return {
      available: false,
      reason: 'Invalid booking time range'
    };
  }

  if (!worker?.isActive) {
    return {
      available: false,
      reason: 'Worker account is inactive'
    };
  }

  if (worker?.workerProfile?.availability !== true) {
    return {
      available: false,
      reason: 'Worker is offline'
    };
  }

  if (isWorkerOnLeaveForDate(worker, bookingDate)) {
    return {
      available: false,
      reason: 'Worker is on approved leave for this date'
    };
  }

  const workingTimeWindow = worker?.workerProfile?.workingTimeWindow;
  if (!workingTimeWindow?.enabled) {
    return {
      available: true,
      reason: 'Within unrestricted working hours'
    };
  }

  const timeZone = getWorkerTimeZone(worker);
  const dayParts = getZonedDateParts(new Date(bookingDate), timeZone);
  const workingDays = Array.isArray(workingTimeWindow.workingDays) && workingTimeWindow.workingDays.length > 0
    ? workingTimeWindow.workingDays.map(Number)
    : null;

  if (workingDays && !workingDays.includes(dayParts.weekday)) {
    return {
      available: false,
      reason: 'Worker is not scheduled to work on this day'
    };
  }

  const slots = normalizeWorkingTimeSlots(workingTimeWindow);
  if (slots.length === 0) {
    return {
      available: false,
      reason: 'Worker working hours are not configured'
    };
  }

  const matchingSlot = slots.find(slot => requestedStart >= slot.startMinutes && requestedEnd <= slot.endMinutes);
  if (!matchingSlot) {
    const slotLabel = slots.map(slot => `${slot.startTime}-${slot.endTime}`).join(', ');
    return {
      available: false,
      reason: `Worker is only available during: ${slotLabel}`
    };
  }

  return {
    available: true,
    reason: 'Requested slot is within worker working hours'
  };
};

export const isWorkerEligibleForAssignment = (worker) => {
  if (!worker) {
    return {
      eligible: false,
      reason: 'Worker not found'
    };
  }

  if (worker.role && worker.role !== 'worker') {
    return {
      eligible: false,
      reason: 'Selected user is not a worker'
    };
  }

  if (worker.isActive === false) {
    return {
      eligible: false,
      reason: 'Worker account is inactive'
    };
  }

  if (worker.isFirstLogin === true) {
    return {
      eligible: false,
      reason: 'Worker must sign in and change the system-generated password before taking bookings'
    };
  }

  return {
    eligible: true,
    reason: null
  };
};

export const getWorkerBlockedTimeRanges = (worker, bookingDate) => {
  const workingTimeWindow = worker?.workerProfile?.workingTimeWindow;
  if (!workingTimeWindow?.enabled) {
    return [];
  }

  const timeZone = getWorkerTimeZone(worker);
  const dayParts = getZonedDateParts(new Date(bookingDate), timeZone);
  const workingDays = Array.isArray(workingTimeWindow.workingDays) && workingTimeWindow.workingDays.length > 0
    ? workingTimeWindow.workingDays.map(Number)
    : null;
  const slots = normalizeWorkingTimeSlots(workingTimeWindow);

  if ((workingDays && !workingDays.includes(dayParts.weekday)) || slots.length === 0) {
    return [{ startTime: '00:00', endTime: '23:59', reason: 'outside-working-window' }];
  }

  const blockedRanges = [];
  let cursor = 0;

  for (const slot of slots) {
    if (slot.startMinutes > cursor) {
      blockedRanges.push({
        startTime: minutesToTimeString(cursor),
        endTime: minutesToTimeString(slot.startMinutes),
        reason: 'outside-working-window'
      });
    }

    cursor = Math.max(cursor, slot.endMinutes);
  }

  if (cursor < 1440) {
    blockedRanges.push({
      startTime: minutesToTimeString(cursor),
      endTime: '23:59',
      reason: 'outside-working-window'
    });
  }

  return blockedRanges.filter(range => range.startTime !== range.endTime);
};

export const isWorkerAssignedToBooking = (booking, workerId) => {
  const workerIdString = workerId?.toString?.() || String(workerId);
  if (!workerIdString || !booking) {
    return false;
  }

  if (booking.worker?.toString?.() === workerIdString) {
    return true;
  }

  return Array.isArray(booking.supportStaff) && booking.supportStaff.some(member => member?.worker?.toString?.() === workerIdString);
};

export const getWorkerOperationalAvailabilityFromBookings = (worker, bookings = [], referenceDate = new Date()) => {
  const workerId = worker?._id?.toString?.() || worker?.toString?.();
  if (!workerId) {
    return {
      operationsCompleted: false,
      activeOrUpcomingBookings: [],
      completedOrExecutedBookings: []
    };
  }

  const windowStatus = getWorkerWorkingWindowStatus(worker, referenceDate);
  const currentMinutes = windowStatus.currentMinutes ?? (referenceDate.getHours() * 60 + referenceDate.getMinutes());
  const assignedBookings = bookings.filter(booking => isWorkerAssignedToBooking(booking, workerId));

  const activeOrUpcomingBookings = assignedBookings.filter(booking => {
    if (!['pending', 'confirmed', 'in-progress'].includes(booking.status)) {
      return false;
    }

    if (booking.status === 'in-progress') {
      return true;
    }

    const bookingEnd = timeStringToMinutes(booking.endTime);
    return bookingEnd === null ? true : bookingEnd > currentMinutes;
  });

  const completedOrExecutedBookings = assignedBookings.filter(booking => {
    if (['pending-review', 'completed'].includes(booking.status)) {
      return true;
    }

    return Boolean(booking.actualEndTime);
  });

  return {
    operationsCompleted: completedOrExecutedBookings.length > 0 && activeOrUpcomingBookings.length === 0,
    activeOrUpcomingBookings,
    completedOrExecutedBookings
  };
};

const getLocalDayBounds = (referenceDate = new Date()) => {
  const startOfDay = new Date(referenceDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(referenceDate);
  endOfDay.setHours(23, 59, 59, 999);
  return { startOfDay, endOfDay };
};

const fetchWorkerBookingsForDay = async (worker, referenceDate = new Date()) => {
  const workerId = worker?._id || worker;
  if (!workerId) {
    return [];
  }

  const { startOfDay, endOfDay } = getLocalDayBounds(referenceDate);
  return Booking.find({
    bookingDate: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    status: { $ne: 'cancelled' },
    $or: [
      { worker: workerId },
      { 'supportStaff.worker': workerId }
    ]
  })
    .select('worker supportStaff.worker status startTime endTime actualEndTime bookingDate')
    .lean();
};

export const evaluateWorkerEffectiveAvailability = async (worker, { referenceDate = new Date(), bookings = null } = {}) => {
  if (!worker) {
    return {
      effectiveAvailability: false,
      reason: 'Worker not found',
      manualAvailability: false,
      withinWorkingWindow: false,
      operationsCompleted: false,
      onLeave: false
    };
  }

  const assignmentEligibility = isWorkerEligibleForAssignment(worker);
  const manualAvailability = assignmentEligibility.eligible && worker?.workerProfile?.availability === true;
  const onLeave = isWorkerOnLeaveForDate(worker, referenceDate);
  const windowStatus = getWorkerWorkingWindowStatus(worker, referenceDate);
  const dayBookings = Array.isArray(bookings) ? bookings : await fetchWorkerBookingsForDay(worker, referenceDate);
  const operationalStatus = getWorkerOperationalAvailabilityFromBookings(worker, dayBookings, referenceDate);

  let reason = null;
  if (!assignmentEligibility.eligible) {
    reason = assignmentEligibility.reason;
  } else if (worker?.workerProfile?.availability !== true) {
    reason = 'Worker is offline';
  } else if (onLeave) {
    reason = 'Worker is on approved leave today';
  } else if (!windowStatus.withinWindow) {
    if (windowStatus.reason === 'outside-working-days') {
      reason = 'Outside configured working days';
    } else if (windowStatus.reason === 'working-hours-not-configured') {
      reason = 'Working hours are not configured';
    } else {
      const slotsLabel = (windowStatus.slots || []).map(slot => `${slot.startTime}-${slot.endTime}`).join(', ');
      reason = slotsLabel ? `Available only during ${slotsLabel}` : 'Outside configured working hours';
    }
  } else if (operationalStatus.operationsCompleted) {
    reason = 'All assigned operations for today are already completed';
  }

  return {
    effectiveAvailability: manualAvailability && !onLeave && windowStatus.withinWindow && !operationalStatus.operationsCompleted,
    reason,
    manualAvailability,
    withinWorkingWindow: windowStatus.withinWindow,
    operationsCompleted: operationalStatus.operationsCompleted,
    onLeave,
    activeSlot: windowStatus.activeSlot || null
  };
};