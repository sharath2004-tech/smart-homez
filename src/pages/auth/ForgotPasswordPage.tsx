import { ArrowLeft, Check, Home, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { authAPI } from "../../lib/api";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await authAPI.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email. Please try again.");
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

        {sent ? (
          <div className="text-center animate-scale-in">
            <div className="w-16 h-16 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold font-heading text-foreground mb-2">Check your email</h2>
            <p className="text-muted-foreground mb-2">We sent a password reset link to</p>
            <p className="font-semibold text-foreground mb-8">{email}</p>
            <p className="text-sm text-muted-foreground mb-6">
              Didn't receive the email?{" "}
              <button onClick={() => setSent(false)} className="text-primary font-medium hover:underline">
                Try again
              </button>
            </p>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to login
            </Link>
          </div>
        ) : (
          <>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
              <ArrowLeft className="w-4 h-4" /> Back to login
            </Link>
            <div className="w-14 h-14 bg-primary-light rounded-2xl flex items-center justify-center mb-6">
              <Mail className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-2xl font-bold font-heading text-foreground mb-2">Reset your password</h2>
            <p className="text-muted-foreground mb-8">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email address</label>
                <input
                  type="email"
                  className="input-clean"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={isLoading} className="btn-brand w-full flex items-center justify-center gap-2">
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : "Send reset link"}
              </button>
              {error && <p className="text-sm text-red-600 text-center mt-2">{error}</p>}
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
