import { LanguageSelector } from "@/components/LanguageSelector";
import { authAPI, publicAPI } from "@/lib/api";
import * as msg91Widget from "@/lib/msg91Widget";
import {
    CheckCircle,
    ChevronDown,
    Home,
    Loader2,
    MapPin,
    Navigation,
    Phone,
    RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";


type Step = "form" | "location" | "done";

interface GeoResult {
  address: string;
  area: string;
  city: string;
  zipCode: string;
  lat: number;
  lng: number;
}

interface ServiceLocation {
  _id: string;
  apartmentName: string;
  area: string;
  city: string;
  state: string;
  zipCode: string;
  coordinates: { lat: number; lng: number } | null;
  isServiceAvailable: boolean;
  workersCount: number;
}

interface ServiceCity {
  city: string;
  locations: ServiceLocation[];
  hasService: boolean;
}

const CustomerSignUp = () => {
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({ name: "", phone: "", gender: "" });
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [error, setError] = useState("");

  const [serviceCities, setServiceCities] = useState<ServiceCity[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");

  useEffect(() => {
    if (step !== "location") return;
    setCitiesLoading(true);
    publicAPI
      .getServiceLocations()
      .then((data) => {
        if (data.cities) setServiceCities(data.cities);
      })
      .catch(() => {})
      .finally(() => setCitiesLoading(false));
  }, [step]);

  // Cleanup countdown interval on unmount
  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const startResendCountdown = () => {
    setResendCountdown(30);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) { clearInterval(countdownRef.current!); countdownRef.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required"); return; }
    const phoneDigits = form.phone.replace(/\D/g, "").slice(-10);
    if (phoneDigits.length < 10) { setError("Mobile number is required"); return; }
    setOtpLoading(true);
    setError("");
    try {
      await msg91Widget.sendOtp("91" + phoneDigits);
      setOtpSent(true);
      startResendCountdown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 6) { setError("Enter the 6-digit OTP"); return; }
    setOtpLoading(true);
    setError("");
    try {
      await msg91Widget.verifyOtp(otpCode);
      setStep("location");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCountdown > 0) return;
    setOtpCode("");
    setError("");
    setOtpLoading(true);
    try {
      await msg91Widget.retryOtp(null);
      startResendCountdown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP.");
    } finally {
      setOtpLoading(false);
    }
  };

  const registerAccount = async (geo: GeoResult | null) => {
    setLoading(true);
    try {
      const phoneDigits = form.phone.replace(/\D/g, "").slice(-10);
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        role: "customer",
        gender: form.gender || "prefer_not_to_say",
        phone: "+91" + phoneDigits,
        isPhoneVerified: true,
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
      setTimeout(() => {
        window.location.href = "/customer/dashboard";
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGPS = () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported by your browser");
      return;
    }
    setLocLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setLocLoading(false);

        let bestLoc: ServiceLocation | null = null;
        let bestDist = Infinity;
        for (const cityGroup of serviceCities) {
          for (const loc of cityGroup.locations) {
            if (!loc.coordinates) continue;
            const dLat = loc.coordinates.lat - lat;
            const dLng = loc.coordinates.lng - lng;
            const dist = Math.sqrt(dLat * dLat + dLng * dLng);
            if (dist < bestDist) {
              bestDist = dist;
              bestLoc = loc;
            }
          }
        }

        if (bestLoc) {
          setSelectedCity(bestLoc.city);
          setSelectedLocationId(bestLoc._id);
        } else {
          setError("Couldn't match your location. Please select your city manually.");
        }
      },
      () => {
        setLocLoading(false);
        setError("Location access denied. Please select your city from the list.");
      }
    );
  };

  const handleSkipLocation = () => registerAccount(null);

  const handleConfirmLocation = async () => {
    if (!selectedCity) {
      setError("Please select your city");
      return;
    }
    if (!selectedLocationId) {
      setError("Please select your area / apartment");
      return;
    }
    setError("");

    const city = serviceCities.find((c) => c.city === selectedCity);
    const loc = city?.locations.find((l) => l._id === selectedLocationId);
    if (!loc) {
      setError("Invalid selection. Please try again.");
      return;
    }

    const geo: GeoResult = {
      address: `${loc.apartmentName}, ${loc.area}, ${loc.city}`,
      area: loc.area,
      city: loc.city,
      zipCode: loc.zipCode,
      lat: loc.coordinates?.lat ?? 0,
      lng: loc.coordinates?.lng ?? 0,
    };
    await registerAccount(geo);
  };

  // Handle location confirmation for OAuth users
  const handleOAuthLocationConfirm = async () => {
    if (!selectedCity) {
      setError("Please select your city");
      return;
    }
    if (!selectedLocationId) {
      setError("Please select your area / apartment");
      return;
    }
    setError("");
    setLoading(true);

    try {
      await authAPI.updateLocation(selectedLocationId);
      setStep("done");
      setTimeout(() => {
        window.location.href = "/customer/dashboard";
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update location. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const steps = ["Your details", "Verify phone", "Your area", "All set!"];
  const stepIdx = step === "form" ? (otpSent ? 1 : 0) : step === "location" ? 2 : 3;

  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md animate-scale-in">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold font-heading text-foreground mb-3">Welcome to Healthy Homez! 🎉</h2>
          <p className="text-muted-foreground">Your account is ready. Redirecting to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-2/5 relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground h-full">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-foreground/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Home className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold font-heading">Healthy Homez</span>
          </Link>
          <div>
            <h1 className="text-3xl font-bold font-heading mb-4 leading-tight">
              Book trusted home
              <br />
              services in minutes
            </h1>
            <p className="text-primary-foreground/70 leading-relaxed mb-8">
              Create your free account to book cleaners, cooks, and more.
            </p>
            <div className="space-y-3">
              {steps.map((label, i) => (
                <div key={label} className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      i < stepIdx
                        ? "bg-primary-foreground text-primary"
                        : i === stepIdx
                        ? "bg-primary-foreground/80 text-primary"
                        : "bg-primary-foreground/20 text-primary-foreground/50"
                    }`}
                  >
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

      <div className="flex-1 flex items-center justify-center p-6 bg-background relative overflow-y-auto">
        <div className="absolute top-6 right-6 z-10">
          <LanguageSelector />
        </div>

        <div className="w-full max-w-md animate-fade-in py-8">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Home className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold font-heading text-foreground">Healthy Homez</span>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">{error}</div>
          )}

          {step === "form" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Create your account</h2>
              <p className="text-muted-foreground mb-6">Join Healthy Homez as a customer</p>

              {!otpSent ? (
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                    <input className="input-clean" placeholder="e.g. Priya Sharma" value={form.name} onChange={set("name")} required />
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
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Gender <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <select className="input-clean" value={form.gender} onChange={set("gender")}>
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={otpLoading}
                    className="btn-brand w-full mt-2 flex items-center justify-center gap-2"
                  >
                    {otpLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP&hellip;</>
                      : <><Phone className="w-4 h-4" /> Send OTP</>}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 flex items-start gap-2">
                    <Phone className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
                    <span>OTP sent to <strong>+91&nbsp;{form.phone}</strong>. Check your SMS.</span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Enter OTP</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className="input-clean tracking-[0.5em] text-center text-lg font-mono"
                      placeholder="· · · · · ·"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && handleVerifyOTP()}
                      autoFocus
                    />
                  </div>

                  <button
                    onClick={handleVerifyOTP}
                    disabled={otpLoading || otpCode.length < 6}
                    className="btn-brand w-full flex items-center justify-center gap-2"
                  >
                    {otpLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying&hellip;</>
                      : "Verify & Continue"}
                  </button>

                  <div className="flex items-center justify-between text-sm">
                    <button
                      onClick={() => { setOtpSent(false); setOtpCode(""); setError(""); setResendCountdown(0); }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Change number
                    </button>
                    <button
                      onClick={handleResendOTP}
                      disabled={otpLoading || resendCountdown > 0}
                      className="flex items-center gap-1.5 text-primary hover:text-primary/80 disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {resendCountdown > 0
                        ? <span>Resend in {resendCountdown}s</span>
                        : <><RefreshCw className="w-3.5 h-3.5" /> Resend OTP</>}
                    </button>
                  </div>
                </div>
              )}

              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{" "}
                <Link to="/login" className="text-primary font-semibold hover:underline">
                  Log in
                </Link>
              </p>
            </>
          )}

          {step === "location" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Select your area</h2>
              <p className="text-muted-foreground mb-5">
                Choose the city and location where you need home services.
              </p>

              {citiesLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground text-sm">Loading service areas…</span>
                </div>
              ) : serviceCities.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 mb-4">
                  No service areas are set up yet. You can still create your account and we'll notify you when service launches in your area.
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">City</label>
                    <div className="relative">
                      <select
                        className="input-clean appearance-none pr-10"
                        value={selectedCity}
                        onChange={(e) => {
                          setSelectedCity(e.target.value);
                          setSelectedLocationId("");
                          setError("");
                        }}
                      >
                        <option value="">Select your city</option>
                        {serviceCities.map((c) => (
                          <option key={c.city} value={c.city}>
                            {c.city}
                            {c.hasService ? "" : " (coming soon)"}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  {selectedCity && (() => {
                    const city = serviceCities.find((c) => c.city === selectedCity);
                    const locs = city?.locations ?? [];
                    return (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Area / Apartment</label>
                        <div className="relative">
                          <select
                            className="input-clean appearance-none pr-10"
                            value={selectedLocationId}
                            onChange={(e) => {
                              setSelectedLocationId(e.target.value);
                              setError("");
                            }}
                          >
                            <option value="">Select your area</option>
                            {locs.map((loc) => (
                              <option key={loc._id} value={loc._id}>
                                {loc.apartmentName}
                                {loc.area ? `, ${loc.area}` : ""}
                                {loc.isServiceAvailable ? "" : " (coming soon)"}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleGPS}
                  disabled={locLoading || citiesLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  {locLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4 text-primary" />}
                  Auto-detect my location
                </button>
              </div>

              <div className="space-y-3 mt-6">
                <button
                  onClick={handleConfirmLocation}
                  disabled={loading || !selectedCity || !selectedLocationId}
                  className="btn-brand w-full flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Creating account…
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4" /> Confirm &amp; Create Account
                    </>
                  )}
                </button>

                <button
                  onClick={handleSkipLocation}
                  disabled={loading}
                  className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip — I'll set location later
                </button>

                <button
                  onClick={() => {
                    setStep("form");
                    setOtpSent(false);
                    setOtpCode("");
                    setError("");
                  }}
                  className="w-full py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors text-sm"
                >
                  Back
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
