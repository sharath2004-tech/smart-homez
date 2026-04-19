import AppLayout from "@/components/AppLayout";
import { RecurringScheduleSetup } from "@/components/RecurringScheduleSetup";
import SubscriptionPaymentStep from "@/components/SubscriptionPaymentStep";
import { SubscriptionPlanSelector } from "@/components/SubscriptionPlanSelector";
import { Button } from "@/components/ui/button";
import { useServiceBookingAvailability } from "@/hooks/useServiceBookingAvailability";
import { authAPI, bookingsAPI, servicesAPI } from "@/lib/api";
import { getApproxMonthlyVisits } from "@/utils/subscriptionPlanDetails";
import { ArrowLeft, CheckCircle2, MapPin, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

interface Service {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration: number;
  subscriptionOptions?: {
    discount?: number;
    planDiscounts?: Partial<Record<'daily' | 'weekly' | 'biweekly' | 'monthly', number>>;
  };
}

interface RecurringSchedule {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  startDate: string;
  endDate?: string;
  preferredTime: string;
  duration: number;
  specificDays?: string[];
  autoRenewal: boolean;
  pauseAllowed: boolean;
}

const addHoursToTime = (time: string, hours: number) => {
  const [rawHours, rawMinutes] = time.split(':').map(Number);
  const totalMinutes = (rawHours * 60) + rawMinutes + Math.round(hours * 60);
  const normalizedMinutes = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hoursPart = Math.floor(normalizedMinutes / 60);
  const minutesPart = normalizedMinutes % 60;

  return `${String(hoursPart).padStart(2, '0')}:${String(minutesPart).padStart(2, '0')}`;
};

export default function SubscriptionBookingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [service, setService] = useState<Service | null>(null);
  const [serviceNotFound, setServiceNotFound] = useState(false);
  const [profile, setProfile] = useState<{
    name?: string;
    isPhoneVerified?: boolean;
    addresses?: Array<{
      isDefault?: boolean;
      apartmentName?: string;
      address?: string;
      area?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      location?: { coordinates?: number[] };
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [createdSubscription, setCreatedSubscription] = useState<{ bookingId: string; amount: number } | null>(null);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState<'plan' | 'schedule' | 'confirm'>('plan');
  
  const [selectedPlan, setSelectedPlan] = useState<'oneTime' | 'daily' | 'weekly' | 'biweekly' | 'monthly'>('oneTime');
  const [schedule, setSchedule] = useState<RecurringSchedule>({
    frequency: 'daily',
    startDate: '',
    preferredTime: '09:00',
    duration: 2,
    autoRenewal: true,
    pauseAllowed: true,
    specificDays: []
  });

  const {
    availability,
    checkingAvailability,
    requestingService,
    resolvedLocation,
    hasResolvedLocation,
    isOutOfRegion,
    canBookService,
    requestService,
  } = useServiceBookingAvailability(service?._id, profile);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [serviceData, profileData] = await Promise.all([
          servicesAPI.getById(id!),
          authAPI.getProfile()
        ]);
        setService(serviceData.service);
        setProfile(profileData.user || profileData);
      } catch (error) {
        console.error('Error fetching data:', error);
        setServiceNotFound(true);
        toast.error(t('subscription.failedToLoad'));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  const calculateTotalPrice = () => {
    if (!service) return 0;
    
    const basePrice = service.price;
    
    // Apply discounts based on plan
    const getPlanDiscount = (plan: string): number => {
      const planDiscounts = service.subscriptionOptions?.planDiscounts;
      const serviceDiscount = service.subscriptionOptions?.discount;
      const defaults: Record<string, number> = { oneTime: 0, daily: 10, weekly: 15, biweekly: 12, monthly: 20 };
      if (plan !== 'oneTime') {
        const key = plan as 'daily' | 'weekly' | 'biweekly' | 'monthly';
        if (planDiscounts?.[key] !== undefined) return planDiscounts[key]!;
        if (serviceDiscount !== undefined) return serviceDiscount;
      }
      return defaults[plan] ?? 0;
    };
    const discounts: Record<string, number> = {
      oneTime: 0,
      daily: getPlanDiscount('daily'),
      weekly: getPlanDiscount('weekly'),
      biweekly: getPlanDiscount('biweekly'),
      monthly: getPlanDiscount('monthly')
    };
    
    const discount = discounts[selectedPlan];
    const discountedPrice = basePrice * (1 - discount / 100);
    
    // Calculate based on schedule duration
    let totalPrice = discountedPrice * schedule.duration;
    
    // For subscriptions, estimate monthly cost
    if (selectedPlan !== 'oneTime') {
      totalPrice = totalPrice * getApproxMonthlyVisits(selectedPlan, schedule.specificDays?.length || 0);
    }
    
    return Math.round(totalPrice);
  };

  const handleContinue = () => {
    if (currentStep === 'plan') {
      setCurrentStep('schedule');
    } else if (currentStep === 'schedule') {
      if (!schedule.startDate) {
        toast.error(t('subscription.pleaseSelectStartDate'));
        return;
      }

      if (selectedPlan === 'weekly' && (schedule.specificDays?.length || 0) === 0) {
        toast.error('Please select your preferred days for the weekly plan.');
        return;
      }

      setCurrentStep('confirm');
    }
  };

  const handleBooking = async () => {
    if (isOutOfRegion) {
      await requestService(service?.name);
      return;
    }

    if (!canBookService) {
      toast.error(
        hasResolvedLocation
          ? 'Checking whether this service is available in your region. Please wait a moment.'
          : 'Please set a service location in your profile or services page before booking.'
      );
      return;
    }

    if (!profile?.isPhoneVerified) {
      toast.error('Please verify your mobile number before confirming the booking.');
      return;
    }

    try {
      setBooking(true);
      
      const userLocation = localStorage.getItem('userLocation');
      const location = userLocation ? JSON.parse(userLocation) : null;
      const isSubscriptionBooking = selectedPlan !== 'oneTime';
      const selectedDays = selectedPlan === 'weekly' ? (schedule.specificDays || []) : [];

      if (selectedPlan === 'weekly' && selectedDays.length === 0) {
        toast.error('Please select your preferred days for the weekly plan.');
        return;
      }

      const bookingData = {
        service: service?._id,
        bookingDate: schedule.startDate,
        startTime: schedule.preferredTime,
        endTime: addHoursToTime(schedule.preferredTime, schedule.duration),
        bookingType: selectedPlan === 'oneTime' ? 'oneTime' : selectedPlan,
        serviceDetails: {
          duration: schedule.duration,
          sessionDurationHours: schedule.duration,
        },
        totalAmount: calculateTotalPrice(),
        estimatedDuration: schedule.duration * 60,
        ...(isSubscriptionBooking && {
          isSubscription: true,
          subscriptionDetails: {
            startDate: schedule.startDate,
            endDate: schedule.endDate,
            frequency: selectedPlan,
            selectedDays,
            preferredTime: schedule.preferredTime,
            durationPerSession: schedule.duration,
            autoRenewal: schedule.autoRenewal,
            allowPause: schedule.pauseAllowed,
          },
        }),
        location: location ? {
          type: 'Point',
          coordinates: [location.lng, location.lat],
          address: location.address || '',
          city: location.city || '',
          state: location.state || '',
          zipCode: location.zipCode || ''
        } : undefined
      };

      const response = await bookingsAPI.create(bookingData);
      if (selectedPlan === 'oneTime') {
        toast.success(t('subscription.bookingCreated'));
        navigate('/customer/bookings');
        return;
      }

      if (!response?.booking?._id) {
        throw new Error('Subscription booking was created but booking ID is missing');
      }

      setCreatedSubscription({
        bookingId: response.booking._id,
        amount: Number(response.booking.totalAmount || calculateTotalPrice()),
      });
      toast.success('Subscription created. Complete the payment below and upload the payment proof to continue.');
    } catch (error) {
      const rawMessage = error instanceof Error
        ? error.message
        : 'Failed to create booking';
      const isExpectedConflict =
        rawMessage.toLowerCase().includes('already have another booking')
        || rawMessage.toLowerCase().includes('already has a booking')
        || rawMessage.toLowerCase().includes('conflict')
        || rawMessage.toLowerCase().includes('slot was just taken');

      if (isExpectedConflict) {
        console.warn('Subscription booking blocked by schedule conflict:', rawMessage);
      } else {
        console.error('Error creating booking:', error);
      }

      toast.error(rawMessage);
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <AppLayout userType="customer" userName={profile?.name}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">{t('common.loading')}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (serviceNotFound || !service) {
    return (
      <AppLayout userType="customer" userName={profile?.name}>
        <div className="flex flex-col items-center justify-center min-h-[400px] px-4 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-foreground mb-2">{t('subscription.serviceNotFound', 'Service not found')}</h2>
          <p className="text-muted-foreground text-sm mb-6">{t('subscription.serviceNotFoundDesc', 'This service is no longer available or has been removed.')}</p>
          <button
            onClick={() => navigate('/customer/services')}
            className="btn-brand px-6 py-3"
          >
            {t('subscription.backToServices', 'Browse services')}
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="customer" userName={profile?.name}>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6">
        {createdSubscription ? (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-6 border border-primary/20">
              <h1 className="text-3xl font-bold mb-2">Subscription created</h1>
              <p className="text-muted-foreground">
                Your plan is saved. Complete the payment and upload the proof so your region admin or super admin can review it,
                assign the worker for future visits, and activate the subscription.
              </p>
            </div>

            <SubscriptionPaymentStep
              bookingId={createdSubscription.bookingId}
              amount={createdSubscription.amount}
              onPaymentSubmitted={() => setPaymentSubmitted(true)}
            />

            <div className="flex flex-wrap gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/customer/subscriptions')}
              >
                View My Subscriptions
              </Button>
              {paymentSubmitted && (
                <Button
                  type="button"
                  onClick={() => navigate('/customer/subscriptions')}
                >
                  Continue
                </Button>
              )}
            </div>
          </div>
        ) : (
        <>
        {/* Header */}
        <div className="mb-6">
          <Link 
            to="/customer/services" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </Link>
          
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-6 border border-primary/20">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <Package className="w-8 h-8 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{service?.name}</h1>
                <p className="text-muted-foreground mb-3">{service?.description}</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="px-3 py-1 bg-primary/10 rounded-full text-primary font-semibold">
                    ₹{service?.price}/hour
                  </span>
                  <span className="px-3 py-1 bg-accent rounded-full">
                    {service?.duration} min
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-4">
            {['plan', 'schedule', 'confirm'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center gap-2 transition-all ${
                  currentStep === step ? 'text-primary' : 
                  ['plan', 'schedule'].indexOf(currentStep) > ['plan', 'schedule'].indexOf(step) ? 
                  'text-green-600' : 'text-muted-foreground'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 ${
                    currentStep === step ? 'border-primary bg-primary text-primary-foreground' :
                    ['plan', 'schedule'].indexOf(currentStep) > ['plan', 'schedule'].indexOf(step) ?
                    'border-green-600 bg-green-600 text-white' : 'border-muted-foreground'
                  }`}>
                    {['plan', 'schedule'].indexOf(currentStep) > ['plan', 'schedule'].indexOf(step) ? 
                      <CheckCircle2 className="w-5 h-5" /> : index + 1
                    }
                  </div>
                  <span className="text-sm font-medium capitalize hidden sm:inline">
                    {t(`subscription.steps.${step}`)}
                  </span>
                </div>
                {index < 2 && (
                  <div className="w-12 sm:w-24 h-0.5 bg-border mx-2" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={`mb-6 rounded-2xl border p-4 ${
          isOutOfRegion
            ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20'
            : hasResolvedLocation
            ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20'
            : 'border-slate-300 bg-slate-50 dark:bg-slate-900/40'
        }`}>
          <div className="flex items-start gap-3">
            <MapPin className={`mt-0.5 h-4 w-4 shrink-0 ${isOutOfRegion ? 'text-amber-700' : hasResolvedLocation ? 'text-emerald-700' : 'text-slate-600'}`} />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-foreground">
                {checkingAvailability
                  ? 'Checking service region...'
                  : isOutOfRegion
                  ? 'This subscription cannot be booked in your region'
                  : hasResolvedLocation
                  ? 'Your saved location is inside a service region'
                  : 'Service location needed before booking'}
              </p>
              <p className="text-muted-foreground">
                {checkingAvailability
                  ? 'We are verifying the admin-configured service region for your saved location.'
                  : isOutOfRegion
                  ? (availability?.reason || 'Subscriptions are accepted only in regions configured by admin or super admin.')
                  : hasResolvedLocation
                  ? (availability?.reason || 'This subscription is available at your saved location.')
                  : 'Please set your service location from the services page or save a default address in your profile.'}
              </p>
              {resolvedLocation && (
                <p className="text-xs text-muted-foreground">
                  Location: {[resolvedLocation.area, resolvedLocation.city].filter(Boolean).join(', ') || resolvedLocation.address || 'Saved location'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-card rounded-xl border border-border p-4 sm:p-5 md:p-6 mb-6">
          {currentStep === 'plan' && (
            <SubscriptionPlanSelector
              selectedPlan={selectedPlan}
              onPlanChange={(plan) => {
                setSelectedPlan(plan);
                setSchedule(prev => ({
                  ...prev,
                  frequency: plan === 'oneTime' ? 'daily' : plan,
                  specificDays: plan === 'weekly' ? (prev.specificDays || []) : []
                }));
              }}
              basePrice={service?.price || 0}
              serviceDiscount={service?.subscriptionOptions?.discount}
              planDiscounts={service?.subscriptionOptions?.planDiscounts}
            />
          )}

          {currentStep === 'schedule' && (
            <RecurringScheduleSetup
              schedule={schedule}
              onChange={setSchedule}
              bookingType={selectedPlan}
            />
          )}

          {currentStep === 'confirm' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">{t('subscription.confirmBooking')}</h2>
                <p className="text-muted-foreground">{t('subscription.reviewDetails')}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-accent/30 rounded-xl p-6 border border-border">
                  <h3 className="font-bold mb-4">{t('subscription.planDetails')}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('subscription.service')}:</span>
                      <span className="font-semibold">{service?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('subscription.plan')}:</span>
                      <span className="font-semibold capitalize">{selectedPlan}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('subscription.duration')}:</span>
                      <span className="font-semibold">{schedule.duration} {t('subscription.hours')}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-accent/30 rounded-xl p-6 border border-border">
                  <h3 className="font-bold mb-4">{t('subscription.scheduleDetails')}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('subscription.startDate')}:</span>
                      <span className="font-semibold">{new Date(schedule.startDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('subscription.time')}:</span>
                      <span className="font-semibold">{schedule.preferredTime}</span>
                    </div>
                    {schedule.specificDays && schedule.specificDays.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('subscription.days')}:</span>
                        <span className="font-semibold">{schedule.specificDays.length} days/week</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-primary/10 rounded-xl p-6 border-2 border-primary">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t('subscription.estimatedCost')}</p>
                    <p className="text-3xl font-bold text-primary">₹{calculateTotalPrice()}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedPlan === 'oneTime' ? t('subscription.billing.oneTime') : t('subscription.billing.monthly')}
                    </p>
                  </div>
                  {selectedPlan !== 'oneTime' && (
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600">
                        {t('subscription.youSave')}: ₹{Math.round(service!.price * schedule.duration * 
                          getApproxMonthlyVisits(selectedPlan, schedule.specificDays?.length || 0) * 
                          ({daily: 0.1, weekly: 0.15, biweekly: 0.12, monthly: 0.2}[selectedPlan] || 0)
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{t('subscription.withSubscription')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-4 justify-between">
          {currentStep !== 'plan' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(currentStep === 'confirm' ? 'schedule' : 'plan')}
              disabled={booking}
            >
              {t('common.back')}
            </Button>
          )}
          
          <div className="flex-1" />

          {currentStep !== 'confirm' ? (
            <Button
              onClick={handleContinue}
              size="lg"
              className="gap-2"
            >
              {t('common.continue')}
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </Button>
          ) : isOutOfRegion ? (
            <Button
              onClick={() => requestService(service?.name)}
              disabled={requestingService || checkingAvailability}
              size="lg"
              className="gap-2 bg-amber-100 text-amber-900 hover:bg-amber-200"
            >
              {requestingService ? 'Sending request...' : 'Request Service'}
            </Button>
          ) : (
            <Button
              onClick={handleBooking}
              disabled={booking || checkingAvailability || !canBookService}
              size="lg"
              className="gap-2"
            >
              {checkingAvailability
                ? 'Checking region...'
                : booking
                ? t('common.loading')
                : !hasResolvedLocation
                ? 'Set Location First'
                : selectedPlan === 'oneTime'
                ? t('subscription.confirmBooking')
                : t('subscription.startSubscription')
              }
              {!booking && !checkingAvailability && hasResolvedLocation && <CheckCircle2 className="w-5 h-5" />}
            </Button>
          )}
        </div>
        </>
        )}
      </div>
    </AppLayout>
  );
}
