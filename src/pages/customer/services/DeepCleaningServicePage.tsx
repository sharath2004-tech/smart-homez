import AppLayout from "@/components/AppLayout";
import { useServiceBookingAvailability } from "@/hooks/useServiceBookingAvailability";
import { authAPI, bookingsAPI, servicesAPI } from "@/lib/api";
import { motion } from "framer-motion";
import {
    ChevronLeft,
    Info,
    MapPin,
    Sparkles,
    User,
    Zap
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface SizeOption {
  label: string;
  price: number;
  duration: number;
  workersRequired?: number;
}

interface AddonOption {
  id: string;
  name: string;
  description?: string;
  price: number;
  icon?: string;
}

interface Service {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  serviceType: string;
  sizeParameters?: {
    enabled: boolean;
    sizes: SizeOption[];
  };
  addons?: AddonOption[];
  dos?: string[];
  donts?: string[];
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

const generateTimeSlots = (openTime: string, closeTime: string, stepMinutes: number): string[] => {
  const slots: string[] = [];
  const [openH, openM] = openTime.split(":").map(Number);
  const [closeH, closeM] = closeTime.split(":").map(Number);
  let current = openH * 60 + openM;
  const end = closeH * 60 + closeM;
  while (current < end) {
    const h = Math.floor(current / 60).toString().padStart(2, "0");
    const m = (current % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
    current += stepMinutes;
  }
  return slots;
};

const DeepCleaningServicePage = () => {
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);

  // Booking params
  const [selectedPackage, setSelectedPackage] = useState<SizeOption | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [genderPref, setGenderPref] = useState<"any" | "male" | "female">("any");
  const [specialInstructions, setSpecialInstructions] = useState("");

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
    fetchData(tomorrowStr);
  }, []);

  const fetchData = async (dateStr: string) => {
    try {
      setLoading(true);
      const [servicesData, profileData, slotsData] = await Promise.all([
        servicesAPI.getAll({ serviceType: "deep_cleaning_full_house", isActive: true, limit: 1 }),
        authAPI.getProfile(),
        bookingsAPI.getBookedSlots(dateStr, null),
      ]);
      const svc: Service = servicesData.services?.[0] || null;
      setService(svc);
      setProfile(profileData.user || profileData);

      // Build time slots from admin business hours
      const open = slotsData.openTime || "08:00";
      const close = slotsData.closeTime || "18:00";
      const step = slotsData.slotDurationMinutes || 60;
      setTimeSlots(generateTimeSlots(open, close, step));
      setStartTime(open);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const packages: SizeOption[] = service?.sizeParameters?.enabled
    ? (service.sizeParameters.sizes || [])
    : [];

  const addOnAreas: AddonOption[] = service?.addons || [];

  const toggleAddOn = (id: string) => {
    setSelectedAddOns((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const addOnsTotal = selectedAddOns.reduce((sum, id) => {
    const ao = addOnAreas.find((a) => a.id === id);
    return sum + (ao?.price || 0);
  }, 0);

  const totalAmount = (selectedPackage?.price || 0) + addOnsTotal;

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

    if (!selectedPackage) return toast.error("Please select a package");
    if (!bookingDate) return toast.error("Please select a date");
    if (!service?._id) return toast.error("No deep cleaning service available in your area");

    const defaultAddr = profile?.addresses?.find((a) => a.isDefault) || profile?.addresses?.[0];

    try {
      setBooking(true);
      await bookingsAPI.create({
        service: service._id,
        bookingDate,
        startTime,
        endTime: startTime,
        totalAmount,
        bookingType: "adhoc",
        preferences: {
          workerGenderPreference: genderPref,
          specialInstructions,
        },
        serviceDetails: {
          package: selectedPackage.label,
          areas: selectedAddOns,
          addOns: selectedAddOns,
        },
        location: defaultAddr
          ? {
              apartmentName: defaultAddr.apartmentName || "",
              area: defaultAddr.area || "",
              city: defaultAddr.city || "",
              coordinates: defaultAddr.location?.coordinates || [],
            }
          : undefined,
        notes: `Package: ${selectedPackage.label}. Add-ons: ${selectedAddOns.join(", ") || "None"}. ${specialInstructions}`,
      } as Record<string, unknown>);
      toast.success("Deep cleaning booked! A team will arrive on the scheduled date 🎉", {
        duration: 5000,
      });
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
            className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full"
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
              <span className="text-2xl">✨</span>
              <h1 className="text-xl font-bold text-foreground">{service?.name || "Deep Cleaning"}</h1>
            </div>
            <p className="text-xs text-muted-foreground">{service?.description || "Full home deep clean by professional team"}</p>
          </div>
        </motion.div>

        <div className={`rounded-2xl border p-4 ${
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
                  ? 'This service is outside your region'
                  : hasResolvedLocation
                  ? 'This service can be booked in your region'
                  : 'Service location needed before booking'}
              </p>
              <p className="text-muted-foreground">
                {checkingAvailability
                  ? 'We are verifying the admin-configured service region for your location.'
                  : isOutOfRegion
                  ? (availability?.reason || 'Bookings are accepted only in regions configured by admin or super admin.')
                  : hasResolvedLocation
                  ? (availability?.reason || 'Your saved location is inside an active service region.')
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

        {/* Service Dos (admin-configured features) */}
        {service?.dos && service.dos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
          >
            {service.dos.slice(0, 3).map((item) => (
              <div
                key={item}
                className="p-3 rounded-xl bg-green-50 border border-green-200 text-center"
              >
                <p className="text-xs font-medium text-green-800">✓ {item}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step >= s ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`h-0.5 w-12 rounded transition-all ${
                    step > s ? "bg-green-500" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
          <span className="ml-2 text-xs text-muted-foreground">
            {step === 1 ? "Select Package" : step === 2 ? "Add-ons & Date" : "Review & Book"}
          </span>
        </div>

        {/* STEP 1 — Package selection */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <h2 className="font-semibold text-foreground mb-1">Home Size / Package</h2>
              <p className="text-xs text-muted-foreground mb-3">
                Includes all rooms, kitchen & bathrooms in the package
              </p>

              {packages.length === 0 ? (
                <div className="p-6 rounded-2xl border border-border bg-muted/30 text-center">
                  <p className="text-sm text-muted-foreground">No packages configured yet. Please contact support.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {packages.map((pkg) => (
                    <button
                      key={pkg.label}
                      onClick={() => setSelectedPackage(pkg)}
                      className={`relative text-left p-4 rounded-2xl border-2 transition-all ${
                        selectedPackage?.label === pkg.label
                          ? "border-green-400 bg-green-50"
                          : "border-border hover:border-green-300 bg-card"
                      }`}
                    >
                      {selectedPackage?.label === pkg.label && (
                        <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      <p className="font-bold text-foreground text-base mt-1">{pkg.label}</p>
                      {pkg.duration > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          ~{Math.round(pkg.duration / 60)} hrs
                          {pkg.workersRequired && pkg.workersRequired > 1 ? ` · ${pkg.workersRequired} workers` : ""}
                        </p>
                      )}
                      <p className="text-base font-bold text-green-600 mt-2">₹{pkg.price.toLocaleString()}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (!selectedPackage) return toast.error("Please select a package");
                setStep(2);
              }}
              disabled={packages.length === 0}
              className="w-full py-3 rounded-2xl bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold transition-colors"
            >
              Continue →
            </button>
          </motion.div>
        )}

        {/* STEP 2 — Add-ons & Date */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Add-ons (only if admin configured them) */}
            {addOnAreas.length > 0 && (
              <div>
                <h2 className="font-semibold text-foreground mb-1">Add-on Areas (optional)</h2>
                <p className="text-xs text-muted-foreground mb-3">
                  Add specific areas or appliances for extra-deep cleaning
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {addOnAreas.map((ao) => (
                    <button
                      key={ao.id}
                      onClick={() => toggleAddOn(ao.id)}
                      className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                        selectedAddOns.includes(ao.id)
                          ? "border-green-400 bg-green-50"
                          : "border-border hover:border-green-300 bg-card"
                      }`}
                    >
                      {selectedAddOns.includes(ao.id) && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      {ao.icon && <div className="text-2xl mb-1">{ao.icon}</div>}
                      <p className="text-sm font-semibold text-foreground leading-tight">{ao.name}</p>
                      {ao.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{ao.description}</p>
                      )}
                      <p className="text-sm font-bold text-green-600 mt-1.5">+₹{ao.price}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Date</label>
                <input
                  type="date"
                  value={bookingDate}
                  min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Start Time</label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                >
                  {timeSlots.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Info note */}
            <div className="flex gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Deep cleaning requires advance booking of at least 1 day. A professional team
                will arrive at your specified time with all equipment and cleaning agents.
              </p>
            </div>

            {/* Gender Preference */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                <User className="w-4 h-4" /> Team Gender Preference
              </label>
              <div className="flex gap-2">
                {(["any", "female", "male"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenderPref(g)}
                    className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                      genderPref === g
                        ? "border-green-400 bg-green-50 text-green-700"
                        : "border-border hover:border-green-300"
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
                rows={2}
                placeholder="E.g. Focus on pet hair, avoid moving heavy furniture..."
                className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
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
                className="flex-1 py-3 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors"
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
            <h2 className="font-semibold text-foreground">Booking Summary</h2>

            {/* Package card */}
            <div className="p-4 rounded-2xl bg-green-50 border border-green-200 space-y-3">
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-semibold text-foreground">
                    Deep Cleaning — {selectedPackage?.label}
                  </p>
                  {selectedPackage?.duration && (
                    <p className="text-xs text-muted-foreground">
                      ~{Math.round(selectedPackage.duration / 60)} hrs
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                <span>
                  {profile?.addresses?.find((a) => a.isDefault)?.area || "Your location"} ·{" "}
                  {bookingDate} at {startTime}
                </span>
              </div>
            </div>

            {/* Add-ons */}
            {selectedAddOns.length > 0 && (
              <div className="p-4 rounded-2xl border border-border">
                <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-green-500" /> Add-ons
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedAddOns.map((id) => {
                    const ao = addOnAreas.find((a) => a.id === id);
                    return (
                      <span
                        key={id}
                        className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full"
                      >
                        {ao?.icon} {ao?.name} (+₹{ao?.price})
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price breakdown */}
            <div className="p-4 rounded-2xl border border-border space-y-2">
              <p className="text-sm font-semibold text-foreground">Price Breakdown</p>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{selectedPackage?.label} package</span>
                <span>₹{selectedPackage?.price.toLocaleString()}</span>
              </div>
              {selectedAddOns.map((id) => {
                const ao = addOnAreas.find((a) => a.id === id);
                return (
                  <div key={id} className="flex justify-between text-sm text-muted-foreground">
                    <span>{ao?.name}</span>
                    <span>₹{ao?.price}</span>
                  </div>
                );
              })}
              <div className="border-t pt-2 flex justify-between font-bold text-foreground">
                <span>Total</span>
                <span>₹{totalAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Service donts (if configured by admin) */}
            {service?.donts && service.donts.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 space-y-1">
                {service.donts.slice(0, 2).map((d) => (
                  <p key={d}>⚠ {d}</p>
                ))}
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
                disabled={booking || requestingService || checkingAvailability || (!isOutOfRegion && !canBookService)}
                className={`flex-1 py-3 rounded-2xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
                  isOutOfRegion
                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {booking || requestingService ? (
                  <>
                    <motion.div
                      className={`w-4 h-4 border-2 border-t-transparent rounded-full ${isOutOfRegion ? 'border-amber-900' : 'border-white'}`}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    {isOutOfRegion ? 'Sending request...' : 'Booking...'}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" /> {isOutOfRegion ? 'Request Service' : !hasResolvedLocation ? 'Set Location First' : checkingAvailability ? 'Checking region...' : 'Confirm Booking'}
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

export default DeepCleaningServicePage;
