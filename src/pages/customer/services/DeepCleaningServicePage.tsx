import AppLayout from "@/components/AppLayout";
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

interface Service {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  serviceType: string;
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

const PACKAGES = [
  { id: "1BHK", label: "1 BHK", rooms: 1, baths: 1, basePrice: 1499, duration: "3-4 hrs", icon: "🏠", badge: "Most Booked", badgeColor: "bg-orange-100 text-orange-700" },
  { id: "2BHK", label: "2 BHK", rooms: 2, baths: 1, basePrice: 2299, duration: "5-6 hrs", icon: "🏡", badge: "Popular", badgeColor: "bg-blue-100 text-blue-700" },
  { id: "3BHK", label: "3 BHK", rooms: 3, baths: 2, basePrice: 3199, duration: "6-8 hrs", icon: "🏘️", badge: "Best for Families", badgeColor: "bg-purple-100 text-purple-700" },
  { id: "4BHK", label: "4 BHK", rooms: 4, baths: 3, basePrice: 4299, duration: "8-10 hrs", icon: "🏰", badge: null, badgeColor: "" },
  { id: "villa", label: "Villa / Duplex", rooms: 5, baths: 4, basePrice: 5999, duration: "10-12 hrs", icon: "🏯", badge: "Premium", badgeColor: "bg-yellow-100 text-yellow-700" },
];

const ADD_ON_AREAS = [
  { id: "kitchen_deep", label: "Kitchen Deep Clean", desc: "Oven, fridge, counters", price: 399, icon: "🍳" },
  { id: "bathroom_extra", label: "Extra Bathroom", desc: "Per additional bathroom", price: 249, icon: "🚿" },
  { id: "sofa", label: "Sofa Cleaning", desc: "Fabric/leather sofa steam clean", price: 499, icon: "🛋️" },
  { id: "carpet", label: "Carpet Cleaning", desc: "Vacuum + steam extraction", price: 349, icon: "🪣" },
  { id: "windows", label: "Window Cleaning", desc: "Inside + outside glass", price: 299, icon: "🪟" },
  { id: "fans", label: "Fan Cleaning", desc: "All ceiling fans", price: 149, icon: "🌀" },
  { id: "balcony", label: "Balcony Cleaning", desc: "Floor, grill, ceiling", price: 199, icon: "🌿" },
  { id: "fridge", label: "Fridge Deep Clean", desc: "Interior cleaning + coils", price: 249, icon: "❄️" },
];

const TIME_SLOTS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];

