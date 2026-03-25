const pad = (value: number) => String(value).padStart(2, '0');

export const formatDateInputValue = (date: Date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
);

export const parseTimeToMinutes = (time: string): number | null => {
  if (!/^\d{2}:\d{2}$/.test(time)) {
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

export const isSubscriptionStartTimeExpired = (
  startDate: string,
  preferredTime: string,
  now: Date = new Date(),
  bufferMinutes = 30,
): boolean => {
  if (!startDate) {
    return false;
  }

  const requestedMinutes = parseTimeToMinutes(preferredTime);
  if (requestedMinutes === null) {
    return false;
  }

  const today = formatDateInputValue(now);
  if (startDate !== today) {
    return false;
  }

  const nowMinutes = (now.getHours() * 60) + now.getMinutes() + bufferMinutes;
  return requestedMinutes <= nowMinutes;
};

export const getMinimumSubscriptionStartDate = (
  preferredTime: string,
  now: Date = new Date(),
  bufferMinutes = 30,
): string => {
  if (!isSubscriptionStartTimeExpired(formatDateInputValue(now), preferredTime, now, bufferMinutes)) {
    return formatDateInputValue(now);
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDateInputValue(tomorrow);
};
