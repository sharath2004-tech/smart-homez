import { API_BASE_URL, bookingsAPI, settingsAPI } from "@/lib/api";
import { CheckCircle2, Copy, ExternalLink, Loader2, QrCode, Smartphone, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface SubscriptionPaymentStepProps {
  bookingId: string;
  amount: number;
  title?: string;
  description?: string;
  onPaymentSubmitted?: () => void;
  successLabel?: string;
  amountLabel?: string;
}

interface PaymentSettings {
  upiId?: string;
  upiName?: string;
  qrCodeImage?: string | null;
}

const buildUpiLink = ({ upiId, upiName, amount, bookingId }: { upiId?: string; upiName?: string; amount: number; bookingId: string }) => {
  if (!upiId) return "";

  const params = new URLSearchParams({
    pa: upiId,
    pn: upiName || "Healthy Homez",
    am: String(amount),
    cu: "INR",
    tn: `Subscription ${bookingId.slice(-6).toUpperCase()}`,
  });

  return `upi://pay?${params.toString()}`;
};

export default function SubscriptionPaymentStep({
  bookingId,
  amount,
  title = "Complete subscription payment",
  description = "Pay using the company UPI ID or QR code, then upload your payment screenshot. Admin or super admin will review the plan and assign the worker before activation.",
  onPaymentSubmitted,
  successLabel = "Payment proof uploaded. Waiting for admin approval",
  amountLabel = "Subscription amount",
}: SubscriptionPaymentStepProps) {
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [transactionId, setTransactionId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadPaymentSettings = async () => {
      try {
        setLoadingSettings(true);
        const response = await settingsAPI.getSettings();
        if (!mounted) return;
        setPaymentSettings(response.settings?.payment || {});
      } catch (error) {
        console.error("Failed to load payment settings", error);
        if (mounted) {
          toast.error(error instanceof Error ? error.message : "Failed to load payment details");
        }
      } finally {
        if (mounted) {
          setLoadingSettings(false);
        }
      }
    };

    loadPaymentSettings();

    return () => {
      mounted = false;
    };
  }, []);

  const upiLink = useMemo(() => buildUpiLink({
    upiId: paymentSettings?.upiId,
    upiName: paymentSettings?.upiName,
    amount,
    bookingId,
  }), [amount, bookingId, paymentSettings?.upiId, paymentSettings?.upiName]);

  const handleCopyUpi = async () => {
    if (!paymentSettings?.upiId) return;

    try {
      await navigator.clipboard.writeText(paymentSettings.upiId);
      toast.success("UPI ID copied");
    } catch (error) {
      console.error("Failed to copy UPI ID", error);
      toast.error("Failed to copy UPI ID");
    }
  };

  const handleUploadProof = async () => {
    if (!selectedFile) {
      toast.error("Please select the payment screenshot");
      return;
    }

    try {
      setUploading(true);
      await bookingsAPI.uploadPaymentProof(
        bookingId,
        selectedFile,
        transactionId.trim() || undefined,
        new Date().toISOString(),
      );
      setSubmitted(true);
      toast.success(successLabel);
      onPaymentSubmitted?.();
    } catch (error) {
      console.error("Failed to upload subscription payment proof", error);
      const message = error instanceof Error ? error.message : "Failed to upload payment proof";

      if (message.toLowerCase().includes("already prepaid")) {
        setSubmitted(true);
        toast.success("This subscription is already prepaid. No additional payment proof is needed.");
        onPaymentSubmitted?.();
        return;
      }

      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const qrImageSource = useMemo(() => {
    if (!paymentSettings?.qrCodeImage) return "";
    if (paymentSettings.qrCodeImage.startsWith("data:") || paymentSettings.qrCodeImage.startsWith("http")) {
      return paymentSettings.qrCodeImage;
    }
    return `${API_BASE_URL.replace("/api", "")}${paymentSettings.qrCodeImage}`;
  }, [paymentSettings?.qrCodeImage]);

  return (
    <div className="rounded-2xl border border-primary/20 bg-card p-5 shadow-sm space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{amountLabel}</p>
          <p className="text-2xl font-bold text-primary">₹{amount.toLocaleString("en-IN")}</p>
        </div>
        <div className="text-xs text-muted-foreground">
          Booking ID: <span className="font-mono text-foreground">{bookingId.slice(-8).toUpperCase()}</span>
        </div>
      </div>

      {loadingSettings ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-8 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading payment details...
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-border p-4 space-y-4">
            <div className="flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Direct UPI payment</p>
                <p className="text-xs text-muted-foreground mt-1">Open any UPI app and complete the payment directly to the company account.</p>
              </div>
            </div>

            <div className="rounded-xl bg-muted/40 p-3 space-y-1">
              <p className="text-xs text-muted-foreground">UPI ID</p>
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-sm font-semibold text-foreground break-all">{paymentSettings?.upiId || "Not configured"}</p>
                {paymentSettings?.upiId && (
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="shrink-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <span className="inline-flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> Copy</span>
                  </button>
                )}
              </div>
              {paymentSettings?.upiName && (
                <p className="text-xs text-muted-foreground">Payee: {paymentSettings.upiName}</p>
              )}
            </div>

            {upiLink && (
              <a
                href={upiLink}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95"
              >
                <ExternalLink className="w-4 h-4" /> Open UPI App
              </a>
            )}
          </div>

          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <QrCode className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">PhonePe / QR payment</p>
                <p className="text-xs text-muted-foreground mt-1">Scan this QR code from PhonePe, GPay, Paytm, or any UPI app.</p>
              </div>
            </div>

            {qrImageSource ? (
              <div className="rounded-xl border border-border bg-white p-3 flex items-center justify-center min-h-[220px]">
                <img src={qrImageSource} alt="Subscription payment QR" className="max-h-52 w-auto object-contain" />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-xs text-muted-foreground min-h-[220px] flex items-center justify-center">
                QR image is not configured yet. You can still pay using the UPI ID shown here.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border p-4 space-y-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Upload payment screenshot</p>
          <p className="text-xs text-muted-foreground mt-1">After you complete the payment, upload the screenshot so admin can track the subscription payment from the booking itself.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Transaction ID (optional)</label>
            <input
              value={transactionId}
              onChange={(event) => setTransactionId(event.target.value)}
              placeholder="Enter UPI reference / transaction ID"
              className="input-clean text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Payment screenshot</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              className="block w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
            />
          </div>
        </div>

        {selectedFile && (
          <p className="text-xs text-muted-foreground">Selected file: <span className="font-medium text-foreground">{selectedFile.name}</span></p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleUploadProof}
            disabled={uploading || submitted}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {submitted ? "Proof uploaded" : "Upload payment proof"}
          </button>

          {submitted && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="w-4 h-4" /> {successLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
