import AppLayout from "@/components/AppLayout";
import ServiceLocationCard from "@/components/ServiceLocationCard";
import { useServiceBookingAvailability } from "@/hooks/useServiceBookingAvailability";
import { authAPI, bookingsAPI, servicesAPI } from "@/lib/api";
import { motion } from "framer-motion";
import { Calendar, CheckCircle, ChevronLeft, Clock, MapPin, Minus, Plus, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

interface Service {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  slotSelectionType?: 'worker_availability' | 'standard_slots';
  tags?: string[];
  requirements?: string[];
  dos?: string[];
  highlight?: string;
  rating?: number;
  reviewCount?: number;
  sizeParameters?: {
    enabled: boolean;
    sizeType?: string;
    options?: Array<{ value: string; label: string; price: number; duration?: number }>;
  };
}

interface ServiceReview {
  _id: string;
  overallRating: number;
  comment?: string;
  createdAt: string;
  customerName: string;
  avatar: string;
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

const SERVICE_META: Record<string, { icon: string; unit: string; unitLabel: string }> = {
  kitchen:  { icon: "🍳", unit: "kitchen",  unitLabel: "Kitchen"   },
  bathroom: { icon: "🚿", unit: "bathroom", unitLabel: "Bathroom"  },
  sofa:     { icon: "🛋️", unit: "sofa",     unitLabel: "Sofa"      },
  carpet:   { icon: "🪣", unit: "carpet",   unitLabel: "Carpet"    },
  window:   { icon: "🪟", unit: "window",   unitLabel: "Set"       },
  fan:      { icon: "🌀", unit: "fan",      unitLabel: "Fan"       },
  balcony:  { icon: "🌿", unit: "balcony",  unitLabel: "Balcony"   },
  fridge:   { icon: "❄️", unit: "fridge",   unitLabel: "Fridge"    },
};

const TIME_SLOTS: string[] = []; // replaced — use admin business hours via state below

const getMeta = (name: string, tags: string[] = []) => {
  const n = name.toLowerCase();
  for (const [key, meta] of Object.entries(SERVICE_META)) {
    if (n.includes(key) || tags.includes(key)) return meta;
  }
  return { icon: "✨", unit: "unit", unitLabel: "Unit", includes: [] };
};

const MiniCleanServicePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [serviceReviews, setServiceReviews] = useState<ServiceReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [selectedTierValue, setSelectedTierValue] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [bookedRanges, setBookedRanges] = useState<Array<{ workerId: string | null; startTime: string; endTime: string }>>([]);
  const [totalWorkersCount, setTotalWorkersCount] = useState(0);
  const [loadingSlots, setLoadingSlots] = useState(false);

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
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    setBookingDate(tomorrowStr);

    const fetchData = async () => {
      try {
        const [svcData, profileData] = await Promise.all([
          servicesAPI.getById(id!),
          authAPI.getProfile(),
        ]);
        setService(svcData.service);
        setProfile(profileData.user || profileData);

        // Pre-select first tier if tiers exist
        const firstTier = svcData.service?.sizeParameters?.options?.[0];
        if (firstTier) setSelectedTierValue(firstTier.value || firstTier.label);

        // Fetch public reviews for this service
        try {
          setReviewsLoading(true);
          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/reviews/public?serviceId=${id}&limit=8`);
          if (response.ok) {
            const reviewData = await response.json();
            setServiceReviews(reviewData?.reviews || []);
          } else {
            setServiceReviews([]);
          }
        } catch {
          // reviews are non-critical
        } finally {
          setReviewsLoading(false);
        }
      } catch {
        toast.error("Failed to load service");
        navigate("/customer/services");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchData();
  }, [id, navigate]);

  useEffect(() => {
    const fetchSlots = async () => {
      if (!bookingDate) return;
      try {
        setLoadingSlots(true);
        const location = resolvedLocation
          ? { lng: resolvedLocation.longitude, lat: resolvedLocation.latitude }
          : null;

        const data = await bookingsAPI.getBookedSlots(
          bookingDate,
          location,
          service?._id ? { service: service._id } : undefined
        );

        setBookedRanges(data.bookedRanges || []);
        setTotalWorkersCount(data.totalWorkers || 0);

        const open = data.openTime || "08:00";
        const close = data.closeTime || "18:00";
        const step = data.slotDurationMinutes || 60;
        const slots: string[] = [];
        const [oh, om] = open.split(":").map(Number);
        const [ch, cm] = close.split(":").map(Number);
        let cur = oh * 60 + om;
        const end = ch * 60 + cm;
        while (cur < end) {
          slots.push(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
          cur += step;
        }
        setTimeSlots(slots);
        if (slots.length > 0) {
          setStartTime(prev => (slots.includes(prev) ? prev : slots[0]));
        }
      } catch {
        setBookedRanges([]);
        setTotalWorkersCount(0);
        setTimeSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [bookingDate, resolvedLocation, service?._id]);

  const meta = service ? getMeta(service.name, service.tags) : null;

  const tierOptions = service?.sizeParameters?.enabled ? (service.sizeParameters?.options ?? []) : [];
  const hasTiers = tierOptions.length > 0;
  const selectedTier = hasTiers
    ? tierOptions.find(o => (o.value || o.label) === selectedTierValue) ?? tierOptions[0]
    : null;
  const totalAmount = hasTiers
    ? (selectedTier?.price ?? 0)
    : (service?.price ?? 0) * quantity;
  const slotDisplayMode = service?.slotSelectionType || 'worker_availability';
  const showAvailabilityCounts = slotDisplayMode === 'worker_availability';

  const getSlotDurationMinutes = () => (
    selectedTier?.duration
    ?? service?.duration
    ?? 60
  );

  const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const formatSlotTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${h12}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  const getAvailableWorkersForSlot = (time: string) => {
    if (totalWorkersCount <= 0) return 0;
    const slotStart = toMinutes(time);
    const slotEnd = slotStart + getSlotDurationMinutes();
    const busyWorkerIds = new Set<string>();

    for (const range of bookedRanges) {
      if (!range.workerId) continue;
      const rangeStart = toMinutes(range.startTime);
      const rangeEnd = toMinutes(range.endTime);
      if (slotStart < rangeEnd && slotEnd > rangeStart) {
        busyWorkerIds.add(range.workerId);
      }
    }

    return Math.max(0, totalWorkersCount - busyWorkerIds.size);
  };

  const handleBook = async () => {
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

    if (!service) return;
    if (!bookingDate) return toast.error("Please select a date");

    if (!resolvedLocation) {
      toast.error("Please pin your selected service location or enable auto location before booking.");
      return;
    }

    try {
      setBooking(true);
      await bookingsAPI.create({
        service: service._id,
        bookingDate,
        startTime,
        endTime: startTime,
        totalAmount,
        bookingType: "adhoc",
        serviceDetails: {
          quantity: hasTiers ? 1 : quantity,
          unit: meta?.unit,
          ...(hasTiers && selectedTier ? { package: selectedTier.label } : {}),
        },
        preferences: { specialInstructions },
        location: {
          apartmentName: resolvedLocation.apartmentName || "",
          address: resolvedLocation.address || "",
          area: resolvedLocation.area || "",
          city: resolvedLocation.city || "",
          state: resolvedLocation.state || "",
          zipCode: resolvedLocation.zipCode || "",
          coordinates: [resolvedLocation.longitude, resolvedLocation.latitude],
        },
        notes: hasTiers && selectedTier
          ? `${service.name} — ${selectedTier.label}. ${specialInstructions}`
          : `${service.name} × ${quantity}. ${specialInstructions}`,
      } as Record<string, unknown>);
      toast.success(`${service.name} booked! We'll confirm shortly 🎉`, { duration: 5000 });
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
          <motion.div
            className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </AppLayout>
    );
  }

  if (!service || !meta) return null;

  return (
    <AppLayout userType="customer" userName={profile?.name || "Guest"}>
      <div className="max-w-lg mx-auto px-3 sm:px-4 md:px-6 pb-24 space-y-5">

        {/* Header */}
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-3">
          <Link
            to="/customer/services"
            className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-border transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="text-xs text-muted-foreground">Spot Clean</p>
            <h1 className="text-xl font-bold text-foreground">{service.name}</h1>
          </div>
        </motion.div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>{s}</div>
              {s < 2 && <div className={`h-0.5 w-10 rounded transition-all ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
          <span className="ml-2 text-xs text-muted-foreground font-medium">
            {step === 1 ? 'Select & Schedule' : 'Review & Confirm'}
          </span>
        </div>

        {/* Service hero card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200"
        >
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-4xl shadow-sm shrink-0">
              {meta.icon}
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-foreground text-base">{service.name}</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{service.highlight || service.description}</p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" /> {service.duration} min / {meta.unitLabel.toLowerCase()}
                </span>
                {hasTiers ? (
                  <span className="text-xs font-bold text-blue-700">
                    from ₹{Math.min(...tierOptions.map(o => o.price)).toLocaleString('en-IN')}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-blue-700">₹{service.price.toLocaleString('en-IN')} / {meta.unitLabel.toLowerCase()}</span>
                )}
                {service.rating && service.rating > 0 ? (
                  <span className="flex items-center gap-1 text-xs">
                    <span className="text-yellow-500">★</span>
                    <span className="font-semibold text-foreground">{service.rating.toFixed(1)}</span>
                    {service.reviewCount && service.reviewCount > 0 ? (
                      <span className="text-muted-foreground">({service.reviewCount.toLocaleString('en-IN')})</span>
                    ) : null}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Our Promise Trust Bar */}
        <div className="flex items-center justify-center gap-3 sm:gap-5 flex-wrap py-2 px-3 rounded-xl bg-muted/40 border border-border">
          {[
            { icon: '✅', text: 'Verified Professionals' },
            { icon: '💰', text: 'Transparent Pricing' },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-1.5">
              <span className="text-sm">{item.icon}</span>
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{item.text}</span>
            </div>
          ))}
        </div>

        <ServiceLocationCard
          serviceLabel="This service"
          checkingAvailability={checkingAvailability}
          hasResolvedLocation={hasResolvedLocation}
          isOutOfRegion={isOutOfRegion}
          availabilityReason={availability?.reason}
          resolvedLocation={resolvedLocation}
        />

        {/* ── STEP 1 content ── */}
        {step === 1 && (<>

        {/* What's included — from admin-configured service dos */}
        {service.dos && service.dos.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <h3 className="font-semibold text-foreground mb-2">What's included</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {service.dos.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                  <span className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Quantity / Tier selector */}
        {service.sizeParameters?.enabled && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {hasTiers ? (
              /* Labeled tier cards (e.g. 3 seats → ₹499, 4 seats → ₹649) */
              <>
                <h3 className="font-semibold text-foreground mb-3">Select {meta.unitLabel}</h3>
                <div className="grid grid-cols-1 gap-2">
                  {tierOptions.map((tier) => {
                    const tierKey = tier.value || tier.label;
                    const isSelected = (selectedTierValue ?? (tierOptions[0].value || tierOptions[0].label)) === tierKey;
                    return (
                      <button
                        key={tierKey}
                        type="button"
                        onClick={() => setSelectedTierValue(tierKey)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-card hover:border-primary/40'
                        }`}
                      >
                        <span className="font-medium text-foreground">{tier.label}</span>
                        <span className={`font-bold text-sm ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                          ₹{tier.price.toLocaleString('en-IN')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              /* Plain quantity counter when no labeled tiers */
              <>
                <h3 className="font-semibold text-foreground mb-2">
                  How many {meta.unitLabel.toLowerCase()}s?
                </h3>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-xl border-2 border-border flex items-center justify-center hover:border-primary transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-2xl font-bold text-foreground w-8 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                    className="w-10 h-10 rounded-xl border-2 border-border flex items-center justify-center hover:border-primary transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-muted-foreground ml-1">
                    {quantity} × ₹{service.price.toLocaleString('en-IN')} = <span className="font-bold text-foreground">₹{totalAmount.toLocaleString('en-IN')}</span>
                  </span>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Date & Time */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Schedule
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Date</label>
              <input
                type="date"
                value={bookingDate}
                min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                <Clock className="w-4 h-4" /> Available Time Slots
              </label>
              {loadingSlots ? (
                <div className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-muted-foreground">
                  Loading time slots...
                </div>
              ) : showAvailabilityCounts ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {timeSlots.length === 0 ? (
                      <p className="col-span-2 text-xs text-muted-foreground py-2">No slots available for this date.</p>
                    ) : (
                      timeSlots.map((t) => {
                        const availableWorkers = getAvailableWorkersForSlot(t);
                        const isFull = availableWorkers <= 0;
                        const isSelected = startTime === t;

                        const isLow = availableWorkers === 1;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => !isFull && setStartTime(t)}
                            disabled={isFull}
                            className={`py-3 px-1 rounded-xl border transition-all flex flex-col items-center gap-1 ${
                              isFull
                                ? 'border-border/40 bg-muted/20 cursor-not-allowed opacity-40'
                                : isSelected
                                ? 'border-primary bg-primary/8 shadow-sm ring-1 ring-primary/25'
                                : 'border-border bg-card hover:border-primary/50'
                            }`}
                          >
                            <span className={`text-sm font-bold leading-tight tracking-tight ${
                              isFull ? 'text-muted-foreground/60' : isSelected ? 'text-primary' : 'text-foreground'
                            }`}>{formatSlotTime(t)}</span>
                            <span className={`flex items-center gap-1 text-[10px] font-medium leading-none ${
                              isFull
                                ? 'text-muted-foreground/50'
                                : isLow
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                isFull ? 'bg-muted-foreground/30' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                              }`} />
                              {isFull ? 'Full' : isLow ? '1 available' : `${availableWorkers} available`}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Available</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 1 left</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" /> Full</span>
                  </div>
                </>
              ) : (
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {timeSlots.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </motion.div>

        {/* Special instructions */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <label className="block text-sm font-medium text-foreground mb-1">Special Instructions (optional)</label>
          <textarea
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            rows={2}
            placeholder={`E.g. Focus on grease spots, bring extra solution...`}
            className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </motion.div>

        {/* Requirements */}
        {service.requirements && service.requirements.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
            <p className="text-xs font-semibold text-amber-800">Before the team arrives:</p>
            {service.requirements.map((r) => (
              <p key={r} className="text-xs text-amber-700">• {r}</p>
            ))}
          </div>
        )}

        </>) /* end step 1 */}

        {/* ── STEP 2: Review & Confirm ── */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <h2 className="font-semibold font-heading text-foreground">Review your booking</h2>

            {/* Service summary */}
            <div className="card-elevated p-4 rounded-2xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-2xl shrink-0">{meta.icon}</div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{service.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {hasTiers && selectedTier ? selectedTier.label : `${quantity} ${meta.unitLabel.toLowerCase()}${quantity > 1 ? 's' : ''}`}
                    {' · '}{bookingDate ? new Date(bookingDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
                    {' · '}{formatSlotTime(startTime)}
                  </p>
                </div>
              </div>

              {/* Location */}
              {resolvedLocation ? (
                <div className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-3">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{[resolvedLocation.apartmentName, resolvedLocation.area, resolvedLocation.city].filter(Boolean).join(', ') || resolvedLocation.address || 'Selected location'}</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-xs text-amber-700 border-t pt-3">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>No location set — please pin your service location before confirming.</span>
                </div>
              )}
            </div>

            {/* Price breakdown */}
            <div className="card-elevated p-4 rounded-2xl space-y-2">
              <p className="text-sm font-semibold text-foreground">Price Breakdown</p>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{hasTiers && selectedTier ? selectedTier.label : `${quantity} × ₹${service.price.toLocaleString('en-IN')}`}</span>
                <span className="font-semibold text-foreground">₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-bold text-foreground border-t pt-2 text-base">
                <span>Total</span>
                <span className="text-primary">₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Special instructions preview */}
            {specialInstructions && (
              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <p className="text-xs font-medium text-foreground mb-1">📝 Special Instructions</p>
                <p className="text-xs text-muted-foreground">{specialInstructions}</p>
              </div>
            )}

            {/* Confirmation checklist */}
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
              {[
                'Verified & background-checked professional',
                'Transparent pricing — no hidden charges',
                'Free cancellation before service starts',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-xs text-emerald-800">{item}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              ← Edit Booking
            </button>
          </motion.div>
        )}

        {/* Customer Reviews Section */}
        {(serviceReviews.length > 0 || reviewsLoading) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Customer Reviews</h3>
              {serviceReviews.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-yellow-500">★</span>
                  <span className="text-sm font-bold text-foreground">
                    {(serviceReviews.reduce((acc, r) => acc + r.overallRating, 0) / serviceReviews.length).toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">({serviceReviews.length} reviews)</span>
                </div>
              )}
            </div>

            {reviewsLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Star breakdown bar */}
                {(() => {
                  const counts = [5, 4, 3, 2, 1].map(star => ({
                    star,
                    count: serviceReviews.filter(r => Math.round(r.overallRating) === star).length
                  }));
                  const max = Math.max(...counts.map(c => c.count), 1);
                  return (
                    <div className="p-3 bg-muted/30 rounded-xl space-y-1.5">
                      {counts.map(({ star, count }) => (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-xs w-4 text-right text-muted-foreground shrink-0">{star}</span>
                          <span className="text-yellow-400 text-xs shrink-0">★</span>
                          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-400 rounded-full transition-all"
                              style={{ width: `${(count / max) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-4 shrink-0">{count}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Individual reviews */}
                <div className="space-y-2">
                  {serviceReviews.slice(0, 5).map((review) => (
                    <div key={review._id} className="p-3 rounded-xl border border-border bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {review.avatar}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground">{review.customerName}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(review.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(s => (
                            <span key={s} className={`text-[10px] ${s <= Math.round(review.overallRating) ? 'text-yellow-400' : 'text-border'}`}>★</span>
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-3">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border"
        >
          <div className="max-w-lg mx-auto flex items-center gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold text-foreground">₹{totalAmount.toLocaleString('en-IN')}</p>
            </div>
            {step === 1 ? (
              <button
                onClick={() => {
                  if (!bookingDate) { toast.error('Please select a date'); return; }
                  setStep(2);
                }}
                className="flex-1 py-3.5 rounded-2xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors flex items-center justify-center gap-2"
              >
                Review Booking →
              </button>
            ) : (
              <button
                onClick={handleBook}
                disabled={booking || requestingService || checkingAvailability || (!isOutOfRegion && !canBookService)}
                className={`flex-1 py-3.5 rounded-2xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
                  isOutOfRegion ? 'bg-amber-100 text-amber-900 hover:bg-amber-200' : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                }`}
              >
                {booking || requestingService ? (
                  <motion.div className={`w-4 h-4 border-2 border-t-transparent rounded-full ${isOutOfRegion ? 'border-amber-900' : 'border-primary-foreground'}`} animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                ) : (
                  <><Zap className="w-4 h-4" /> {isOutOfRegion ? 'Request Service' : !hasResolvedLocation ? 'Set Location First' : checkingAvailability ? 'Checking...' : 'Confirm & Book'}</>
                )}
              </button>
            )}
          </div>
        </motion.div>

      </div>
    </AppLayout>
  );
};

export default MiniCleanServicePage;
