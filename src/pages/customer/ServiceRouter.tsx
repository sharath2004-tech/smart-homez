import { servicesAPI } from "@/lib/api";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BookServicePage from "./BookServicePage"; // Fallback for other services
import ACServicingPage from "./services/ACServicingPage";
import CleaningServicePage from "./services/CleaningServicePage";
import MaidServicePage from "./services/MaidServicePage";
import MiniCleanServicePage from "./services/MiniCleanServicePage";
import PlumbingServicePage from "./services/PlumbingServicePage";

const MINI_SERVICE_TYPES = new Set([
  'deep_cleaning_kitchen',
  'deep_cleaning_bathroom',
  'fixed_sofa_cleaning',
  'fixed_carpet_cleaning',
  'fixed_window_cleaning',
  'fixed_fan_cleaning',
  'fixed_balcony_cleaning',
  'fixed_fridge_cleaning',
  'fixed_microwave_cleaning',
  'fixed_oven_cleaning',
  'fixed_stove_cleaning',
  'fixed_chimney_cleaning',
  'fixed_kitchen_platform_cleaning',
  'fixed_sink_cleaning',
  'kitchen_appliances_package',
  'fixed_washbasin_cleaning',
  'fixed_window_mesh_cleaning',
  'fixed_washroom_basic',
  'fixed_washroom_deep',
  'fixed_dining_cleaning',
  'fixed_cabinet_cleaning',
  'fixed_utility_cleaning',
  'fixed_cupboard_cleaning',
  'bedroom_package',
  'fixed_bed_cleaning',
  'fixed_mirror_cleaning',
  'fixed_ac_indoor_cleaning',
  'fixed_ac_outdoor_cleaning',
  'fixed_door_cleaning',
]);

