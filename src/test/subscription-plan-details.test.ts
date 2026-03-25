import { describe, expect, it } from 'vitest';

import {
    getApproxMonthlyVisits,
    getCustomerPlanFrequencyLabel,
} from '../utils/subscriptionPlanDetails';

describe('subscription plan details helpers', () => {
  it('treats monthly plans as one visit per month', () => {
    expect(getApproxMonthlyVisits('monthly')).toBe(1);
    expect(getCustomerPlanFrequencyLabel('monthly')).toBe('Once a month');
  });

  it('treats biweekly plans as every two weeks', () => {
    expect(getApproxMonthlyVisits('biweekly')).toBe(2);
    expect(getCustomerPlanFrequencyLabel('biweekly')).toBe('Every 2 weeks');
  });

  it('uses selected weekly day count for weekly labels and pricing', () => {
    expect(getApproxMonthlyVisits('weekly', 3)).toBe(12);
    expect(getCustomerPlanFrequencyLabel('weekly', 3)).toBe('3 days per week');
  });
});