const DeepCleaningServicePage = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Booking params
  const [selectedPackage, setSelectedPackage] = useState<(typeof PACKAGES)[0] | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [genderPref, setGenderPref] = useState<"any" | "male" | "female">("any");
  const [specialInstructions, setSpecialInstructions] = useState("");

  useEffect(() => {
    fetchData();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setBookingDate(tomorrow.toISOString().split("T")[0]);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [servicesData, profileData] = await Promise.all([
        servicesAPI.getAll({
          serviceType: "deep_cleaning_full_house,deep_cleaning_room,deep_cleaning_kitchen,deep_cleaning_bathroom",
          isActive: true,
          limit: 20,
        }),
        authAPI.getProfile(),
      ]);
      setServices(servicesData.services || []);
      setProfile(profileData.user || profileData);
    } catch (error) {
      console.error("Fetch error:", error);
      // Not a hard fail — pricing is from PACKAGES, service id from list
    } finally {
      setLoading(false);
    }
  };

  const toggleAddOn = (id: string) => {
    setSelectedAddOns((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const addOnsTotal = selectedAddOns.reduce((sum, id) => {
    const ao = ADD_ON_AREAS.find((a) => a.id === id);
    return sum + (ao?.price || 0);
  }, 0);

  const totalAmount = (selectedPackage?.basePrice || 0) + addOnsTotal;

  const getServiceId = () => {
    // Use first available deep cleaning service, or null
    return services[0]?._id ?? null;
  };

  const handleBook = async () => {
    if (!selectedPackage) return toast.error("Please select a package");
    if (!bookingDate) return toast.error("Please select a date");

    const serviceId = getServiceId();
    if (!serviceId) return toast.error("No deep cleaning service available in your area");

    const defaultAddr = profile?.addresses?.find((a) => a.isDefault) || profile?.addresses?.[0];

    try {
      setBooking(true);
      await bookingsAPI.create({
        service: serviceId,
        bookingDate,
        startTime,
        endTime: startTime, // backend will compute from duration
        totalAmount,
        bookingType: "adhoc",
        preferences: {
          workerGenderPreference: genderPref,
          specialInstructions,
        },
        serviceDetails: {
          package: selectedPackage.id,
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
              <span className="text-2xl">✨</span>
              <h1 className="text-xl font-bold text-foreground">Deep Cleaning</h1>
            </div>
            <p className="text-xs text-muted-foreground">Full home deep clean by professional team</p>
          </div>
        </motion.div>

        {/* Features row */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
        >
          {[
            { icon: "👥", label: "2-member team" },
            { icon: "🧪", label: "Pro cleaning agents" },
            { icon: "📸", label: "Before & after photos" },
          ].map((f) => (
            <div
              key={f.label}
              className="p-3 rounded-xl bg-green-50 border border-green-200 text-center"
            >
              <div className="text-lg mb-0.5">{f.icon}</div>
              <p className="text-xs font-medium text-green-800">{f.label}</p>
            </div>
          ))}
        </motion.div>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PACKAGES.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackage(pkg)}
                    className={`relative text-left p-4 rounded-2xl border-2 transition-all ${
                      selectedPackage?.id === pkg.id
                        ? "border-green-400 bg-green-50"
                        : "border-border hover:border-green-300 bg-card"
                    }`}
                  >
                    {pkg.badge && (
                      <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${pkg.badgeColor}`}>
                        {pkg.badge}
                      </span>
                    )}
                    {selectedPackage?.id === pkg.id && (
                      <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <div className="text-3xl mb-2 mt-1">{pkg.icon}</div>
                    <p className="font-bold text-foreground text-base">{pkg.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pkg.rooms} rm · {pkg.baths} bath
                    </p>
                    <p className="text-xs text-muted-foreground">{pkg.duration}</p>
                    <p className="text-base font-bold text-green-600 mt-2">₹{pkg.basePrice.toLocaleString()}</p>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                if (!selectedPackage) return toast.error("Please select a package");
                setStep(2);
              }}
              className="w-full py-3 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors"
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
            {/* Add-ons */}
            <div>
              <h2 className="font-semibold text-foreground mb-1">Add-on Areas (optional)</h2>
              <p className="text-xs text-muted-foreground mb-3">
                Add specific areas or appliances for extra-deep cleaning
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ADD_ON_AREAS.map((ao) => (
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
                    <div className="text-2xl mb-1">{ao.icon}</div>
                    <p className="text-sm font-semibold text-foreground leading-tight">{ao.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{ao.desc}</p>
                    <p className="text-sm font-bold text-green-600 mt-1.5">+₹{ao.price}</p>
                  </button>
                ))}
              </div>
            </div>

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
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Info note */}
            <div className="flex gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Deep cleaning requires advance booking of at least 1 day. A 2-member professional team
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
                <span className="text-2xl">{selectedPackage?.icon}</span>
                <div>
                  <p className="font-semibold text-foreground">
                    Deep Cleaning — {selectedPackage?.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedPackage?.rooms} rooms · {selectedPackage?.baths} bathrooms ·{" "}
                    {selectedPackage?.duration}
                  </p>
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
                    const ao = ADD_ON_AREAS.find((a) => a.id === id);
                    return (
                      <span
                        key={id}
                        className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full"
                      >
                        {ao?.icon} {ao?.label} (+₹{ao?.price})
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
                <span>
                  {selectedPackage?.label} package
                </span>
                <span>₹{selectedPackage?.basePrice.toLocaleString()}</span>
              </div>
              {selectedAddOns.map((id) => {
                const ao = ADD_ON_AREAS.find((a) => a.id === id);
                return (
                  <div key={id} className="flex justify-between text-sm text-muted-foreground">
                    <span>{ao?.label}</span>
                    <span>₹{ao?.price}</span>
                  </div>
                );
              })}
              <div className="border-t pt-2 flex justify-between font-bold text-foreground">
                <span>Total</span>
                <span>₹{totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
              📸 Our team will take before & after photos. If you're not satisfied, we'll redo any
              missed spots free of charge.
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
                className="flex-1 py-3 rounded-2xl bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-semibold transition-colors flex items-center justify-center gap-2"
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
                    <Zap className="w-4 h-4" /> Confirm Booking
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
