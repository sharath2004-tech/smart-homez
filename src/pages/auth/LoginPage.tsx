import { LanguageSelector } from "@/components/LanguageSelector";
import { authAPI, publicAPI } from "@/lib/api";
import * as msg91Widget from "@/lib/msg91Widget";
import { Eye, EyeOff, Home, Loader2, Phone, RefreshCw, Shield } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";


const LoginPage = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"customer" | "worker" | "admin">("customer");
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ totalCustomers: 0, totalWorkers: 0, servicesDone: 0 });

  // OTP login state
  const [otpPhone, setOtpPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    publicAPI.getStats().then((r) => { if (r.success) setStats(r.stats); }).catch(() => {});
  }, []);

  useEffect(() => {
    setForm({ email: "", password: "" });
    setError("");
    setOtpPhone("");
    setOtpCode("");
    setOtpSent(false);
    setResendCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, [tab]);

  // Clean up interval on unmount
  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const formatNumber = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + "K+" : n + "+");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError("Please enter email and password"); return; }
    setLoading(true);
    setError("");
    try {
      const response = await authAPI.login(form.email, form.password);
      localStorage.removeItem("userLocation");
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));

      if (response.requirePasswordChange || response.user.isFirstLogin) {
        window.location.href = "/change-password";
        return;
      }

      const role = response.user.role;

      // Enforce tab-role match
      const allowedRoles: Record<string, string[]> = {
        customer: ["customer"],
        worker: ["worker"],
        admin: ["admin", "super_admin"],
      };
      if (!allowedRoles[tab].includes(role)) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        const label = tab === "admin" ? "Admin" : tab === "worker" ? "Worker" : "Customer";
        setError(`This account is not registered as a ${label}. Please select the correct role tab.`);
        setLoading(false);
        return;
      }

      if (role === "super_admin") window.location.href = "/super-admin/dashboard";
      else if (role === "admin") window.location.href = "/admin/dashboard";
      else if (role === "worker") window.location.href = "/worker/dashboard";
      else window.location.href = "/customer/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please check your credentials.");
      setLoading(false);
    }
  };

  const startResendCountdown = () => {
    setResendCountdown(30);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async () => {
    const digits = otpPhone.replace(/\D/g, "").slice(-10);
    if (digits.length < 10) { setError("Enter a valid 10-digit mobile number"); return; }
    setOtpLoading(true);
    setError("");
    try {
      await msg91Widget.sendOtp("91" + digits);
      setOtpSent(true);
      startResendCountdown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP. Please try again.");
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

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 6) { setError("Enter the 6-digit OTP"); return; }
    setOtpLoading(true);
    setError("");
    try {
      const widgetToken = await msg91Widget.verifyOtp(otpCode);
      const digits = otpPhone.replace(/\D/g, "").slice(-10);
      const response = await authAPI.verifyWidgetToken(widgetToken, digits, tab);
      localStorage.removeItem("userLocation");
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));
      const role = response.user.role;

      // New OTP user with incomplete profile → complete it first
      if (response.user.isProfileIncomplete) {
        window.location.href = "/complete-profile";
        return;
      }

      // Enforce tab-role match
      const allowedRoles: Record<string, string[]> = {
        customer: ["customer"],
        worker: ["worker"],
        admin: ["admin", "super_admin"],
      };
      if (!allowedRoles[tab].includes(role)) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        const label = tab === "admin" ? "Admin" : tab === "worker" ? "Worker" : "Customer";
        setError(`This account is not registered as a ${label}. Please select the correct role tab.`);
        setOtpLoading(false);
        return;
      }

      if (role === "super_admin") window.location.href = "/super-admin/dashboard";
      else if (role === "admin") window.location.href = "/admin/dashboard";
      else if (role === "worker") window.location.href = "/worker/dashboard";
      else window.location.href = "/customer/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.");
      setOtpLoading(false);
    }
  };

  const tabs = [
    { key: "customer", label: "Customer", icon: "👤" },
    { key: "worker", label: "Worker", icon: "🔧" },
    { key: "admin", label: "Admin", icon: "🛡️" },
  ] as const;

  const signupLink = tab === "customer" ? "/register/customer" : tab === "worker" ? "/register/worker" : null;

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
            <span className="text-xl font-bold font-heading">Healthy Homez</span>
          </div>
          <div>
            <h1 className="text-4xl font-bold font-heading mb-4 leading-tight">
              {t("auth.login.yourHome")}<br />{t("auth.login.perfectlyClean")}
            </h1>
            <p className="text-primary-foreground/70 text-lg leading-relaxed">{t("auth.login.tagline")}</p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Home className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold font-heading text-foreground">Healthy Homez</span>
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
                  tab === t_.key
                    ? "bg-card text-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{t_.icon}</span>
                <span>{t_.label}</span>
              </button>
            ))}
          </div>

          {tab === "admin" && (
            <div className="flex items-center gap-2 mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <Shield className="w-4 h-4 shrink-0" />
              Admin &amp; Super Admin access only
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
              {error}
            </div>
          )}

          {/* -- Admin Email / Password login form -- */}
          {tab === "admin" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {t("auth.login.email")}
                </label>
                <input
                  type="email"
                  className="input-clean"
                  placeholder={t("auth.login.emailPlaceholder")}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-foreground">
                    {t("auth.login.password")}
                  </label>
                  <Link to="/forgot-password" className="text-sm text-primary hover:underline font-medium">
                    {t("auth.login.forgotPassword")}
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input-clean pr-12"
                    placeholder={t("auth.login.passwordPlaceholder")}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    autoComplete="current-password"
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
                disabled={loading}
                className="btn-brand w-full flex items-center justify-center gap-2 mt-6"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t("auth.login.signingIn")}</>
                ) : (
                  t("auth.login.signIn")
                )}
              </button>
            </form>
          )}

          {/* -- Mobile OTP login form (Customer & Worker) -- */}
          {tab !== "admin" && (
            <div className="space-y-4">
              {!otpSent ? (
                <>
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
                        value={otpPhone}
                        onChange={(e) => setOtpPhone(e.target.value.replace(/\D/g, ""))}
                        onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
                        autoFocus
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">A 6-digit OTP will be sent via SMS</p>
                  </div>
                  <button
                    onClick={handleSendOTP}
                    disabled={otpLoading || otpPhone.replace(/\D/g, "").length < 10}
                    className="btn-brand w-full flex items-center justify-center gap-2"
                  >
                    {otpLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP&hellip;</>
                      : <><Phone className="w-4 h-4" /> Send OTP</>}
                  </button>
                </>
              ) : (
                <>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 flex items-start gap-2">
                    <Phone className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
                    <span>OTP sent to <strong>+91&nbsp;{otpPhone}</strong>. Check your SMS.</span>
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
                      : "Verify & Login"}
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
                </>
              )}
            </div>
          )}

          {signupLink && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              {t("auth.login.noAccount")}{" "}
              <Link to={signupLink} className="text-primary font-semibold hover:underline">
                {t("auth.login.signUpFree")}
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
