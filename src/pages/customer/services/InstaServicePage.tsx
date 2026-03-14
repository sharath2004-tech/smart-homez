import AppLayout from "@/components/AppLayout";
import { authAPI, bookingsAPI, servicesAPI } from "@/lib/api";
import { motion } from "framer-motion";
import {
    Briefcase,
    Calendar,
    Clock,
    MapPin,
    ShoppingBag,
    Sparkles,
    User,
    Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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

const DEFAULT_PRICE = 150;

const getNearestSlot = () => {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes() + 30;
  return (
    TIME_SLOTS.find((t) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m >= nowMins;
    }) || TIME_SLOTS[TIME_SLOTS.length - 1]
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

const InstaServicePage = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pricePerHour, setPricePerHour] = useState(DEFAULT_PRICE);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [bookingMode, setBookingMode] = useState<"now" | "schedule">("now");
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [hours, setHours] = useState(2);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState(getNearestSlot());
  const [bringSupplies, setBringSupplies] = useState(false);
  const [genderPref, setGenderPref] = useState<"any" | "male" | "female">("any");
  const [notes, setNotes] = useState("");
  const [noServiceWarning, setNoServiceWarning] = useState(false);

  // Slot availability: map of startTime → number of workers busy during that slot
  const [busyWorkersBySlot, setBusyWorkersBySlot] = useState<Record<string, number>>({});
  const [totalWorkers, setTotalWorkers] = useState(0);

  const totalAmount = hours * pricePerHour + (bringSupplies ? 50 : 0);

  const availableSlots = (() => {
    const today = new Date().toISOString().split("T")[0];
    if (bookingMode === "now" || bookingDate === today) {
      const nowMins = new Date().getHours() * 60 + new Date().getMinutes() + 30;
      return TIME_SLOTS.filter((t) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m >= nowMins;
      });
    }
    return TIME_SLOTS;
  })();

  useEffect(() => {
    const init = async () => {
      try {
        const [profileData, servicesData] = await Promise.all([
          authAPI.getProfile(),
          servicesAPI
            .getAll({ serviceType: "instant_hourly", isActive: true, limit: 5 })
            .catch(() => ({ services: [] })),
        ]);
        setProfile(profileData.user || profileData);
        const list = servicesData?.services || [];
        if (list.length > 0) {
          setPricePerHour(list[0].price || DEFAULT_PRICE);
          setServiceId(list[0]._id);
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

  // Fetch booked-slots whenever the date changes
  useEffect(() => {
    const fetchSlots = async () => {
      try {
        const data = await bookingsAPI.getBookedSlots(bookingDate);
        const ranges: { workerId: string | null; startTime: string; endTime: string }[] =
          data.bookedRanges || [];
        setTotalWorkers(data.totalWorkers || 0);

        // For each TIME_SLOT, count how many workers are busy during [slotStart, slotStart+hours]
        const busy: Record<string, number> = {};
        for (const slot of TIME_SLOTS) {
          const [sh, sm] = slot.split(":").map(Number);
          const slotStartMins = sh * 60 + sm;
          const slotEndMins = slotStartMins + hours * 60;
          const workersBusy = new Set<string>();
          for (const r of ranges) {
            if (!r.workerId) continue;
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
        setBusyWorkersBySlot(busy);
      } catch {
        // non-critical — continue without availability info
      }
    };
    fetchSlots();
  }, [bookingDate, hours]);

  const toggleTask = (id: string) =>
    setSelectedTasks((p) => (p.includes(id) ? p.filter((t) => t !== id) : [...p, id]));

  const handleBook = async () => {
    if (!serviceId) {
      toast.error('No maid service is currently available in your area. Please contact support.');
      return;
    }
    const defaultAddr =
      profile?.addresses?.find((a) => a.isDefault) || profile?.addresses?.[0];
    const coords = defaultAddr?.location?.coordinates;
    const hasValidCoords =
      Array.isArray(coords) &&
      coords.length === 2 &&
      coords.every((c) => typeof c === "number" && !isNaN(c));
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
        serviceDetails: { hours, taskList: selectedTasks, bringSupplies },
        ...(hasValidCoords && {
          location: {
            coordinates: coords,
            apartmentName: defaultAddr!.apartmentName || "",
            area: defaultAddr!.area || "",
            city: defaultAddr!.city || "",
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
      <div className="max-w-lg mx-auto pb-24 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold font-heading text-foreground flex items-center gap-2">
            <span>⚡</span> Insta Maid Service
          </h1>
          <p className="text-xs text-muted-foreground">
            On-demand hourly cleaning · ₹{pricePerHour}/hr
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
            {step === 1 ? "What & When" : step === 2 ? "Time & Extras" : "Confirm & Pay"}
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
              <div className="grid grid-cols-2 gap-3">
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

            {/* Tasks */}
            <div>
              <h2 className="font-semibold font-heading text-foreground mb-1">
                What should the maid do?
              </h2>
              <p className="text-xs text-muted-foreground mb-3">Select all that apply</p>
              <div className="grid grid-cols-2 gap-2">
                {TASK_OPTIONS.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                      selectedTasks.includes(task.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="text-xl">{task.icon}</span>
                    <span className="text-xs font-medium text-foreground leading-snug">
                      {task.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                if (selectedTasks.length === 0)
                  return toast.error("Select at least one task");
                setStep(2);
              }}
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
            {/* Hours */}
            <div>
              <h2 className="font-semibold font-heading text-foreground mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Number of Hours
              </h2>
              <p className="text-xs text-muted-foreground mb-3">Minimum 1 hour</p>
              <div className="flex gap-2 flex-wrap">
                {HOUR_OPTIONS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHours(h)}
                    className={`px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-all ${
                      hours === h
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {h}h · ₹{h * pricePerHour}
                  </button>
                ))}
              </div>
            </div>

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
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map((t) => {
                      const busy = busyWorkersBySlot[t] ?? 0;
                      const free = totalWorkers > 0 ? totalWorkers - busy : null;
                      const fullyBooked = free !== null && free <= 0;
                      const limited = free !== null && free === 1;
                      return (
                        <button
                          key={t}
                          onClick={() => !fullyBooked && setStartTime(t)}
                          disabled={fullyBooked}
                          title={
                            free === null
                              ? undefined
                              : fullyBooked
                              ? "All workers booked"
                              : `${free} worker${free !== 1 ? "s" : ""} available`
                          }
                          className={`py-2.5 rounded-xl border-2 text-xs font-semibold transition-all relative ${
                            fullyBooked
                              ? "border-destructive/30 bg-destructive/5 text-destructive/50 cursor-not-allowed line-through"
                              : startTime === t
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/40 text-foreground"
                          }`}
                        >
                          {fmt12(t)}
                          {free !== null && !fullyBooked && (
                            <span
                              className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] flex items-center justify-center text-white font-bold ${
                                limited ? "bg-amber-500" : "bg-green-500"
                              }`}
                            >
                              {free}
                            </span>
                          )}
                          {fullyBooked && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-destructive text-[8px] flex items-center justify-center text-white font-bold">
                              ✕
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {totalWorkers > 0 && (
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Available</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Limited (1 worker)</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-destructive inline-block" /> Fully booked</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bring supplies */}
            <div className="card-elevated p-4 flex items-center justify-between rounded-xl">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground text-sm">Bring Supplies</p>
                  <p className="text-xs text-muted-foreground">Cleaning supplies included (+₹50)</p>
                </div>
              </div>
              <button
                onClick={() => setBringSupplies(!bringSupplies)}
                className={`w-12 h-6 rounded-full relative transition-colors ${
                  bringSupplies ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    bringSupplies ? "left-6" : "left-0.5"
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
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {g === "any" ? "Any" : g === "female" ? "👩 Female" : "👨 Male"}
                  </button>
                ))}
              </div>
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
              {profile?.addresses?.find((a) => a.isDefault)?.area && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{profile.addresses?.find((a) => a.isDefault)?.area}</span>
                </div>
              )}
            </div>

            <div className="card-elevated p-4 rounded-2xl">
              <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" /> Tasks Selected
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedTasks.map((t) => {
                  const task = TASK_OPTIONS.find((o) => o.id === t);
                  return (
                    <span key={t} className="badge-primary text-xs">
                      {task?.icon} {task?.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="card-elevated p-4 rounded-2xl space-y-2">
              <p className="text-sm font-semibold text-foreground">Price Breakdown</p>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>
                  {hours} hr × ₹{pricePerHour}/hr
                </span>
                <span>₹{hours * pricePerHour}</span>
              </div>
              {bringSupplies && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Cleaning supplies</span>
                  <span>₹50</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-foreground border-t pt-2 text-base">
                <span>Total</span>
                <span className="text-primary">₹{totalAmount}</span>
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
                disabled={booking}
                className="btn-brand flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {booking ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    {bookingMode === "now" ? `Book Now – ₹${totalAmount}` : `Schedule – ₹${totalAmount}`}
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
