import { Check, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PlanOption {
  value: 'oneTime' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  label: string;
  description: string;
  discount?: number;
  popular?: boolean;
  features: string[];
  billingCycle: string;
}

interface SubscriptionPlanSelectorProps {
  selectedPlan: string;
  onPlanChange: (plan: 'oneTime' | 'daily' | 'weekly' | 'biweekly' | 'monthly') => void;
  basePrice: number;
  /** Optional single discount % from service config that overrides per-plan defaults for all non-oneTime plans */
  serviceDiscount?: number;
  /** Optional per-plan discount overrides from service config */
  planDiscounts?: Partial<Record<'daily' | 'weekly' | 'biweekly' | 'monthly', number>>;
}

export function SubscriptionPlanSelector({ selectedPlan, onPlanChange, basePrice, serviceDiscount, planDiscounts }: SubscriptionPlanSelectorProps) {
  const { t } = useTranslation();

  // Default per-plan discount percentages (used when service config doesn't provide its own)
  const DEFAULT_DISCOUNTS: Record<string, number> = {
    daily: 10,
    weekly: 15,
    biweekly: 12,
    monthly: 20,
  };

  const resolveDiscount = (plan: 'daily' | 'weekly' | 'biweekly' | 'monthly'): number => {
    if (planDiscounts && plan in planDiscounts) return planDiscounts[plan] ?? DEFAULT_DISCOUNTS[plan];
    if (serviceDiscount !== undefined && serviceDiscount > 0) return serviceDiscount;
    return DEFAULT_DISCOUNTS[plan];
  };

  const plans: PlanOption[] = [
    {
      value: 'oneTime',
      label: t('subscription.plans.oneTime'),
      description: t('subscription.plans.oneTimeDesc'),
      features: [
        t('subscription.features.flexibleSchedule'),
        t('subscription.features.noCommitment'),
        t('subscription.features.payPerUse')
      ],
      billingCycle: t('subscription.billing.oneTime')
    },
    {
      value: 'daily',
      label: t('subscription.plans.daily'),
      description: t('subscription.plans.dailyDesc'),
      discount: resolveDiscount('daily'),
      features: [
        t('subscription.features.save10'),
        t('subscription.features.dailyService'),
        t('subscription.features.priorityBooking'),
        t('subscription.features.pauseAnytime')
      ],
      billingCycle: t('subscription.billing.monthly')
    },
    {
      value: 'weekly',
      label: t('subscription.plans.weekly'),
      description: t('subscription.plans.weeklyDesc'),
      discount: resolveDiscount('weekly'),
      popular: true,
      features: [
        t('subscription.features.save15'),
        t('subscription.features.weeklyService'),
        t('subscription.features.chooseDays'),
        t('subscription.features.prioritySupport'),
        t('subscription.features.flexibleRescheduling')
      ],
      billingCycle: t('subscription.billing.monthly')
    },
    {
      value: 'biweekly',
      label: t('subscription.plans.biweekly'),
      description: t('subscription.plans.biweeklyDesc'),
      discount: resolveDiscount('biweekly'),
      features: [
        t('subscription.features.save12'),
        t('subscription.features.twiceWeekly'),
        t('subscription.features.customSchedule'),
        t('subscription.features.priorityBooking')
      ],
      billingCycle: t('subscription.billing.monthly')
    },
    {
      value: 'monthly',
      label: t('subscription.plans.monthly'),
      description: t('subscription.plans.monthlyDesc'),
      discount: resolveDiscount('monthly'),
      features: [
        t('subscription.features.save20'),
        t('subscription.features.monthlyService'),
        t('subscription.features.dedicatedWorker'),
        t('subscription.features.premiumSupport'),
        t('subscription.features.freeRescheduling')
      ],
      billingCycle: t('subscription.billing.monthly')
    }
  ];

  const calculatePrice = (plan: PlanOption) => {
    if (plan.discount) {
      const discountedPrice = basePrice * (1 - plan.discount / 100);
      return Math.round(discountedPrice);
    }
    return basePrice;
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">{t('subscription.choosePlan')}</h2>
        <p className="text-muted-foreground">{t('subscription.choosePlanDesc')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <button
            key={plan.value}
            type="button"
            onClick={() => onPlanChange(plan.value)}
            className={`relative p-6 rounded-xl border-2 text-left transition-all hover:shadow-lg ${
              selectedPlan === plan.value
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-lg">
                  <Sparkles className="w-3 h-3" />
                  {t('subscription.mostPopular')}
                </span>
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-lg font-bold mb-1">{plan.label}</h3>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
            </div>

            <div className="mb-4">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-primary">₹{calculatePrice(plan)}</span>
                <span className="text-sm text-muted-foreground">/{t('subscription.perService')}</span>
              </div>
              {plan.discount && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm line-through text-muted-foreground">₹{basePrice}</span>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                    {t('subscription.save')} {plan.discount}%
                  </span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">{plan.billingCycle}</p>
            </div>

            <ul className="space-y-2 mb-4">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {selectedPlan === plan.value && (
              <div className="absolute inset-0 border-2 border-primary rounded-xl pointer-events-none" />
            )}
          </button>
        ))}
      </div>

      {selectedPlan !== 'oneTime' && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm text-blue-900 dark:text-blue-100 mb-1">
                {t('subscription.subscriptionBenefits')}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {t('subscription.subscriptionBenefitsDesc')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
