import AppLayout from "@/components/AppLayout";
import ServiceLocationCard from "@/components/ServiceLocationCard";
import { useServiceBookingAvailability } from "@/hooks/useServiceBookingAvailability";
import { authAPI, bookingsAPI, servicesAPI, settingsAPI } from "@/lib/api";
import { motion } from "framer-motion";
import {
    Briefcase,
    Calendar,
    Clock,
    MapPin,
    Sparkles,
    User,
    Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface UserProfile {
  name: string;
  isPhoneVerified?: boolean;
  addresses?: {
    isDefault: boolean;
    apartmentName?: string;
    area?: string;
    city?: string;
    location?: { coordinates: number[] };
  }[];
}

interface Service {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  originalPrice?: number;
  duration: number;
  addons?: Array<{
    name: string;
    price: number;
    type: string;
    isActive?: boolean;
  }>;
  durationOptions?: Array<{
    hours: number;
    price: number;
    originalPrice?: number;
  }>;
  dos?: string[];
  donts?: string[];
}

const HOUR_OPTIONS: number[] = []; // replaced — hours derived from service.durationOptions below

// Generate time slots between openTime and closeTime at slotDurationMinutes intervals
const generateTimeSlots = (openTime = '07:00', closeTime = '19:00', slotDurationMinutes = 30) => {
  const slots: string[] = [];
  const [oh, om] = openTime.split(':').map(Number);
  const [ch, cm] = closeTime.split(':').map(Number);
  let cur = oh * 60 + om;
  const close = ch * 60 + cm;
  while (cur < close) {
    slots.push(`${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`);
    cur += slotDurationMinutes;
  }
  return slots;
};

const DEFAULT_SLOTS = generateTimeSlots();

const DEFAULT_PRICE = 150;

const getNearestSlot = () => {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes() + 30;
  return (
    DEFAULT_SLOTS.find((t) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m >= nowMins;
    }) || DEFAULT_SLOTS[DEFAULT_SLOTS.length - 1]
  );
};

const fmt12 = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

const addMins = (time: string, mins: number) => {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const normalizeGender = (value: string | null | undefined): "male" | "female" | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized === "male" || normalized === "female" ? normalized : null;
};

