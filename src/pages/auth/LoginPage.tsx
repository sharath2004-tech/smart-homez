import { LanguageSelector } from "@/components/LanguageSelector";
import { authAPI, publicAPI } from "@/lib/api";
import { Eye, EyeOff, Home, Loader2, Shield } from "lucide-react";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    publicAPI.getStats().then((r) => { if (r.success) setStats(r.stats); }).catch(() => {});
  }, []);

  useEffect(() => {
    setForm({ email: "", password: "" });
    setError("");
  }, [tab]);

  const formatNumber = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + "K+" : n + "+");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError("Please enter email and password"); return; }
    setLoading(true);
    setError("");
    try {
      const response = await authAPI.login(form.email, form.password);
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));

      if (response.requirePasswordChange || response.user.isFirstLogin) {
        window.location.href = "/change-password";
        return;
      }

      const role = response.user.role;
      if (role === "super_admin") window.location.href = "/super-admin/dashboard";
      else if (role === "admin") window.location.href = "/admin/dashboard";
      else if (role === "worker") window.location.href = "/worker/dashboard";
      else window.location.href = "/customer/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please check your credentials.");
      setLoading(false);
    }
  };

  const tabs = [
    { key: "customer", label: "Customer", emoji: "🏠" },
    { key: "worker", label: "Worker", emoji: "🧹" },
    { key: "admin", label: "Admin", emoji: "⚙️" },
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

        <div className="w-full max-w-md animate-fade-in">
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
                  tab === t_.key
                    ? "bg-card text-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{t_.emoji}</span>
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
              className="btn-brand w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t("auth.login.signingIn")}</>
              ) : (
                t("auth.login.signIn")
              )}
            </button>
          </form>

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

