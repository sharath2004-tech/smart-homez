import AppLayout from "@/components/AppLayout";
import { authAPI, bookingsAPI, servicesAPI } from "@/lib/api";
import { motion } from "framer-motion";
import {
    AlertCircle,
    Briefcase,
    Calendar,
    ChevronLeft,
    Clock,
    MapPin,
    ShoppingBag,
    Sparkles,
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
  tags?: string[];
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

const TASK_OPTIONS = [
  { id: "sweeping", label: "Sweeping & Mopping", icon: "🧹" },
  { id: "dusting", label: "Dusting Surfaces", icon: "🪣" },
  { id: "dishes", label: "Washing Dishes", icon: "🍽️" },
  { id: "laundry", label: "Laundry (wash & fold)", icon: "👕" },
  { id: "cooking", label: "Basic Cooking", icon: "🍳" },
  { id: "toilets", label: "Cleaning Toilets", icon: "🚿" },
  { id: "wiping", label: "Wiping Mirrors & Glass", icon: "🪟" },
  { id: "trash", label: "Taking Out Trash", icon: "🗑️" },
];

const HOUR_OPTIONS = [1, 2, 3, 4, 6, 8];
const TIME_SLOTS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00",
];

const getNearestSlot = (): string => {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes() + 30;
  const slot = TIME_SLOTS.find((t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m >= nowMinutes;
  });
  return slot || TIME_SLOTS[TIME_SLOTS.length - 1];
};

