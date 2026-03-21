import { LanguageSelector } from "@/components/LanguageSelector";
import { authAPI, publicAPI } from "@/lib/api";
import {
    CheckCircle,
    ChevronDown,
    Eye,
    EyeOff,
    Home,
    Loader2,
    MapPin,
    Navigation,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

// Google OAuth types (will be used once @react-oauth/google is installed)
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: CredentialResponse) => void }) => void;
          renderButton: (element: HTMLElement, options: { theme: string; size: string; text: string }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface CredentialResponse {
  credential: string;
  select_by: string;
}

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

  const [serviceCities, setServiceCities] = useState<ServiceCity[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [isOAuthFlow, setIsOAuthFlow] = useState(false);

  // Google Sign-In initialization state
  const [googleInitialized, setGoogleInitialized] = useState(false);

  // Google OAuth handler
  const handleGoogleSuccess = async (credential: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await authAPI.googleLogin(credential);
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));

      // Check if this is a new user or existing user
      const isNewUser = response.isNewUser === true;
      const hasLocation = response.hasLocation === true;

      if (isNewUser || !hasLocation) {
        // New users or existing users without location → show location step
        setIsOAuthFlow(true);
        setStep("location");
      } else {
        // Existing user with location → go to dashboard
        setStep("done");
        setTimeout(() => {
          window.location.href = "/customer/dashboard";
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Initialize Google Sign-In once
  useEffect(() => {
    if (window.google && !googleInitialized) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
        callback: (response: CredentialResponse) => handleGoogleSuccess(response.credential)
      });
      setGoogleInitialized(true);
    }
  }, [googleInitialized]);

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

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleFormNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!form.email.trim()) {
      setError("Email is required");
      return;
    }
    // Validate password field requirements
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(form.password)) {
      setError("Password must contain at least one uppercase letter");
      return;
    }
    if (!/[0-9]/.test(form.password)) {
      setError("Password must contain at least one number");
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(form.password)) {
      setError("Password must include a special character (e.g. @, #, $, !)");
      return;
    }
    // Validate confirm password field requirements
    if (form.confirmPassword.length < 8) {
      setError("Confirm password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(form.confirmPassword)) {
      setError("Confirm password must contain at least one uppercase letter");
      return;
    }
    if (!/[0-9]/.test(form.confirmPassword)) {
      setError("Confirm password must contain at least one number");
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(form.confirmPassword)) {
      setError("Confirm password must include a special character (e.g. @, #, $, !)");
      return;
    }
    // Finally, check if passwords match
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setStep("location");
  };

  const registerAccount = async (geo: GeoResult | null) => {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: "customer",
        gender: form.gender || "prefer_not_to_say",
        isPhoneVerified: false,
      };
      const phoneDigits = form.phone.replace(/\D/g, "").slice(-10);
      if (phoneDigits.length === 10) payload.phone = "+91" + phoneDigits;

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

  const steps = ["Your details", "Your area", "All set!"];
  const stepIdx = step === "form" ? 0 : step === "location" ? 1 : 2;

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

              {/* Google OAuth Button */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => {
                    if (!window.google || !googleInitialized) {
                      setError("Google Sign-In is not available. Please use email signup.");
                      return;
                    }
                    window.google.accounts.id.prompt();
                  }}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 border-2 border-border rounded-xl font-semibold hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {loading ? "Signing in..." : "Continue with Google"}
                </button>
              </div>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-background text-muted-foreground">Or sign up with email</span>
                </div>
              </div>

              <form onSubmit={handleFormNext} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                  <input className="input-clean" placeholder="e.g. Priya Sharma" value={form.name} onChange={set("name")} required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email Address</label>
                  <input
                    type="email"
                    className="input-clean"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={set("email")}
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Mobile Number <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
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
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
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
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn-brand w-full mt-2">
                  Continue
                </button>
              </form>

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
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">
                {isOAuthFlow ? "One last step!" : "Select your area"}
              </h2>
              <p className="text-muted-foreground mb-5">
                {isOAuthFlow
                  ? "Help us find the best workers near you by selecting your location."
                  : "Choose the city and location where you need home services."}
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
                  onClick={isOAuthFlow ? handleOAuthLocationConfirm : handleConfirmLocation}
                  disabled={loading || !selectedCity || !selectedLocationId}
                  className="btn-brand w-full flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> {isOAuthFlow ? "Updating location…" : "Creating account…"}
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4" /> {isOAuthFlow ? "Confirm Location" : "Confirm & Create Account"}
                    </>
                  )}
                </button>

                {!isOAuthFlow && (
                  <button
                    onClick={handleSkipLocation}
                    disabled={loading}
                    className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Skip — I'll set location later
                  </button>
                )}

                <button
                  onClick={() => {
                    setStep("form");
                    setError("");
                    setIsOAuthFlow(false);
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
