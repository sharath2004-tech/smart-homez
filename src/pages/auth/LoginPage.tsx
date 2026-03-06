import { LanguageSelector } from "@/components/LanguageSelector";
import { authAPI, publicAPI } from "@/lib/api";
import { Eye, EyeOff, Home, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const LoginPage = () => {
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
      
      // Store token
      localStorage.setItem('token', response.token);
      
      // Check if password change is required (first-time login)
      if (response.requirePasswordChange || response.user.isFirstLogin) {
        window.location.href = "/change-password";
        return;
      }
      
      // Redirect based on user role
      const role = response.user.role;
      if (role === 'customer') window.location.href = "/customer/dashboard";
      else if (role === 'worker') window.location.href = "/worker/dashboard";
      else if (role === 'admin' || role === 'super_admin') window.location.href = "/admin/dashboard";
      else window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
      setIsLoading(false);
    }
  };

  const userTypes = [
    { key: "customer", label: "Customer", emoji: "🏠" },
    { key: "worker", label: "Worker", emoji: "🧹" },
    { key: "admin", label: "Admin", emoji: "⚙️" },
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
              Your home,<br />perfectly clean.
            </h1>
            <p className="text-primary-foreground/70 text-lg leading-relaxed">
              On-demand home services connecting you with trusted professionals for cleaning, maintenance, and more.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { label: "Active Workers", value: formatNumber(stats.totalWorkers) },
                { label: "Happy Customers", value: formatNumber(stats.totalCustomers) },
                { label: "Services Done", value: formatNumber(stats.servicesDone) },
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

          <h2 className="text-3xl font-bold font-heading text-foreground mb-1">Welcome back</h2>
          <p className="text-muted-foreground mb-8">Sign in to your account</p>

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
              <label className="block text-sm font-medium text-foreground mb-1.5">Email address</label>
              <input
                type="email"
                className="input-clean"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-foreground">Password</label>
                <Link to="/forgot-password" className="text-sm text-primary hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-clean pr-12"
                  placeholder="Enter your password"
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
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary font-semibold hover:underline">
              Sign up for free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