const InstaServicePage = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1=service, 2=details, 3=confirm

  // Booking params
  const [bookingMode, setBookingMode] = useState<"now" | "schedule">("now");
  const [hours, setHours] = useState(2);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [bringSupplies, setBringSupplies] = useState(false);
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [genderPref, setGenderPref] = useState<"any" | "male" | "female">("any");
  const [specialInstructions, setSpecialInstructions] = useState("");

  useEffect(() => {
    fetchData();
    const today = new Date();
    setBookingDate(today.toISOString().split("T")[0]);
    setStartTime(getNearestSlot());
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [servicesData, profileData] = await Promise.all([
        servicesAPI.getAll({ serviceType: "instant_hourly", isActive: true, limit: 20 }),
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

  const toggleTask = (id: string) => {
    setSelectedTasks((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const pricePerHour = selectedService?.price ?? 150;
  const suppliesExtra = bringSupplies ? 50 : 0;
  const totalAmount = hours * pricePerHour + suppliesExtra;

  const formatTimeDisplay = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  const getAvailableTimeSlots = (): string[] => {
    const today = new Date().toISOString().split("T")[0];
    if (bookingMode === "now" || bookingDate === today) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes() + 30;
      return TIME_SLOTS.filter((t) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m >= nowMinutes;
      });
    }
    return TIME_SLOTS;
  };

  const getEndTime = () => {
    const [h, m] = startTime.split(":").map(Number);
    const endMinutes = h * 60 + m + hours * 60;
    const endH = Math.floor(endMinutes / 60) % 24;
    const endM = endMinutes % 60;
    return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  };

  const handleBook = async () => {
    if (!selectedService) return toast.error("Please select a service");
    if (!bookingDate) return toast.error("Please select a date");
    if (selectedTasks.length === 0)
      return toast.error("Please select at least one task");

    const defaultAddr = profile?.addresses?.find((a) => a.isDefault) || profile?.addresses?.[0];

    try {
      setBooking(true);
      await bookingsAPI.create({
        service: selectedService._id,
        bookingDate,
        startTime,
        endTime: getEndTime(),
        totalAmount,
        bookingType: "adhoc",
        preferences: {
          workerGenderPreference: genderPref,
          specialInstructions,
        },
        serviceDetails: {
          hours,
          taskList: selectedTasks,
          bringSupplies,
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
      toast.success(
        bookingMode === "now"
          ? "Booking confirmed! We're finding a maid near you 🎉"
          : "Booking scheduled! You'll receive a confirmation shortly 📅"
      );
      navigate("/customer/bookings");
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
            className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full"
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
              <span className="text-2xl">⚡</span>
              <h1 className="text-xl font-bold text-foreground">Insta Maid Service</h1>
            </div>
            <p className="text-xs text-muted-foreground">On-demand hourly cleaning</p>
          </div>
        </motion.div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step >= s
                    ? "bg-amber-400 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`h-0.5 w-12 rounded transition-all ${
                    step > s ? "bg-amber-400" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
          <span className="ml-2 text-xs text-muted-foreground">
            {step === 1 ? "Choose Service" : step === 2 ? "Booking Details" : "Confirm Order"}
          </span>
        </div>

        {/* STEP 1 — Choose Service */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Booking Mode */}
            <div>
              <h2 className="font-semibold text-foreground mb-3">How do you want to book?</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setBookingMode("now");
                    setBookingDate(new Date().toISOString().split("T")[0]);
                    setStartTime(getNearestSlot());
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all text-left ${
                    bookingMode === "now"
                      ? "border-amber-400 bg-amber-50"
                      : "border-border hover:border-amber-300"
                  }`}
                >
                  <div className="text-2xl mb-1">⚡</div>
                  <p className="font-bold text-foreground text-sm">Book Now</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Maid arrives ASAP</p>
                  <span className="mt-2 inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    ~30 min arrival
                  </span>
                </button>
                <button
                  onClick={() => setBookingMode("schedule")}
                  className={`p-4 rounded-2xl border-2 transition-all text-left ${
                    bookingMode === "schedule"
                      ? "border-amber-400 bg-amber-50"
                      : "border-border hover:border-amber-300"
                  }`}
                >
                  <div className="text-2xl mb-1">📅</div>
                  <p className="font-bold text-foreground text-sm">Schedule</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pick date & time</p>
                  <span className="mt-2 inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    Plan ahead
                  </span>
                </button>
              </div>
            </div>

            <h2 className="font-semibold text-foreground">Select Service Package</h2>
            {services.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No insta services available in your area yet.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {services.map((svc) => (
                  <button
                    key={svc._id}
                    onClick={() => setSelectedService(svc)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                      selectedService?._id === svc._id
                        ? "border-amber-400 bg-amber-50"
                        : "border-border hover:border-amber-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-2xl">
                        ⚡
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{svc.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {svc.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">₹{svc.price}</p>
                        <p className="text-xs text-muted-foreground">/hr</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Tasks to do */}
            <div>
              <h2 className="font-semibold text-foreground mb-2">What should the maid do?</h2>
              <p className="text-xs text-muted-foreground mb-3">Select all that apply</p>
              <div className="grid grid-cols-2 gap-2">
                {TASK_OPTIONS.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                      selectedTasks.includes(task.id)
                        ? "border-amber-400 bg-amber-50"
                        : "border-border hover:border-amber-300"
                    }`}
                  >
                    <span className="text-lg">{task.icon}</span>
                    <span className="text-xs font-medium text-foreground">{task.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                if (!selectedService) return toast.error("Please select a service");
                if (selectedTasks.length === 0)
                  return toast.error("Select at least one task");
                setStep(2);
              }}
              className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-500 text-white font-semibold transition-colors"
            >
              Continue →
            </button>
          </motion.div>
        )}

        {/* STEP 2 — Booking Details */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Hours */}
            <div>
              <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" /> Number of Hours
              </h2>
              <p className="text-xs text-muted-foreground mb-3">Minimum 1 hour</p>
              <div className="flex gap-2 flex-wrap">
                {HOUR_OPTIONS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHours(h)}
                    className={`px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-all ${
                      hours === h
                        ? "border-amber-400 bg-amber-50 text-amber-700"
                        : "border-border hover:border-amber-300"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            {/* Date & Time */}
            <div className="space-y-4">
              {bookingMode === "now" ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                  <Zap className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-700">Book Now – Today</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
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
                        const now = new Date();
                        const nowMinutes = now.getHours() * 60 + now.getMinutes() + 30;
                        const available = TIME_SLOTS.filter((t) => {
                          const [h, m] = t.split(":").map(Number);
                          return h * 60 + m >= nowMinutes;
                        });
                        if (available.length > 0 && !available.includes(startTime)) {
                          setStartTime(available[0]);
                        }
                      }
                    }}
                    className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              )}

              {/* Available Time Slots */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                  <Clock className="w-4 h-4" /> Available Time Slots
                </label>
                {getAvailableTimeSlots().length === 0 ? (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 text-center">
                    No slots available today. Switch to "Schedule" to pick a future date.
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {getAvailableTimeSlots().map((t) => (
                      <button
                        key={t}
                        onClick={() => setStartTime(t)}
                        className={`py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                          startTime === t
                            ? "border-amber-400 bg-amber-50 text-amber-700"
                            : "border-border hover:border-amber-300 text-foreground"
                        }`}
                      >
                        {formatTimeDisplay(t)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bring Supplies */}
            <div className="flex items-center justify-between p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="font-medium text-foreground text-sm">Bring Supplies</p>
                  <p className="text-xs text-muted-foreground">Maid brings cleaning supplies (+₹50)</p>
                </div>
              </div>
              <button
                onClick={() => setBringSupplies(!bringSupplies)}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  bringSupplies ? "bg-amber-400" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    bringSupplies ? "left-6" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Gender Preference */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                <User className="w-4 h-4" /> Worker Gender Preference
              </label>
              <div className="flex gap-2">
                {(["any", "female", "male"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenderPref(g)}
                    className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium capitalize transition-all ${
                      genderPref === g
                        ? "border-amber-400 bg-amber-50 text-amber-700"
                        : "border-border hover:border-amber-300"
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
                placeholder="E.g. Enter from back door, allergic to strong chemicals..."
                className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
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
                className="flex-1 py-3 rounded-2xl bg-amber-400 hover:bg-amber-500 text-white font-semibold transition-colors"
              >
                Review Order →
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
            <h2 className="font-semibold text-foreground">Order Summary</h2>

            {/* Service info */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <p className="font-semibold text-foreground">{selectedService?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {hours} hours · {formatTimeDisplay(startTime)} – {formatTimeDisplay(getEndTime())}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {bookingMode === "now"
                      ? "⚡ Book Now (Today)"
                      : new Date(bookingDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                <span>
                  {profile?.addresses?.find((a) => a.isDefault)?.area || "Your location"}
                </span>
              </div>
            </div>

            {/* Tasks */}
            <div className="p-4 rounded-2xl border border-border">
              <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-amber-500" /> Tasks
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedTasks.map((t) => {
                  const task = TASK_OPTIONS.find((o) => o.id === t);
                  return (
                    <span key={t} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                      {task?.icon} {task?.label}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Price breakdown */}
            <div className="p-4 rounded-2xl border border-border space-y-2">
              <p className="text-sm font-semibold text-foreground">Price Breakdown</p>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{hours} hr × ₹{pricePerHour}/hr</span>
                <span>₹{hours * pricePerHour}</span>
              </div>
              {bringSupplies && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Supplies fee</span>
                  <span>₹50</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-bold text-foreground">
                <span>Total</span>
                <span>₹{totalAmount}</span>
              </div>
            </div>

            {genderPref !== "any" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-xl bg-muted">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Gender preference: <strong className="text-foreground capitalize">{genderPref}</strong></span>
              </div>
            )}

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
                className="flex-1 py-3 rounded-2xl bg-amber-400 hover:bg-amber-500 disabled:opacity-60 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {booking ? (
                  <>
                    <motion.div
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    Booking...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" /> Book Now
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
