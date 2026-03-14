import AppLayout from "@/components/AppLayout";
import { authAPI, bookingsAPI, servicesAPI } from "@/lib/api";
import { motion } from "framer-motion";
import {
    AlertCircle,
    Calendar,
    ChevronLeft,
    Clock,
    RefreshCw,
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
  durationOptions?: { hours: number; price: number; isDefault?: boolean }[];
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

const FREQUENCY_OPTIONS = [
  { id: "daily", label: "Daily", icon: "📆", desc: "Every day", days: 30 },
  { id: "custom-days", label: "5 Days/Week", icon: "📅", desc: "Weekdays only", days: 20 },
  { id: "3-days", label: "3 Days/Week", icon: "🗓️", desc: "3× per week", days: 12 },
  { id: "weekly", label: "Weekly", icon: "📋", desc: "Once a week", days: 4 },
];

const SESSION_HOURS = [1, 1.5, 2, 2.5, 3, 3.5];
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

  // Booking params — frequency is fixed to "daily" for this Monthly Pack
  const frequency = "daily";
  const selectedDays: string[] = []; // daily plan has no specific day selection
  const [sessionHours, setSessionHours] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("09:00");
  const [autoRenewal, setAutoRenewal] = useState(true);
  const [genderPref, setGenderPref] = useState<"any" | "male" | "female">("any");
  const [specialInstructions, setSpecialInstructions] = useState("");

  // Session split — available when sessionHours >= 2
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [session1Hours, setSession1Hours] = useState(1);
  const [session2Time, setSession2Time] = useState("17:00");

  useEffect(() => {
    fetchData();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 1);
    setStartDate(nextWeek.toISOString().split("T")[0]);
  }, []);

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

  const currentFreq = FREQUENCY_OPTIONS.find((f) => f.id === frequency);
  // Pricing: look up the monthly price from durationOptions for chosen hours
  const durationOption = selectedService?.durationOptions?.find(
    (d) => d.hours === sessionHours
  );
  const monthlyPrice = durationOption?.price ?? selectedService?.price ?? 0;
  const discountedPrice = monthlyPrice; // durationOptions prices are already the subscription prices

  const getEndDate = () => {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + 1);
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

  // Valid session1Hours choices: steps of 0.5, from 1 up to sessionHours-1 (so session2 has ≥1h)
  const session1HoursOptions: number[] = [];
  for (let h = 1; h <= sessionHours - 1; h += 0.5) {
    session1HoursOptions.push(h);
  }

  const handleBook = async () => {
    if (!selectedService) return toast.error("Please select a service");
    if (!startDate) return toast.error("Please select a start date");

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
          selectedDays: [],
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
                          <p className="text-xs text-muted-foreground">from</p>
                          <p className="font-bold text-blue-700">
                            ₹{(
                              svc.durationOptions?.find(d => d.hours === 1)?.price ||
                              svc.durationOptions?.slice().sort((a, b) => a.hours - b.hours)[0]?.price ||
                              svc.price
                            ).toLocaleString('en-IN')}/mo
                          </p>
                          <p className="text-xs text-muted-foreground">1h daily</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Session duration — pick FIRST so plan summaries show correct hours */}
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
              <p className="text-sm font-semibold text-blue-900 mb-1">Monthly Total</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-blue-700">₹{monthlyPrice.toLocaleString('en-IN')}</span>
                <span className="text-xs text-blue-600 mb-0.5">/ month</span>
              </div>
              <p className="text-xs text-blue-700 mt-1">
                {sessionHours}h daily · 30 sessions · same worker every day
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

            {/* Session Split — available when 2h or more booked */}
            {sessionHours >= 2 && (
              <div className="space-y-3">
                {/* Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                  <div>
                    <p className="text-sm font-semibold text-indigo-900">Split into Sessions</p>
                    <p className="text-xs text-indigo-600">
                      Divide {sessionHours}h across morning &amp; evening (min 1h each)
                    </p>
                  </div>
                  <button
                    onClick={() => setSplitEnabled(!splitEnabled)}
                    className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${splitEnabled ? "bg-indigo-500" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${splitEnabled ? "left-6" : "left-0.5"}`} />
                  </button>
                </div>

                {/* Session split details */}
                {splitEnabled && (
                  <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 space-y-4">
                    {/* Session 1 */}
                    <div>
                      <p className="text-xs font-bold text-indigo-800 mb-2">🌅 Session 1 — Morning</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Start Time</label>
                          <select
                            value={preferredTime}
                            onChange={(e) => setPreferredTime(e.target.value)}
                            className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          >
                            {TIME_SLOTS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Duration</label>
                          <select
                            value={session1Hours}
                            onChange={(e) => setSession1Hours(Number(e.target.value))}
                            className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          >
                            {session1HoursOptions.map((h) => (
                              <option key={h} value={h}>{h}h</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <p className="text-xs text-indigo-600 mt-1">
                        Ends at {addHoursToTime(preferredTime, session1Hours)}
                      </p>
                    </div>

                    <div className="border-t border-indigo-200" />

                    {/* Session 2 */}
                    <div>
                      <p className="text-xs font-bold text-indigo-800 mb-2">
                        🌆 Session 2 — Evening ({sessionHours - session1Hours}h)
                      </p>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Start Time</label>
                        <select
                          value={session2Time}
                          onChange={(e) => setSession2Time(e.target.value)}
                          className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        >
                          {TIME_SLOTS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <p className="text-xs text-indigo-600 mt-1">
                        Ends at {addHoursToTime(session2Time, sessionHours - session1Hours)}
                      </p>
                    </div>

                    {/* Split summary */}
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
              {splitEnabled ? (
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>🌅</span>
                    <span>Session 1: {preferredTime} → {addHoursToTime(preferredTime, session1Hours)} ({session1Hours}h)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🌆</span>
                    <span>Session 2: {session2Time} → {addHoursToTime(session2Time, sessionHours - session1Hours)} ({sessionHours - session1Hours}h)</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Preferred time: {preferredTime}</span>
                </div>
              )}
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
              <p className="text-sm font-semibold text-foreground">Cost Summary</p>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{sessionHours}h/day · 30 days</span>
                <span>Daily pack rate</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-foreground">
                <span>Monthly Total</span>
                <span>₹{discountedPrice.toLocaleString('en-IN')}</span>
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
