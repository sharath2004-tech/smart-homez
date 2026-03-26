import AppLayout from "@/components/AppLayout";
import { useAdminRole } from "@/hooks/useAdminRole";
import { settingsAPI } from "@/lib/api";
import { cropQRFromImage } from "@/utils/cropQRFromImage";
import { Building, CreditCard, FileText, IndianRupee, Lock, Save, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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

const AdminSettings = () => {
  const navigate = useNavigate();
  const { role, name, isSuperAdmin } = useAdminRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);
  const [settings, setSettings] = useState<Settings>(createDefaultSettings());

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getAdminSettings();
      setSettings(mergeSettingsWithDefaults(response.settings));
    } catch (error) {
      console.error('Error fetching settings:', error);
      alert('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleQRUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
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
        img.onerror = () => { alert('Image processing failed.'); setUploadingQR(false); };
        img.src = cropped;
      } catch {
        alert('Failed to process image.');
        setUploadingQR(false);
      }
    };
    reader.onerror = () => { alert('Failed to read file.'); setUploadingQR(false); };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await settingsAPI.updateSettings(settings);
      alert('Settings saved successfully!');
    } catch (error: unknown) {
      console.error('Error saving settings:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to save settings. Please try again.';
      alert(`Failed to save settings: ${errorMessage}`);
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
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Application Settings</h1>
          <p className="text-muted-foreground">Configure payment, company, booking{isSuperAdmin ? ', earnings, subscriptions, and cancellation policy' : ', and booking settings'}</p>
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
              {isSuperAdmin && (
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

          {/* Super Admin Only: Cancellation Policy */}
          {isSuperAdmin && (
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-amber-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-foreground">Cancellation Policy</h2>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Super Admin Only</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Refund windows and cancellation charges</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Full Refund Window (hours before booking)</label>
                  <input type="number" min="0" step="0.5"
                    value={settings.cancellationPolicy.fullRefundHours}
                    onChange={(e) => setSettings(prev => ({ ...prev, cancellationPolicy: { ...prev.cancellationPolicy, fullRefundHours: parseFloat(e.target.value) || 0 } }))}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Customer gets 100% refund if cancelled before this window</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Cancellation Charge (₹)</label>
                  <input type="number" min="0"
                    value={settings.cancellationPolicy.cancellationCharge}
                    onChange={(e) => setSettings(prev => ({ ...prev, cancellationPolicy: { ...prev.cancellationPolicy, cancellationCharge: parseFloat(e.target.value) || 0 } }))}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Flat fee charged if cancelled within full refund window</p>
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
          )}

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
