import { LanguageSelector } from "@/components/LanguageSelector";
import { API_BASE_URL, authAPI } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";
import {
    ConfirmationResult,
    RecaptchaVerifier,
    signInWithPhoneNumber,
} from "firebase/auth";
import {
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
    workerRecaptchaVerifier?: RecaptchaVerifier;
  }
}

type Step = "phone" | "otp" | "profile" | "skills" | "location" | "done";

const SKILLS = [
  "General Cleaning",
  "Deep Cleaning",
  "Kitchen Cleaning",
  "Bathroom Cleaning",
  "Laundry",
  "Cooking",
  "Mopping & Sweeping",
  "Dusting",
];

interface GeoResult {
  address: string;
  area: string;
  city: string;
  zipCode: string;
}

const WorkerSignUp = () => {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [experience, setExperience] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [firebaseIdToken, setFirebaseIdToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [error, setError] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const recaptchaRef = useRef<HTMLDivElement>(null);

  const setupRecaptcha = () => {
    if (window.workerRecaptchaVerifier) return window.workerRecaptchaVerifier;
    const v = new RecaptchaVerifier(firebaseAuth, "worker-recaptcha", {
      size: "invisible",
      callback: () => {},
    });
    window.workerRecaptchaVerifier = v;
    return v;
  };

  const reverseGeocode = async (lat: number, lng: number): Promise<GeoResult> => {
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
      return { address: "", area: "", city: "", zipCode: "" };
    }
  };

  const checkAvailability = async (lat: number, lng: number) => {
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
    try {
      setLoading(true);
      setError("");
      const v = setupRecaptcha();
      const result = await signInWithPhoneNumber(firebaseAuth, `+91${cleaned}`, v);
      setConfirmation(result);
      setStep("otp");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg.includes("TOO_MANY_REQUESTS")
        ? "Too many attempts. Please wait a few minutes."
        : "Could not send OTP. Please try again.");
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

  // ── Save profile → go to skills ───────────────────────────────────────────
  const handleProfileNext = () => {
    if (!name.trim()) { setError("Please enter your name"); return; }
    setError("");
    setStep("skills");
  };

  // ── Skills → location ────────────────────────────────────────────────────
  const handleSkillsNext = () => {
    if (selectedSkills.length === 0) { setError("Please select at least one skill"); return; }
    setError("");
    setStep("location");
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  // ── Register with location ────────────────────────────────────────────────
  const finishSignup = async (lat: number, lng: number, geo: GeoResult, avail: { isAvailable: boolean; serviceArea?: { id: string } }) => {
    try {
      setLoading(true);
      const response = await authAPI.firebaseVerify(firebaseIdToken, "worker", name, gender);
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));

      // Update worker profile with full details
      try {
        await authAPI.updateProfile({
          name,
          gender: gender || "prefer_not_to_say",
          workerProfile: {
            experience: parseInt(experience) || 0,
            skills: selectedSkills,
          },
          addresses: [{
            label: "Home",
            street: geo.address,
            area: geo.area,
            city: geo.city,
            zipCode: geo.zipCode,
            location: { type: "Point", coordinates: [lng, lat] },
            isDefault: true,
          }],
        });
      } catch { /* non-fatal */ }

      if (avail.isAvailable) {
        localStorage.setItem("userLocation", JSON.stringify({ lat, lng, ...geo, isAvailable: true }));
      }

      setStep("done");
      setTimeout(() => { window.location.href = "/worker/dashboard"; }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGPSLocation = () => {
    if (!navigator.geolocation) { setError("Geolocation not supported"); return; }
    setLocLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const geo = await reverseGeocode(lat, lng);
        const avail = await checkAvailability(lat, lng);
        setLocLoading(false);
        await finishSignup(lat, lng, geo, avail);
      },
      () => {
        setLocLoading(false);
        setError("Location access denied. Please allow it or enter your address manually.");
      }
    );
  };

  const handleManualLocation = async () => {
    if (!manualAddress.trim()) { setError("Please enter an address"); return; }
    try {
      setLocLoading(true);
      setError("");
      const enc = encodeURIComponent(manualAddress + ", India");
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${enc}`);
      const results = await res.json();
      if (!results.length) { setError("Address not found. Try a more specific area."); setLocLoading(false); return; }
      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);
      const geo = await reverseGeocode(lat, lng);
      const avail = await checkAvailability(lat, lng);
      await finishSignup(lat, lng, geo, avail);
    } catch {
      setError("Location lookup failed. Please try again.");
    } finally {
      setLocLoading(false);
    }
  };

  // ── Left panel ─────────────────────────────────────────────────────────────
  const stepLabels: { s: Step; label: string }[] = [
    { s: "phone", label: "Verify mobile number" },
    { s: "profile", label: "Your details" },
    { s: "skills", label: "Skills & experience" },
    { s: "location", label: "Your service area" },
  ];
  const stepOrder: Step[] = ["phone", "otp", "profile", "skills", "location", "done"];
  const currentIdx = stepOrder.indexOf(step);

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
            Grow your income with<br />flexible hours
          </h1>
          <p className="text-primary-foreground/70 leading-relaxed">
            Join our network of trusted home service professionals. Earn more, work on your schedule.
          </p>
          <div className="mt-8 space-y-3">
            {stepLabels.map(({ s, label }, i) => {
              const targetIdx = stepOrder.indexOf(s);
              const done = currentIdx > targetIdx;
              const active = (["phone", "otp"].includes(step) && s === "phone")
                || (step === "profile" && s === "profile")
                || (step === "skills" && s === "skills")
                || (["location", "done"].includes(step) && s === "location");
              return (
                <div key={s} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    done ? "bg-primary-foreground text-primary"
                    : active ? "bg-primary-foreground/80 text-primary"
                    : "bg-primary-foreground/20 text-primary-foreground/50"
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
          <h2 className="text-3xl font-bold font-heading text-foreground mb-3">Welcome aboard! 🎉</h2>
          <p className="text-muted-foreground">Your worker account is ready. Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <LeftPanel />

      <div className="flex-1 flex items-center justify-center p-6 bg-background relative overflow-y-auto">
        <div className="absolute top-6 right-6 z-10"><LanguageSelector /></div>
        <div id="worker-recaptcha" ref={recaptchaRef} />

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
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Join as a Worker</h2>
              <p className="text-muted-foreground mb-6">Verify your mobile number to get started</p>
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
              <p className="text-muted-foreground mb-6">Tell us about yourself</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                  <input className="input-clean" placeholder="e.g. Ravi Kumar" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Gender</label>
                  <select className="input-clean" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Years of experience</label>
                  <input
                    type="number"
                    className="input-clean"
                    placeholder="e.g. 2"
                    min="0"
                    max="50"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                  />
                </div>
                <button onClick={handleProfileNext} className="btn-brand w-full">Continue</button>
              </div>
            </>
          )}

          {/* ── STEP: skills ── */}
          {step === "skills" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Your skills</h2>
              <p className="text-muted-foreground mb-6">Select the services you can provide</p>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {SKILLS.map((skill) => (
                  <label
                    key={skill}
                    className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${
                      selectedSkills.includes(skill)
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-primary w-4 h-4"
                      checked={selectedSkills.includes(skill)}
                      onChange={() => toggleSkill(skill)}
                    />
                    <span className="text-sm font-medium">{skill}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-xl mb-4">
                <input type="checkbox" className="accent-primary w-4 h-4 mt-0.5" required id="worker-terms" />
                <label htmlFor="worker-terms" className="text-sm text-muted-foreground cursor-pointer">
                  I agree to the{" "}
                  <span className="text-primary hover:underline font-medium">Terms of Service</span>{" "}
                  and{" "}
                  <span className="text-primary hover:underline font-medium">Privacy Policy</span>
                </label>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep("profile")} className="flex-1 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors">
                  Back
                </button>
                <button onClick={handleSkillsNext} className="btn-brand flex-1">Continue</button>
              </div>
            </>
          )}

          {/* ── STEP: location ── */}
          {step === "location" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Your service area</h2>
              <p className="text-muted-foreground mb-6">
                Share your location so we can match you with nearby bookings. We do <strong>not</strong> require a specific city — just your area.
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
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-1"
                  >
                    {locLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  </button>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                  💡 Workers outside current service areas may still be registered and notified when we expand nearby.
                </div>

                <button onClick={() => setStep("skills")} className="w-full py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors text-sm">
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

export default WorkerSignUp;
