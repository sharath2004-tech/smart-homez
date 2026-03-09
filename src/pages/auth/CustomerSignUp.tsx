import { LanguageSelector } from "@/components/LanguageSelector";
import { API_BASE_URL, authAPI } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";
import {
    ConfirmationResult,
    RecaptchaVerifier,
    signInWithPhoneNumber,
} from "firebase/auth";
import {
    Bell,
    CheckCircle,
    Home,
    Loader2,
    MapPin,
    Navigation,
    Phone,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";

declare global {
  interface Window {
    customerRecaptchaVerifier?: RecaptchaVerifier;
  }
}

type Step = "phone" | "otp" | "profile" | "location" | "unavailable" | "done";

interface LocationResult {
  lat: number;
  lng: number;
  address: string;
  area: string;
  city: string;
  zipCode: string;
  isAvailable: boolean;
  serviceAreaId?: string;
}

const CustomerSignUp = () => {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [firebaseIdToken, setFirebaseIdToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locationResult, setLocationResult] = useState<LocationResult | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [notifySubmitted, setNotifySubmitted] = useState(false);
  const recaptchaRef = useRef<HTMLDivElement>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const setupRecaptcha = () => {
    if (window.customerRecaptchaVerifier) return window.customerRecaptchaVerifier;
    const v = new RecaptchaVerifier(firebaseAuth, "customer-recaptcha", {
      size: "invisible",
      callback: () => {},
    });
    window.customerRecaptchaVerifier = v;
    return v;
  };

  const reverseGeocode = async (lat: number, lng: number): Promise<Partial<LocationResult>> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await res.json();
      const addr = data.address || {};
      return {
        address: data.display_name || "",
        area: addr.suburb || addr.neighbourhood || addr.residential || addr.village || "",
        city: addr.city || addr.town || addr.district || "",
        zipCode: addr.postcode || "",
      };
    } catch {
      return {};
    }
  };

  const checkServiceAvailability = async (lat: number, lng: number) => {
    const res = await fetch(`${API_BASE_URL}/service-areas/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    });
    if (!res.ok) return { isAvailable: false };
    return res.json();
  };

  // ── OTP send ─────────────────────────────────────────────────────────────
  const handleSendOTP = async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) { setError("Enter a valid 10-digit mobile number"); return; }
    const formatted = `+91${cleaned}`;
    try {
      setLoading(true);
      setError("");
      const verifier = setupRecaptcha();
      const result = await signInWithPhoneNumber(firebaseAuth, formatted, verifier);
      setConfirmation(result);
      setStep("otp");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("TOO_MANY_REQUESTS")) {
        setError("Too many attempts. Please wait and try again.");
      } else {
        setError("Could not send OTP. Check the number and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── OTP verify ───────────────────────────────────────────────────────────
  const handleVerifyOTP = async () => {
    if (!confirmation || otp.length < 6) { setError("Enter the 6-digit OTP"); return; }
    try {
      setLoading(true);
      setError("");
      const cred = await confirmation.confirm(otp);
      const token = await cred.user.getIdToken();
      setFirebaseIdToken(token);
      setStep("profile");
    } catch {
      setError("Wrong OTP or session expired. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Use GPS location ──────────────────────────────────────────────────────
  const handleGPSLocation = () => {
    if (!navigator.geolocation) { setError("Geolocation not supported by your browser"); return; }
    setLocLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const geo = await reverseGeocode(lat, lng);
        const avail = await checkServiceAvailability(lat, lng);
        setLocationResult({
          lat, lng,
          address: geo.address || "",
          area: geo.area || "",
          city: geo.city || "",
          zipCode: geo.zipCode || "",
          isAvailable: avail.isAvailable ?? false,
          serviceAreaId: avail.serviceArea?.id,
        });
        setLocLoading(false);
        setStep(avail.isAvailable ? "done" : "unavailable");
        if (avail.isAvailable) {
          finishSignup({ lat, lng, ...geo, isAvailable: true, serviceAreaId: avail.serviceArea?.id });
        }
      },
      () => {
        setLocLoading(false);
        setError("Could not access location. Please allow location permission or enter manually.");
      }
    );
  };

  // ── Manual address lookup ─────────────────────────────────────────────────
  const [manualAddress, setManualAddress] = useState("");
  const handleManualLocation = async () => {
    if (!manualAddress.trim()) { setError("Please enter an address"); return; }
    try {
      setLocLoading(true);
      setError("");
      const encoded = encodeURIComponent(manualAddress + ", India");
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encoded}`
      );
      const results = await res.json();
      if (!results.length) { setError("Address not found. Try a more specific address."); setLocLoading(false); return; }
      const { lat: latStr, lon: lngStr } = results[0];
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      const geo = await reverseGeocode(lat, lng);
      const avail = await checkServiceAvailability(lat, lng);
      setLocationResult({
        lat, lng,
        address: results[0].display_name || manualAddress,
        area: geo.area || "",
        city: geo.city || "",
        zipCode: geo.zipCode || "",
        isAvailable: avail.isAvailable ?? false,
        serviceAreaId: avail.serviceArea?.id,
      });
      setStep(avail.isAvailable ? "done" : "unavailable");
      if (avail.isAvailable) {
        finishSignup({ lat, lng, ...geo, isAvailable: true, serviceAreaId: avail.serviceArea?.id });
      }
    } catch {
      setError("Location lookup failed. Please try again.");
    } finally {
      setLocLoading(false);
    }
  };

  // ── Final account creation ────────────────────────────────────────────────
  const finishSignup = async (loc: Partial<LocationResult> & { lat: number; lng: number; isAvailable: boolean }) => {
    try {
      setLoading(true);
      const response = await authAPI.firebaseVerify(firebaseIdToken, "customer", name, gender);
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));
      if (loc.isAvailable) {
        if (loc.lat) {
          localStorage.setItem("userLocation", JSON.stringify({
            lat: loc.lat, lng: loc.lng,
            address: loc.address, area: loc.area, city: loc.city,
            zipCode: loc.zipCode, isAvailable: true,
          }));
        }
        // Update profile with location
        try {
          await authAPI.updateProfile({
            name,
            addresses: [{
              label: "Home",
              street: loc.address || "",
              area: loc.area || "",
              city: loc.city || "",
              zipCode: loc.zipCode || "",
              location: { type: "Point", coordinates: [loc.lng, loc.lat] },
              isDefault: true,
            }],
          });
        } catch { /* non-fatal */ }
        setStep("done");
        setTimeout(() => { window.location.href = "/customer/dashboard"; }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account creation failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Notify me when available ──────────────────────────────────────────────
  const handleNotifyMe = async () => {
    try {
      setLoading(true);
      // Create the account even if service isn't available yet (so they can log in later)
      const response = await authAPI.firebaseVerify(firebaseIdToken, "customer", name, gender);
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));
      // We store pending location in localStorage; backend can process it later
      if (locationResult) {
        localStorage.setItem("pendingLocation", JSON.stringify({
          ...locationResult,
          notifyMe: true,
          savedAt: new Date().toISOString(),
        }));
      }
      setNotifySubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const LeftPanel = () => (
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
            Your home, perfectly<br />clean and cared for
          </h1>
          <p className="text-primary-foreground/70 leading-relaxed">
            Book trusted home services with just a few taps. Flexible scheduling, transparent pricing.
          </p>
          {/* Step pills */}
          <div className="mt-8 space-y-3">
            {[
              { s: "phone", label: "Verify mobile number" },
              { s: "profile", label: "Set your name" },
              { s: "location", label: "Check service availability" },
            ].map(({ s, label }, i) => {
              const stepOrder: Step[] = ["phone", "otp", "profile", "location", "unavailable", "done"];
              const current = stepOrder.indexOf(step);
              const target = stepOrder.indexOf(s as Step);
              const done = current > target;
              const active = ["phone", "otp"].includes(step) && s === "phone"
                || step === "profile" && s === "profile"
                || ["location", "unavailable", "done"].includes(step) && s === "location";
              return (
                <div key={s} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    done ? "bg-primary-foreground text-primary" :
                    active ? "bg-primary-foreground/80 text-primary" :
                    "bg-primary-foreground/20 text-primary-foreground/50"
                  }`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span className={`text-sm ${active || done ? "text-primary-foreground" : "text-primary-foreground/50"}`}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md animate-scale-in">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold font-heading text-foreground mb-3">Welcome to Smart Homez!</h2>
          <p className="text-muted-foreground">Your account is ready. Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <LeftPanel />

      <div className="flex-1 flex items-center justify-center p-6 bg-background relative overflow-y-auto">
        <div className="absolute top-6 right-6 z-10"><LanguageSelector /></div>

        {/* invisible recaptcha */}
        <div id="customer-recaptcha" ref={recaptchaRef} />

        <div className="w-full max-w-md animate-fade-in py-8">
          {/* Mobile logo */}
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

          {/* ── STEP: phone ── */}
          {step === "phone" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Create your account</h2>
              <p className="text-muted-foreground mb-6">We'll send an OTP to verify your number</p>
              <div className="space-y-4">
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
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
                    />
                  </div>
                </div>
                <button onClick={handleSendOTP} disabled={loading} className="btn-brand w-full flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Phone className="w-4 h-4" /> Send OTP</>}
                </button>
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link to="/login" className="text-primary font-semibold hover:underline">Log in</Link>
                </p>
              </div>
            </>
          )}

          {/* ── STEP: otp ── */}
          {step === "otp" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Enter OTP</h2>
              <p className="text-muted-foreground mb-6">
                Sent to <strong>+91 {phone}</strong>{" "}
                <button className="text-primary hover:underline text-sm" onClick={() => { setStep("phone"); setOtp(""); setError(""); }}>Change</button>
              </p>
              <div className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="input-clean tracking-[0.4em] text-center text-xl font-bold"
                  placeholder="• • • • • •"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyOTP()}
                />
                <button onClick={handleVerifyOTP} disabled={loading || otp.length < 6} className="btn-brand w-full flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : "Verify OTP"}
                </button>
                <button className="w-full text-sm text-primary hover:underline" onClick={() => { setStep("phone"); setOtp(""); setError(""); }}>Resend OTP</button>
              </div>
            </>
          )}

          {/* ── STEP: profile ── */}
          {step === "profile" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Your details</h2>
              <p className="text-muted-foreground mb-6">Just your name — no passwords needed!</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                  <input
                    className="input-clean"
                    placeholder="e.g. Priya Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Gender (optional)</label>
                  <select className="input-clean" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Prefer not to say</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <button
                  onClick={() => {
                    if (!name.trim()) { setError("Please enter your name"); return; }
                    setError("");
                    setStep("location");
                  }}
                  className="btn-brand w-full"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {/* ── STEP: location ── */}
          {step === "location" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Where are you?</h2>
              <p className="text-muted-foreground mb-6">
                We'll check if Smart Homez services your area. No city selection needed — just share your location!
              </p>
              <div className="space-y-4">
                <button
                  onClick={handleGPSLocation}
                  disabled={locLoading}
                  className="w-full flex items-center justify-center gap-3 py-4 px-4 bg-primary/10 border-2 border-primary rounded-xl text-primary font-semibold hover:bg-primary/20 transition-colors"
                >
                  {locLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
                  Use my current location
                </button>

                <div className="relative flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or enter address</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="flex gap-2">
                  <input
                    className="input-clean flex-1"
                    placeholder="e.g. Bandra West, Mumbai"
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleManualLocation()}
                  />
                  <button
                    onClick={handleManualLocation}
                    disabled={locLoading}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-1"
                  >
                    {locLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── STEP: unavailable ── */}
          {step === "unavailable" && !notifySubmitted && (
            <>
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell className="w-10 h-10 text-amber-600" />
                </div>
                <h2 className="text-2xl font-bold font-heading text-foreground mb-2">Not in our area yet</h2>
                <p className="text-muted-foreground">
                  Smart Homez doesn't service{" "}
                  <strong>{locationResult?.area || locationResult?.city || "this area"}</strong> yet, but we're expanding fast!
                </p>
              </div>

              {locationResult && (
                <div className="p-4 bg-muted rounded-xl mb-6 flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{locationResult.area}, {locationResult.city}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{locationResult.address}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={handleNotifyMe}
                  disabled={loading}
                  className="btn-brand w-full flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                  Notify me when available
                </button>
                <button
                  onClick={() => { setStep("location"); setError(""); }}
                  className="w-full py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors text-sm"
                >
                  Try a different location
                </button>
              </div>
            </>
          )}

          {step === "unavailable" && notifySubmitted && (
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-3">We'll let you know! 🎉</h2>
              <p className="text-muted-foreground mb-6">
                Your account is created. We'll notify you on <strong>+91 {phone}</strong> as soon as we expand to your area.
              </p>
              <Link to="/login" className="btn-brand inline-block px-8">
                Go to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerSignUp;
