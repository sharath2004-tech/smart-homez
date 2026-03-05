import AppLayout from "@/components/AppLayout";
import { useGeolocation } from "@/hooks/useGeolocation";
import { authAPI, bookingsAPI, locationsAPI } from "@/lib/api";
import { motion } from "framer-motion";
import { ArrowRight, Bell, ChevronRight, Clock, Heart, MapPin, Settings, Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

interface Booking {
  _id: string;
  service: { name: string };
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
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nearbyWorkersCount, setNearbyWorkersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { latitude, longitude, error: locationError } = useGeolocation();

  const quickServices = [
    { icon: "🧹", name: t('services.instaMaid'), subtitle: t('services.instaMaidSubtitle'), badge: t('services.instaMaidBadge') },
    { icon: "✨", name: t('services.deepClean'), subtitle: t('services.deepCleanSubtitle'), badge: t('services.deepCleanBadge') },
    { icon: "🍳", name: t('services.kitchen'), subtitle: t('services.kitchenSubtitle'), badge: "" },
    { icon: "🚿", name: t('services.bathroom'), subtitle: t('services.bathroomSubtitle'), badge: "" },
  ];

  useEffect(() => {
    fetchDashboardData();
  }, [latitude, longitude]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch user profile
      const profileData = await authAPI.getProfile();
      setProfile(profileData.user || profileData);

      // Fetch upcoming bookings
      const bookingsData = await bookingsAPI.getUpcoming();
      setUpcomingBookings((bookingsData.bookings || []).slice(0, 2));

      // Check nearby workers if location available
      if (latitude && longitude) {
        const workersData = await locationsAPI.getNearbyWorkers({
          latitude,
          longitude,
          maxDistance: 500
        });
        setNearbyWorkersCount(workersData.count || 0);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

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
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  const cardHoverVariants = {
    hover: {
      scale: 1.02,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 10
      }
    },
    tap: {
      scale: 0.98
    }
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
              transition={{ delay: 0.2 }}
            >
              Good morning 👋
            </motion.p>
            <motion.h1 
              className="text-2xl font-bold font-heading text-foreground"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
            >
              {profile?.name || "Loading..."}
            </motion.h1>
          </div>
          <motion.button 
            className="relative p-2.5 bg-card rounded-xl border border-border"
            whileHover={{ scale: 1.05, rotate: 15 }}
            whileTap={{ scale: 0.95 }}
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            {upcomingBookings.length > 0 && (
              <motion.span 
                className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
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

        {/* Hero Banner */}
        {nearbyWorkersCount > 0 && (
          <motion.div 
            variants={itemVariants}
            className="rounded-2xl p-6 relative overflow-hidden" 
            style={{ background: "var(--gradient-brand)" }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <motion.div 
              className="absolute right-0 top-0 bottom-0 w-32 flex items-center justify-center text-5xl opacity-20 pr-4"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
            >
              🏠
            </motion.div>
            <div className="relative">
              <motion.div 
                className="badge-primary mb-3 inline-flex text-xs" 
                style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white" }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <Sparkles className="w-3 h-3" />
                <span>Insta service available</span>
              </motion.div>
              <h2 className="text-xl font-bold font-heading text-primary-foreground mb-1">Get a maid in 15 minutes!</h2>
              <p className="text-primary-foreground/70 text-sm mb-4">{nearbyWorkersCount} workers available near you right now</p>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  to="/customer/services"
                  className="inline-flex items-center gap-2 bg-primary-foreground text-primary font-semibold py-2.5 px-5 rounded-xl text-sm hover:opacity-90 transition-all"
                >
                  Book Now <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </div>
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
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
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
                <Link to="/customer/services" className="card-elevated-hover p-4 text-center group block h-[140px] flex flex-col justify-center">
                  <motion.div 
                    className="text-3xl mb-2"
                    whileHover={{ scale: 1.2, rotate: 10 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {s.icon}
                  </motion.div>
                  <p className="text-sm font-semibold text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.subtitle}</p>
                  {s.badge && <span className="badge-primary mt-2 text-xs inline-block">{s.badge}</span>}
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
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <motion.div 
                className="text-4xl mb-2"
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              >
                📭
              </motion.div>
              <p className="text-sm font-medium text-foreground">{t('dashboard.noUpcomingBookings')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('dashboard.bookService')}</p>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link to="/customer/services" className="btn-brand mt-4 text-sm inline-flex items-center gap-2">
                  {t('dashboard.browseServices')} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div 
              className="space-y-3"
              variants={containerVariants}
            >
              {upcomingBookings.map((b, index) => (
                <motion.div 
                  key={b._id} 
                  className="card-elevated p-4 flex items-center gap-4"
                  variants={itemVariants}
                  custom={index}
                  whileHover={{ scale: 1.02, x: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <motion.div 
                    className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-xl shrink-0"
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                  >
                    {b.service.name.toLowerCase().includes("deep") ? "✨" : "🧹"}
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">{b.service.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {b.worker?.name || "Worker will be assigned"}
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
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                  >
                    {b.status === "confirmed" ? "Confirmed" : "Pending"}
                  </motion.span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* Worker Preferences */}
        <motion.div variants={itemVariants} className="grid sm:grid-cols-2 gap-3">
          <motion.div whileHover="hover" whileTap="tap" variants={cardHoverVariants}>
            <Link 
              to="/customer/preferences" 
              className="card-elevated-hover p-4 flex items-center gap-4 group block"
            >
              <motion.div 
                className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors"
                whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5 }}
              >
                <Heart className="w-6 h-6 text-primary" />
              </motion.div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Worker Preferences</p>
                <p className="text-xs text-muted-foreground mt-0.5">Set your preferred workers</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </Link>
          </motion.div>

          <motion.div whileHover="hover" whileTap="tap" variants={cardHoverVariants}>
            <Link 
              to="/customer/profile" 
              className="card-elevated-hover p-4 flex items-center gap-4 group block"
            >
              <motion.div 
                className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center shrink-0 group-hover:bg-secondary/80 transition-colors"
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.3 }}
              >
                <Settings className="w-6 h-6 text-foreground" />
              </motion.div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Account Settings</p>
                <p className="text-xs text-muted-foreground mt-0.5">Manage your profile & addresses</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
            </Link>
          </motion.div>
        </motion.div>

        {/* Subscription banner */}
        <motion.div 
          variants={itemVariants}
          whileHover={{ scale: 1.02, y: -5 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="card-elevated p-5 flex items-center gap-4 bg-secondary"
        >
          <motion.div 
            className="text-4xl"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          >
            📅
          </motion.div>
          <div className="flex-1">
            <p className="font-bold text-foreground font-heading text-sm">Save 20% with Monthly Plan</p>
            <p className="text-xs text-muted-foreground mt-0.5">Regular cleaning at discounted rates</p>
          </div>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Link to="/customer/services" className="btn-brand text-xs py-2 px-4 shrink-0">
              Explore
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
};

export default CustomerDashboard;
