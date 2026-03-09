import { LanguageSelector } from "@/components/LanguageSelector";
import { authAPI, publicAPI } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";
import { ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { Eye, EyeOff, Home, Loader2, Phone, Shield } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

declare global {
  interface Window { recaptchaVerifier?: RecaptchaVerifier; }
}

const LoginPage = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"customer" | "worker" | "admin">("customer");

  // OTP flow state (customer & worker tabs)
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  // Admin email/password state
  const [showPassword, setShowPassword] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: "", password: "" });
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");

  const [stats, setStats] = useState({ totalCustomers: 0, totalWorkers: 0, servicesDone: 0 });

  useEffect(() => {
    publicAPI.getStats().then((r) => { if (r.success) setStats(r.stats); }).catch(() => {});
  }, []);

  // Reset OTP state when tab changes
  useEffect(() => {
    setStep("phone");
    setPhone("");
    setOtp("");
    setOtpError("");
    setConfirmationResult(null);
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = undefined;
    }
  }, [tab]);

  const formatNumber = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + "K+" : n + "+");

  const setupRecaptcha = () => {
    if (window.recaptchaVerifier) return window.recaptchaVerifier;
    const verifier = new RecaptchaVerifier(firebaseAuth, "recaptcha-container", {
      size: "invisible",
      callback: () => {},
    });
    window.recaptchaVerifier = verifier;
    return verifier;
  };

  const handleSendOTP = async () => {
    const cleaned = phone.trim().replace(/\s+/g, "");
    if (!cleaned) { setOtpError("Please enter your mobile number"); return; }

    // Ensure E.164 format
    const formatted = cleaned.startsWith("+") ? cleaned : `+91${cleaned}`;
    if (!/^\+\d{10,15}$/.test(formatted)) {
      setOtpError("Enter a valid mobile number (10 digits)");
      return;
    }

    try {
      setOtpLoading(true);
      setOtpError("");
      const verifier = setupRecaptcha();
      const result = await signInWithPhoneNumber(firebaseAuth, formatted, verifier);
      setConfirmationResult(result);
      setStep("otp");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("TOO_SHORT") || msg.includes("INVALID_PHONE_NUMBER")) {
        setOtpError("Invalid phone number. Include country code or use 10-digit Indian number.");
      } else if (msg.includes("TOO_MANY_REQUESTS")) {
        setOtpError("Too many attempts. Please wait a few minutes and try again.");
      } else if (msg.includes("not-initialized") || msg.includes("Firebase")) {
        setOtpError("Auth service not configured. Please contact support.");
      } else {
        setOtpError("Failed to send OTP. Please try again.");
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!confirmationResult) return;
    if (otp.length < 6) { setOtpError("Enter the 6-digit OTP"); return; }

    try {
      setOtpLoading(true);
      setOtpError("");
      const credential = await confirmationResult.confirm(otp);
      const idToken = await credential.user.getIdToken();

      const response = await authAPI.firebaseVerify(idToken, tab);
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));

      const role = response.user.role;
      if (role === "customer") window.location.href = "/customer/dashboard";
      else if (role === "worker") window.location.href = "/worker/dashboard";
      else window.location.href = "/";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("invalid-verification-code") || msg.includes("INVALID_CODE")) {
        setOtpError("Wrong OTP. Please check and try again.");
      } else if (msg.includes("expired") || msg.includes("session-expired")) {
        setOtpError("OTP has expired. Please request a new one.");
      } else {
        setOtpError(msg || "Verification failed. Please try again.");
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoading(true);
    setAdminError("");
    try {
      const response = await authAPI.login(adminForm.email, adminForm.password);
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));
      if (response.requirePasswordChange || response.user.isFirstLogin) {
        window.location.href = "/change-password";
        return;
      }
      const role = response.user.role;
      if (role === "super_admin") window.location.href = "/super-admin/dashboard";
      else if (role === "admin") window.location.href = "/admin/dashboard";
      else if (role === "customer") window.location.href = "/customer/dashboard";
      else if (role === "worker") window.location.href = "/worker/dashboard";
      else window.location.href = "/";
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Login failed.");
      setAdminLoading(false);
    }
  };

  const tabs = [
    { key: "customer", label: "Customer", emoji: "🏠" },
    { key: "worker", label: "Worker", emoji: "🧹" },
    { key: "admin", label: "Admin", emoji: "⚙️" },
  ] as const;

  const signupLink = tab === "customer" ? "/register/customer" : "/register/worker";

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-primary-foreground/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-48 h-48 rounded-full bg-primary-foreground/20 blur-2xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-foreground/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Home className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-heading">Smart Homez</span>
          </div>
          <div>
            <h1 className="text-4xl font-bold font-heading mb-4 leading-tight">
              {t("auth.login.yourHome")}<br />{t("auth.login.perfectlyClean")}
            </h1>
            <p className="text-primary-foreground/70 text-lg leading-relaxed">{t("auth.login.tagline")}</p>
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { label: t("auth.login.activeWorkers"), value: formatNumber(stats.totalWorkers) },
                { label: t("auth.login.happyCustomers"), value: formatNumber(stats.totalCustomers) },
                { label: t("auth.login.servicesDone"), value: formatNumber(stats.servicesDone) },
              ].map((s) => (
                <div key={s.label} className="bg-primary-foreground/10 rounded-xl p-4 backdrop-blur-sm">
                  <div className="text-2xl font-bold font-heading">{s.value}</div>
                  <div className="text-xs text-primary-foreground/60 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background relative">
        <div className="absolute top-6 right-6">
          <LanguageSelector />
        </div>

        {/* invisible recaptcha mount point */}
        <div id="recaptcha-container" ref={recaptchaContainerRef} />

        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Home className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold font-heading text-foreground">Smart Homez</span>
          </div>

          <h2 className="text-3xl font-bold font-heading text-foreground mb-1">{t("auth.login.title")}</h2>
          <p className="text-muted-foreground mb-8">{t("auth.login.subtitle")}</p>

          {/* Tab switcher */}
          <div className="flex gap-2 p-1 bg-muted rounded-xl mb-6">
            {tabs.map((t_) => (
              <button
                key={t_.key}
                onClick={() => setTab(t_.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  tab === t_.key ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{t_.emoji}</span>
                <span>{t_.label}</span>
              </button>
            ))}
          </div>

          {/* OTP login — Customer / Worker */}
          {tab !== "admin" && (
            <div className="space-y-4">
              {otpError && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                  {otpError}
                </div>
              )}

              {step === "phone" ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">
                        +91
                      </span>
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
                    <p className="text-xs text-muted-foreground mt-1">We'll send a 6-digit OTP to this number</p>
                  </div>
                  <button
                    onClick={handleSendOTP}
                    disabled={otpLoading}
                    className="btn-brand w-full flex items-center justify-center gap-2"
                  >
                    {otpLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...</>
                    ) : (
                      <><Phone className="w-4 h-4" /> Send OTP</>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
                    OTP sent to <strong>+91 {phone}</strong>{" "}
                    <button
                      className="underline text-primary ml-1"
                      onClick={() => { setStep("phone"); setOtp(""); setOtpError(""); }}
                    >
                      Change
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Enter OTP</label>
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
                  </div>
                  <button
                    onClick={handleVerifyOTP}
                    disabled={otpLoading || otp.length < 6}
                    className="btn-brand w-full flex items-center justify-center gap-2"
                  >
                    {otpLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                    ) : (
                      "Verify & Login"
                    )}
                  </button>
                  <button
                    className="w-full text-sm text-primary hover:underline"
                    onClick={() => { setStep("phone"); setOtp(""); setOtpError(""); }}
                  >
                    Resend OTP
                  </button>
                </>
              )}

              <p className="text-center text-sm text-muted-foreground pt-2">
                New here?{" "}
                <Link to={signupLink} className="text-primary font-semibold hover:underline">
                  Sign up for free
                </Link>
              </p>
            </div>
          )}

          {/* Admin email/password login */}
          {tab === "admin" && (
            <div>
              <div className="flex items-center gap-2 mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                <Shield className="w-4 h-4 shrink-0" />
                Admin & Super Admin login only
              </div>

              {adminError && (
                <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                  {adminError}
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t("auth.login.email")}</label>
                  <input
                    type="email"
                    className="input-clean"
                    placeholder={t("auth.login.emailPlaceholder")}
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-foreground">{t("auth.login.password")}</label>
                    <Link to="/forgot-password" className="text-sm text-primary hover:underline font-medium">
                      {t("auth.login.forgotPassword")}
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="input-clean pr-12"
                      placeholder={t("auth.login.passwordPlaceholder")}
                      value={adminForm.password}
                      onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                      required
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
                <button
                  type="submit"
                  disabled={adminLoading}
                  className="btn-brand w-full flex items-center justify-center gap-2 mt-2"
                >
                  {adminLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {t("auth.login.signingIn")}</>
                  ) : (
                    t("auth.login.signIn")
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;


const LoginPage = () => {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState<"customer" | "worker" | "admin">("customer");
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalWorkers: 0,
    servicesDone: 0,
    fulfillmentRate: 95
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await publicAPI.getStats();
        if (response.success) {
          setStats(response.stats);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    fetchStats();
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K+';
    }
    return num.toString() + '+';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await authAPI.login(form.email, form.password);
      
      // Store token and user
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      // Check if password change is required (first-time login)
      if (response.requirePasswordChange || response.user.isFirstLogin) {
        window.location.href = "/change-password";
        return;
      }
      
      // Redirect based on user role
      const role = response.user.role;
      if (role === 'customer') window.location.href = "/customer/dashboard";
      else if (role === 'worker') window.location.href = "/worker/dashboard";
      else if (role === 'super_admin') window.location.href = "/super-admin/dashboard";
      else if (role === 'admin') window.location.href = "/admin/dashboard";
      else window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
      setIsLoading(false);
    }
  };

  const userTypes = [
    { key: "customer", label: t('auth.login.customer'), emoji: "🏠" },
    { key: "worker", label: t('auth.login.worker'), emoji: "🧹" },
    { key: "admin", label: t('auth.login.admin'), emoji: "⚙️" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-primary-foreground/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-48 h-48 rounded-full bg-primary-foreground/20 blur-2xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-foreground/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Home className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-heading">Healthy Homez</span>
          </div>
          <div>
            <h1 className="text-4xl font-bold font-heading mb-4 leading-tight">
              {t('auth.login.yourHome')}<br />{t('auth.login.perfectlyClean')}
            </h1>
            <p className="text-primary-foreground/70 text-lg leading-relaxed">
              {t('auth.login.tagline')}
            </p>
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { label: t('auth.login.activeWorkers'), value: formatNumber(stats.totalWorkers) },
                { label: t('auth.login.happyCustomers'), value: formatNumber(stats.totalCustomers) },
                { label: t('auth.login.servicesDone'), value: formatNumber(stats.servicesDone) },
              ].map((stat) => (
                <div key={stat.label} className="bg-primary-foreground/10 rounded-xl p-4 backdrop-blur-sm">
                  <div className="text-2xl font-bold font-heading">{stat.value}</div>
                  <div className="text-xs text-primary-foreground/60 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background relative">
        {/* Language Selector - Top Right */}
        <div className="absolute top-6 right-6">
          <LanguageSelector />
        </div>
        
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Home className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold font-heading text-foreground">Healthy Homez</span>
          </div>

          <h2 className="text-3xl font-bold font-heading text-foreground mb-1">{t('auth.login.title')}</h2>
          <p className="text-muted-foreground mb-8">{t('auth.login.subtitle')}</p>

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
              {error}
            </div>
          )}

          {/* User Type Switcher */}
          <div className="flex gap-2 p-1 bg-muted rounded-xl mb-6">
            {userTypes.map((type) => (
              <button
                key={type.key}
                onClick={() => setUserType(type.key as typeof userType)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  userType === type.key
                    ? "bg-card text-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{type.emoji}</span>
                <span>{type.label}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.login.email')}</label>
              <input
                type="email"
                className="input-clean"
                placeholder={t('auth.login.emailPlaceholder')}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-foreground">{t('auth.login.password')}</label>
                <Link to="/forgot-password" className="text-sm text-primary hover:underline font-medium">
                  {t('auth.login.forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-clean pr-12"
                  placeholder={t('auth.login.passwordPlaceholder')}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
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

            <button
              type="submit"
              disabled={isLoading}
              className="btn-brand w-full flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('auth.login.signingIn')}
                </>
              ) : (
                t('auth.login.signIn')
              )}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t('auth.login.noAccount')}{" "}
            <Link to="/register" className="text-primary font-semibold hover:underline">
              {t('auth.login.signUpFree')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
