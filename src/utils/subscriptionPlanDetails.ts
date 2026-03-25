export type CustomerSubscriptionPlan = 'oneTime' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export const getApproxMonthlyVisits = (
  plan: CustomerSubscriptionPlan,
  selectedDayCount = 0,
) => {
  if (plan === 'daily') {
    return 30;
  }

  if (plan === 'weekly') {
    return Math.max(selectedDayCount, 1) * 4;
  }

  if (plan === 'biweekly') {
    return 2;
  }

  if (plan === 'monthly') {
    return 1;
  }

  return 1;
};

export const getCustomerPlanFrequencyLabel = (
  plan: CustomerSubscriptionPlan,
  selectedDayCount = 0,
) => {
  if (plan === 'daily') {
    return 'Every day';
  }

  if (plan === 'weekly') {
    return selectedDayCount > 0
      ? `${selectedDayCount} day${selectedDayCount > 1 ? 's' : ''} per week`
      : 'Once a week';
  }

  if (plan === 'biweekly') {
    return 'Every 2 weeks';
  }

  if (plan === 'monthly') {
    return 'Once a month';
  }

  return 'One-time service';
};