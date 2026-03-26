import AppLayout from "@/components/AppLayout";
import ServiceLocationCard from "@/components/ServiceLocationCard";
import { useServiceBookingAvailability } from "@/hooks/useServiceBookingAvailability";
import { authAPI, bookingsAPI, servicesAPI } from "@/lib/api";
import { motion } from "framer-motion";
import {
    AlertCircle,
    Calendar,
    CheckCircle,
    ChevronLeft,
    Clock,
    RefreshCw,
    Star,
    User,
    Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

type FrequencyOptionId = "daily" | "alt-days" | "3-days" | "weekly";

type FrequencyOption = {
  id: FrequencyOptionId;
  label: string;
  icon: string;
  desc: string;
  visits: number;
  priceMultiplier: number;
};

const DEFAULT_FREQUENCY_OPTIONS: FrequencyOption[] = [
  { id: "daily",     label: "Daily",      icon: "📆", desc: "Every day",      visits: 30, priceMultiplier: 1.0 },
  { id: "alt-days",  label: "Alt Days",   icon: "📅", desc: "Mon/Wed/Fri",    visits: 13, priceMultiplier: 0.65 },
  { id: "3-days",    label: "3× Week",    icon: "🗓️", desc: "Any 3 days",     visits: 12, priceMultiplier: 0.60 },
  { id: "weekly",    label: "Weekly",     icon: "📋", desc: "Once a week",    visits: 4,  priceMultiplier: 0.35 },
];

interface Service {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  serviceType: string;
  durationOptions?: { hours: number; price: number; originalPrice?: number; isDefault?: boolean }[];
  subscriptionOptions?: {
    allowedFrequencies?: FrequencyOptionId[];
    autoRenewal?: boolean;
    requiresSameWorker?: boolean;
    frequencyConfigs?: Array<{
      id: FrequencyOptionId;
      label?: string;
      description?: string;
      visits?: number;
      priceMultiplier?: number;
      sortOrder?: number;
      isActive?: boolean;
    }>;
  };
}

interface UserProfile {
  name: string;
  addresses?: {
    isDefault: boolean;
    apartmentName?: string;
    area?: string;
    city?: string;
    location?: { coordinates: number[] };
  }[];
}

// Fallback hours list if service has no durationOptions
const FALLBACK_HOURS = [1, 1.5, 2, 2.5, 3];

const TIME_SLOTS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
];

const DAYS_OF_WEEK = [
  { value: "sunday", label: "Sun" },
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
] as const;

const REQUIRED_DAY_COUNT_BY_FREQUENCY: Partial<Record<FrequencyOptionId, number>> = {
  weekly: 1,
  "3-days": 3,
  "alt-days": 3,
};