const ServiceRouter = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [serviceType, setServiceType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Phone verification gate
  const [isPhoneVerified, setIsPhoneVerified] = useState<boolean | null>(null);
  const [phoneVerifyNumber, setPhoneVerifyNumber] = useState('');
  const [phoneVerifyOtp, setPhoneVerifyOtp] = useState('');
  const [phoneVerifyOtpSent, setPhoneVerifyOtpSent] = useState(false);
  const [phoneVerifyLoading, setPhoneVerifyLoading] = useState(false);
  const [phoneVerifyError, setPhoneVerifyError] = useState('');
  const [phoneVerifyResendCountdown, setPhoneVerifyResendCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startResendCountdown = () => {
    setPhoneVerifyResendCountdown(30);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setPhoneVerifyResendCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current!); countdownRef.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const handleSendPhoneOtp = async () => {
    const digits = phoneVerifyNumber.replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) { setPhoneVerifyError('Enter a valid 10-digit mobile number'); return; }
    setPhoneVerifyLoading(true); setPhoneVerifyError('');
    try {
      await msg91Widget.sendOtp('91' + digits);
      setPhoneVerifyOtpSent(true);
      startResendCountdown();
    } catch (err) {
      setPhoneVerifyError(err instanceof Error ? err.message : 'Failed to send OTP. Try again.');
    } finally { setPhoneVerifyLoading(false); }
  };

  const handleVerifyPhoneOtp = async () => {
    if (phoneVerifyOtp.length !== 6) { setPhoneVerifyError('Enter the 6-digit OTP'); return; }
    setPhoneVerifyLoading(true); setPhoneVerifyError('');
    try {
      const token = await msg91Widget.verifyOtp(phoneVerifyOtp);
      await authAPI.confirmPhoneWidgetToken(token);
      setIsPhoneVerified(true);
      toast.success('Phone verified! You can now view and book this service.');
    } catch (err) {
      setPhoneVerifyError(err instanceof Error ? err.message : 'Verification failed. Try again.');
    } finally { setPhoneVerifyLoading(false); }
  };

  useEffect(() => {
    const fetchServiceType = async () => {
      try {
        const [response, profileData] = await Promise.all([
          servicesAPI.getById(id!),
          authAPI.getProfile(),
        ]);
        const userProfile = profileData.user || profileData;
        setIsPhoneVerified(userProfile.isPhoneVerified === true);
        setPhoneVerifyNumber(userProfile.phone?.replace(/\D/g, '').slice(-10) || '');
        const service = response.service;
        const serviceName = service.name.toLowerCase();
        const serviceTags = service.tags || [];
        const serviceTypeValue = service.serviceType || '';
        const serviceCategory = service.serviceCategory || '';

        // Quote services → deep cleaning custom builder
        if (service.isQuoteService) {
          navigate('/customer/deep-cleaning/customize', { replace: true });
          return;
        }

        // Subscription services → subscription booking page
        if (service.subscriptionOptions?.enabled) {
          navigate(`/customer/subscribe/${id}`, { replace: true });
          return;
        }

        // Priority 1: Check for maid services (time-based)
        if (serviceName.includes('maid') ||
            serviceName.includes('insta maid') ||
            serviceTags.includes('maid') ||
            serviceTags.includes('hourly') ||
            serviceTypeValue === 'instant_hourly' ||
            serviceName.includes('instant') ||
            serviceName.includes('ad hoc')) {
          setServiceType('maid');
        }
        // Priority 2: Mini / spot-clean services (individual add-on services)
        else if (
          serviceTags.includes('mini-service') ||
          serviceTags.includes('spot-clean') ||
          MINI_SERVICE_TYPES.has(serviceTypeValue) ||
          ['spot_cleaning', 'kitchen_services', 'bathroom_services', 'furniture_services', 'hvac_services'].includes(serviceCategory)
        ) {
          setServiceType('mini');
        }
        // Priority 3: Check for other cleaning services
        else if (serviceName.includes('clean')) {
          setServiceType('cleaning');
        } else if (serviceName.includes('ac') || serviceName.includes('air condition')) {
          setServiceType('ac');
        } else if (serviceName.includes('plumb')) {
          setServiceType('plumbing');
        } else if (serviceName.includes('electric')) {
          setServiceType('electrical');
        } else if (serviceName.includes('paint')) {
          setServiceType('painting');
        } else if (serviceName.includes('pest')) {
          setServiceType('pest');
        } else {
          // Fallback to generic booking page
          setServiceType('generic');
        }
      } catch (error) {
        console.error('Error fetching service:', error);
        navigate('/customer/services');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchServiceType();
    }
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading service...</p>
        </div>
      </div>
    );
  }

  // Phone verification gate — must verify before viewing service details
  if (!isPhoneVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm bg-card rounded-2xl shadow-card p-8 animate-fade-in">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 mx-auto">
            <Phone className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold font-heading text-foreground text-center mb-2">Verify your mobile number</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Please verify your mobile number to view service details and make bookings.
          </p>

          {phoneVerifyError && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
              {phoneVerifyError}
            </div>
          )}

          {!phoneVerifyOtpSent ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Mobile Number</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">+91</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    className="input-clean pl-12"
                    placeholder="98765 43210"
                    value={phoneVerifyNumber}
                    onChange={(e) => setPhoneVerifyNumber(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendPhoneOtp()}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">A 6-digit OTP will be sent via SMS</p>
              </div>
              <button
                onClick={handleSendPhoneOtp}
                disabled={phoneVerifyLoading || phoneVerifyNumber.replace(/\D/g, '').length < 10}
                className="btn-brand w-full flex items-center justify-center gap-2"
              >
                {phoneVerifyLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  : <><Phone className="w-4 h-4" /> Send OTP</>}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 flex items-start gap-2">
                <Phone className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
                <span>OTP sent to <strong>+91 {phoneVerifyNumber}</strong>. Check your SMS.</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Enter OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="input-clean tracking-[0.5em] text-center text-lg font-mono"
                  placeholder="· · · · · ·"
                  value={phoneVerifyOtp}
                  onChange={(e) => setPhoneVerifyOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyPhoneOtp()}
                  autoFocus
                />
              </div>
              <button
                onClick={handleVerifyPhoneOtp}
                disabled={phoneVerifyLoading || phoneVerifyOtp.length < 6}
                className="btn-brand w-full flex items-center justify-center gap-2"
              >
                {phoneVerifyLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                  : 'Verify & Continue'}
              </button>
              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => { setPhoneVerifyOtpSent(false); setPhoneVerifyOtp(''); setPhoneVerifyError(''); }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Change number
                </button>
                <button
                  onClick={async () => {
                    if (phoneVerifyResendCountdown > 0) return;
                    setPhoneVerifyOtp(''); setPhoneVerifyError(''); setPhoneVerifyLoading(true);
                    try { await msg91Widget.retryOtp(null); startResendCountdown(); }
                    catch (err) { setPhoneVerifyError(err instanceof Error ? err.message : 'Failed to resend OTP.'); }
                    finally { setPhoneVerifyLoading(false); }
                  }}
                  disabled={phoneVerifyLoading || phoneVerifyResendCountdown > 0}
                  className="flex items-center gap-1.5 text-primary hover:text-primary/80 disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {phoneVerifyResendCountdown > 0
                    ? <span>Resend in {phoneVerifyResendCountdown}s</span>
                    : <><RefreshCw className="w-3.5 h-3.5" /> Resend OTP</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Route to the appropriate specialized page
  switch (serviceType) {
    case 'maid':
      return <MaidServicePage />;
    case 'mini':
      return <MiniCleanServicePage />;
    case 'cleaning':
      return <CleaningServicePage />;
    case 'ac':
      return <ACServicingPage />;
    case 'plumbing':
      return <PlumbingServicePage />;
    case 'electrical':
    case 'painting':
    case 'pest':
    case 'generic':
    default:
      return <BookServicePage />;
  }
};

export default ServiceRouter;