const InstaServicePage = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [pricePerHour, setPricePerHour] = useState(DEFAULT_PRICE);
  const [mrpPerHour, setMrpPerHour] = useState(0);          // from service.originalPrice
  const [overtimeRate, setOvertimeRate] = useState(2.5);     // from Settings.booking.overtimeRate
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [bookingMode, setBookingMode] = useState<"now" | "schedule">("now");
  const [hours, setHours] = useState(2);
  const [selectedDurationTotal, setSelectedDurationTotal] = useState<number | null>(null);
  const [selectedDurationMrp, setSelectedDurationMrp] = useState<number | null>(null);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState(getNearestSlot());
  const [genderPref, setGenderPref] = useState<"any" | "male" | "female">("any");
  const [notes, setNotes] = useState("");
  const [noServiceWarning, setNoServiceWarning] = useState(false);

  // Slot availability: raw booked ranges with worker gender info
  const [rawBookedRanges, setRawBookedRanges] = useState<Array<{ workerId: string | null; workerGender: string | null; startTime: string; endTime: string }>>([]);
  // Worker counts (always from full/unfiltered fetch) — used for slot badges and gender buttons
  const [workerCounts, setWorkerCounts] = useState({ total: 0, male: 0, female: 0 });
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const [businessHours, setBusinessHours] = useState({ openTime: '07:00', closeTime: '19:00', slotDurationMinutes: 30 });

  const {
    availability,
    checkingAvailability,
    requestingService,
    resolvedLocation,
    hasResolvedLocation,
    isOutOfRegion,
    canBookService,
    requestService,
  } = useServiceBookingAvailability(serviceId, profile);

  // Dynamic time slots from admin-configured business hours
  const generatedTimeSlots = useMemo(
    () => generateTimeSlots(businessHours.openTime, businessHours.closeTime, businessHours.slotDurationMinutes),
    [businessHours]
  );

  // Busy worker count per slot, filtered by current gender preference — updates instantly on gender change
  const busyWorkersBySlot = useMemo(() => {
    const busy: Record<string, number> = {};
    for (const slot of generatedTimeSlots) {
      const [sh, sm] = slot.split(":").map(Number);
      const slotStartMins = sh * 60 + sm;
      const slotEndMins = slotStartMins + hours * 60;
      const workersBusy = new Set<string>();
      for (const r of rawBookedRanges) {
        if (!r.workerId) continue;
        // Skip workers who don't match the selected gender preference
        if (genderPref !== 'any' && normalizeGender(r.workerGender) !== genderPref) continue;
        const [rsh, rsm] = r.startTime.split(":").map(Number);
        const [reh, rem] = r.endTime.split(":").map(Number);
        const rStart = rsh * 60 + rsm;
        const rEnd = reh * 60 + rem;
        if (rStart < slotEndMins && rEnd > slotStartMins) {
          workersBusy.add(r.workerId);
        }
      }
      busy[slot] = workersBusy.size;
    }
    return busy;
  }, [rawBookedRanges, genderPref, hours, generatedTimeSlots]);

  const totalAmount = selectedDurationTotal ?? hours * pricePerHour;
  const mrpTotal = selectedDurationMrp ?? hours * mrpPerHour;
  const discountPct = mrpTotal > totalAmount && mrpTotal > 0
    ? Math.round((1 - totalAmount / mrpTotal) * 100)
    : 0;
  const genderCounts = useMemo(() => ({
    any: workerCounts.total,
    female: workerCounts.female,
    male: workerCounts.male,
  } as const), [workerCounts.female, workerCounts.male, workerCounts.total]);
  const activeWorkers = genderCounts[genderPref];

  const availableSlots = (() => {
    const today = new Date().toISOString().split("T")[0];
    if (bookingMode === "now" || bookingDate === today) {
      const nowMins = new Date().getHours() * 60 + new Date().getMinutes() + 30;
      return generatedTimeSlots.filter((t) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m >= nowMins;
      });
    }
    return generatedTimeSlots;
  })();

  useEffect(() => {
    if (!slotsLoaded || genderPref === "any") return;
    if (genderCounts[genderPref] === 0 && genderCounts.any > 0) {
      setGenderPref("any");
    }
  }, [genderCounts, genderPref, slotsLoaded]);

  useEffect(() => {
    if (!slotsLoaded || availableSlots.length === 0) return;

    const selectedSlotStillAvailable = availableSlots.some((slot) => {
      if (slot !== startTime) return false;
      const freeWorkers = Math.max(0, activeWorkers - (busyWorkersBySlot[slot] ?? 0));
      return freeWorkers > 0;
    });

    if (selectedSlotStillAvailable) return;

    const firstAvailableSlot = availableSlots.find((slot) => {
      const freeWorkers = Math.max(0, activeWorkers - (busyWorkersBySlot[slot] ?? 0));
      return freeWorkers > 0;
    });

    if (firstAvailableSlot && firstAvailableSlot !== startTime) {
      setStartTime(firstAvailableSlot);
    }
  }, [activeWorkers, availableSlots, busyWorkersBySlot, slotsLoaded, startTime]);

  useEffect(() => {
    const init = async () => {
      try {
        const [profileData, servicesData, settingsData] = await Promise.all([
          authAPI.getProfile(),
          servicesAPI
            .getAll({ serviceType: "instant_hourly", isActive: true, limit: 5 })
            .catch(() => ({ services: [] })),
          settingsAPI.getSettings().catch(() => null),
        ]);
        setProfile(profileData.user || profileData);
        if (settingsData?.settings?.booking?.overtimeRate) {
          setOvertimeRate(settingsData.settings.booking.overtimeRate);
        }
        const list = servicesData?.services || [];
        if (list.length > 0) {
          const svc = list[0];
          setService(svc); // Store the service object for dos/don'ts
          setPricePerHour(svc.price || DEFAULT_PRICE);
          setServiceId(svc._id);
          // MRP from DB — falls back to computing 25% above if not set
          setMrpPerHour(svc.originalPrice > 0 ? svc.originalPrice : Math.round((svc.price || DEFAULT_PRICE) / 0.8));
        } else {
          setNoServiceWarning(true);
        }
      } catch {
        // continue with defaults
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Fetch booked-slots whenever the date or serviceId changes.
  // Gender preference is applied locally via the busyWorkersBySlot useMemo — no extra API call needed.
  useEffect(() => {
    const fetchSlots = async () => {
      try {
        const location = resolvedLocation
          ? { lng: resolvedLocation.longitude, lat: resolvedLocation.latitude }
          : null;

        // Always fetch without a gender filter so we get all workers' ranges with
        // gender info — gender filtering is done locally in the busyWorkersBySlot useMemo
        const data = await bookingsAPI.getBookedSlots(
          bookingDate,
          location,
          { service: serviceId || undefined }
        );
        const ranges: { workerId: string | null; workerGender: string | null; startTime: string; endTime: string }[] =
          data.bookedRanges || [];

        // Update worker counts (all-gender totals for slot badges and gender buttons)
        setWorkerCounts({
          total: data.totalWorkers || 0,
          male: data.maleWorkers || 0,
          female: data.femaleWorkers || 0,
        });

        // Update time slots from admin-configured business hours
        if (data.openTime || data.closeTime) {
          setBusinessHours({
            openTime: data.openTime || '07:00',
            closeTime: data.closeTime || '19:00',
            slotDurationMinutes: data.slotDurationMinutes || 30,
          });
        }

        // Store raw ranges; gender-specific busy counts are derived via useMemo
        setRawBookedRanges(ranges);
        setSlotsLoaded(true);
      } catch {
        setWorkerCounts({ total: 0, male: 0, female: 0 });
        setRawBookedRanges([]);
        setSlotsLoaded(false);
        // non-critical — continue without availability info
      }
    };
    fetchSlots();
  }, [bookingDate, serviceId, resolvedLocation]);

  const handleBook = async () => {
    if (isOutOfRegion) {
      await requestService(service?.name || 'Insta Maid Service');
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

    if (!serviceId) {
      toast.error('No maid service is currently available in your area. Please contact support.');
      return;
    }
    const coords = resolvedLocation
      ? [resolvedLocation.longitude, resolvedLocation.latitude]
      : null;
    const hasValidCoords =
      Array.isArray(coords) &&
      coords.length === 2 &&
      coords.every((c) => typeof c === "number" && !isNaN(c));

    if (!hasValidCoords || !resolvedLocation) {
      toast.error("Please pin your selected service location or enable auto location before booking.");
      return;
    }

    try {
      setBooking(true);
      await bookingsAPI.create({
        ...(serviceId ? { service: serviceId } : {}),
        bookingDate,
        startTime,
        endTime: addMins(startTime, hours * 60),
        totalAmount,
        bookingType: "adhoc",
        preferences: { workerGenderPreference: genderPref, specialInstructions: notes },
        serviceDetails: { hours },
        ...(hasValidCoords && {
          location: {
            coordinates: coords,
            apartmentName: resolvedLocation.apartmentName || "",
            address: resolvedLocation.address || "",
            area: resolvedLocation.area || "",
            city: resolvedLocation.city || "",
            state: resolvedLocation.state || "",
            zipCode: resolvedLocation.zipCode || "",
          },
        }),
        notes,
      } as Record<string, unknown>);
      toast.success(
        bookingMode === "now"
          ? "Booked! We're finding a maid near you 🎉"
          : "Scheduled! You'll get a confirmation shortly 📅"
      );
      navigate("/customer/bookings");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <AppLayout userType="customer" userName="Loading...">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="customer" userName={profile?.name || "Guest"}>
      <div className="max-w-lg mx-auto px-3 sm:px-4 md:px-6 pb-24 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold font-heading text-foreground flex items-center gap-2">
            <span>⚡</span> Insta Maid Service
          </h1>
          <p className="text-xs text-muted-foreground">
            On-demand hourly cleaning ·{" "}
            {mrpPerHour > pricePerHour && <span className="line-through text-muted-foreground/60">₹{mrpPerHour}/hr </span>}
            <span className="text-green-600 font-semibold">₹{pricePerHour}/hr</span>
            {discountPct > 0 && <span className="text-xs font-semibold bg-green-100 text-green-700 px-1 py-0.5 rounded-full ml-1">{discountPct}% off</span>}
          </p>
        </div>

        {/* No-service notice */}
        {noServiceWarning && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm">
            <span className="text-destructive text-base shrink-0">🚫</span>
            <div className="flex-1">
              <p className="font-medium text-destructive text-xs">Instant booking unavailable</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                No instant hourly service has been configured yet. Bookings cannot be placed at this time. Please contact support.
              </p>
            </div>
          </div>
        )}

        <ServiceLocationCard
          serviceLabel="Insta service"
          checkingAvailability={checkingAvailability}
          hasResolvedLocation={hasResolvedLocation}
          isOutOfRegion={isOutOfRegion}
          availabilityReason={availability?.reason}
          resolvedLocation={resolvedLocation}
        />

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`h-0.5 w-10 rounded transition-all ${
                    step > s ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
          <span className="ml-2 text-xs text-muted-foreground font-medium">
            {step === 1 ? "When & How" : step === 2 ? "Time & Extras" : "Confirm & Pay"}
          </span>
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Booking mode */}
            <div>
              <h2 className="font-semibold font-heading text-foreground mb-3">
                How do you want to book?
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setBookingMode("now");
                    setBookingDate(new Date().toISOString().split("T")[0]);
                    setStartTime(getNearestSlot());
                  }}
                  className={`card-elevated p-4 text-left rounded-2xl border-2 transition-all ${
                    bookingMode === "now"
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:border-border"
                  }`}
                >
                  <div className="text-2xl mb-1">⚡</div>
                  <p className="font-bold text-foreground text-sm">Book Now</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Maid arrives ASAP</p>
                  <span className="mt-2 badge-success text-xs">~30 min</span>
                </button>
                <button
                  onClick={() => setBookingMode("schedule")}
                  className={`card-elevated p-4 text-left rounded-2xl border-2 transition-all ${
                    bookingMode === "schedule"
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:border-border"
                  }`}
                >
                  <div className="text-2xl mb-1">📅</div>
                  <p className="font-bold text-foreground text-sm">Schedule</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pick date & time</p>
                  <span className="mt-2 badge-primary text-xs">Plan ahead</span>
                </button>
              </div>
            </div>

            {/* Service Information */}
            {service && (service.dos?.length > 0 || service.donts?.length > 0) && (
            <div>
              <h2 className="font-semibold font-heading text-foreground mb-1">
                Service Details
              </h2>
              <p className="text-xs text-muted-foreground mb-3">What's included and excluded</p>

              <div className="space-y-3">
                {/* What's Included (Dos) */}
                {service.dos && service.dos.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-green-600">✅</span>
                      <h3 className="text-sm font-semibold text-green-800">Service Includes</h3>
                    </div>
                    <div className="space-y-1">
                      {service.dos.map((item, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-green-600 text-xs mt-1">•</span>
                          <span className="text-xs text-green-800">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* What's Excluded (Don'ts) */}
                {service.donts && service.donts.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-red-600">❌</span>
                      <h3 className="text-sm font-semibold text-red-800">Service Excludes</h3>
                    </div>
                    <div className="space-y-1">
                      {service.donts.map((item, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-red-600 text-xs mt-1">•</span>
                          <span className="text-xs text-red-800">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}

            <button
              onClick={() => setStep(2)}
              className="btn-brand w-full"
            >
              Continue →
            </button>
          </motion.div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Hours — from admin-configured durationOptions */}
            {service?.durationOptions && service.durationOptions.length > 0 && (
            <div>
              <h2 className="font-semibold font-heading text-foreground mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Number of Hours
              </h2>
              <p className="text-xs text-muted-foreground mb-3">Minimum {service.durationOptions[0]?.hours || 1} hour</p>
              <div className="flex gap-2 flex-wrap">
                {[...service.durationOptions].sort((a, b) => a.hours - b.hours).map((opt) => (
                  <button
                    key={opt.hours}
                    onClick={() => {
                      setHours(opt.hours);
                      setSelectedDurationTotal(opt.price);
                      setSelectedDurationMrp(opt.originalPrice > 0 ? opt.originalPrice : null);
                    }}
                    className={`px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-all ${
                      hours === opt.hours
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="block">{opt.hours}h</span>
                    {opt.originalPrice > 0 && (
                      <span className="text-xs line-through text-muted-foreground font-normal">₹{opt.originalPrice.toLocaleString('en-IN')}</span>
                    )}
                    <span className="text-sm text-green-700 font-bold">₹{opt.price.toLocaleString('en-IN')}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-start gap-2 mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>If the maid stays beyond your booked hours, <strong>overtime charges of ₹{overtimeRate}/min</strong> will apply to the final bill.</span>
              </div>
            </div>
            )}

            {/* Date */}
            {bookingMode === "now" ? (
              <div className="card-elevated p-3 flex items-center gap-3 rounded-xl">
                <Zap className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Book Now – Today</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date().toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> Select Date
                </label>
                <input
                  type="date"
                  value={bookingDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => {
                    setBookingDate(e.target.value);
                    const today = new Date().toISOString().split("T")[0];
                    if (e.target.value === today) {
                      const near = getNearestSlot();
                      setStartTime(near);
                    }
                  }}
                  className="input-clean"
                />
              </div>
            )}

            {/* Gender preference — placed before time slots so slots reflect the selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                <User className="w-4 h-4" /> Worker Gender Preference
              </label>
              <div className="flex gap-2">
                {(["any", "female", "male"] as const).map((g) => {
                  const count = genderCounts[g];
                  const label = g === "any" ? "Any" : g === "female" ? "👩 Female" : "👨 Male";
                  const disabled = slotsLoaded && count === 0;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => !disabled && setGenderPref(g)}
                      disabled={disabled}
                      className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                        disabled
                          ? "border-muted bg-muted/40 text-muted-foreground cursor-not-allowed"
                          : genderPref === g
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      {label}
                      {slotsLoaded && (
                        <span className={`ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full ${
                          count === 0
                            ? 'bg-muted text-muted-foreground'
                            : genderPref === g
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {slotsLoaded && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{activeWorkers}</span> matching worker{activeWorkers === 1 ? "" : "s"} for the selected preference.
                </p>
              )}
            </div>

            {/* Time slots */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                <Clock className="w-4 h-4" /> Available Time Slots
              </label>
              {availableSlots.length === 0 ? (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive text-center">
                  No slots left today. Switch to "Schedule" to pick a future date.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {availableSlots.map((t) => {
                      const busy = busyWorkersBySlot[t] ?? 0;
                      const free = slotsLoaded ? Math.max(0, activeWorkers - busy) : null;
                      const fullyBooked = slotsLoaded && free !== null && free <= 0;
                      const limited = free !== null && free === 1;
                      return (
                        <button
                          key={t}
                          onClick={() => !fullyBooked && setStartTime(t)}
                          disabled={fullyBooked}
                          className={`py-2 px-1 rounded-xl border-2 text-xs font-semibold transition-all flex flex-col items-center gap-0.5 ${
                            fullyBooked
                              ? "border-muted bg-muted/40 text-muted-foreground cursor-not-allowed opacity-50"
                              : startTime === t
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/40 text-foreground"
                          }`}
                        >
                          <span>{fmt12(t)}</span>
                          {free !== null && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                              fullyBooked
                                ? "bg-muted text-muted-foreground"
                                : limited
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                            }`}>
                                {fullyBooked ? "Full" : `${free} available`}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {slotsLoaded && (
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Available</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 1 left</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" /> Full</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Special Instructions (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="E.g. Enter from back door, allergic to strong chemicals..."
                className="input-clean resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors"
              >
                ← Back
              </button>
              <button onClick={() => setStep(3)} className="btn-brand flex-1">
                Review →
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="font-semibold font-heading text-foreground">Order Summary</h2>

            <div className="card-elevated p-4 rounded-2xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-2xl shrink-0">
                  ⚡
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Insta Maid Service</p>
                  <p className="text-xs text-muted-foreground">
                    {hours} hr · {fmt12(startTime)} – {fmt12(addMins(startTime, hours * 60))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {bookingMode === "now"
                      ? "⚡ Today (Book Now)"
                      : new Date(bookingDate + "T00:00:00").toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                  </p>
                </div>
              </div>
              {resolvedLocation ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>
                    {[
                      resolvedLocation.apartmentName,
                      resolvedLocation.area,
                      resolvedLocation.city,
                    ].filter(Boolean).join(", ") || resolvedLocation.address || "Selected location"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-amber-700 border-t pt-3">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Please pin your service location or enable auto location before confirming.</span>
                </div>
              )}
            </div>

            {service && (service.dos?.length > 0 || service.donts?.length > 0) && (
            <div className="card-elevated p-4 rounded-2xl">
              <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" /> Service Details
              </p>
              <div className="space-y-2">
                {service.dos && service.dos.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-green-700 mb-1">✅ Includes:</p>
                    <div className="flex flex-wrap gap-1">
                      {service.dos.slice(0, 3).map((item, index) => (
                        <span key={index} className="badge-success text-xs">
                          {item}
                        </span>
                      ))}
                      {service.dos.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{service.dos.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {service.donts && service.donts.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-red-700 mb-1">❌ Excludes:</p>
                    <div className="flex flex-wrap gap-1">
                      {service.donts.slice(0, 2).map((item, index) => (
                        <span key={index} className="badge-destructive text-xs">
                          {item}
                        </span>
                      ))}
                      {service.donts.length > 2 && (
                        <span className="text-xs text-muted-foreground">
                          +{service.donts.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}

            <div className="card-elevated p-4 rounded-2xl space-y-2">
              <p className="text-sm font-semibold text-foreground">Price Breakdown</p>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{hours} hr × <span className="line-through">₹{mrpPerHour}/hr</span> <span className="text-green-600 font-medium">₹{pricePerHour}/hr</span></span>
                <div className="text-right">
                  <div className="text-xs line-through">₹{mrpTotal.toLocaleString('en-IN')}</div>
                  <div className="text-green-700 font-medium">₹{totalAmount.toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div className="flex justify-between font-bold text-foreground border-t pt-2 text-base">
                <span>Total</span>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground line-through">₹{mrpTotal.toLocaleString('en-IN')}</div>
                  <span className="text-green-700">₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 pt-2 border-t border-amber-200 text-xs text-amber-800 bg-amber-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-2xl mt-2">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span><strong>Price may vary</strong> if the service runs beyond {hours} hr{hours > 1 ? 's' : ''}. Overtime is billed at ₹{overtimeRate}/min on the final bill.</span>
              </div>
            </div>

            {genderPref !== "any" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-xl bg-muted">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>
                  Worker preference:{" "}
                  <strong className="text-foreground capitalize">{genderPref}</strong>
                </span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleBook}
                disabled={booking || requestingService || checkingAvailability || (!isOutOfRegion && !canBookService)}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-semibold disabled:opacity-60 ${
                  isOutOfRegion
                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                    : 'btn-brand'
                }`}
              >
                {booking || requestingService ? (
                  <>
                    <span className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${isOutOfRegion ? 'border-amber-900' : 'border-white'}`} />
                    {isOutOfRegion ? 'Sending request...' : 'Booking...'}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    {isOutOfRegion
                      ? 'Request Service'
                      : !hasResolvedLocation
                      ? 'Set Location First'
                      : checkingAvailability
                      ? 'Checking region...'
                      : bookingMode === "now"
                      ? `Book Now – ₹${totalAmount.toLocaleString('en-IN')}`
                      : `Schedule – ₹${totalAmount.toLocaleString('en-IN')}`}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
};

export default InstaServicePage;
