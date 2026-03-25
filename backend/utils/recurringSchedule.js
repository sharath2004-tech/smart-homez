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