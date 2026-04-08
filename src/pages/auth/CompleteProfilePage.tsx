import { authAPI, publicAPI } from "@/lib/api";
import { CheckCircle, Home, Loader2, MapPin, Navigation, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

interface ServiceLocation {
  _id: string;
  apartmentName: string;
  area: string;
  city: string;
  state: string;
  zipCode: string;
  coordinates: { lat: number; lng: number } | null;
  isServiceAvailable: boolean;
}

interface ServiceCity {
  city: string;
  locations: ServiceLocation[];
  hasService: boolean;
}

type Step = "details" | "location" | "done";

const CompleteProfilePage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState({ name: "", gender: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [serviceCities, setServiceCities] = useState<ServiceCity[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [locLoading, setLocLoading] = useState(false);

  // Redirect if not logged in or profile already complete
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { navigate("/login", { replace: true }); return; }
    const user = JSON.parse(raw);
    if (!user.isProfileIncomplete) { navigate("/customer/dashboard", { replace: true }); }
  }, [navigate]);

  // Load service cities when moving to location step
  useEffect(() => {
    if (step !== "location") return;
    setCitiesLoading(true);
    publicAPI
      .getServiceLocations()
      .then((data) => { if (data.cities) setServiceCities(data.cities); })
      .catch(() => {})
      .finally(() => setCitiesLoading(false));
  }, [step]);

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleDetailsNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Please enter your full name"); return; }
    setError("");
    setStep("location");
  };

  const submitProfile = async (locationId?: string, locationMeta?: { city: string; area: string; locationName: string }) => {
    setLoading(true);
    setError("");
    try {
      const response = await authAPI.completeProfile({
        name: form.name.trim(),
        gender: form.gender || undefined,
        locationId,
        ...locationMeta,
      });

      // Update stored user
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...stored, ...response.user }));

      navigate("/customer/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipLocation = () => submitProfile();

  const handleConfirmLocation = async () => {
    if (!selectedCity) { setError("Please select your city"); return; }
    if (!selectedLocationId) { setError("Please select your area / apartment"); return; }
    setError("");
    const city = serviceCities.find((c) => c.city === selectedCity);
    const loc = city?.locations.find((l) => l._id === selectedLocationId);
    if (!loc) { setError("Invalid selection. Please try again."); return; }
    await submitProfile(selectedLocationId, {
      city: loc.city,
      area: loc.area,
      locationName: loc.apartmentName,
    });
  };

  const handleGPS = () => {
    if (!navigator.geolocation) { setError("Geolocation not supported"); return; }
    setLocLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setLocLoading(false);
        let bestLoc: ServiceLocation | null = null;
        let bestDist = Infinity;
        for (const cityGroup of serviceCities) {
          for (const loc of cityGroup.locations) {
            if (!loc.coordinates) continue;
            const d = Math.hypot(loc.coordinates.lat - lat, loc.coordinates.lng - lng);
            if (d < bestDist) { bestDist = d; bestLoc = loc; }
          }
        }
        if (bestLoc) {
          setSelectedCity(bestLoc.city);
          setSelectedLocationId(bestLoc._id);
        } else {
          setError("Couldn't match your location. Please select manually.");
        }
      },
      () => {
        setLocLoading(false);
        setError("Location access denied. Please select your city from the list.");
      }
    );
  };

  const stepIdx = step === "details" ? 0 : step === "location" ? 1 : 2;
  const steps = ["Your details", "Your area", "All set!"];

  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md animate-scale-in">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold font-heading text-foreground mb-3">You're all set!</h2>
          <p className="text-muted-foreground">Your profile is complete. Taking you to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div
        className="hidden lg:flex lg:w-2/5 relative overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground h-full">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Home className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl">Healthy Homez</span>
          </Link>
          <div>
            <h1 className="text-4xl font-bold font-heading leading-tight mb-4">
              Complete your profile
            </h1>
            <p className="text-primary-foreground/80 text-lg leading-relaxed">
              Just a few details so we can personalise your experience and assign the right workers for your home.
            </p>
          </div>
          <div className="flex gap-2">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 rounded-full flex-1 transition-all ${
                  i <= stepIdx ? "bg-white" : "bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center p-6 sm:p-10 lg:p-16 bg-background overflow-y-auto">
        <div className="max-w-md w-full mx-auto">
          {/* Mobile logo */}
          <Link to="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Home className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-foreground">Healthy Homez</span>
          </Link>

          {/* Step indicator mobile */}
          <div className="flex gap-2 mb-8 lg:hidden">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`h-1 rounded-full flex-1 transition-all ${
                  i <= stepIdx ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* ── Step 1: Details ── */}
          {step === "details" && (
            <>
              <div className="mb-8">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Tell us about yourself</h2>
                <p className="text-muted-foreground text-sm">This helps us personalise your bookings.</p>
              </div>

              <form onSubmit={handleDetailsNext} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Full name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Priya Sharma"
                    value={form.name}
                    onChange={set("name")}
                    className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Gender</label>
                  <select
                    value={form.gender}
                    onChange={set("gender")}
                    className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Helps us assign workers based on your preference.</p>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
                >
                  Continue to location
                </button>
              </form>
            </>
          )}

          {/* ── Step 2: Location ── */}
          {step === "location" && (
            <>
              <div className="mb-8">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Where do you live?</h2>
                <p className="text-muted-foreground text-sm">
                  We'll check if our services are available in your area.
                </p>
              </div>

              <div className="space-y-4">
                {/* GPS */}
                <button
                  type="button"
                  onClick={handleGPS}
                  disabled={locLoading || citiesLoading}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-input bg-background hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  {locLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : (
                    <Navigation className="w-5 h-5 text-primary" />
                  )}
                  <span className="text-sm font-medium text-foreground">
                    {locLoading ? "Detecting location…" : "Use my current location"}
                  </span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or select manually</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {citiesLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">City</label>
                      <select
                        value={selectedCity}
                        onChange={(e) => { setSelectedCity(e.target.value); setSelectedLocationId(""); }}
                        className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      >
                        <option value="">Select city</option>
                        {serviceCities.map((c) => (
                          <option key={c.city} value={c.city}>{c.city}</option>
                        ))}
                      </select>
                    </div>

                    {selectedCity && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Area / Apartment</label>
                        <select
                          value={selectedLocationId}
                          onChange={(e) => setSelectedLocationId(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        >
                          <option value="">Select area</option>
                          {serviceCities
                            .find((c) => c.city === selectedCity)
                            ?.locations.filter((l) => l.isServiceAvailable)
                            .map((l) => (
                              <option key={l._id} value={l._id}>
                                {l.apartmentName} — {l.area}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                {error && (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleConfirmLocation}
                  disabled={loading || !selectedLocationId}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Confirm location"}
                </button>

                <button
                  type="button"
                  onClick={handleSkipLocation}
                  disabled={loading}
                  className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip for now — I'll set this later
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompleteProfilePage;
