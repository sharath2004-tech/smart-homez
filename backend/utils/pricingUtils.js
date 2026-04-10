/**
 * Converts a "HH:mm" string to total minutes since midnight.
 * @param {string} timeStr  e.g. "19:00"
 * @returns {number}
 */
const toMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Checks whether a given "HH:mm" time string falls within [startTime, endTime].
 * Handles overnight ranges (e.g. "22:00" – "02:00").
 *
 * @param {string} timeStr    "HH:mm" — the time to test
 * @param {string} startTime  "HH:mm"
 * @param {string} endTime    "HH:mm"
 * @returns {boolean}
 */
const isInTimeWindow = (timeStr, startTime, endTime) => {
  const t     = toMinutes(timeStr);
  const start = toMinutes(startTime);
  const end   = toMinutes(endTime);
  if (start <= end) {
    return t >= start && t <= end;
  }
  // Overnight range
  return t >= start || t <= end;
};

/**
 * Applies the service's timeBasedPricing surcharge to a base price.
 *
 * @param {number} basePrice
 * @param {object} timeBasedPricing  The service.timeBasedPricing subdocument
 * @param {string} bookingTimeStr    "HH:mm" — the scheduled booking time
 * @returns {{ finalPrice: number, surchargeAmount: number, isPeakHours: boolean }}
 */
export const applyTimeBasedSurcharge = (basePrice, timeBasedPricing, bookingTimeStr) => {
  const noop = { finalPrice: basePrice, surchargeAmount: 0, isPeakHours: false };

  if (!timeBasedPricing?.enabled || !timeBasedPricing.surchargeValue || !bookingTimeStr) {
    return noop;
  }

  const { startTime = '19:00', endTime = '23:59', surchargeType = 'percentage', surchargeValue = 0 } = timeBasedPricing;

  if (!isInTimeWindow(bookingTimeStr, startTime, endTime)) {
    return noop;
  }

  let surchargeAmount;
  if (surchargeType === 'percentage') {
    surchargeAmount = Math.round(basePrice * surchargeValue / 100);
  } else {
    surchargeAmount = Math.round(surchargeValue);
  }

  return {
    finalPrice: basePrice + surchargeAmount,
    surchargeAmount,
    isPeakHours: true,
  };
};
