// @vitest-environment node

import { describe, expect, it } from 'vitest';

import Payment from '../../backend/models/Payment.js';
import { parseCoordinate } from '../../backend/utils/coordinateValidation.js';
import { normalizeMaxServices } from '../../backend/utils/dashboardPreferences.js';
import {
    buildBookingDateTime,
    buildVerifiedCartItems,
    normalizeDurationMinutes,
} from '../../backend/utils/deepCleaningValidation.js';
import { getNextRecurringScheduleDate } from '../../backend/utils/recurringSchedule.js';
import {
    findFirstOverlappingOccurrence,
    getSubscriptionConflictWindowEnd,
    isRequestedDateTimeInPast,
} from '../../backend/utils/subscriptionScheduling.js';
import {
    getMinimumSubscriptionStartDate,
    isSubscriptionStartTimeExpired,
} from '../utils/subscriptionStartRules';

describe('coordinate validation helpers', () => {
  it('accepts zero coordinates as valid numeric input', () => {
    expect(parseCoordinate(0)).toBe(0);
    expect(parseCoordinate('0')).toBe(0);
    expect(parseCoordinate('0.000')).toBe(0);
  });

  it('rejects missing and non-numeric coordinates', () => {
    expect(parseCoordinate(undefined)).toBeNull();
    expect(parseCoordinate(null)).toBeNull();
    expect(parseCoordinate('')).toBeNull();
    expect(parseCoordinate('north')).toBeNull();
  });
});

describe('dashboard preferences normalization', () => {
  it('preserves valid maxServices values below six', () => {
    expect(normalizeMaxServices(1)).toBe(1);
    expect(normalizeMaxServices(3)).toBe(3);
    expect(normalizeMaxServices(5)).toBe(5);
  });

  it('clamps invalid values into the supported 1-8 range', () => {
    expect(normalizeMaxServices(0)).toBe(1);
    expect(normalizeMaxServices(99)).toBe(8);
    expect(normalizeMaxServices('abc')).toBe(1);
  });
});

describe('deep cleaning validation helpers', () => {
  const config = {
    items: [
      {
        id: 'kitchen_deep',
        name: 'Kitchen Deep Cleaning',
        category: 'kitchen',
        pricingType: 'tiered',
        price: 0,
        durationMinutes: 120,
        unit: 'service',
        tiers: [
          { label: '2 BHK', price: 2600 },
          { label: '3 BHK', price: 3200 },
        ],
      },
      {
        id: 'fullhouse_bare',
        name: 'Full House Deep Clean — Bare Flat',
        category: 'fullhouse',
        pricingType: 'per_sqft',
        price: 8,
        durationMinutes: 240,
        unit: 'sqft',
      },
      {
        id: 'fan_clean',
        name: 'Fan Cleaning',
        category: 'appliances',
        pricingType: 'per_unit',
        price: 100,
        durationMinutes: 30,
        unit: 'fan',
        maxQty: 20,
      },
    ],
  };

  it('builds booking date time only for valid dates and HH:MM input', () => {
    const bookingDate = buildBookingDateTime('2026-04-05', '09:30');
    expect(bookingDate).not.toBeNull();
    expect(bookingDate?.getHours()).toBe(9);
    expect(bookingDate?.getMinutes()).toBe(30);

    expect(buildBookingDateTime('invalid-date', '09:30')).toBeNull();
    expect(buildBookingDateTime('2026-04-05', '25:00')).toBeNull();
  });

  it('rejects invalid tier selections instead of silently pricing them at zero', () => {
    const result = buildVerifiedCartItems([
      { itemId: 'kitchen_deep', qty: 1, selectedTier: '9 BHK' },
    ], config);

    expect(result.verifiedCartItems).toHaveLength(0);
    expect(result.invalidItems).toEqual([
      expect.objectContaining({ itemId: 'kitchen_deep' }),
    ]);
    expect(result.calculatedTotal).toBe(0);
  });

  it('rejects sqft items without a positive area value', () => {
    const result = buildVerifiedCartItems([
      { itemId: 'fullhouse_bare', areaValue: 0 },
    ], config);

    expect(result.verifiedCartItems).toHaveLength(0);
    expect(result.invalidItems[0]?.reason).toContain('requires a valid area value greater than 0');
  });

  it('rejects quantities above configured maxQty', () => {
    const result = buildVerifiedCartItems([
      { itemId: 'fan_clean', qty: 21 },
    ], config);

    expect(result.verifiedCartItems).toHaveLength(0);
    expect(result.invalidItems[0]?.reason).toContain('maximum quantity of 20');
  });

  it('calculates valid tiered and sqft cart totals correctly', () => {
    const result = buildVerifiedCartItems([
      { itemId: 'kitchen_deep', qty: 1, selectedTier: '2 BHK' },
      { itemId: 'fullhouse_bare', areaValue: 100 },
      { itemId: 'fan_clean', qty: 2 },
    ], config);

    expect(result.invalidItems).toHaveLength(0);
    expect(result.verifiedCartItems).toHaveLength(3);
    expect(result.calculatedTotal).toBe(2600 + 800 + 200);
  });

  it('normalizes invalid durations to a safe minimum default', () => {
    expect(normalizeDurationMinutes(undefined)).toBe(180);
    expect(normalizeDurationMinutes(0)).toBe(180);
    expect(normalizeDurationMinutes(14.2)).toBe(15);
    expect(normalizeDurationMinutes(47.6)).toBe(48);
  });
});