const SubscriptionServicePage = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  // Booking params
  const [frequency, setFrequency] = useState<FrequencyOptionId>("daily");
  const [sessionHours, setSessionHours] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("09:00");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [autoRenewal, setAutoRenewal] = useState(true);
  const [genderPref, setGenderPref] = useState<"any" | "male" | "female">("any");
  const [specialInstructions, setSpecialInstructions] = useState("");

  // Session split — available when sessionHours >= 2
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [session1Hours, setSession1Hours] = useState(1);
  const [session2Time, setSession2Time] = useState("17:00");

  const {
    availability,
    checkingAvailability,
    requestingService,
    resolvedLocation,
    hasResolvedLocation,
    isOutOfRegion,
    canBookService,
    requestService,
  } = useServiceBookingAvailability(selectedService?._id, profile);

  useEffect(() => {
    fetchData();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setStartDate(tomorrow.toISOString().split("T")[0]);
  }, []);

  // When service changes, reset hours to first available durationOption
  useEffect(() => {
    if (selectedService?.durationOptions?.length) {
      const sorted = [...selectedService.durationOptions].sort((a, b) => a.hours - b.hours);
      setSessionHours(sorted[0].hours);
    }
  }, [selectedService?.durationOptions]);

  const availableFrequencyOptions = useMemo(() => {
    const configuredOptions = selectedService?.subscriptionOptions?.frequencyConfigs?.length
      ? DEFAULT_FREQUENCY_OPTIONS.map((defaultOption) => {
          const savedOption = selectedService.subscriptionOptions?.frequencyConfigs?.find(
            (option) => option.id === defaultOption.id
          );

          return {
            ...defaultOption,
            label: savedOption?.label?.trim() || defaultOption.label,
            desc: savedOption?.description?.trim() || defaultOption.desc,
            visits: savedOption?.visits && savedOption.visits > 0 ? savedOption.visits : defaultOption.visits,
            priceMultiplier: typeof savedOption?.priceMultiplier === 'number' && savedOption.priceMultiplier >= 0
              ? savedOption.priceMultiplier
              : defaultOption.priceMultiplier,
          };
        })
      : DEFAULT_FREQUENCY_OPTIONS;

    const allowedIds = selectedService?.subscriptionOptions?.allowedFrequencies?.filter(
      (freq): freq is FrequencyOptionId => DEFAULT_FREQUENCY_OPTIONS.some((option) => option.id === freq)
    ) || [];

    const orderedIds = allowedIds.length > 0
      ? allowedIds
      : configuredOptions.map((option) => option.id);

    return orderedIds
      .map((id) => configuredOptions.find((option) => option.id === id))
      .filter(Boolean) as FrequencyOption[];
  }, [selectedService]);

  useEffect(() => {
    if (!selectedService) {
      return;
    }

    setAutoRenewal(selectedService.subscriptionOptions?.autoRenewal ?? true);
    setFrequency((currentFrequency) => {
      if (availableFrequencyOptions.some((option) => option.id === currentFrequency)) {
        return currentFrequency;
      }

      return availableFrequencyOptions[0]?.id || "daily";
    });
  }, [selectedService, availableFrequencyOptions]);

  useEffect(() => {
    setSelectedDays((currentDays) => {
      if (frequency === "daily") {
        return [];
      }

      const requiredCount = REQUIRED_DAY_COUNT_BY_FREQUENCY[frequency];
      return requiredCount ? currentDays.slice(0, requiredCount) : currentDays;
    });
  }, [frequency]);

  // Reset split state whenever hours change
  useEffect(() => {
    if (sessionHours < 2) setSplitEnabled(false);
    setSession1Hours(1);
  }, [sessionHours]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [servicesData, profileData] = await Promise.all([
        servicesAPI.getAll({ serviceType: "monthly_subscription", isActive: true, limit: 20 }),
        authAPI.getProfile(),
      ]);
      const list: Service[] = servicesData.services || [];
      setServices(list);
      if (list.length === 1) setSelectedService(list[0]);
      setProfile(profileData.user || profileData);
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  // Hours available from service.durationOptions (sorted); fallback to FALLBACK_HOURS
  const availableHours: number[] = selectedService?.durationOptions?.length
    ? [...selectedService.durationOptions].sort((a, b) => a.hours - b.hours).map(d => d.hours)
    : FALLBACK_HOURS;

  const currentFreq = availableFrequencyOptions.find((option) => option.id === frequency)
    || availableFrequencyOptions[0]
    || DEFAULT_FREQUENCY_OPTIONS[0];
  const requiresDaySelection = frequency !== "daily";
  const requiredSelectedDayCount = REQUIRED_DAY_COUNT_BY_FREQUENCY[frequency] || null;

  // Monthly price from durationOptions — authoritative source
  const durationOption = selectedService?.durationOptions?.find(d => d.hours === sessionHours);
  const baseMonthlyPrice = durationOption?.price ?? selectedService?.price ?? 0;

  // Apply frequency-based pricing multiplier
  const monthlyPrice = Math.round(baseMonthlyPrice * currentFreq.priceMultiplier);

  // Per-visit breakdown (Urban Company style)
  const perVisitPrice = currentFreq.visits > 0 ? Math.round(monthlyPrice / currentFreq.visits) : 0;

  // MRP / savings from originalPrice (apply multiplier to original as well)
  const baseOriginalPrice = durationOption?.originalPrice ?? 0;
  const originalMonthlyPrice = Math.round(baseOriginalPrice * currentFreq.priceMultiplier);
  const monthlySavings = originalMonthlyPrice > monthlyPrice ? originalMonthlyPrice - monthlyPrice : 0;
  const savingsPct = originalMonthlyPrice > 0 && monthlySavings > 0
    ? Math.round((monthlySavings / originalMonthlyPrice) * 100)
    : 0;

  const getEndDate = () => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + 29);
    return d.toISOString().split("T")[0];
  };

  const addHoursToTime = (time: string, hours: number) => {
    const [h, m] = time.split(":").map(Number);
    const totalMin = h * 60 + m + Math.round(hours * 60);
    return `${String(Math.floor(totalMin / 60) % 24).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
  };

  const getEndTime = () => {
    if (splitEnabled && sessionHours >= 2) {
      return addHoursToTime(session2Time, sessionHours - session1Hours);
    }
    return addHoursToTime(preferredTime, sessionHours);
  };

  // Valid session1Hours choices: 0.5 steps from 1 up to sessionHours-1
  const session1HoursOptions: number[] = [];
  for (let h = 1; h <= sessionHours - 1; h += 0.5) {
    session1HoursOptions.push(h);
  }

  const getWeekdayForDate = (dateValue: string) => {
    if (!dateValue) return null;

    const parsed = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;

    return DAYS_OF_WEEK[parsed.getDay()]?.value || null;
  };

  const selectedStartWeekday = getWeekdayForDate(startDate);

  const toggleSelectedDay = (day: string) => {
    setSelectedDays((currentDays) => {
      if (currentDays.includes(day)) {
        return currentDays.filter((existingDay) => existingDay !== day);
      }

      if (requiredSelectedDayCount && currentDays.length >= requiredSelectedDayCount) {
        toast.error(`Select exactly ${requiredSelectedDayCount} day${requiredSelectedDayCount > 1 ? 's' : ''} for this plan.`);
        return currentDays;
      }

      return [...currentDays, day];
    });
  };

  const validateSelectedDays = () => {
    if (!requiresDaySelection) {
      return true;
    }

    if (selectedDays.length === 0) {
      toast.error("Please select the weekdays for this subscription.");
      return false;
    }

    if (requiredSelectedDayCount && selectedDays.length !== requiredSelectedDayCount) {
      toast.error(`Please select exactly ${requiredSelectedDayCount} day${requiredSelectedDayCount > 1 ? 's' : ''} for this plan.`);
      return false;
    }

    if (selectedStartWeekday && !selectedDays.includes(selectedStartWeekday)) {
      toast.error("Start date must fall on one of your selected service days.");
      return false;
    }

    return true;
  };

  const handleBook = async () => {
    if (isOutOfRegion) {
      await requestService(selectedService?.name);
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

    if (!selectedService) return toast.error("Please select a service");
    if (!startDate) return toast.error("Please select a start date");
    if (!validateSelectedDays()) return;

    if (!resolvedLocation) {
      toast.error("Please pin your selected service location or enable auto location before booking.");
      return;
    }

    try {
      setBooking(true);
      const response = await bookingsAPI.create({
        service: selectedService._id,
        bookingDate: startDate,
        startTime: preferredTime,
        endTime: getEndTime(),
        totalAmount: monthlyPrice,
        bookingType: "monthly",
        isSubscription: true,
        subscriptionDetails: {
          startDate,
          endDate: getEndDate(),
          frequency,
          selectedDays,
          preferredTime,
          durationPerSession: sessionHours,
          autoRenewal,
          allowPause: true,
          ...(splitEnabled && sessionHours >= 2 && {
            splitSessions: [
              { startTime: preferredTime, endTime: addHoursToTime(preferredTime, session1Hours) },
              { startTime: session2Time, endTime: addHoursToTime(session2Time, sessionHours - session1Hours) },
            ],
          }),
        },
        serviceDetails: { sessionDurationHours: sessionHours },
        preferences: { workerGenderPreference: genderPref, specialInstructions },
        location: {
          apartmentName: resolvedLocation.apartmentName || "",
          address: resolvedLocation.address || "",
          area: resolvedLocation.area || "",
          city: resolvedLocation.city || "",
          state: resolvedLocation.state || "",
          zipCode: resolvedLocation.zipCode || "",
          coordinates: [resolvedLocation.longitude, resolvedLocation.latitude],
        },
        notes: specialInstructions,
      } as Record<string, unknown>);
      if (!response?.booking?._id) {
        throw new Error("Subscription booking was created but booking ID is missing");
      }

      toast.success("Subscription created and activated successfully.", { duration: 5000 });
      navigate('/customer/subscriptions');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <AppLayout userType="customer" userName={profile?.name || "Loading..."}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <motion.div
            className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="customer" userName={profile?.name || "Guest"}>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 md:px-6 pb-24 space-y-5">

        {/* Header */}
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-3">
          <Link to="/customer/services" className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-border transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📅</span>
              <h1 className="text-xl font-bold text-foreground">Subscription Plans</h1>
            </div>
            <p className="text-xs text-muted-foreground">Save with recurring daily bookings</p>
          </div>
        </motion.div>

        {/* Benefits banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 flex items-center gap-3"
        >
          <Star className="w-8 h-8 text-blue-500 fill-blue-500 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-blue-900">Save vs one-time bookings</p>
            <p className="text-xs text-blue-700">Same maid every day · Pause or cancel anytime · Priority support</p>
          </div>
        </motion.div>

        <ServiceLocationCard
          serviceLabel="This subscription"
          checkingAvailability={checkingAvailability}
          hasResolvedLocation={hasResolvedLocation}
          isOutOfRegion={isOutOfRegion}
          availabilityReason={availability?.reason}
          resolvedLocation={resolvedLocation}
        />

          <>
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"}`}>
                    {step > s ? <CheckCircle className="w-4 h-4" /> : s}
                  </div>
                  {s < 3 && <div className={`h-0.5 w-12 rounded transition-all ${step > s ? "bg-blue-500" : "bg-muted"}`} />}
                </div>
              ))}
              <span className="ml-2 text-xs text-muted-foreground">
                {step === 1 ? "Choose Plan" : step === 2 ? "Schedule & Preferences" : "Review & Confirm"}
              </span>
            </div>

            {/* ── STEP 1 — Choose Plan ── */}
            {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

            {/* Service selection */}
            <div>
              <h2 className="font-semibold text-foreground mb-2">Service Package</h2>
              {services.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No subscription services available in your area.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {services.map((svc) => {
                    const lowestTier = svc.durationOptions?.find(d => d.hours === 1) ||
                      (svc.durationOptions?.length ? [...svc.durationOptions].sort((a, b) => a.hours - b.hours)[0] : null);
                    const fromPrice = lowestTier?.price ?? svc.price;
                    const fromOriginalPrice = lowestTier?.originalPrice ?? 0;
                    const fromSavingsPct = fromOriginalPrice > fromPrice && fromOriginalPrice > 0
                      ? Math.round((1 - fromPrice / fromOriginalPrice) * 100) : 0;
                    return (
                      <button
                        key={svc._id}
                        onClick={() => setSelectedService(svc)}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                          selectedService?._id === svc._id
                            ? "border-blue-400 bg-blue-50"
                            : "border-border hover:border-blue-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl shrink-0">🧹</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground">{svc.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{svc.description}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">from</p>
                            {fromOriginalPrice > fromPrice && (
                              <p className="text-xs text-muted-foreground line-through">₹{fromOriginalPrice.toLocaleString("en-IN")}</p>
                            )}
                            <p className="font-bold text-blue-700 text-lg">₹{fromPrice.toLocaleString("en-IN")}</p>
                            <p className="text-xs text-muted-foreground">/month</p>
                            {fromSavingsPct > 0 && (
                              <span className="inline-block text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full mt-0.5">{fromSavingsPct}% off</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Hours per session — derived from service.durationOptions */}
            {selectedService && (
              <>
                <div>
                  <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" /> Hours per Session
                  </h2>
                  <p className="text-xs text-muted-foreground mb-3">How many hours should the maid work each visit?</p>

                  {availableHours.length === 0 ? (
                    <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      ⚠️ No pricing tiers configured for this service. Please contact support.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {availableHours.map((h) => {
                        const tierOpt = selectedService.durationOptions?.find(d => d.hours === h);
                        const tierPrice = tierOpt?.price;
                        const tierOriginal = tierOpt?.originalPrice;
                        return (
                          <button
                            key={h}
                            onClick={() => setSessionHours(h)}
                            className={`py-3 px-2 rounded-xl border-2 text-center transition-all ${
                              sessionHours === h
                                ? "border-blue-400 bg-blue-50"
                                : "border-border hover:border-blue-300"
                            }`}
                          >
                            <p className={`text-lg font-bold ${sessionHours === h ? "text-blue-700" : "text-foreground"}`}>{h}h</p>
                            {tierOriginal && tierOriginal > (tierPrice || 0) && (
                              <p className={`text-[10px] line-through ${sessionHours === h ? "text-blue-400" : "text-muted-foreground/60"}`}>
                                ₹{tierOriginal.toLocaleString("en-IN")}
                              </p>
                            )}
                            {tierPrice && (
                              <p className={`text-xs mt-0.5 ${sessionHours === h ? "text-blue-600" : "text-muted-foreground"}`}>
                                ₹{tierPrice.toLocaleString("en-IN")}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Frequency selector — Urban Company style */}
                <div>
                  <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500" /> Frequency
                  </h2>
                  <p className="text-xs text-muted-foreground mb-3">How often should the maid visit?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableFrequencyOptions.map((opt) => {
                      const freqPrice = Math.round(baseMonthlyPrice * opt.priceMultiplier);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setFrequency(opt.id)}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            frequency === opt.id
                              ? "border-blue-400 bg-blue-50"
                              : "border-border hover:border-blue-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">{opt.icon}</span>
                            <span className={`font-semibold text-sm ${frequency === opt.id ? "text-blue-700" : "text-foreground"}`}>
                              {opt.label}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                          <div className="flex items-center justify-between mt-1">
                            <p className={`text-xs font-medium ${frequency === opt.id ? "text-blue-600" : "text-muted-foreground"}`}>
                              ~{opt.visits} visits/mo
                            </p>
                            <p className={`text-sm font-bold ${frequency === opt.id ? "text-blue-700" : "text-foreground"}`}>
                              ₹{freqPrice.toLocaleString("en-IN")}/mo
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Urban Company style pricing card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-blue-900">Your Plan</p>
                    <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">{currentFreq.label}</span>
                  </div>
                  <div className="flex items-end gap-2 flex-wrap">
                    {originalMonthlyPrice > monthlyPrice && (
                      <span className="text-sm text-muted-foreground line-through mb-1">₹{originalMonthlyPrice.toLocaleString("en-IN")}</span>
                    )}
                    <span className="text-3xl font-bold text-blue-700">₹{monthlyPrice.toLocaleString("en-IN")}</span>
                    <span className="text-sm text-blue-600 mb-1">/month</span>
                  </div>
                  {monthlySavings > 0 && (
                    <p className="text-xs font-medium text-green-600">
                      You save ₹{monthlySavings.toLocaleString("en-IN")}/mo ({savingsPct}% off vs. one-time)
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-blue-200">
                    <div className="text-center">
                      <p className="text-xs text-blue-600">Per Visit</p>
                      <p className="text-sm font-bold text-blue-800">₹{perVisitPrice}</p>
                    </div>
                    <div className="text-center border-x border-blue-200">
                      <p className="text-xs text-blue-600">Hours/Day</p>
                      <p className="text-sm font-bold text-blue-800">{sessionHours}h</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-blue-600">Visits/Mo</p>
                      <p className="text-sm font-bold text-blue-800">~{currentFreq.visits}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                    <span className="text-xs text-blue-700 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {selectedService?.subscriptionOptions?.requiresSameWorker ?? true ? 'Same maid daily' : 'Worker assigned based on availability'}
                    </span>
                    <span className="text-xs text-blue-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Pause anytime</span>
                    <span className="text-xs text-blue-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Priority booking</span>
                  </div>
                </div>
              </>
            )}

            <button
              onClick={() => {
                if (!selectedService) return toast.error("Please select a service");
                if (availableHours.length === 0) return toast.error("Service has no pricing tiers configured");
                setStep(2);
              }}
              className="w-full py-3 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors"
            >
              Continue →
            </button>
          </motion.div>
          )}

        {/* ── STEP 2 — Schedule & Preferences ── */}
            {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                {requiresDaySelection && selectedStartWeekday && selectedDays.length > 0 && !selectedDays.includes(selectedStartWeekday) && (
                  <p className="mt-1 text-xs text-amber-600">Choose a start date that matches one of your selected service days.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {splitEnabled ? "Session 1 Time" : "Preferred Time"}
                </label>
                <select
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {requiresDaySelection && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Choose service days</label>
                  <p className="text-xs text-muted-foreground">
                    {requiredSelectedDayCount
                      ? `Select exactly ${requiredSelectedDayCount} day${requiredSelectedDayCount > 1 ? 's' : ''}. Worker assignment and future blocking will follow only these weekdays.`
                      : 'Select the weekdays for this subscription.'}
                  </p>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleSelectedDay(day.value)}
                      className={`rounded-xl border-2 px-3 py-2 text-sm font-medium transition-all ${
                        selectedDays.includes(day.value)
                          ? "border-blue-400 bg-blue-50 text-blue-700"
                          : "border-border hover:border-blue-300 text-foreground"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
                  {selectedDays.length > 0
                    ? `Selected days: ${selectedDays.map((day) => DAYS_OF_WEEK.find((item) => item.value === day)?.label || day).join(", ")}`
                    : "No days selected yet."}
                  {selectedStartWeekday && (
                    <div className="mt-1">Start date day: {DAYS_OF_WEEK.find((day) => day.value === selectedStartWeekday)?.label}</div>
                  )}
                </div>
              </div>
            )}

            {/* Session Split — available when 2h or more */}
            {sessionHours >= 2 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                  <div>
                    <p className="text-sm font-semibold text-indigo-900">Split into Sessions</p>
                    <p className="text-xs text-indigo-600">Divide {sessionHours}h across morning &amp; evening (min 1h each)</p>
                  </div>
                  <button
                    onClick={() => setSplitEnabled(!splitEnabled)}
                    className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${splitEnabled ? "bg-indigo-500" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${splitEnabled ? "left-6" : "left-0.5"}`} />
                  </button>
                </div>

                {splitEnabled && (
                  <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 space-y-4">
                    <div>
                      <p className="text-xs font-bold text-indigo-800 mb-2">🌅 Session 1 — Morning</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Start Time</label>
                          <select value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                            {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Duration</label>
                          <select value={session1Hours} onChange={(e) => setSession1Hours(Number(e.target.value))} className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                            {session1HoursOptions.map((h) => <option key={h} value={h}>{h}h</option>)}
                          </select>
                        </div>
                      </div>
                      <p className="text-xs text-indigo-600 mt-1">Ends at {addHoursToTime(preferredTime, session1Hours)}</p>
                    </div>

                    <div className="border-t border-indigo-200" />

                    <div>
                      <p className="text-xs font-bold text-indigo-800 mb-2">🌆 Session 2 — Evening ({sessionHours - session1Hours}h)</p>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Start Time</label>
                        <select value={session2Time} onChange={(e) => setSession2Time(e.target.value)} className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                          {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <p className="text-xs text-indigo-600 mt-1">Ends at {addHoursToTime(session2Time, sessionHours - session1Hours)}</p>
                    </div>

                    <div className="bg-white rounded-lg p-3 border border-indigo-200 text-xs text-indigo-800 space-y-1">
                      <p className="font-semibold">📋 Daily Schedule</p>
                      <p>Session 1: {preferredTime} → {addHoursToTime(preferredTime, session1Hours)} ({session1Hours}h)</p>
                      <p>Session 2: {session2Time} → {addHoursToTime(session2Time, sessionHours - session1Hours)} ({sessionHours - session1Hours}h)</p>
                      <p className="text-green-700 font-medium pt-1">✓ Total: {sessionHours}h/day</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Auto-renewal */}
            <div className="flex items-center justify-between p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium text-foreground text-sm">Auto-Renewal</p>
                  <p className="text-xs text-muted-foreground">Renew month-to-month automatically</p>
                </div>
              </div>
              <button
                onClick={() => setAutoRenewal(!autoRenewal)}
                className={`w-12 h-6 rounded-full transition-colors relative ${autoRenewal ? "bg-blue-500" : "bg-muted"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${autoRenewal ? "left-6" : "left-0.5"}`} />
              </button>
            </div>

            {/* Gender preference */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                <User className="w-4 h-4" /> Worker Gender Preference
              </label>
              <div className="flex gap-2">
                {(["any", "female", "male"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenderPref(g)}
                    className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                      genderPref === g ? "border-blue-400 bg-blue-50 text-blue-700" : "border-border hover:border-blue-300"
                    }`}
                  >
                    {g === "any" ? "Any" : g === "female" ? "👩 Female" : "👨 Male"}
                  </button>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Special Instructions (optional)</label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                rows={3}
                placeholder="E.g. Focus on kitchen and bathrooms..."
                className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-2xl border border-border text-foreground font-semibold hover:bg-muted transition-colors">← Back</button>
              <button
                onClick={() => {
                  if (!startDate) return toast.error("Please select a start date");
                  if (!validateSelectedDays()) return;
                  setStep(3);
                }}
                className="flex-1 py-3 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors"
              >
                Review →
              </button>
            </div>
          </motion.div>
          )}

        {/* ── STEP 3 — Confirm ── */}
            {step === 3 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <h2 className="font-semibold text-foreground">Subscription Summary</h2>

            {/* Service + Plan summary */}
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🧹</span>
                <div>
                  <p className="font-semibold text-foreground">{selectedService?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {currentFreq.label} · {sessionHours}h/session · {currentFreq.desc}
                  </p>
                </div>
              </div>

              {splitEnabled ? (
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2"><span>🌅</span><span>Session 1: {preferredTime} → {addHoursToTime(preferredTime, session1Hours)} ({session1Hours}h)</span></div>
                  <div className="flex items-center gap-2"><span>🌆</span><span>Session 2: {session2Time} → {addHoursToTime(session2Time, sessionHours - session1Hours)} ({sessionHours - session1Hours}h)</span></div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Preferred time: {preferredTime} → {addHoursToTime(preferredTime, sessionHours)}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>Starts: {new Date(startDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
              </div>

              {selectedDays.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Selected days: {selectedDays.map((day) => DAYS_OF_WEEK.find((item) => item.value === day)?.label || day).join(', ')}</span>
                </div>
              )}
            </div>

            {/* Urban Company cost breakdown */}
            <div className="p-4 rounded-2xl border border-border space-y-2">
              <p className="text-sm font-semibold text-foreground">Cost Breakdown</p>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{sessionHours}h × ~{currentFreq.visits} visits ({currentFreq.label})</span>
                <span>₹{perVisitPrice}/visit</span>
              </div>
              {monthlySavings > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Subscription saving ({savingsPct}% off)</span>
                  <span>-₹{monthlySavings.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Auto-renewal</span>
                <span>{autoRenewal ? "On" : "Off"}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-foreground text-lg">
                <span>Monthly Total</span>
                <span>₹{monthlyPrice.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
              ⚡ A dedicated maid will be assigned exclusively to your subscription. You can pause or cancel anytime from My Subscriptions.
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-2xl border border-border text-foreground font-semibold hover:bg-muted transition-colors">← Back</button>
              <button
                onClick={handleBook}
                disabled={booking || requestingService || checkingAvailability || (!isOutOfRegion && !canBookService)}
                className={`flex-1 py-3 rounded-2xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
                  isOutOfRegion
                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {booking || requestingService ? (
                  <>
                    <motion.div className={`w-4 h-4 border-2 border-t-transparent rounded-full ${isOutOfRegion ? 'border-amber-900' : 'border-white'}`} animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                    {isOutOfRegion ? 'Sending request...' : 'Creating...'}
                  </>
                ) : (
                  <><Zap className="w-4 h-4" /> {isOutOfRegion ? 'Request Service' : !hasResolvedLocation ? 'Set Location First' : checkingAvailability ? 'Checking region...' : 'Subscribe Now'}</>
                )}
              </button>
            </div>
          </motion.div>
            )}
          </>
      </div>
    </AppLayout>
  );
};

export default SubscriptionServicePage;
