import AppLayout from "@/components/AppLayout";
import { useGeolocation } from "@/hooks/useGeolocation";
import { authAPI, bookingsAPI, locationsAPI } from "@/lib/api";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, Bell, ChevronRight, Clock, MapPin, Settings, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

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

const CustomerDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [ongoingBooking, setOngoingBooking] = useState<Booking | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nearbyWorkersCount, setNearbyWorkersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [serviceableStatus, setServiceableStatus] = useState<'available' | 'unavailable' | 'unknown'>('unknown');
  const { latitude, longitude, error: locationError } = useGeolocation();

  // Only 3 service category cards
  const quickServices = [
    { icon: "⚡", name: t('customer.dashboard.instaAdhoc'), subtitle: t('customer.dashboard.instantBooking'), badge: t('customer.dashboard.onDemand'), path: "/customer/services/insta" },
    { icon: "📅", name: t('customer.dashboard.subscription'), subtitle: t('customer.dashboard.recurringPlans'), badge: t('customer.dashboard.save20'), path: "/customer/services/subscription" },
    { icon: "✨", name: t('customer.dashboard.deepCleaning'), subtitle: t('customer.dashboard.fullHomeClean'), badge: t('customer.dashboard.bestValue'), path: "/customer/services/deep-cleaning" },
  ];

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
    if (!latitude || !longitude) return;
    locationsAPI.getNearbyWorkers({ latitude, longitude, maxDistance: 500 })
      .then((workersData) => setNearbyWorkersCount(workersData.count || 0))
      .catch(() => {});
    // Check serviceability
    locationsAPI.getNearby({ latitude, longitude, maxDistance: 20000 })
      .then((res) => {
        const locs = res.locations || res.data || [];
        setServiceableStatus(locs.length > 0 ? 'available' : 'unavailable');
      })
      .catch(() => setServiceableStatus('unknown'));
  }, [latitude, longitude]);

  const defaultAddress = profile?.addresses?.find(addr => addr.isDefault);
  const displayAddress = defaultAddress 
    ? `${defaultAddress.area}, ${defaultAddress.city} - ${defaultAddress.zipCode}`
    : locationError
    ? t('dashboard.locationUnavailable')
    : latitude && longitude
    ? t('dashboard.currentLocation')
    : t('dashboard.loadingLocation');

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
        className="max-w-4xl mx-auto space-y-8 pb-20 md:pb-0"
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
          <Link to="/customer/profile" className="flex items-center gap-2 p-3 bg-card rounded-xl border border-border hover:bg-muted transition-colors group">
            <MapPin className="w-4 h-4 text-primary shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-sm text-foreground font-medium truncate">{displayAddress}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0 group-hover:translate-x-1 transition-transform" />
          </Link>
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
                <p className="font-semibold text-foreground text-sm">{ongoingBooking.service?.name ?? '✨ Deep Cleaning'}</p>
                <p className="text-xs text-muted-foreground">{ongoingBooking.worker?.name || t('customer.dashboard.workerAssigned')}</p>
              </div>
              <Link to="/customer/bookings" className="btn-brand text-xs py-2 px-3 shrink-0">
                {t('customer.dashboard.track')}
              </Link>
            </div>
          </motion.div>
        )}

        {/* Not serviceable warning */}
        {serviceableStatus === 'unavailable' && (
          <motion.div
            variants={itemVariants}
            className="rounded-2xl p-4 border border-amber-300 bg-amber-50 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{t('customer.dashboard.areaNotServiceable')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('customer.dashboard.bookElsewhere')}</p>
            </div>
            <Link to="/customer/services" className="text-xs text-primary font-semibold shrink-0 hover:underline whitespace-nowrap">
              {t('customer.dashboard.bookElsewhereLink')}
            </Link>
          </motion.div>
        )}



        {/* Quick Services */}
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
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight hidden sm:block">{s.subtitle}</p>
                  {s.badge && <span className="badge-primary mt-1.5 text-xs inline-block">{s.badge}</span>}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

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
                <Link to="/customer/services" className="btn-brand mt-4 text-sm inline-flex items-center gap-2">
                  {t('dashboard.browseServices')} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
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
                    <p className="font-semibold text-foreground text-sm">{b.service?.name ?? (b.bookingType === 'deep-cleaning-cart' ? '✨ Deep Cleaning' : 'Booking')}</p>
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
    </AppLayout>
  );
};

export default CustomerDashboard;
