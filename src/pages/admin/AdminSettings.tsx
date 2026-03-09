import { settingsAPI } from "@/lib/api";
import { cropQRFromImage } from "@/utils/cropQRFromImage";
import { Building, CreditCard, DollarSign, FileText, Save, Upload } from "lucide-react";
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
  };
  booking: {
    overtimeRate: number;
    cancellationHours: number;
  };
}

const AdminSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    payment: {
      upiId: 'healthyhomez@upi',
      upiName: 'Healthy Homez',
      qrCodeImage: null
    },
    company: {
      name: 'Healthy Homez',
      phone: '',
      email: '',
      address: ''
    },
    booking: {
      overtimeRate: 2.5,
      cancellationHours: 24
    }
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getAdminSettings();
      setSettings(response.settings);
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="text-primary hover:text-primary/80 mb-4 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-foreground mb-2">Application Settings</h1>
          <p className="text-muted-foreground">Configure payment, company, and booking settings</p>
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

              {/* QR Code Upload */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Static QR Code (Optional)
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  Upload a QR code image for workers to show customers. Workers will see this constant QR code.
                </p>
                
                {uploadingQR ? (
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
                      className="w-64 h-64 object-contain border-2 border-primary rounded-xl"
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
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Overtime Rate (₹ per minute)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
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
    </div>
  );
};

export default AdminSettings;
