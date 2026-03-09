import { LanguageSelector } from "@/components/LanguageSelector";
import { API_BASE_URL, authAPI } from "@/lib/api";
import {
  CheckCircle,
  Eye,
  EyeOff,
  Home,
  Loader2,
  MapPin,
  Navigation,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

type Step = "form" | "location" | "unavailable" | "done";

interface GeoResult {
  address: string;
  area: string;
  city: string;
  zipCode: string;
  lat: number;
  lng: number;
}

const CustomerSignUp = () => {
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    gender: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [error, setError] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [geoResult, setGeoResult] = useState<GeoResult | null>(null);
  const [notifySubmitted, setNotifySubmitted] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // ── Step 1: validate and go to location ────────────────────────────────
  const handleFormNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.email.trim()) { setError("Email is required"); return; }
    if (!form.phone.trim() || form.phone.replace(/\D/g, "").length < 10) {
      setError("Enter a valid 10-digit mobile number"); return;
    }
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
    setError("");
    setStep("location");
  };

  // ── Geocoding helpers ──────────────────────────────────────────────────
  const reverseGeocode = async (lat: number, lng: number): Promise<GeoResult> => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      const addr = data.address || {};
      return {
        lat, lng,
        address: data.display_name || "",
        area: addr.suburb || addr.neighbourhood || addr.residential || addr.village || "",
        city: addr.city || addr.town || addr.district || "",
        zipCode: addr.postcode || "",
      };
    } catch {
      return { lat, lng, address: "", area: "", city: "", zipCode: "" };
    }
  };

  const checkAvailability = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/service-areas/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.isAvailable === true;
    } catch {
      return false;
    }
  };

  // ── Register account ───────────────────────────────────────────────────
  const registerAccount = async (geo: GeoResult | null) => {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: "+91" + form.phone.replace(/\D/g, "").slice(-10),
        role: "customer",
        gender: form.gender || "prefer_not_to_say",
      };

      if (geo) {
        payload.location = {
          address: geo.address,
          area: geo.area,
          city: geo.city,
          zipCode: geo.zipCode,
          coordinates: [geo.lng, geo.lat],
        };
      }

      const response = await authAPI.register(payload);
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));
      setStep("done");
      setTimeout(() => { window.location.href = "/customer/dashboard"; }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGPS = () => {
    if (!navigator.geolocation) { setError("Geolocation not supported by your browser"); return; }
    setLocLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const geo = await reverseGeocode(lat, lng);
        setGeoResult(geo);
        const avail = await checkAvailability(lat, lng);
        setLocLoading(false);
        if (avail) {
          await registerAccount(geo);
        } else {
          setStep("unavailable");
        }
      },
      () => {
        setLocLoading(false);
        setError("Location access denied. Please allow it or enter your address manually.");
      }
    );
  };

  const handleManualLocation = async () => {
    if (!manualAddress.trim()) { setError("Please enter your area / address"); return; }
    setLocLoading(true);
    setError("");
    try {
      const enc = encodeURIComponent(manualAddress + ", India");
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${enc}`);
      const results = await res.json();
      if (!results.length) { setError("Address not found. Try a more specific area."); setLocLoading(false); return; }
      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);
      const geo = await reverseGeocode(lat, lng);
      setGeoResult(geo);
      const avail = await checkAvailability(lat, lng);
      setLocLoading(false);
      if (avail) {
        await registerAccount(geo);
      } else {
        setStep("unavailable");
      }
    } catch {
      setLocLoading(false);
      setError("Location lookup failed. Please try again.");
    }
  };

  const handleSkipLocation = () => registerAccount(null);

  const handleNotifyMe = async () => {
    if (geoResult) {
      localStorage.setItem("pendingLocation", JSON.stringify({ ...geoResult, notifyMe: true }));
    }
    await registerAccount(geoResult);
    setNotifySubmitted(true);
  };

  // ── Left panel step indicator ──────────────────────────────────────────
  const steps = ["Your details", "Your area", "All set!"];
  const stepIdx = step === "form" ? 0 : step === "location" || step === "unavailable" ? 1 : 2;

  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md animate-scale-in">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold font-heading text-foreground mb-3">Welcome to Smart Homez! 🎉</h2>
          <p className="text-muted-foreground">Your account is ready. Redirecting to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground h-full">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-foreground/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Home className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold font-heading">Smart Homez</span>
          </Link>
          <div>
            <h1 className="text-3xl font-bold font-heading mb-4 leading-tight">
              Book trusted home<br />services in minutes
            </h1>
            <p className="text-primary-foreground/70 leading-relaxed mb-8">
              Create your free account to book cleaners, cooks, and more.
            </p>
            <div className="space-y-3">
              {steps.map((label, i) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < stepIdx ? "bg-primary-foreground text-primary"
                    : i === stepIdx ? "bg-primary-foreground/80 text-primary"
                    : "bg-primary-foreground/20 text-primary-foreground/50"
                  }`}>
                    {i < stepIdx ? "✓" : i + 1}
                  </div>
                  <span className={`text-sm ${i <= stepIdx ? "text-primary-foreground" : "text-primary-foreground/50"}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background relative overflow-y-auto">
        <div className="absolute top-6 right-6 z-10"><LanguageSelector /></div>

        <div className="w-full max-w-md animate-fade-in py-8">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Home className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold font-heading text-foreground">Smart Homez</span>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
              {error}
            </div>
          )}

          {/* ── STEP: form ── */}
          {step === "form" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Create your account</h2>
              <p className="text-muted-foreground mb-6">Join Smart Homez as a customer</p>

              <form onSubmit={handleFormNext} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                  <input className="input-clean" placeholder="e.g. Priya Sharma" value={form.name} onChange={set("name")} required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email Address</label>
                  <input type="email" className="input-clean" placeholder="you@example.com" value={form.email} onChange={set("email")} required autoComplete="email" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Mobile Number</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">+91</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      className="input-clean pl-12"
                      placeholder="98765 43210"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, "") }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Gender <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <select className="input-clean" value={form.gender} onChange={set("gender")}>
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="input-clean pr-12"
                      placeholder="Min. 8 characters"
                      value={form.password}
                      onChange={set("password")}
                      required
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      className="input-clean pr-12"
                      placeholder="Re-enter your password"
                      value={form.confirmPassword}
                      onChange={set("confirmPassword")}
                      required
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn-brand w-full mt-2">Continue</button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{" "}
                <Link to="/login" className="text-primary font-semibold hover:underline">Log in</Link>
              </p>
            </>
          )}

          {/* ── STEP: location ── */}
          {step === "location" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Where are you?</h2>
              <p className="text-muted-foreground mb-6">
                Share your location so we can check if services are available in your area.
              </p>
              <div className="space-y-4">
                <button
                  onClick={handleGPS}
                  disabled={locLoading}
                  className="w-full flex items-center justify-center gap-3 py-4 px-4 bg-primary/10 border-2 border-primary rounded-xl text-primary font-semibold hover:bg-primary/20 transition-colors"
                >
                  {locLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
                  Use my current location
                </button>

                <div className="relative flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or enter area</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="flex gap-2">
                  <input
                    className="input-clean flex-1"
                    placeholder="e.g. Koramangala, Bengaluru"
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleManualLocation()}
                  />
                  <button
                    onClick={handleManualLocation}
                    disabled={locLoading}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
                  >
                    {locLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  onClick={handleSkipLocation}
                  disabled={loading}
                  className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip for now
                </button>

                <button onClick={() => { setStep("form"); setError(""); }} className="w-full py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors text-sm">
                  Back
                </button>
              </div>
            </>
          )}

          {/* ── STEP: unavailable ── */}
          {step === "unavailable" && (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-amber-500" />
                </div>
                <h2 className="text-2xl font-bold font-heading text-foreground mb-2">Not available yet</h2>
                <p className="text-muted-foreground">
                  We don't serve{geoResult?.city ? ` ${geoResult.city}` : " your area"} yet, but we're expanding fast!
                </p>
              </div>

              <div className="space-y-3">
                {!notifySubmitted ? (
                  <button
                    onClick={handleNotifyMe}
                    disabled={loading}
                    className="btn-brand w-full flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Notify me when available"}
                  </button>
                ) : (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 text-center">
                    ✅ Got it! We'll notify you at <strong>{form.email}</strong> when we launch in your area.
                    <div className="mt-3">
                      <Link to="/login" className="text-primary font-semibold hover:underline">Go to login</Link>
                    </div>
                  </div>
                )}
                <button onClick={() => { setStep("location"); setError(""); }} className="w-full py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors text-sm">
                  Try a different area
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerSignUp;