describe('recurring schedule helpers', () => {
  it('advances monthly schedules by calendar month instead of one day', () => {
    const nextDate = getNextRecurringScheduleDate({
      frequency: 'monthly',
      startDate: new Date('2026-03-26T00:00:00.000Z'),
      selectedDays: [],
    });

    expect(nextDate.getFullYear()).toBe(2026);
    expect(nextDate.getMonth()).toBe(3);
    expect(nextDate.getDate()).toBe(26);
  });

  it('keeps daily schedules advancing by one day', () => {
    const nextDate = getNextRecurringScheduleDate({
      frequency: 'daily',
      startDate: new Date('2026-03-26T00:00:00.000Z'),
      selectedDays: [],
    });

    expect(nextDate.getFullYear()).toBe(2026);
    expect(nextDate.getMonth()).toBe(2);
    expect(nextDate.getDate()).toBe(27);
  });

  it('detects overlapping recurring subscriptions beyond the first booking day', () => {
    const overlapDate = findFirstOverlappingOccurrence({
      proposedSchedule: {
        frequency: 'weekly',
        startDate: new Date('2026-03-31T00:00:00.000Z'),
        endDate: null,
        selectedDays: ['friday'],
        startTime: '09:00',
        endTime: '10:00',
      },
      existingSchedule: {
        frequency: 'weekly',
        startDate: new Date('2026-03-27T00:00:00.000Z'),
        endDate: null,
        selectedDays: ['friday'],
        startTime: '09:30',
        endTime: '10:30',
      },
      rangeStart: new Date('2026-03-27T00:00:00.000Z'),
      rangeEnd: getSubscriptionConflictWindowEnd(new Date('2026-03-27T00:00:00.000Z')),
    });

    expect(overlapDate).not.toBeNull();
    expect(overlapDate?.getDay()).toBe(5);
    expect(overlapDate?.getTime()).toBeGreaterThan(new Date('2026-03-31T00:00:00.000Z').getTime());
  });

  it('flags same-day subscription starts whose preferred time has already passed', () => {
    expect(isRequestedDateTimeInPast({
      date: '2026-03-26',
      time: '09:00',
      now: new Date('2026-03-26T09:05:00.000Z'),
      bufferMinutes: 30,
    })).toBe(true);

    expect(isRequestedDateTimeInPast({
      date: '2026-03-27',
      time: '09:00',
      now: new Date('2026-03-26T09:05:00.000Z'),
      bufferMinutes: 30,
    })).toBe(false);
  });
});

describe('subscription start rules', () => {
  it('pushes the minimum start date to tomorrow when today\'s preferred time is over', () => {
    const now = new Date(2026, 2, 26, 9, 5, 0, 0);

    expect(isSubscriptionStartTimeExpired('2026-03-26', '09:00', now, 30)).toBe(true);
    expect(getMinimumSubscriptionStartDate('09:00', now, 30)).toBe('2026-03-27');
    expect(getMinimumSubscriptionStartDate('11:00', now, 30)).toBe('2026-03-26');
  });
});

describe('payment model compatibility', () => {
  it('supports the qr-upi payment method used by the payment route and UI', () => {
    expect(Payment.schema.path('paymentMethod').enumValues).toContain('qr-upi');
  });
});