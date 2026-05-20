import AppLayout from "@/components/AppLayout";
import { useAdminRole } from "@/hooks/useAdminRole";
import { settingsAPI } from "@/lib/api";
import { cropQRFromImage } from "@/utils/cropQRFromImage";
import { Building, CheckCircle, Clock, CreditCard, FileText, IndianRupee, Lock, Save, Upload, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Settings {
  payment: {
    upiId: string;
    upiName: string;
    qrCodeImage: string | null;
  };
  company: {
    name: string;
    phone: string;
    email: string;
    address: string;
    defaultState: string;
  };
  booking: {
    overtimeRate: number;
    cancellationHours: number;
    serviceRadius: number;
  };
  earnings: {
    platformCommissionRate: number;
    bookingConvenienceFee: number;
    minPayoutAmount: number;
    payoutSchedule: string;
    instantPayoutFee: number;
    payoutDay: number;
    autoPayoutEnabled: boolean;
  };
  subscriptions: {
    workerPlans: {
      basic: { price: number; commissionRate: number };
      pro: { price: number; commissionRate: number };
      premium: { price: number; commissionRate: number };
    };
    customerPlans: {
      basic: { price: number; discountRate: number };
      premium: { price: number; discountRate: number };
    };
  };
  cancellationPolicy: {
    freeCancellationMinutes: number;
    fullRefundHours: number;
    partialRefundPercentage: number;
    partialRefundHours: number;
    cancellationCharge: number;
    noRefundHours: number;
  };
}

const createDefaultSettings = (): Settings => ({
  payment: {
    upiId: 'healthyhomez@upi',
    upiName: 'Healthy Homez',
    qrCodeImage: null
  },
  company: {
    name: 'Healthy Homez',
    phone: '',
    email: '',
    address: '',
    defaultState: 'Maharashtra'
  },
  booking: {
    overtimeRate: 2.5,
    cancellationHours: 24,
    serviceRadius: 500
  },
  earnings: {
    platformCommissionRate: 0,
    bookingConvenienceFee: 0,
    minPayoutAmount: 500,
    payoutSchedule: 'weekly',
    instantPayoutFee: 0,
    payoutDay: 1,
    autoPayoutEnabled: false
  },
  subscriptions: {
    workerPlans: {
      basic: { price: 0, commissionRate: 0 },
      pro: { price: 0, commissionRate: 0 },
      premium: { price: 0, commissionRate: 0 }
    },
    customerPlans: {
      basic: { price: 0, discountRate: 0 },
      premium: { price: 0, discountRate: 0 }
    }
  },
  cancellationPolicy: {
    freeCancellationMinutes: 20,
    fullRefundHours: 1,
    partialRefundPercentage: 0,
    partialRefundHours: 0.5,
    cancellationCharge: 100,
    noRefundHours: 0
  }
});

const mergeSettingsWithDefaults = (incoming?: Partial<Settings> | null): Settings => {
  const defaults = createDefaultSettings();

  return {
    payment: { ...defaults.payment, ...(incoming?.payment || {}) },
    company: { ...defaults.company, ...(incoming?.company || {}) },
    booking: { ...defaults.booking, ...(incoming?.booking || {}) },
    earnings: { ...defaults.earnings, ...(incoming?.earnings || {}) },
    subscriptions: {
      workerPlans: {
        basic: {
          ...defaults.subscriptions.workerPlans.basic,
          ...(incoming?.subscriptions?.workerPlans?.basic || {})
        },
        pro: {
          ...defaults.subscriptions.workerPlans.pro,
          ...(incoming?.subscriptions?.workerPlans?.pro || {})
        },
        premium: {
          ...defaults.subscriptions.workerPlans.premium,
          ...(incoming?.subscriptions?.workerPlans?.premium || {})
        }
      },
      customerPlans: {
        basic: {
          ...defaults.subscriptions.customerPlans.basic,
          ...(incoming?.subscriptions?.customerPlans?.basic || {})
        },
        premium: {
          ...defaults.subscriptions.customerPlans.premium,
          ...(incoming?.subscriptions?.customerPlans?.premium || {})
        }
      }
    },
    cancellationPolicy: {
      ...defaults.cancellationPolicy,
      ...(incoming?.cancellationPolicy || {})
    }
  };
};

interface OvertimeRateRequest {
  _id: string;
  requestedRate: number;
  requestedByName: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNote: string;
  requestedAt: string;
  reviewedAt: string | null;
}

const AdminSettings = () => {
  const navigate = useNavigate();
  const { role, name, isSuperAdmin } = useAdminRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);
  const [settings, setSettings] = useState<Settings>(createDefaultSettings());
  // Overtime rate request state
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRateRequest[]>([]);
  const [requestedRate, setRequestedRate] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchOvertimeRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getAdminSettings();
      setSettings(mergeSettingsWithDefaults(response.settings));
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchOvertimeRequests = async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await settingsAPI.getOvertimeRateRequests();
      setOvertimeRequests(res.requests || []);
    } catch (error) {
      console.error('Failed to load overtime rate requests:', error);
    }
  };

  const handleSubmitOvertimeRequest = async () => {
    const rate = parseFloat(requestedRate);
    if (!requestedRate || isNaN(rate) || rate < 0) {
      toast.warning('Please enter a valid rate (0 or more)');
      return;
    }
    try {
      setSubmittingRequest(true);
      await settingsAPI.requestOvertimeRateChange(rate, requestReason.trim() || undefined);
      toast.success('Request submitted. Super admin will review it.');
      setRequestedRate('');
      setRequestReason('');
    } catch (error) {
      console.error('Failed to submit overtime rate request:', error);
      toast.error('Failed to submit request. Please try again.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleReviewRequest = async (requestId: string, approved: boolean, reviewNote?: string) => {
    try {
      setReviewingId(requestId);
      const res = await settingsAPI.reviewOvertimeRateRequest(requestId, approved, reviewNote);
      toast.success(approved ? `Approved. New overtime rate: ₹${res.currentRate}/min` : 'Request rejected.');
      // Refresh rate in settings
      setSettings(prev => ({ ...prev, booking: { ...prev.booking, overtimeRate: res.currentRate } }));
      fetchOvertimeRequests();
    } catch (error) {
      console.error('Failed to review request:', error);
      toast.error('Failed to process review. Please try again.');
    } finally {
      setReviewingId(null);
    }
  };

  const handleQRUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.warning('File size must be less than 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.warning('Please upload an image file');
      return;
    }

    setUploadingQR(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        // Step 1: detect & crop just the QR region
        const cropped = await cropQRFromImage(reader.result as string);

        // Step 2: lightly resize to 600×600 max for storage
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max = 600;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const finalBase64 = canvas.toDataURL('image/png');

          setSettings(prev => ({
            ...prev,
            payment: { ...prev.payment, qrCodeImage: finalBase64 }
          }));
          setUploadingQR(false);
        };
        img.onerror = () => { toast.error('Image processing failed.'); setUploadingQR(false); };
        img.src = cropped;
      } catch {
        toast.error('Failed to process image.');
        setUploadingQR(false);
      }
    };
    reader.onerror = () => { toast.error('Failed to read file.'); setUploadingQR(false); };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await settingsAPI.updateSettings(settings);
      toast.success('Settings saved successfully!');
    } catch (error: unknown) {
      console.error('Error saving settings:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to save settings. Please try again.';
      toast.error(`Failed to save settings: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout userType={role} userName={name}>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType={role} userName={name}>
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Application Settings</h1>
          <p className="text-muted-foreground">Configure payment, company, booking{isSuperAdmin ? ', earnings, subscriptions, and' : ' and'} cancellation policy settings</p>
        </div>

        <div className="grid gap-6">
          {/* Payment Settings */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Payment Settings</h2>
                <p className="text-sm text-muted-foreground">Configure UPI and QR code settings</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* UPI ID */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  UPI ID *
                </label>
                <input
                  type="text"
                  value={settings.payment.upiId}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    payment: { ...prev.payment, upiId: e.target.value }
                  }))}
                  placeholder="yourname@upi"
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* UPI Name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  UPI Name *
                </label>
                <input
                  type="text"
                  value={settings.payment.upiName}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    payment: { ...prev.payment, upiName: e.target.value }
                  }))}
                  placeholder="Company Name"
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* QR Code Upload — Super Admin only */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Static QR Code (Optional)
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  {isSuperAdmin
                    ? 'Upload a QR code image for workers to show customers. Workers will see this constant QR code.'
                    : 'The global payment QR is managed by Super Admin. Workers at your locations inherit it automatically.'}
                </p>

                {isSuperAdmin ? (
                  uploadingQR ? (
                    <div className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-primary rounded-xl bg-primary/5">
                      <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mb-3"></div>
                      <p className="text-sm text-foreground font-medium">Detecting QR code...</p>
                      <p className="text-xs text-muted-foreground mt-1">Cropping to QR region</p>
                    </div>
                  ) : settings.payment.qrCodeImage ? (
                    <div className="relative inline-block">
                      <img
                        src={settings.payment.qrCodeImage}
                        alt="Payment QR Code"
                        className="w-64 h-64 object-contain border-2 border-primary rounded-xl max-w-full"
                      />
                      <button
                        onClick={() => setSettings(prev => ({
                          ...prev,
                          payment: { ...prev.payment, qrCodeImage: null }
                        }))}
                        className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted transition-colors">
                      <Upload className="w-12 h-12 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload QR code</p>
                      <p className="text-xs text-muted-foreground mt-1">Max 2MB, JPG/PNG (will be compressed)</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleQRUpload}
                        className="hidden"
                      />
                    </label>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center w-full border-2 border-dashed border-border rounded-xl p-6 bg-muted/30">
                    {settings.payment.qrCodeImage ? (
                      <img
                        src={settings.payment.qrCodeImage}
                        alt="Payment QR Code"
                        className="w-48 h-48 object-contain mb-3"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mb-3">
                        <Lock className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground text-center">QR management is restricted to Super Admin</p>
                    <p className="text-xs text-muted-foreground text-center mt-1">New workers and admins automatically inherit this QR</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Company Settings */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Company Information</h2>
                <p className="text-sm text-muted-foreground">Business details and contact info</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={settings.company.name}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    company: { ...prev.company, name: e.target.value }
                  }))}
                  placeholder="Company Name"
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={settings.company.phone}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    company: { ...prev.company, phone: e.target.value }
                  }))}
                  placeholder="+91 XXXXXXXXXX"
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={settings.company.email}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    company: { ...prev.company, email: e.target.value }
                  }))}
                  placeholder="contact@company.com"
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Address
                </label>
                <input
                  type="text"
                  value={settings.company.address}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    company: { ...prev.company, address: e.target.value }
                  }))}
                  placeholder="Business Address"
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Default State
                  </label>
                  <input
                    type="text"
                    value={settings.company.defaultState}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      company: { ...prev.company, defaultState: e.target.value }
                    }))}
                    placeholder="e.g. Maharashtra"
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Default state used when creating new locations</p>
                </div>
              )}
            </div>
          </div>

          {/* Booking Settings */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Booking Settings</h2>
                <p className="text-sm text-muted-foreground">Configure booking policies</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Overtime Rate — super admin edits directly; admin submits a change request */}
              {isSuperAdmin ? (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Overtime Rate (₹ per minute)
                  </label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={settings.booking.overtimeRate}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        booking: { ...prev.booking, overtimeRate: parseFloat(e.target.value) || 0 }
                      }))}
                      className="w-full pl-10 pr-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Charge rate when service exceeds scheduled time
                  </p>
                </div>
              ) : (
                <div className="md:col-span-2">
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Overtime Rate</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Current: <span className="font-medium text-foreground">₹{settings.booking.overtimeRate}/min</span> — only Super Admin can approve changes</p>
                      </div>
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Requires Super Admin</span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Request new rate (₹/min)</label>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={requestedRate}
                            onChange={(e) => setRequestedRate(e.target.value)}
                            placeholder={String(settings.booking.overtimeRate)}
                            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Reason (optional)</label>
                        <input
                          type="text"
                          value={requestReason}
                          onChange={(e) => setRequestReason(e.target.value)}
                          placeholder="Briefly explain why"
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={submittingRequest || !requestedRate}
                      onClick={handleSubmitOvertimeRequest}
                      className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                    >
                      {submittingRequest ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <IndianRupee className="w-4 h-4" />}
                      Request Rate Change
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Cancellation Notice (hours)
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.booking.cancellationHours}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    booking: { ...prev.booking, cancellationHours: parseInt(e.target.value) || 0 }
                  }))}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum hours before booking to cancel
                </p>
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Service Radius (meters)
                  </label>
                  <input
                    type="number"
                    min="50"
                    step="50"
                    value={settings.booking.serviceRadius}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      booking: { ...prev.booking, serviceRadius: parseInt(e.target.value) || 500 }
                    }))}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Default walking distance radius for worker assignment</p>
                </div>
              )}
            </div>
          </div>

          {/* Super Admin Only: Overtime Rate Change Requests */}
          {isSuperAdmin && (
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-orange-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <IndianRupee className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-foreground">Overtime Rate Change Requests</h2>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Super Admin Only</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Review admin requests to change the overtime rate</p>
                </div>
              </div>

              {overtimeRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No overtime rate change requests yet.</p>
              ) : (
                <div className="space-y-3">
                  {overtimeRequests.map((req) => (
                    <div key={req._id} className={`rounded-xl border p-4 space-y-2 ${
                      req.status === 'pending' ? 'border-orange-200 bg-orange-50' :
                      req.status === 'approved' ? 'border-green-200 bg-green-50' :
                      'border-red-100 bg-red-50'
                    }`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-foreground">
                            {req.requestedByName || 'Admin'} → ₹{req.requestedRate}/min
                          </p>
                          {req.reason && (
                            <p className="text-xs text-muted-foreground">Reason: {req.reason}</p>
                          )}
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(req.requestedAt).toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {req.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                disabled={reviewingId === req._id}
                                onClick={() => {
                                  const note = window.prompt(`Approve rate change to ₹${req.requestedRate}/min?\n\nOptional note for admin:`);
                                  if (note !== null) handleReviewRequest(req._id, true, note || undefined);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button
                                type="button"
                                disabled={reviewingId === req._id}
                                onClick={() => {
                                  const note = window.prompt(`Reject this request?\n\nReason (optional):`);
                                  if (note !== null) handleReviewRequest(req._id, false, note || undefined);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </button>
                            </>
                          ) : (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {req.status === 'approved' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                              {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                            </span>
                          )}
                        </div>
                      </div>
                      {req.reviewNote && (
                        <p className="text-xs text-muted-foreground border-t border-border pt-2">Note: {req.reviewNote}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cancellation Policy — editable by admin and super_admin */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-amber-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">Cancellation Policy</h2>
                </div>
                <p className="text-sm text-muted-foreground">Refund windows and cancellation charges</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Free Cancellation Window (minutes before booking)</label>
                <input type="number" min="0" step="1"
                  value={settings.cancellationPolicy.freeCancellationMinutes}
                  onChange={(e) => setSettings(prev => ({ ...prev, cancellationPolicy: { ...prev.cancellationPolicy, freeCancellationMinutes: parseInt(e.target.value) || 0 } }))}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">Customer gets 100% refund if cancelled before this window (e.g. 20 = free if 20+ min before start)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Cancellation Charge (₹)</label>
                <input type="number" min="0"
                  value={settings.cancellationPolicy.cancellationCharge}
                  onChange={(e) => setSettings(prev => ({ ...prev, cancellationPolicy: { ...prev.cancellationPolicy, cancellationCharge: parseFloat(e.target.value) || 0 } }))}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">Flat fee charged if customer cancels within the free window</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Partial Refund Window (hours)</label>
                <input type="number" min="0" step="0.5"
                  value={settings.cancellationPolicy.partialRefundHours}
                  onChange={(e) => setSettings(prev => ({ ...prev, cancellationPolicy: { ...prev.cancellationPolicy, partialRefundHours: parseFloat(e.target.value) || 0 } }))}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Partial Refund Percentage (%)</label>
                <input type="number" min="0" max="100"
                  value={settings.cancellationPolicy.partialRefundPercentage}
                  onChange={(e) => setSettings(prev => ({ ...prev, cancellationPolicy: { ...prev.cancellationPolicy, partialRefundPercentage: parseFloat(e.target.value) || 0 } }))}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">No Refund Window (hours)</label>
                <input type="number" min="0" step="0.5"
                  value={settings.cancellationPolicy.noRefundHours}
                  onChange={(e) => setSettings(prev => ({ ...prev, cancellationPolicy: { ...prev.cancellationPolicy, noRefundHours: parseFloat(e.target.value) || 0 } }))}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">No refund if cancelled within this many hours of booking</p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => navigate('/admin')}
              className="btn-secondary px-6 py-3"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="btn-brand px-6 py-3 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      </AppLayout>
  );
};

export default AdminSettings;
