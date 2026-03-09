import { ArrowLeft, Check, Eye, EyeOff, Home, Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authAPI } from "../../lib/api";

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Invalid or missing reset token. Please request a new reset link.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await authAPI.resetPassword(token, newPassword);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password. The link may have expired.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <Home className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold font-heading text-foreground">Healthy Homez</span>
        </div>

        {done ? (
          <div className="text-center animate-scale-in">
            <div className="w-16 h-16 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold font-heading text-foreground mb-2">Password reset!</h2>
            <p className="text-muted-foreground mb-8">Your password has been changed successfully. You can now log in with your new password.</p>
            <button
              onClick={() => navigate("/login")}
              className="btn-brand w-full flex items-center justify-center gap-2"
            >
              Go to Login
            </button>
          </div>
        ) : (
          <>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
              <ArrowLeft className="w-4 h-4" /> Back to login
            </Link>
            <div className="w-14 h-14 bg-primary-light rounded-2xl flex items-center justify-center mb-6">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-2xl font-bold font-heading text-foreground mb-2">Set new password</h2>
            <p className="text-muted-foreground mb-8">
              Choose a strong password with at least 8 characters, one uppercase letter, one number and one special character.
            </p>
            {!token && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                Invalid or missing reset token. Please <Link to="/forgot-password" className="underline font-medium">request a new link</Link>.
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">New password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input-clean pr-10"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Confirm new password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-clean"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={isLoading || !token}
                className="btn-brand w-full flex items-center justify-center gap-2"
              >
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Resetting...</> : "Reset password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
