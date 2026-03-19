import { LanguageSelector } from "@/components/LanguageSelector";
import LocationSelector, { LocationData } from "@/components/LocationSelector";
import { authAPI } from "@/lib/api";
import { Check, Eye, EyeOff, Home, Loader2, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

// Password validation function
const validatePassword = (password: string): { valid: boolean; message: string } => {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, message: "Password must contain at least one special character (!@#$%^&*...)" };
  }
  return { valid: true, message: "" };
};

const RegisterPage = () => {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState<"customer" | "worker">("customer");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "", city: "",
    serviceArea: "", skills: "",
    gender: "",
    religion: "",
    experience: ""
  });

  const handleLocationConfirmed = (location: LocationData) => {
    if (!location.isAvailable) {
      setError("Sorry, we don't service your area yet. Please check back soon!");
      setShowLocationSelector(false);
      return;
    }
    setLocationData(location);
    setShowLocationSelector(false);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (step === 1) {
      // Validate password before moving to step 2
      const passwordValidation = validatePassword(form.password);
      if (!passwordValidation.valid) {
        setError(passwordValidation.message);
        return;
      }
      setStep(2);
      return;
    }

    // Check if location is set before final submission
    if (step === 2 && !locationData) {
      setError("Please set your location to check service availability");
      return;
    }

    setIsLoading(true);

    try {
      const name = `${form.firstName} ${form.lastName}`.trim();
      const userData = {
        name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        role: userType,
        gender: form.gender || undefined,
        religion: form.religion || undefined,
        workerProfile: userType === 'worker' ? {
          experience: parseInt(form.experience) || 0
        } : undefined,
        location: locationData ? {
          coordinates: [locationData.lng, locationData.lat],
          address: locationData.address,
          area: locationData.area,
          city: locationData.city,
          zipCode: locationData.zipCode,
          serviceAreaId: locationData.serviceAreaId
        } : undefined
      };

      const response = await authAPI.register(userData);
      
      // Store token and location for both customers and workers
      localStorage.setItem('token', response.token);
      if (locationData) {
        localStorage.setItem('userLocation', JSON.stringify(locationData));
      }
      
      setIsLoading(false);
      setStep(3);
    } catch (err) {
      setError((err as Error).message || 'Registration failed. Please try again.');
      setIsLoading(false);
    }
  };

  // Auto-redirect after registration success
  useEffect(() => {
    if (step === 3) {
      const timer = setTimeout(() => {
        if (userType === 'customer') {
          window.location.href = "/customer/dashboard";
        } else if (userType === 'worker') {
          window.location.href = "/worker/dashboard";
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step, userType]);

  if (step === 3) {

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md animate-scale-in">
          <div className="w-20 h-20 bg-success-light rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-3xl font-bold font-heading text-foreground mb-3">{t('auth.register.accountCreated')}</h2>
          <p className="text-muted-foreground mb-8">
            {userType === "customer"
              ? t('auth.register.welcomeCustomer')
              : t('auth.register.welcomeWorker')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-2/5 relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-foreground/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Home className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-heading">Healthy Homez</span>
          </Link>
          <div>
            <h1 className="text-3xl font-bold font-heading mb-4 leading-tight">
              Join thousands of {userType === "customer" ? "happy customers" : "skilled professionals"}
            </h1>
            <p className="text-primary-foreground/70 leading-relaxed">
              {userType === "customer"
                ? "Book trusted home services with just a few taps. Flexible scheduling, transparent pricing."
                : "Grow your income with flexible hours. Join our network of trusted home service professionals."}
            </p>
            {/* Step indicator */}
            <div className="mt-8 flex items-center gap-3">
              {[1, 2].map((s) => (
                <div key={s} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    step >= s ? "bg-primary-foreground text-primary" : "bg-primary-foreground/20 text-primary-foreground/60"
                  }`}>
                    {step > s ? <Check className="w-4 h-4" /> : s}
                  </div>
                  {s < 2 && <div className={`h-0.5 w-10 transition-all ${step > s ? "bg-primary-foreground" : "bg-primary-foreground/20"}`} />}
                </div>
              ))}
              <span className="text-primary-foreground/60 text-sm ml-2">Step {step} of 2</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background overflow-y-auto relative">
        {/* Language Selector - Top Right */}
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

          <h2 className="text-2xl font-bold font-heading text-foreground mb-1">{step === 1 ? t('auth.register.title') : t('auth.register.personalInfo')}</h2>
          <p className="text-muted-foreground mb-6">
            {step === 1 ? t('auth.register.subtitle') : t('auth.register.locationInfo')}
          </p>

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="flex gap-2 p-1 bg-muted rounded-xl mb-6">
              {[
                { key: "customer", label: t('auth.register.customer'), emoji: "🏠" },
                { key: "worker", label: t('auth.register.worker'), emoji: "🧹" },
              ].map((type) => (
                <button
                  key={type.key}
                  onClick={() => setUserType(type.key as "customer" | "worker")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                    userType === type.key ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{type.emoji}</span>
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.register.firstName')}</label>
                    <input className="input-clean" placeholder={t('auth.register.firstNamePlaceholder')} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.register.lastName')}</label>
                    <input className="input-clean" placeholder={t('auth.register.lastNamePlaceholder')} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.register.email')}</label>
                  <input 
                    type="email" 
                    className="input-clean" 
                    placeholder={t('auth.register.emailPlaceholder')} 
                    value={form.email} 
                    onChange={(e) => {
                      setForm({ ...form, email: e.target.value });
                      // Clear error when email is changed
                      if (error) setError("");
                    }} 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.register.phone')}</label>
                  <input type="tel" className="input-clean" placeholder={t('auth.register.phonePlaceholder')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.register.password')}</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} className="input-clean pr-12" placeholder={t('auth.register.passwordPlaceholder')} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.register.city')}</label>
                  <select className="input-clean" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required>
                    <option value="">{t('auth.register.cityPlaceholder')}</option>
                    {["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                
                {/* Location Selector */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.register.location')}</label>
                  {!locationData ? (
                    <button
                      type="button"
                      onClick={() => setShowLocationSelector(true)}
                      className="w-full py-3 px-4 border border-border rounded-xl hover:bg-accent transition-colors flex items-center justify-center gap-2 text-foreground"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>{t('auth.register.locationNotSet')}</span>
                    </button>
                  ) : (
                    <div className="p-4 bg-muted rounded-xl space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-primary mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {locationData.area}, {locationData.city}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {locationData.address}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowLocationSelector(true)}
                          className="text-xs text-primary hover:underline"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Gender field */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.register.gender')}</label>
                  <select className="input-clean" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} required>
                    <option value="">{t('auth.register.genderPlaceholder')}</option>
                    <option value="male">{t('auth.register.male')}</option>
                    <option value="female">{t('auth.register.female')}</option>
                    <option value="other">{t('auth.register.other')}</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>

                {/* Religion field (optional) */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.register.religion')}</label>
                  <input className="input-clean" placeholder={t('auth.register.religionPlaceholder')} value={form.religion} onChange={(e) => setForm({ ...form, religion: e.target.value })} />
                </div>

                {userType === "customer" ? (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Full address</label>
                    <textarea className="input-clean resize-none" rows={3} placeholder="Enter your home address" value={form.serviceArea} onChange={(e) => setForm({ ...form, serviceArea: e.target.value })} required />
                  </div>
                ) : (
                  <>
                    {/* Worker Experience */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.register.experience')}</label>
                      <input 
                        type="number" 
                        className="input-clean" 
                        placeholder={t('auth.register.experiencePlaceholder')} 
                        value={form.experience} 
                        onChange={(e) => setForm({ ...form, experience: e.target.value })} 
                        required 
                        min="0"
                        max="50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Service area / locality</label>
                      <input className="input-clean" placeholder="e.g. Bandra, Andheri" value={form.serviceArea} onChange={(e) => setForm({ ...form, serviceArea: e.target.value })} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-3">Skills & services</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {["General Cleaning", "Deep Cleaning", "Kitchen Cleaning", "Bathroom Cleaning", "Laundry", "Cooking"].map((skill) => (
                          <label key={skill} className="flex items-center gap-2 p-2.5 border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors">
                            <input type="checkbox" className="accent-primary w-4 h-4" />
                            <span className="text-sm text-foreground">{skill}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <div className="flex items-start gap-3 p-3 bg-muted rounded-xl">
                  <input type="checkbox" className="accent-primary w-4 h-4 mt-0.5" required />
                  <p className="text-sm text-muted-foreground">
                    I agree to the{" "}
                    <span className="text-primary cursor-pointer hover:underline font-medium">Terms of Service</span>{" "}
                    and{" "}
                    <span className="text-primary cursor-pointer hover:underline font-medium">Privacy Policy</span>
                  </p>
                </div>
              </>
            )}

            <div className="flex gap-3">
              {step === 2 && (
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors">
                  {t('auth.register.backStep')}
                </button>
              )}
              <button type="submit" disabled={isLoading} className="btn-brand flex-1 flex items-center justify-center gap-2">
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('auth.register.creating')}</> : step === 1 ? t('auth.register.nextStep') : t('auth.register.createAccount')}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t('auth.register.haveAccount')}{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">{t('auth.register.signIn')}</Link>
          </p>
        </div>
      </div>

      {/* Location Selector Modal */}
      {showLocationSelector && (
        <LocationSelector
          onLocationConfirmed={handleLocationConfirmed}
          onClose={() => setShowLocationSelector(false)}
          showCloseButton={true}
        />
      )}
    </div>
  );
};

export default RegisterPage;
