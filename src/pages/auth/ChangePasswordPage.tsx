import { authAPI } from "@/lib/api";
import { Check, Eye, EyeOff, Home, Loader2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

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

const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<{
    role: string;
    name?: string;
    isFirstLogin?: boolean;
    needsPasswordSetup?: boolean;
    hasCustomPassword?: boolean;
  } | null>(null);
  
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      
      const data = await authAPI.getProfile();
      const nextProfile = data.user || data;
      setProfile(nextProfile);
      localStorage.setItem('user', JSON.stringify({
        ...(JSON.parse(localStorage.getItem('user') || '{}')),
        ...nextProfile
      }));
    } catch (error) {
      console.error('Error fetching profile:', error);
      navigate('/login');
    }
  };

  const needsPasswordSetup = Boolean(profile?.needsPasswordSetup || profile?.isFirstLogin || profile?.hasCustomPassword === false);
  const pageTitle = needsPasswordSetup ? 'Add Password' : 'Change Your Password';
  const pageSubtitle = needsPasswordSetup
    ? 'Create a password for your account so you can use password login anytime.'
    : "Create a strong password that you'll remember";
  const submitLabel = needsPasswordSetup ? 'Add Password' : 'Change Password';
  const submitLoadingLabel = needsPasswordSetup ? 'Adding Password...' : 'Changing Password...';
  const successTitle = needsPasswordSetup ? 'Password Added!' : 'Password Changed!';
  const successMessage = needsPasswordSetup
    ? 'Your password has been added successfully. Redirecting to your dashboard...'
    : 'Your password has been updated successfully. Redirecting to your dashboard...';

  const redirectToDashboard = (role: string) => {
    if (role === 'worker') {
      navigate('/worker/dashboard');
    } else if (role === 'super_admin') {
      navigate('/super-admin/dashboard');
    } else if (role === 'admin') {
      navigate('/admin/dashboard');
    } else {
      navigate('/customer/dashboard');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate new password
    const passwordValidation = validatePassword(form.newPassword);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
      return;
    }

    // Check if passwords match
    if (form.newPassword !== form.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    // Check if new password is different from current
    if (!needsPasswordSetup && form.currentPassword === form.newPassword) {
      setError("New password must be different from current password");
      return;
    }

    setIsLoading(true);

    try {
      await authAPI.changePassword(needsPasswordSetup ? "" : form.currentPassword, form.newPassword);
      localStorage.setItem('user', JSON.stringify({
        ...(JSON.parse(localStorage.getItem('user') || '{}')),
        isFirstLogin: false,
        hasCustomPassword: true,
        needsPasswordSetup: false
      }));
      setSuccess(true);
      
      // Redirect after 2 seconds
      setTimeout(() => {
        redirectToDashboard(profile?.role || 'customer');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md animate-scale-in">
          <div className="w-20 h-20 bg-success-light rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-3xl font-bold font-heading text-foreground mb-3">{successTitle}</h2>
          <p className="text-muted-foreground mb-8">
            {successMessage}
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
              {needsPasswordSetup ? 'Add a Password' : 'Secure Your Account'}
            </h1>
            <p className="text-primary-foreground/70 leading-relaxed">
              {needsPasswordSetup
                ? 'Set a strong password for your account so you can sign in with email and password whenever you need.'
                : 'For your security, please change your temporary password to a new, strong password that only you know.'}
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background overflow-y-auto">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Home className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold font-heading text-foreground">Healthy Homez</span>
          </div>

          {needsPasswordSetup && (
          <div className="mb-6 p-4 bg-warning/10 border border-warning/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-warning mb-1">Add Password</h3>
                <p className="text-sm text-muted-foreground">
                  Your account needs a personal password. Add one now to secure your account and use password login later.
                </p>
              </div>
            </div>
          </div>
          )}

          <h2 className="text-2xl font-bold font-heading text-foreground mb-1">
            {pageTitle}
          </h2>
          <p className="text-muted-foreground mb-6">
            {pageSubtitle}
          </p>

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!needsPasswordSetup && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Current Password</label>
              <div className="relative">
                <input 
                  type={showCurrentPassword ? "text" : "password"} 
                  className="input-clean pr-12" 
                  placeholder="Enter your current password" 
                  value={form.currentPassword} 
                  onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} 
                  required 
                />
                <button 
                  type="button" 
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{needsPasswordSetup ? 'Password' : 'New Password'}</label>
              <div className="relative">
                <input 
                  type={showNewPassword ? "text" : "password"} 
                  className="input-clean pr-12" 
                  placeholder={needsPasswordSetup ? 'Create your password' : 'Create a strong password'} 
                  value={form.newPassword} 
                  onChange={(e) => setForm({ ...form, newPassword: e.target.value })} 
                  required 
                  minLength={8}
                />
                <button 
                  type="button" 
                  onClick={() => setShowNewPassword(!showNewPassword)} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Minimum 8 characters, including uppercase, lowercase, number, and special character
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{needsPasswordSetup ? 'Confirm Password' : 'Confirm New Password'}</label>
              <div className="relative">
                <input 
                  type={showConfirmPassword ? "text" : "password"} 
                  className="input-clean pr-12" 
                  placeholder={needsPasswordSetup ? 'Re-enter your password' : 'Re-enter your new password'} 
                  value={form.confirmPassword} 
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} 
                  required 
                  minLength={8}
                />
                <button 
                  type="button" 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading} 
              className="btn-brand w-full flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> {submitLoadingLabel}
                </>
              ) : (
                submitLabel
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
