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
    MapPin,
    Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Step = "form" | "skills" | "documents" | "location" | "pending";

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

interface AvailableLocation {
  _id: string;
  apartmentName: string;
  area: string;
  city: string;
}

const WorkerSignUp = () => {
  const [step, setStep] = useState<Step>("form");
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
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [availableLocations, setAvailableLocations] = useState<AvailableLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");

  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [aadhaarFront, setAadhaarFront] = useState<File | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<File | null>(null);
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);
  const [aadhaarFrontPreview, setAadhaarFrontPreview] = useState<string | null>(null);
  const [aadhaarBackPreview, setAadhaarBackPreview] = useState<string | null>(null);

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Fetch available locations when reaching the location step
  useEffect(() => {
    if (step === "location" && availableLocations.length === 0) {
      setLocLoading(true);
      fetch(`${API_BASE_URL}/api/locations/public`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setAvailableLocations(data.data);
          else setError("Could not load service areas. Please try again.");
        })
        .catch(() => setError("Could not load service areas. Please try again."))
        .finally(() => setLocLoading(false));
    }
  }, [step, availableLocations.length]);

  const toggleSkill = (skill: string) =>
    setSelectedSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));

  const handleFileChange = (
    file: File | null,
    setter: (f: File | null) => void,
    previewSetter: (s: string | null) => void
  ) => {
    if (!file) {
      setter(null);
      previewSetter(null);
      return;
    }
    setter(file);
    const reader = new FileReader();
    reader.onloadend = () => previewSetter(reader.result as string);
    reader.readAsDataURL(file);
  };

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
    const digits = form.phone.replace(/\D/g, "").slice(-10);
    if (digits.length < 10) {
      setError("Mobile number must be 10 digits");
      return;
    }
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
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setStep("skills");
  };

  const handleSkillsNext = () => {
    if (selectedSkills.length === 0) {
      setError("Please select at least one skill");
      return;
    }
    if (!termsAccepted) {
      setError("Please accept the Terms of Service to continue");
      return;
    }
    setError("");
    setStep("documents");
  };

  const handleDocumentsNext = () => {
    if (!profilePic) {
      setError("Profile picture is required");
      return;
    }
    if (!aadhaarFront) {
      setError("Aadhaar front image is required");
      return;
    }
    setError("");
    setStep("location");
  };

  const registerAccount = async () => {
    if (!selectedLocationId) {
      setError("Please select a service area");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const digits = form.phone.replace(/\D/g, "").slice(-10);
      const formData = new FormData();
      formData.append("name", form.name.trim());
      formData.append("email", form.email.trim().toLowerCase());
      formData.append("password", form.password);
      formData.append("phone", "+91" + digits);
      formData.append("gender", form.gender || "prefer_not_to_say");
      formData.append("experience", form.experience || "0");
      formData.append("skills", JSON.stringify(selectedSkills));
      formData.append("phoneVerified", "false");
      formData.append("locationId", selectedLocationId);

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

  const stepLabels = ["Your details", "Skills", "Documents", "Service area"];
  const stepIdx = step === "form" ? 0 : step === "skills" ? 1 : step === "documents" ? 2 : 3;

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
            You will receive a notification once your account is approved. This usually takes 1–2 business days.
          </p>
          <Link to="/login" className="mt-6 inline-block btn-brand px-8">
            Back to Login
          </Link>
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
              Grow your income with
              <br />
              flexible hours
            </h1>
            <p className="text-primary-foreground/70 leading-relaxed mb-8">
              Join our network of trusted home service professionals.
            </p>
            <div className="space-y-3">
              {stepLabels.map((label, i) => (
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
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Join as a Worker</h2>
              <p className="text-muted-foreground mb-6">Create your free worker account</p>

              <form onSubmit={handleFormNext} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                  <input className="input-clean" placeholder="e.g. Ravi Kumar" value={form.name} onChange={set("name")} required />
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
                  <p className="text-xs text-muted-foreground mt-1">Required temporarily while OTP signup is disabled</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Gender <span className="text-muted-foreground font-normal">(opt.)</span>
                    </label>
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
                    <input type="number" className="input-clean" placeholder="0" min="0" max="50" value={form.experience} onChange={set("experience")} />
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

          {step === "skills" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Your skills</h2>
              <p className="text-muted-foreground mb-6">Select all services you can provide</p>

              <div className="grid grid-cols-2 gap-2 mb-5">
                {SKILLS.map((skill) => (
                  <label
                    key={skill}
                    className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${
                      selectedSkills.includes(skill) ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-accent"
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
                  I agree to the <span className="text-primary font-medium">Terms of Service</span> and{" "}
                  <span className="text-primary font-medium">Privacy Policy</span>
                </span>
              </label>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep("form");
                    setError("");
                  }}
                  className="flex-1 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors"
                >
                  Back
                </button>
                <button onClick={handleSkillsNext} className="btn-brand flex-1">
                  Continue
                </button>
              </div>
            </>
          )}

          {step === "documents" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Upload documents</h2>
              <p className="text-muted-foreground mb-2">Required for account verification</p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 mb-6">
                Your documents are securely stored and only reviewed by our admin team.
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Profile Photo <span className="text-destructive">*</span>
                  </label>
                  <label
                    className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:bg-accent ${
                      profilePicPreview ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
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

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Aadhaar Card - Front <span className="text-destructive">*</span>
                  </label>
                  <label
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:bg-accent ${
                      aadhaarFrontPreview ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
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

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Aadhaar Card - Back <span className="text-muted-foreground font-normal">(optional but recommended)</span>
                  </label>
                  <label
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:bg-accent ${
                      aadhaarBackPreview ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
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
                <button
                  onClick={() => {
                    setStep("skills");
                    setError("");
                  }}
                  className="flex-1 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors"
                >
                  Back
                </button>
                <button onClick={handleDocumentsNext} className="btn-brand flex-1">
                  Continue
                </button>
              </div>
            </>
          )}

          {step === "location" && (
            <>
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Your service area</h2>
              <p className="text-muted-foreground mb-6">Select the area where you will provide services.</p>
              <div className="space-y-4">
                {locLoading ? (
                  <div className="flex items-center justify-center py-8 gap-3 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Loading available areas...</span>
                  </div>
                ) : availableLocations.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                    No service areas are available right now. Please contact support.
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Select Service Area <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <select
                        className="input-clean pl-9"
                        value={selectedLocationId}
                        onChange={(e) => setSelectedLocationId(e.target.value)}
                      >
                        <option value="">-- Choose your area --</option>
                        {availableLocations.map((loc) => (
                          <option key={loc._id} value={loc._id}>
                            {loc.apartmentName} — {loc.area}, {loc.city}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                  Only areas where Healthy Homez operates are listed. Your admin can update your area after approval.
                </div>

                <button
                  onClick={registerAccount}
                  disabled={loading || !selectedLocationId || locLoading}
                  className="btn-brand w-full"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                  Submit Application
                </button>

                <button
                  onClick={() => {
                    setStep("documents");
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

export default WorkerSignUp;
