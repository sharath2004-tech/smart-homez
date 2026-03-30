import AppLayout from "@/components/AppLayout";
import ServiceLocationCard from "@/components/ServiceLocationCard";
import { useServiceBookingAvailability } from "@/hooks/useServiceBookingAvailability";
import { authAPI, bookingsAPI, servicesAPI } from "@/lib/api";
import { motion } from "framer-motion";
import { Calendar, ChevronLeft, Clock, Minus, Plus, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

interface Service {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  tags?: string[];
  requirements?: string[];
  dos?: string[];
  sizeParameters?: {
    enabled: boolean;
    sizeType?: string;
    options?: Array<{ value: string; label: string; price: number; duration?: number }>;
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

  const [quantity, setQuantity] = useState(1);
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [timeSlots, setTimeSlots] = useState<string[]>([]);

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
        const [svcData, profileData, slotsData] = await Promise.all([
          servicesAPI.getById(id!),
          authAPI.getProfile(),
          bookingsAPI.getBookedSlots(tomorrowStr, null),
        ]);
        setService(svcData.service);
        setProfile(profileData.user || profileData);

        // Build time slots from admin business hours
        const open = slotsData.openTime || "08:00";
        const close = slotsData.closeTime || "18:00";
        const step = slotsData.slotDurationMinutes || 60;
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
        if (slots.length > 0) setStartTime(slots[0]);
      } catch {
        toast.error("Failed to load service");
        navigate("/customer/services");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchData();
  }, [id, navigate]);

  const meta = service ? getMeta(service.name, service.tags) : null;
  const totalAmount = (service?.price ?? 0) * quantity;

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
          quantity,
          unit: meta?.unit,
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
        notes: `${service.name} × ${quantity}. ${specialInstructions}`,
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
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{service.description}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" /> {service.duration} min / {meta.unitLabel.toLowerCase()}
                </span>
                <span className="text-xs font-bold text-blue-700">₹{service.price.toLocaleString('en-IN')} / {meta.unitLabel.toLowerCase()}</span>
              </div>
            </div>
          </div>
        </motion.div>

        <ServiceLocationCard
          serviceLabel="This service"
          checkingAvailability={checkingAvailability}
          hasResolvedLocation={hasResolvedLocation}
          isOutOfRegion={isOutOfRegion}
          availabilityReason={availability?.reason}
          resolvedLocation={resolvedLocation}
        />

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

        {/* Quantity — only shown when admin explicitly enables sizeParameters */}
        {service.sizeParameters?.enabled && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
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
          </motion.div>
        )}

        {/* Date & Time */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Schedule
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <label className="block text-xs text-muted-foreground mb-1">Time</label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {timeSlots.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
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
            <button
              onClick={handleBook}
              disabled={booking || requestingService || checkingAvailability || (!isOutOfRegion && !canBookService)}
              className={`flex-1 py-3.5 rounded-2xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
                isOutOfRegion
                  ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
              }`}
            >
              {booking || requestingService ? (
                <motion.div
                  className={`w-4 h-4 border-2 border-t-transparent rounded-full ${isOutOfRegion ? 'border-amber-900' : 'border-primary-foreground'}`}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              ) : (
                <><Zap className="w-4 h-4" /> {isOutOfRegion ? 'Request Service' : !hasResolvedLocation ? 'Set Location First' : checkingAvailability ? 'Checking region...' : 'Book Now'}</>
              )}
            </button>
          </div>
        </motion.div>

      </div>
    </AppLayout>
  );
};

export default MiniCleanServicePage;
