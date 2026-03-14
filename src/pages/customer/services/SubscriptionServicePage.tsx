import AppLayout from "@/components/AppLayout";
import { authAPI, bookingsAPI, servicesAPI } from "@/lib/api";
import { motion } from "framer-motion";
import {
    AlertCircle,
    Calendar,
    ChevronLeft,
    Clock,
    RefreshCw,
    Repeat,
    Star,
    User,
    Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Service {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  serviceType: string;
  subscriptionPlans?: {
    id: string;
    name: string;
    displayName: string;
    icon: string;
    description: string;
    price: number;
    discountPercentage: number;
    isActive: boolean;
    allowDaySelection: boolean;
  }[];
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

const DAYS_OF_WEEK = [
  { id: "monday", label: "Mon" },
  { id: "tuesday", label: "Tue" },
  { id: "wednesday", label: "Wed" },
  { id: "thursday", label: "Thu" },
  { id: "friday", label: "Fri" },
  { id: "saturday", label: "Sat" },
  { id: "sunday", label: "Sun" },
];

const FREQUENCY_OPTIONS = [
  { id: "daily", label: "Daily", icon: "📆", desc: "Every day", days: 30 },
  { id: "custom-days", label: "5 Days/Week", icon: "📅", desc: "Weekdays only", days: 20 },
  { id: "3-days", label: "3 Days/Week", icon: "🗓️", desc: "3× per week", days: 12 },
  { id: "weekly", label: "Weekly", icon: "📋", desc: "Once a week", days: 4 },
];

const SESSION_HOURS = [1, 2, 3, 4];
const TIME_SLOTS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
];

const SubscriptionServicePage = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Booking params
  const [frequency, setFrequency] = useState("daily");
  const [selectedDays, setSelectedDays] = useState<string[]>(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  const [sessionHours, setSessionHours] = useState(2);
  const [startDate, setStartDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("09:00");
  const [autoRenewal, setAutoRenewal] = useState(true);
  const [genderPref, setGenderPref] = useState<"any" | "male" | "female">("any");
  const [specialInstructions, setSpecialInstructions] = useState("");

  useEffect(() => {
    fetchData();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 1);
    setStartDate(nextWeek.toISOString().split("T")[0]);
  }, []);

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

  const toggleDay = (id: string) => {
    setSelectedDays((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const currentFreq = FREQUENCY_OPTIONS.find((f) => f.id === frequency);
  const basePrice = selectedService?.price ?? 120;
  // Monthly cost projection: sessions × price per session (hours set duration, not price multiplier)
  const sessionsPerMonth = currentFreq?.days ?? 20;
  const pricePerSession = basePrice;
  const monthlyPrice = sessionsPerMonth * pricePerSession;
  const discount = 20; // 20% subscription discount
  const discountedPrice = Math.round(monthlyPrice * (1 - discount / 100));

  const getEndDate = () => {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  };

  const getEndTime = () => {
    const [h] = preferredTime.split(":").map(Number);
    return `${String(h + sessionHours).padStart(2, "0")}:00`;
  };

  const handleBook = async () => {
    if (!selectedService) return toast.error("Please select a service");
    if (!startDate) return toast.error("Please select a start date");
    if (frequency === "weekly" && selectedDays.length === 0)
      return toast.error("Select at least one day for weekly plan");

    const defaultAddr = profile?.addresses?.find((a) => a.isDefault) || profile?.addresses?.[0];

    try {
      setBooking(true);
      await bookingsAPI.create({
        service: selectedService._id,
        bookingDate: startDate,
        startTime: preferredTime,
        endTime: getEndTime(),
        totalAmount: discountedPrice,
        bookingType: "monthly",
        isSubscription: true,
        subscriptionDetails: {
          startDate,
          endDate: getEndDate(),
          frequency,
          selectedDays: frequency === "weekly" || frequency === "custom-days" ? selectedDays : [],
          preferredTime,
          durationPerSession: sessionHours,
          autoRenewal,
          allowPause: true,
        },
        serviceDetails: {
          sessionDurationHours: sessionHours,
        },
        preferences: {
          workerGenderPreference: genderPref,
          specialInstructions,
        },
        location: defaultAddr
          ? {
              apartmentName: defaultAddr.apartmentName || "",
              area: defaultAddr.area || "",
              city: defaultAddr.city || "",
              coordinates: defaultAddr.location?.coordinates || [],
            }
          : undefined,
        notes: specialInstructions,
      } as Record<string, unknown>);
      toast.success("Subscription created! A dedicated maid will be assigned 🎉", {
        duration: 5000,
      });
      navigate("/customer/subscriptions");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Booking failed";
      toast.error(msg);
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
      <div className="max-w-2xl mx-auto pb-24 space-y-5">
        {/* Header */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex items-center gap-3"
        >
          <Link
            to="/customer/services"
            className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-border transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📅</span>
              <h1 className="text-xl font-bold text-foreground">Subscription Plans</h1>
            </div>
            <p className="text-xs text-muted-foreground">Save 20% with recurring bookings</p>
          </div>
        </motion.div>

        {/* Savings banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 flex items-center gap-3"
        >
          <Star className="w-8 h-8 text-blue-500 fill-blue-500 shrink-0" />
          <div>
            <p className="font-semibold text-blue-900">Save 20% vs One-time Bookings</p>
            <p className="text-xs text-blue-700">
              Fixed maid assigned • Pause or cancel anytime • Priority support
            </p>
          </div>
        </motion.div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step >= s ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`h-0.5 w-12 rounded transition-all ${
                    step > s ? "bg-blue-500" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
          <span className="ml-2 text-xs text-muted-foreground">
            {step === 1
              ? "Choose Plan"
              : step === 2
              ? "Schedule & Preferences"
              : "Review & Confirm"}
          </span>
        </div>

        {/* STEP 1 — Choose Service & Frequency */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
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
                  {services.map((svc) => (
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
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">
                          📅
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{svc.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {svc.description}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground line-through">₹{svc.price.toLocaleString('en-IN')}/session</p>
                          <p className="font-bold text-green-700">₹{Math.round(svc.price * 0.8).toLocaleString('en-IN')}</p>
                          <p className="text-xs text-muted-foreground">/session · 20% off</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Frequency */}
            <div>
              <h2 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Repeat className="w-4 h-4 text-blue-500" /> Frequency
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {FREQUENCY_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFrequency(f.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      frequency === f.id
                        ? "border-blue-400 bg-blue-50"
                        : "border-border hover:border-blue-300"
                    }`}
                  >
                    <div className="text-xl mb-1">{f.icon}</div>
                    <p className="text-sm font-semibold text-foreground">{f.label}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Day selection for weekly-type */}
            {(frequency === "weekly" || frequency === "custom-days" || frequency === "3-days") && (
              <div>
                <h2 className="font-semibold text-foreground mb-2">Select Days</h2>
                <div className="flex gap-2 flex-wrap">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.id}
                      onClick={() => toggleDay(day.id)}
                      className={`px-3 py-1.5 rounded-xl border-2 text-sm font-medium transition-all ${
                        selectedDays.includes(day.id)
                          ? "border-blue-400 bg-blue-50 text-blue-700"
                          : "border-border hover:border-blue-300"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Session duration */}
            <div>
              <h2 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" /> Hours per Session
              </h2>
              <div className="flex gap-2">
                {SESSION_HOURS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setSessionHours(h)}
                    className={`flex-1 py-2 rounded-xl border-2 font-semibold text-sm transition-all ${
                      sessionHours === h
                        ? "border-blue-400 bg-blue-50 text-blue-700"
                        : "border-border hover:border-blue-300"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            {/* Monthly estimate */}
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
              <p className="text-sm font-semibold text-blue-900 mb-1">Monthly Estimate</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-blue-700">₹{discountedPrice.toLocaleString('en-IN')}</span>
                <span className="text-sm text-blue-400 line-through mb-0.5">₹{monthlyPrice.toLocaleString('en-IN')}</span>
                <span className="text-xs font-semibold text-green-600 mb-0.5">20% OFF</span>
              </div>
              <p className="text-xs text-blue-700 mt-1">
                <span className="line-through text-blue-400">₹{pricePerSession.toLocaleString('en-IN')}/session</span>
                {' → '}₹{Math.round(discountedPrice / sessionsPerMonth).toLocaleString('en-IN')}/session × {sessionsPerMonth} sessions/month · {sessionHours}h each
              </p>
            </div>

            <button
              onClick={() => {
                if (!selectedService) return toast.error("Please select a service");
                setStep(2);
              }}
              className="w-full py-3 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors"
            >
              Continue →
            </button>
          </motion.div>
        )}

        {/* STEP 2 — Schedule & Preferences */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Preferred Time</label>
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
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  autoRenewal ? "bg-blue-500" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    autoRenewal ? "left-6" : "left-0.5"
                  }`}
                />
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
                      genderPref === g
                        ? "border-blue-400 bg-blue-50 text-blue-700"
                        : "border-border hover:border-blue-300"
                    }`}
                  >
                    {g === "any" ? "Any" : g === "female" ? "👩 Female" : "👨 Male"}
                  </button>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Special Instructions (optional)
              </label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                rows={3}
                placeholder="E.g. Focus on kitchen and bathrooms..."
                className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-2xl border border-border text-foreground font-semibold hover:bg-muted transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-3 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors"
              >
                Review →
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3 — Confirm */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="font-semibold text-foreground">Subscription Summary</h2>

            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <div>
                  <p className="font-semibold text-foreground">{selectedService?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {currentFreq?.label} · {sessionHours}h/session · from {startDate}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>Preferred time: {preferredTime}</span>
              </div>
              {selectedDays.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {selectedDays.map((d) => (
                    <span key={d} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full capitalize">
                      {d.slice(0, 3)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Price breakdown */}
            <div className="p-4 rounded-2xl border border-border space-y-2">
              <p className="text-sm font-semibold text-foreground">Monthly Cost</p>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Without subscription</span>
                <span className="line-through">₹{monthlyPrice}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600 font-medium">
                <span>20% Subscription Discount</span>
                <span>-₹{monthlyPrice - discountedPrice}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-foreground">
                <span>Monthly Total</span>
                <span>₹{discountedPrice}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
              ⚡ A dedicated maid will be assigned exclusively to your subscription. You can pause or cancel anytime.
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 rounded-2xl border border-border text-foreground font-semibold hover:bg-muted transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleBook}
                disabled={booking}
                className="flex-1 py-3 rounded-2xl bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {booking ? (
                  <>
                    <motion.div
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    Creating...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" /> Subscribe Now
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

export default SubscriptionServicePage;
