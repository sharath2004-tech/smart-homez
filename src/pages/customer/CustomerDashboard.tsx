import AppLayout from "@/components/AppLayout";
import LocationSelector, { type LocationData } from "@/components/LocationSelector";
import { useGeolocation } from "@/hooks/useGeolocation";
import { authAPI, bookingsAPI, dashboardPreferencesAPI, locationsAPI, serviceAreasAPI, servicesAPI, setStoredCustomerLocation } from "@/lib/api";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, Bell, ChevronRight, Clock, MapPin, RefreshCw, Settings, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Booking {
  _id: string;
  service?: { name: string } | null;
  bookingType?: string;
  worker?: { name: string; workerProfile: { rating: number } };
  bookingDate: string;
  startTime: string;
  status: string;
}

interface UserProfile {
  name: string;
  addresses: Array<{
    _id: string;
    label: string;
    area: string;
    city: string;
    zipCode: string;
    isDefault: boolean;
    location?: {
      coordinates: [number, number];
    };
  }>;
  currentLocation?: {
    coordinates: [number, number];
  };
}

interface DashboardConfiguredService {
  id: string;
  linkedServiceId?: string | null;
  icon: string;
  nameKey: string;
  subtitleKey: string;
  customName?: string;
  customSubtitle?: string;
  badge?: string;
  path: string;
}

interface CustomerServiceRecord {
  _id: string;
  name: string;
  serviceType?: string;
  serviceCategory?: string;
  isQuoteService?: boolean;
  subscriptionOptions?: {
    enabled?: boolean;
  };
}

const getStoredDashboardLocation = (): LocationData | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem('userLocation');
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      lat?: number;
      lng?: number;
      latitude?: number;
      longitude?: number;
      address?: string;
      area?: string;
      city?: string;
      zipCode?: string;
      isAvailable?: boolean;
      serviceAreaId?: string;
    };

    const lat = parsed.lat ?? parsed.latitude;
    const lng = parsed.lng ?? parsed.longitude;

    if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
      return null;
    }

    return {
      lat,
      lng,
      address: parsed.address,
      area: parsed.area,
      city: parsed.city,
      zipCode: parsed.zipCode,
      isAvailable: Boolean(parsed.isAvailable),
      serviceAreaId: parsed.serviceAreaId,
    };
  } catch (error) {
    console.error('Failed to parse stored dashboard location:', error);
    return null;
  }
};

const CustomerDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [ongoingBooking, setOngoingBooking] = useState<Booking | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nearbyWorkersCount, setNearbyWorkersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [serviceableStatus, setServiceableStatus] = useState<'available' | 'unavailable' | 'unknown'>('unknown');
  const [serviceabilityMessage, setServiceabilityMessage] = useState('');
  const [nearestServiceArea, setNearestServiceArea] = useState<{ name?: string; distance?: number } | null>(null);
  const [quickServices, setQuickServices] = useState<any[]>([]);
  const [dashboardLinkedServices, setDashboardLinkedServices] = useState<CustomerServiceRecord[]>([]);
  const [deepCleaningRequestServiceId, setDeepCleaningRequestServiceId] = useState<string | null>(null);
  const [requestingDeepCleaning, setRequestingDeepCleaning] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const { latitude, longitude, error: locationError, loading: locationLoading, refetch } = useGeolocation();

  const getDashboardLinkedService = (service: DashboardConfiguredService) => {
    if (service.linkedServiceId) {
      return dashboardLinkedServices.find((item) => item._id === service.linkedServiceId) || null;
    }

    const serviceByRule = dashboardLinkedServices.find((item) => {
      const name = item.name.toLowerCase();

      if (service.id === 'intense_washroom') {
        return item.serviceType === 'fixed_washroom_deep'
          || item.serviceType === 'fixed_washroom_basic'
          || (name.includes('washroom') && (name.includes('intense') || name.includes('deep')));
      }

      if (service.id === 'kitchen_deep_clean') {
        return item.serviceType === 'deep_cleaning_kitchen'
          || (name.includes('kitchen') && name.includes('deep'));
      }

      if (service.id === 'window_deep_clean') {
        return item.serviceType === 'fixed_window_cleaning'
          || (name.includes('window') && name.includes('clean'));
      }

      return false;
    });

    return serviceByRule || null;
  };

  const resolveDashboardServicePath = (service: DashboardConfiguredService) => {
    const linkedService = getDashboardLinkedService(service);

    if (linkedService?.subscriptionOptions?.enabled) {
      return `/customer/subscribe/${linkedService._id}`;
    }

    if (linkedService && !linkedService.isQuoteService) {
      return `/customer/book/${linkedService._id}`;
    }

    if (service.id === 'move_in_out_cleaning') {
      return '/customer/deep-cleaning';
    }

    return service.path;
  };

  useEffect(() => {
    const stored = getStoredDashboardLocation();
    if (stored) {
      setSelectedLocation(stored);
    }
  }, []);

  // Fetch service records used to resolve direct dashboard links
  useEffect(() => {
    const fetchDashboardLinkedServices = async () => {
      try {
        const response = await servicesAPI.getAll({ isActive: true, limit: 50 });
        const list = response.services || [];
        const deepCleaning = list.find((s: any) =>
          s.serviceType === 'deep_cleaning_full_house' ||
          s.serviceCategory === 'deep_cleaning' ||
          s.name.toLowerCase().includes('deep cleaning')
        );

        setDashboardLinkedServices(list);
        if (deepCleaning) setDeepCleaningRequestServiceId(deepCleaning._id);
      } catch (error) {
        console.error('Error fetching spot-clean services:', error);
      }
    };
    fetchDashboardLinkedServices();
  }, []);

  // Only 3 service category cards - now fetched dynamically
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await dashboardPreferencesAPI.getServices();
        const services = response.services || [];

        // Map backend service configuration to frontend format
        const mappedServices = services.map((service: DashboardConfiguredService) => ({
          id: service.id,
          icon: service.icon,
          name: service.customName || t(service.nameKey),
          subtitle: service.customSubtitle || t(service.subtitleKey),
          badge: service.badge,
          path: resolveDashboardServicePath(service)
        }));

        setQuickServices(mappedServices);
      } catch (error) {
        console.error('Error fetching dashboard services:', error);
        // REMOVED: Hardcoded fallback services. Show error state or empty state instead.
        // Admin must configure services via backend for them to appear to customers.
        setQuickServices([]);
      }
    };
    fetchServices();
  }, [dashboardLinkedServices, t]);

  useEffect(() => {
    const fetchCoreData = async () => {
      try {
        setLoading(true);
        const [profileData, bookingsData, ongoingData] = await Promise.all([
          authAPI.getProfile(),
          bookingsAPI.getUpcoming(),
          bookingsAPI.getOngoing(),
        ]);
        setProfile(profileData.user || profileData);
        setUpcomingBookings((bookingsData.bookings || []).slice(0, 2));
        const ongoing = ongoingData.bookings || [];
        setOngoingBooking(ongoing.length > 0 ? ongoing[0] : null);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCoreData();
  }, []);

  useEffect(() => {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return;

    setSelectedLocation((prev) => ({
      lat: latitude,
      lng: longitude,
      address: prev?.address,
      area: prev?.area,
      city: prev?.city,
      zipCode: prev?.zipCode,
      isAvailable: prev?.isAvailable ?? false,
      serviceAreaId: prev?.serviceAreaId,
    }));
  }, [latitude, longitude]);

  const validateDashboardLocation = useCallback(async (location: LocationData) => {
    try {
      setServiceableStatus('unknown');
      const response = await serviceAreasAPI.validate(location.lat, location.lng);

      const nextLocation: LocationData = {
        ...location,
        area: location.area || response.serviceArea?.area,
        city: location.city || response.serviceArea?.city,
        isAvailable: Boolean(response.isAvailable),
        serviceAreaId: response.serviceArea?.id || location.serviceAreaId,
      };

      setSelectedLocation(nextLocation);
      setServiceableStatus(response.isAvailable ? 'available' : 'unavailable');
      setServiceabilityMessage(response.message || '');
      setNearestServiceArea(response.nearest || null);

      setStoredCustomerLocation({
        ...nextLocation,
        latitude: nextLocation.lat,
        longitude: nextLocation.lng,
        timestamp: Date.now(),
      }, 'selected');

      if (response.isAvailable) {
        const workersData = await locationsAPI.getNearbyWorkers({
          latitude: nextLocation.lat,
          longitude: nextLocation.lng,
          maxDistance: 500,
        });
        setNearbyWorkersCount(workersData.count || 0);
      } else {
        setNearbyWorkersCount(0);
      }
    } catch (error) {
      console.error('Error validating dashboard location:', error);
      setServiceableStatus('unknown');
      setServiceabilityMessage('We could not verify your service region right now.');
      setNearestServiceArea(null);
    }
  }, []);

  useEffect(() => {
    if (!selectedLocation) return;
    void validateDashboardLocation(selectedLocation);
  }, [selectedLocation?.lat, selectedLocation?.lng, validateDashboardLocation]);

  const handleLocationConfirmed = (location: LocationData) => {
    setSelectedLocation(location);
    setShowLocationSelector(false);
  };

  const defaultAddress = profile?.addresses?.find(addr => addr.isDefault);
  const tracedAddress = selectedLocation?.address
    || [selectedLocation?.area, selectedLocation?.city, selectedLocation?.zipCode].filter(Boolean).join(', ');
  const displayAddress = tracedAddress
    ? tracedAddress
    : defaultAddress 
    ? `${defaultAddress.area}, ${defaultAddress.city} - ${defaultAddress.zipCode}`
    : locationError
    ? t('dashboard.locationUnavailable')
    : latitude && longitude
    ? t('dashboard.currentLocation')
    : t('dashboard.loadingLocation');

  const handleRequestDeepCleaning = useCallback(async () => {
    if (!selectedLocation) {
      toast.error('Choose a location first so we know where to expand service.');
      return;
    }

    if (!deepCleaningRequestServiceId) {
      toast.error('Deep-cleaning service record is missing or inactive. Please ask the admin to configure it in Deep Cleaning Config → Service Settings.');
      return;
    }

    try {
      setRequestingDeepCleaning(true);
      await serviceAreasAPI.requestUnavailableService({
        serviceId: deepCleaningRequestServiceId,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        address: selectedLocation.address || tracedAddress || undefined,
        area: selectedLocation.area || defaultAddress?.area,
        city: selectedLocation.city || defaultAddress?.city,
        zipCode: selectedLocation.zipCode || defaultAddress?.zipCode,
        serviceAreaId: selectedLocation.serviceAreaId,
      });
      toast.success('Deep-cleaning demand recorded for this area. We’ll nudge the ops team.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to request deep cleaning for this area.');
    } finally {
      setRequestingDeepCleaning(false);
    }
  }, [deepCleaningRequestServiceId, defaultAddress?.area, defaultAddress?.city, defaultAddress?.zipCode, selectedLocation, tracedAddress]);

  const formatDate = (dateString: string, timeString?: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dateText = "";
    if (date.toDateString() === today.toDateString()) {
      dateText = t('dashboard.today');
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dateText = t('dashboard.tomorrow');
    } else {
      dateText = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    }

    if (timeString) {
      // Format time from 24-hour to 12-hour format
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      const formattedTime = `${displayHour}:${minutes} ${ampm}`;
      return `${dateText}, ${formattedTime}`;
    }
    
    return dateText;
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.35, ease: "easeOut" }
    }
  };

  const cardHoverVariants = {
    hover: {
      scale: 1.015,
      transition: { duration: 0.2, ease: "easeOut" }
    },
    tap: { scale: 0.97 }
  };

  return (
    <AppLayout userType="customer" userName={profile?.name || "Loading..."}>
      <motion.div 
        className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 space-y-8 pb-20 md:pb-0"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-start justify-between">
          <div>
            <motion.p
              className="text-muted-foreground text-sm mb-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {t('customer.dashboard.goodMorning')}
            </motion.p>
            <Link to="/customer/profile">
              <motion.h1
                className="text-2xl font-bold font-heading text-foreground hover:text-primary transition-colors cursor-pointer"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
              >
                {profile?.name || "Loading..."}
              </motion.h1>
            </Link>
          </div>
          <motion.button
            className="relative p-2.5 bg-card rounded-xl border border-border"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/customer/notifications')}
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            {upcomingBookings.length > 0 && (
              <motion.span
                className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              />
            )}
          </motion.button>
        </motion.div>

        {/* Location bar */}
        <motion.div variants={itemVariants}>
          <button
            type="button"
            onClick={() => setShowLocationSelector(true)}
            className="flex w-full items-center gap-2 rounded-xl border border-border bg-card p-3 text-left hover:bg-muted transition-colors group"
          >
            <MapPin className="w-4 h-4 text-primary shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-sm text-foreground line-clamp-2 break-words">{displayAddress}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>

        {/* Ongoing Booking — top priority */}
        {ongoingBooking && (
          <motion.div
            variants={itemVariants}
            className="rounded-2xl p-4 border-2 border-primary bg-primary/5"
          >
            <div className="flex items-center gap-2 mb-2">
              <motion.span
                className="w-2.5 h-2.5 bg-green-500 rounded-full inline-block"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
              <span className="text-xs font-bold text-green-600 uppercase tracking-wide">{t('customer.dashboard.serviceInProgress')}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-xl shrink-0">
                🧹
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground text-sm">{ongoingBooking.service?.name ?? '✨ Move In / Move Out Cleaning'}</p>
                <p className="text-xs text-muted-foreground">{ongoingBooking.worker?.name || t('customer.dashboard.workerAssigned')}</p>
              </div>
              <Link to="/customer/bookings" className="btn-brand text-xs py-2 px-3 shrink-0">
                {t('customer.dashboard.track')}
              </Link>
            </div>
          </motion.div>
        )}

        {/* Not serviceable warning */}
        {serviceableStatus !== 'available' && (
          <motion.div
            variants={itemVariants}
            className="rounded-2xl p-4 border border-amber-300 bg-amber-50 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {locationLoading
                  ? 'Checking your current region...'
                  : serviceableStatus === 'unavailable'
                  ? t('customer.dashboard.areaNotServiceable')
                  : 'Set your location to see services'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {locationLoading
                  ? 'We are tracing your location and verifying whether it is inside an active service region.'
                  : serviceableStatus === 'unavailable'
                  ? (serviceabilityMessage || t('customer.dashboard.bookElsewhere'))
                  : (locationError || 'Choose a location to check whether services are available in your region.')}
              </p>
              {nearestServiceArea?.name && serviceableStatus === 'unavailable' && (
                <p className="text-xs text-amber-700 mt-2">
                  Nearest service area: <strong>{nearestServiceArea.name}</strong>
                  {typeof nearestServiceArea.distance === 'number' ? ` (${nearestServiceArea.distance.toFixed(1)} km away)` : ''}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowLocationSelector(true)}
                className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-200 whitespace-nowrap"
              >
                {serviceableStatus === 'unavailable' ? 'Choose location' : 'Set location'}
              </button>
              {serviceableStatus === 'unavailable' && selectedLocation && deepCleaningRequestServiceId && (
                <button
                  type="button"
                  onClick={handleRequestDeepCleaning}
                  disabled={requestingDeepCleaning}
                  className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {requestingDeepCleaning ? 'Requesting...' : 'Request Deep Cleaning'}
                </button>
              )}
              {locationError && (
                <button
                  type="button"
                  onClick={refetch}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap"
                >
                  <RefreshCw className="h-3 w-3" /> Retry
                </button>
              )}
            </div>
          </motion.div>
        )}



        {/* Move In / Move Out Promo Banner */}
        {serviceableStatus === 'available' && (
        <motion.div variants={itemVariants}>
          <Link
            to="/customer/deep-cleaning"
            className="flex items-center gap-4 p-4 rounded-2xl border-2 border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 hover:border-green-400 transition-all group block"
          >
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform text-3xl">
              ✨
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-green-900 text-sm leading-tight">Move In / Move Out Cleaning</p>
              <p className="text-xs text-green-700 mt-0.5">Enter your home area and get the amount instantly</p>
            </div>
            <span className="shrink-0 text-xs font-semibold bg-green-700 text-white px-3 py-1.5 rounded-full whitespace-nowrap">Open</span>
          </Link>
        </motion.div>
        )}

        {/* Quick Services */}
        {serviceableStatus === 'available' && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold font-heading text-foreground">{t('dashboard.quickBook')}</h2>
            <Link to="/customer/services" className="text-sm text-primary font-medium flex items-center gap-1 hover:gap-2 transition-all">
              {t('dashboard.allServices')} <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            variants={containerVariants}
          >
            {quickServices.map((s, index) => (
              <motion.div
                key={s.name}
                variants={itemVariants}
                whileHover="hover"
                whileTap="tap"
                custom={index}
              >
                <Link
                  to={s.path}
                  className="card-elevated-hover p-4 text-center group block flex flex-col items-center justify-center min-h-[130px]"
                >
                  <motion.div
                    className="text-3xl mb-2"
                    whileHover={{ scale: 1.15 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    {s.icon}
                  </motion.div>
                  <p className="text-xs font-semibold text-foreground leading-tight">{s.name}</p>
                  <p className={`text-xs mt-0.5 leading-tight hidden sm:block ${s.name.includes('Move In') ? 'text-muted-foreground/70 font-light' : 'text-muted-foreground'}`}>{s.subtitle}</p>
                  {s.badge && <span className="badge-primary mt-1.5 text-xs inline-block">{s.badge}</span>}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
        )}

        {/* Upcoming Bookings */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold font-heading text-foreground">{t('dashboard.upcomingBookings')}</h2>
            <Link to="/customer/bookings" className="text-sm text-primary font-medium flex items-center gap-1 hover:gap-2 transition-all">
              {t('dashboard.viewAll')} <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {loading ? (
            <motion.div 
              className="text-center py-8 text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div 
                className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <p className="text-sm">{t('dashboard.loadingBookings')}</p>
            </motion.div>
          ) : upcomingBookings.length === 0 ? (
            <motion.div
              className="card-elevated p-8 text-center"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <div className="text-4xl mb-2">📭</div>
              <p className="text-sm font-medium text-foreground">{t('dashboard.noUpcomingBookings')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('dashboard.bookService')}</p>
              <div>
                {serviceableStatus === 'available' ? (
                  <Link to="/customer/services" className="btn-brand mt-4 text-sm inline-flex items-center gap-2">
                    {t('dashboard.browseServices')} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowLocationSelector(true)}
                    className="btn-brand mt-4 text-sm inline-flex items-center gap-2"
                  >
                    {serviceableStatus === 'unavailable' ? 'Choose Serviceable Location' : 'Set Location'} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              className="space-y-3"
              variants={containerVariants}
            >
              {upcomingBookings.map((b, index) => (
                <Link key={b._id} to={`/customer/bookings`} state={{ openBookingId: b._id }}>
                <motion.div
                  className="card-elevated p-4 flex items-center gap-4 cursor-pointer"
                  variants={itemVariants}
                  custom={index}
                  whileHover={{ scale: 1.015, y: -2 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-xl shrink-0">
                    {(b.service?.name ?? '').toLowerCase().includes("deep") || b.bookingType === 'deep-cleaning-cart' ? "✨" : "🧹"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">{b.service?.name ?? (b.bookingType === 'deep-cleaning-cart' ? '✨ Move In / Move Out Cleaning' : 'Booking')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {b.worker?.name || t('customer.dashboard.workerWillBeAssigned')}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" /> {formatDate(b.bookingDate, b.startTime)}
                      </span>
                      {b.worker && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="w-3 h-3 fill-warning text-warning" /> {b.worker.workerProfile.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <motion.span
                    className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold badge-primary"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut", delay: 0.15 + index * 0.05 }}
                  >
                    {b.status === "confirmed" ? t('customer.dashboard.confirmed') : t('customer.dashboard.pending')}
                  </motion.span>
                </motion.div>
                </Link>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* Account Settings quick link */}
        <motion.div variants={itemVariants}>
          <motion.div whileHover="hover" whileTap="tap" variants={cardHoverVariants}>
            <Link
              to="/customer/profile"
              className="card-elevated-hover p-4 flex items-center gap-4 group block"
            >
              <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center shrink-0">
                <Settings className="w-6 h-6 text-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{t('customer.dashboard.accountSettings')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('customer.dashboard.manageProfile')}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
            </Link>
          </motion.div>
        </motion.div>


      </motion.div>

      {showLocationSelector && (
        <LocationSelector
          onLocationConfirmed={handleLocationConfirmed}
          onClose={() => setShowLocationSelector(false)}
          showCloseButton
          defaultLocation={selectedLocation ? { lat: selectedLocation.lat, lng: selectedLocation.lng } : undefined}
        />
      )}
    </AppLayout>
  );
};

export default CustomerDashboard;
