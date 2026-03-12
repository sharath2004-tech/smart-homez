import { LanguageSelector } from "@/components/LanguageSelector";
import { API_BASE_URL, authAPI } from "@/lib/api";
import {
    Camera,
    CheckCircle,
    Clock,
    Eye,
    EyeOff,
    Home,
    Loader2,
    Mail,
    MapPin,
    Navigation,
    Phone,
    Upload,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

type Step = "method" | "form" | "phone-entry" | "otp" | "skills" | "documents" | "location" | "pending";

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
  lat: number;
  lng: number;
  address: string;
  area: string;
  city: string;
  zipCode: string;
}

const WorkerSignUp = () => {
  const [step, setStep] = useState<Step>("method");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    gender: "",
    experience: "",
  });
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [error, setError] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [signupMethod, setSignupMethod] = useState<"email" | "phone" | null>(null);
  const [phoneForm, setPhoneForm] = useState({ name: "", phone: "", gender: "", experience: "" });

  // Document upload state
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [aadhaarFront, setAadhaarFront] = useState<File | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<File | null>(null);
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);
  const [aadhaarFrontPreview, setAadhaarFrontPreview] = useState<string | null>(null);
  const [aadhaarBackPreview, setAadhaarBackPreview] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const toggleSkill = (skill: string) =>
    setSelectedSkills((prev) => prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]);

  const handleFileChange = (
    file: File | null,
    setter: (f: File | null) => void,
    previewSetter: (s: string | null) => void
  ) => {
    if (!file) { setter(null); previewSetter(null); return; }
    setter(file);
    const reader = new FileReader();
    reader.onloadend = () => previewSetter(reader.result as string);
    reader.readAsDataURL(file);
  };

  // -- Step 1 (email path): validate form and go directly to skills -----
  const handleFormNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.email.trim()) { setError("Email is required"); return; }
    if (!form.phone.trim() || form.phone.replace(/\D/g, "").length < 10) {
      setError("Enter a valid 10-digit mobile number"); return;
    }
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (!/[A-Z]/.test(form.password)) { setError("Password must contain at least one uppercase letter"); return; }
    if (!/[0-9]/.test(form.password)) { setError("Password must contain at least one number"); return; }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(form.password)) { setError('Password must include a special character (e.g. @, #, $, !)'); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
    setError("");
    setStep("skills"); // Email path: skip phone OTP, go directly to skills
  };

  // -- OTP helpers ---------------------------------------------------------
  const sendOTP = async () => {
    setOtpLoading(true);
    setError("");
    try {
      const phone = signupMethod === "phone"
        ? phoneForm.phone.replace(/\D/g, "").slice(-10)
        : form.phone.replace(/\D/g, "").slice(-10);
      await authAPI.sendOTP(phone);
      setOtpSent(true);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  // -- Phone-only path: collect name + phone then send OTP ----------------
  const handlePhoneEntryNext = async () => {
    if (!phoneForm.name.trim()) { setError("Name is required"); return; }
    const digits = phoneForm.phone.replace(/\D/g, "").slice(-10);
    if (digits.length < 10) { setError("Enter a valid 10-digit mobile number"); return; }
    setError("");
    setOtpLoading(true);
    try {
      await authAPI.sendOTP(digits);
      setOtpSent(true);
      setStep("otp");
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
      const phone = signupMethod === "phone"
        ? phoneForm.phone.replace(/\D/g, "").slice(-10)
        : form.phone.replace(/\D/g, "").slice(-10);
      await authAPI.checkOTP(phone, otpCode);
      setStep("skills");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect OTP. Please check and try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  // -- Step 2: skills -----------------------------------------------------
  const handleSkillsNext = () => {
    if (selectedSkills.length === 0) { setError("Please select at least one skill"); return; }
    if (!termsAccepted) { setError("Please accept the Terms of Service to continue"); return; }
    setError("");
    setStep("documents");
  };

  // -- Step 3: documents --------------------------------------------------
  const handleDocumentsNext = () => {
    if (!profilePic) { setError("Profile picture is required"); return; }
    if (!aadhaarFront) { setError("Aadhaar front image is required"); return; }
    setError("");
    setStep("location");
  };

  // -- Geocoding helpers --------------------------------------------------
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

  // -- Register -----------------------------------------------------------
  const registerAccount = async (geo: GeoResult | null) => {
    setLoading(true);
    setError("");
    try {
      const digits = (signupMethod === "phone" ? phoneForm.phone : form.phone).replace(/\D/g, "").slice(-10);
      const formData = new FormData();
      formData.append("name", signupMethod === "phone" ? phoneForm.name.trim() : form.name.trim());
      formData.append("email", signupMethod === "phone" ? `${digits}@healthyhomez.app` : form.email.trim().toLowerCase());
      formData.append("password", signupMethod === "phone" ? `Hh${digits}!` : form.password);
      formData.append("phone", "+91" + digits);
      formData.append("gender", (signupMethod === "phone" ? phoneForm.gender : form.gender) || "prefer_not_to_say");
      formData.append("experience", (signupMethod === "phone" ? phoneForm.experience : form.experience) || "0");
      formData.append("skills", JSON.stringify(selectedSkills));
      formData.append("phoneVerified", signupMethod === "phone" ? "true" : "false");

      if (geo) {
        formData.append("location", JSON.stringify({
          address: geo.address,
          area: geo.area,
          city: geo.city,
          zipCode: geo.zipCode,
          coordinates: [geo.lng, geo.lat],
        }));
      }

      if (profilePic) formData.append("profilePicture", profilePic);
      if (aadhaarFront) formData.append("aadhaarFront", aadhaarFront);
      if (aadhaarBack) formData.append("aadhaarBack", aadhaarBack);

      const response = await authAPI.registerWorker(formData);
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));
      setStep("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGPS = () => {
    if (!navigator.geolocation) { setError("Geolocation not supported"); return; }
    setLocLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const geo = await reverseGeocode(lat, lng);
        setLocLoading(false);
        await registerAccount(geo);
      },
      () => {
        setLocLoading(false);
        setError("Location access denied. Please allow it or enter your area.");
      }
    );
  };

  const handleManualLocation = async () => {
    if (!manualAddress.trim()) { setError("Please enter your area"); return; }
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
      setLocLoading(false);
      await registerAccount(geo);
    } catch {
      setLocLoading(false);
      setError("Location lookup failed. Please try again.");
    }
  };

  const handleSkipLocation = () => registerAccount(null);

  // -- Steps for left panel -----------------------------------------------
  const stepLabels = signupMethod === "phone"
    ? ["Your details", "Verify phone", "Skills", "Documents", "Service area"]
    : ["Your details", "Skills", "Documents", "Service area"];
  const stepIdx = signupMethod === "phone"
    ? ((step === "phone-entry") ? 0 : step === "otp" ? 1 : step === "skills" ? 2 : step === "documents" ? 3 : 4)
    : ((step === "form") ? 0 : step === "skills" ? 1 : step === "documents" ? 2 : 3);

  // -- Pending approval screen -------------------------------------------
  if (step === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md animate-scale-in">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-amber-600" />
          </div>
          <h2 className="text-3xl font-bold font-heading text-foreground mb-3">Application Submitted! 🎉</h2>
          <p className="text-muted-foreground mb-4">
            Your worker application is under review. Our admin team will verify your documents and approve your account.
          </p>
          <p className="text-sm text-muted-foreground bg-muted rounded-xl p-4">
            You will receive a notification once your account is approved. This usually takes 1�2 business days.
          </p>
          <Link to="/login" className="mt-6 inline-block btn-brand px-8">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  void API_BASE_URL; // suppress unused import warning

  return (
    <div className="min-h-screen flex">

      {/* Left panel */}
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
              Grow your income with<br />flexible hours
            </h1>
            <p className="text-primary-foreground/70 leading-relaxed mb-8">
              Join our network of trusted home service professionals.
            </p>
            <div className="space-y-3">
              {stepLabels.map((label, i) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < stepIdx ? "bg-primary-foreground text-primary"
                    : i === stepIdx ? "bg-primary-foreground/80 text-primary"
                    : "bg-primary-foreground/20 text-primary-foreground/50"
                  }`}>
                    {i < stepIdx ? "?" : i + 1}
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
            <span className="text-lg font-bold font-heading text-foreground">Healthy Homez</span>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
              {error}
            </div>
          )}

          {/* -- STEP: method -- */}
          {step === "method" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Join as a Worker</h2>
              <p className="text-muted-foreground mb-8">How would you like to sign up?</p>

              <div className="space-y-3">
                <button
                  onClick={() => { setSignupMethod("email"); setStep("form"); setError(""); }}
                  className="w-full flex items-center gap-4 p-5 border-2 border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary transition-all shrink-0">
                    <Mail className="w-5 h-5 text-primary group-hover:text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Continue with Email</div>
                    <div className="text-sm text-muted-foreground mt-0.5">Sign up with your email address &amp; password</div>
                  </div>
                </button>

                <button
                  onClick={() => { setSignupMethod("phone"); setStep("phone-entry"); setError(""); }}
                  className="w-full flex items-center gap-4 p-5 border-2 border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary transition-all shrink-0">
                    <Phone className="w-5 h-5 text-primary group-hover:text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Continue with Phone</div>
                    <div className="text-sm text-muted-foreground mt-0.5">Sign up instantly with your mobile number &amp; OTP</div>
                  </div>
                </button>
              </div>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{" "}
                <Link to="/login" className="text-primary font-semibold hover:underline">Log in</Link>
              </p>
            </>
          )}

          {/* -- STEP: phone-entry -- */}
          {step === "phone-entry" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Your details</h2>
              <p className="text-muted-foreground mb-6">Enter your name and mobile number to get started</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                  <input
                    className="input-clean"
                    placeholder="e.g. Ravi Kumar"
                    value={phoneForm.name}
                    onChange={(e) => setPhoneForm(p => ({ ...p, name: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Mobile Number <span className="text-destructive">*</span></label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">+91</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      className="input-clean pl-12"
                      placeholder="98765 43210"
                      value={phoneForm.phone}
                      onChange={(e) => setPhoneForm(p => ({ ...p, phone: e.target.value.replace(/\D/g, "") }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Gender <span className="text-muted-foreground font-normal">(opt.)</span></label>
                    <select className="input-clean" value={phoneForm.gender} onChange={(e) => setPhoneForm(p => ({ ...p, gender: e.target.value }))}>
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Experience (yrs)</label>
                    <input
                      type="number"
                      className="input-clean"
                      placeholder="0"
                      min="0"
                      max="50"
                      value={phoneForm.experience}
                      onChange={(e) => setPhoneForm(p => ({ ...p, experience: e.target.value }))}
                    />
                  </div>
                </div>

                <button
                  onClick={handlePhoneEntryNext}
                  disabled={otpLoading}
                  className="btn-brand w-full flex items-center justify-center gap-2"
                >
                  {otpLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP…</> : <><Phone className="w-4 h-4" /> Send OTP</>}
                </button>
                <button
                  onClick={() => { setStep("method"); setError(""); }}
                  className="w-full py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors text-sm"
                >
                  Back
                </button>
              </div>
            </>
          )}

          {/* -- STEP: form -- */}
          {step === "form" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Join as a Worker</h2>
              <p className="text-muted-foreground mb-6">Create your free worker account</p>

              <form onSubmit={handleFormNext} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                  <input className="input-clean" placeholder="e.g. Ravi Kumar" value={form.name} onChange={set("name")} required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email Address</label>
                  <input type="email" className="input-clean" placeholder="you@example.com" value={form.email} onChange={set("email")} required autoComplete="email" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Mobile Number <span className="text-destructive">*</span></label>
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
                  <p className="text-xs text-muted-foreground mt-1">An OTP will be sent to verify this number</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Gender <span className="text-muted-foreground font-normal">(opt.)</span></label>
                    <select className="input-clean" value={form.gender} onChange={set("gender")}>
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Experience (yrs)</label>
                    <input
                      type="number"
                      className="input-clean"
                      placeholder="0"
                      min="0"
                      max="50"
                      value={form.experience}
                      onChange={set("experience")}
                    />
                  </div>
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

                <button type="submit" className="btn-brand w-full mt-2">
                  Continue
                </button>
              </form>

              <div className="flex items-center justify-between mt-6 flex-wrap gap-2">
                <button onClick={() => { setStep("method"); setError(""); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  ← Back
                </button>
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link to="/login" className="text-primary font-semibold hover:underline">Log in</Link>
                </p>
              </div>
            </>
          )}

          {/* -- STEP: otp -- */}
          {step === "otp" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Verify your number</h2>
              <p className="text-muted-foreground mb-6">
                {otpSent
                  ? `OTP sent to +91${signupMethod === "phone" ? phoneForm.phone : form.phone}. Enter the 6-digit code below.`
                  : "Sending OTP�"}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Enter OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="input-clean tracking-widest text-center text-lg"
                    placeholder="� � � � � �"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                <button
                  onClick={handleVerifyOTP}
                  disabled={otpLoading}
                  className="btn-brand w-full flex items-center justify-center gap-2"
                >
                  {otpLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying�</> : "Verify & Continue"}
                </button>

                <button
                  onClick={() => { setOtpSent(false); setOtpCode(""); setError(""); sendOTP(); }}
                  disabled={otpLoading}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Resend OTP
                </button>

                <button onClick={() => { setStep(signupMethod === "phone" ? "phone-entry" : "form"); setError(""); }} className="w-full py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors text-sm">
                  Back
                </button>
              </div>
            </>
          )}

          {/* -- STEP: skills -- */}
          {step === "skills" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Your skills</h2>
              <p className="text-muted-foreground mb-6">Select all services you can provide</p>

              <div className="grid grid-cols-2 gap-2 mb-5">
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
                      className="accent-primary w-4 h-4 shrink-0"
                      checked={selectedSkills.includes(skill)}
                      onChange={() => toggleSkill(skill)}
                    />
                    <span className="text-sm font-medium leading-tight">{skill}</span>
                  </label>
                ))}
              </div>

              <label className="flex items-start gap-3 p-3 bg-muted rounded-xl mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-primary w-4 h-4 mt-0.5 shrink-0"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                <span className="text-sm text-muted-foreground">
                  I agree to the{" "}
                  <span className="text-primary font-medium">Terms of Service</span> and{" "}
                  <span className="text-primary font-medium">Privacy Policy</span>
                </span>
              </label>

              <div className="flex gap-3">
                <button onClick={() => { setStep("otp"); setError(""); }} className="flex-1 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors">
                  Back
                </button>
                <button onClick={handleSkillsNext} className="btn-brand flex-1">Continue</button>
              </div>
            </>
          )}

          {/* -- STEP: documents -- */}
          {step === "documents" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Upload documents</h2>
              <p className="text-muted-foreground mb-2">Required for account verification</p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 mb-6">
                Your documents are securely stored and only reviewed by our admin team.
              </div>

              <div className="space-y-5">
                {/* Profile picture */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Profile Photo <span className="text-destructive">*</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:bg-accent ${profilePicPreview ? "border-primary bg-primary/5" : "border-border"}`}>
                    {profilePicPreview ? (
                      <img src={profilePicPreview} alt="Profile preview" className="h-full w-full object-cover rounded-xl" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Camera className="w-8 h-8" />
                        <span className="text-sm">Upload your photo</span>
                        <span className="text-xs">JPG, PNG up to 5MB</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleFileChange(e.target.files?.[0] || null, setProfilePic, setProfilePicPreview)}
                    />
                  </label>
                </div>

                {/* Aadhaar front */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Aadhaar Card � Front <span className="text-destructive">*</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:bg-accent ${aadhaarFrontPreview ? "border-primary bg-primary/5" : "border-border"}`}>
                    {aadhaarFrontPreview ? (
                      <div className="flex items-center gap-2 text-primary">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">Aadhaar front uploaded</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="w-7 h-7" />
                        <span className="text-sm">Upload Aadhaar front</span>
                        <span className="text-xs">JPG, PNG up to 5MB</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleFileChange(e.target.files?.[0] || null, setAadhaarFront, setAadhaarFrontPreview)}
                    />
                  </label>
                </div>

                {/* Aadhaar back */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Aadhaar Card � Back <span className="text-muted-foreground font-normal">(optional but recommended)</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:bg-accent ${aadhaarBackPreview ? "border-primary bg-primary/5" : "border-border"}`}>
                    {aadhaarBackPreview ? (
                      <div className="flex items-center gap-2 text-primary">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">Aadhaar back uploaded</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="w-7 h-7" />
                        <span className="text-sm">Upload Aadhaar back</span>
                        <span className="text-xs">JPG, PNG up to 5MB</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleFileChange(e.target.files?.[0] || null, setAadhaarBack, setAadhaarBackPreview)}
                    />
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => { setStep("skills"); setError(""); }} className="flex-1 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors">
                  Back
                </button>
                <button onClick={handleDocumentsNext} className="btn-brand flex-1">Continue</button>
              </div>
            </>
          )}

          {/* -- STEP: location -- */}
          {step === "location" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Your service area</h2>
              <p className="text-muted-foreground mb-6">
                Tell us where you're based so we can match you with nearby bookings.
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

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                  You can update your service area anytime from your profile settings.
                </div>

                <button
                  onClick={handleSkipLocation}
                  disabled={loading}
                  className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                  Skip for now
                </button>

                <button onClick={() => { setStep("documents"); setError(""); }} className="w-full py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors text-sm">
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
