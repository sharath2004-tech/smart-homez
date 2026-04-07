import { ArrowLeft, Check, Home, Loader2, Mail, Phone } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { authAPI } from "../../lib/api";
import * as msg91Widget from "../../lib/msg91Widget";

type Tab = "email" | "phone";
type EmailStep = "sendOtp" | "resetPassword";
type PhoneStep = "sendOtp" | "resetPassword";

const ForgotPasswordPage = () => {
  const [tab, setTab] = useState<Tab>("email");

  // Email OTP flow
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailNewPassword, setEmailNewPassword] = useState("");
  const [emailConfirmPassword, setEmailConfirmPassword] = useState("");
  const [emailStep, setEmailStep] = useState<EmailStep>("sendOtp");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState("");

  // Phone flow
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("sendOtp");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneSuccess, setPhoneSuccess] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  const handleSendEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLoading(true);
    setEmailError("");
    try {
      await authAPI.forgotPasswordEmailOtp(email);
      setEmailStep("resetPassword");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to send OTP. Please try again.");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleResetWithEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    if (!/^\d{6}$/.test(emailOtp)) {
      setEmailError("Please enter the 6-digit OTP sent to your email.");
      return;
    }
    if (emailNewPassword.length < 8) {
      setEmailError("Password must be at least 8 characters.");
      return;
    }
    if (emailNewPassword !== emailConfirmPassword) {
      setEmailError("Passwords do not match.");
      return;
    }
    setEmailLoading(true);
    try {
      await authAPI.resetPasswordEmailOtp(email, emailOtp, emailNewPassword);
      setEmailSuccess(true);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to reset password. Please check the OTP and try again.");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");
    if (!/^\d{10}$/.test(phone)) {
      setPhoneError("Please enter a valid 10-digit phone number.");
      return;
    }
    setPhoneLoading(true);
    try {
      await msg91Widget.sendOtp("91" + phone);
      setPhoneStep("resetPassword");
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : "Failed to send OTP. Please try again.");
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleResetWithOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");
    if (newPassword.length < 8) {
      setPhoneError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPhoneError("Passwords do not match.");
      return;
    }
    setPhoneLoading(true);
    try {
      const widgetToken = await msg91Widget.verifyOtp(otp);
      await authAPI.resetPasswordWidget(widgetToken, phone, newPassword);
      setPhoneSuccess(true);
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : "Failed to reset password. Please check the OTP and try again.");
    } finally {
      setPhoneLoading(false);
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

        {/* Email success state */}
        {tab === "email" && emailSuccess ? (
          <div className="text-center animate-scale-in">
            <div className="w-16 h-16 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold font-heading text-foreground mb-2">Password Reset!</h2>
            <p className="text-muted-foreground mb-8">Your password has been successfully reset. You can now log in with your new password.</p>
            <Link to="/login" className="btn-brand inline-flex items-center gap-2">
              Back to login
            </Link>
          </div>
        ) : tab === "phone" && phoneSuccess ? (
          /* Phone success state */
          <div className="text-center animate-scale-in">
            <div className="w-16 h-16 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold font-heading text-foreground mb-2">Password Reset!</h2>
            <p className="text-muted-foreground mb-8">Your password has been successfully reset. You can now log in with your new password.</p>
            <Link to="/login" className="btn-brand inline-flex items-center gap-2">
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
              <ArrowLeft className="w-4 h-4" /> Back to login
            </Link>

            <h2 className="text-2xl font-bold font-heading text-foreground mb-2">Reset your password</h2>
            <p className="text-muted-foreground mb-6">
              Choose how you'd like to reset your password.
            </p>

            {/* Tabs */}
            <div className="flex rounded-xl border border-border overflow-hidden mb-6">
              <button
                type="button"
                onClick={() => { setTab("email"); setEmailError(""); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                  tab === "email" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <Mail className="w-4 h-4" /> Email OTP
              </button>
              <button
                type="button"
                onClick={() => { setTab("phone"); setPhoneError(""); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                  tab === "phone" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <Phone className="w-4 h-4" /> Phone OTP
              </button>
            </div>

            {/* Email OTP form */}
            {tab === "email" && (
              <>
                {emailStep === "sendOtp" ? (
                  <form onSubmit={handleSendEmailOtp} className="space-y-4">
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
                    <button type="submit" disabled={emailLoading} className="btn-brand w-full flex items-center justify-center gap-2">
                      {emailLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...</> : "Send OTP"}
                    </button>
                    {emailError && <p className="text-sm text-red-600 text-center mt-2">{emailError}</p>}
                  </form>
                ) : (
                  <form onSubmit={handleResetWithEmailOtp} className="space-y-4">
                    <p className="text-sm text-muted-foreground">OTP sent to <span className="font-semibold text-foreground">{email}</span>.{" "}
                      <button type="button" onClick={() => { setEmailStep("sendOtp"); setEmailOtp(""); setEmailError(""); }} className="text-primary hover:underline">
                        Change email
                      </button>
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">OTP</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="input-clean tracking-widest text-center text-lg"
                        placeholder="------"
                        value={emailOtp}
                        onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                        maxLength={6}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">New password</label>
                      <input
                        type="password"
                        className="input-clean"
                        placeholder="Min 8 characters"
                        value={emailNewPassword}
                        onChange={(e) => setEmailNewPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Confirm new password</label>
                      <input
                        type="password"
                        className="input-clean"
                        placeholder="Repeat new password"
                        value={emailConfirmPassword}
                        onChange={(e) => setEmailConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" disabled={emailLoading} className="btn-brand w-full flex items-center justify-center gap-2">
                      {emailLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Resetting...</> : "Reset password"}
                    </button>
                    {emailError && <p className="text-sm text-red-600 text-center mt-2">{emailError}</p>}
                  </form>
                )}
              </>
            )}

            {/* Phone form */}
            {tab === "phone" && (
              <>
                {phoneStep === "sendOtp" ? (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Phone number</label>
                      <div className="flex gap-2">
                        <span className="input-clean w-14 text-center text-muted-foreground select-none pointer-events-none">+91</span>
                        <input
                          type="tel"
                          className="input-clean flex-1"
                          placeholder="10-digit mobile number"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          required
                          maxLength={10}
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={phoneLoading} className="btn-brand w-full flex items-center justify-center gap-2">
                      {phoneLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...</> : "Send OTP"}
                    </button>
                    {phoneError && <p className="text-sm text-red-600 text-center mt-2">{phoneError}</p>}
                  </form>
                ) : (
                  <form onSubmit={handleResetWithOtp} className="space-y-4">
                    <p className="text-sm text-muted-foreground">OTP sent to <span className="font-semibold text-foreground">+91 {phone}</span>.{" "}
                      <button type="button" onClick={() => { setPhoneStep("sendOtp"); setOtp(""); setPhoneError(""); }} className="text-primary hover:underline">
                        Change number
                      </button>
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">OTP</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="input-clean tracking-widest text-center text-lg"
                        placeholder="------"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                        maxLength={6}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">New password</label>
                      <input
                        type="password"
                        className="input-clean"
                        placeholder="Min 8 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Confirm new password</label>
                      <input
                        type="password"
                        className="input-clean"
                        placeholder="Repeat new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" disabled={phoneLoading} className="btn-brand w-full flex items-center justify-center gap-2">
                      {phoneLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Resetting...</> : "Reset password"}
                    </button>
                    {phoneError && <p className="text-sm text-red-600 text-center mt-2">{phoneError}</p>}
                  </form>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
