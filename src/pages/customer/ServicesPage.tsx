import AppLayout from "@/components/AppLayout";
import LocationSelector, { LocationData } from "@/components/LocationSelector";
import { authAPI, servicesAPI } from "@/lib/api";
import { motion } from "framer-motion";
import { Clock, MapPin, Search, Sparkles, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

interface Service {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration: number;
  availability?: {
    available: boolean;
    workersCount: number;
    reason: string;
  };
}

const SERVICE_CATEGORIES = [
  { key: 'insta',        labelKey: 'customer.services.catInstaLabel', icon: '⚡', descKey: 'customer.services.catInstaDesc', color: 'bg-amber-50 border-amber-300',  badgeKey: 'customer.services.catInstaBadge', badgeColor: 'bg-teal-100 text-teal-700', path: '/customer/services/insta' },
  { key: 'subscription', labelKey: 'customer.services.catSubLabel',   icon: '📅', descKey: 'customer.services.catSubDesc',   color: 'bg-blue-50 border-blue-300',    badgeKey: 'customer.services.catSubBadge',   badgeColor: 'bg-teal-100 text-teal-700', path: '/customer/services/subscription' },
  { key: 'deep',         labelKey: 'customer.services.catDeepLabel',  icon: '✨', descKey: 'customer.services.catDeepDesc',  color: 'bg-green-50 border-green-300',  badgeKey: 'customer.services.catDeepBadge',  badgeColor: 'bg-teal-100 text-teal-700', path: '/customer/deep-cleaning' },
];

const ServicesPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(
    searchParams.get('category')
  );
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ name: string; addresses?: { isDefault: boolean; [key: string]: unknown }[] } | null>(null);
  const [showLocationSelector, setShowLocationSelector] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);

  useEffect(() => {
    fetchProfile();
    
    // Check if user has a saved location
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
      try {
        const parsed = JSON.parse(savedLocation);
        setSelectedLocation(parsed);
        setShowLocationSelector(false);
      } catch (e) {
        console.error('Error parsing saved location:', e);
      }
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await authAPI.getProfile();
      setProfile(data.user || data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleLocationConfirmed = (location: LocationData) => {
    if (!location.isAvailable) {
      alert(t('customer.services.areaNotServiceable'));
      return;
    }
    
    setSelectedLocation(location);
    setShowLocationSelector(false);
    
    // Save location to localStorage
    localStorage.setItem('userLocation', JSON.stringify(location));
  };

  const handleChangeLocation = () => {
    setShowLocationSelector(true);
  };

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const defaultAddress = profile?.addresses?.find((addr: { isDefault: boolean }) => addr.isDefault);
      
      const params: Record<string, unknown> = {
        isActive: true,
        limit: 20
      };

      if (search) {
        params.search = search;
      }

      // Use selected location from LocationSelector
      if (selectedLocation) {
        params.latitude = selectedLocation.lat;
        params.longitude = selectedLocation.lng;
        if (defaultAddress?.apartment) {
          params.apartmentName = defaultAddress.apartment;
        }
      }

      const data = await servicesAPI.getAll(params);
      console.log('Services fetched:', data.services);
      setServices(data.services || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedLocation, search, profile]);

  // Fetch services when location is confirmed and location selector is hidden
  useEffect(() => {
    if (selectedLocation && !showLocationSelector) {
      fetchServices();
    }
  }, [selectedLocation, showLocationSelector, fetchServices]);

  const matchesCategory = (service: Service) => {
    if (!activeCategory) return true;
    const n = service.name.toLowerCase();
    const c = service.category.toLowerCase();
    if (activeCategory === 'insta') return n.includes('insta') || n.includes('adhoc') || n.includes('hourly');
    if (activeCategory === 'subscription') return n.includes('subscription') || n.includes('monthly') || n.includes('weekly') || c.includes('subscription');
    if (activeCategory === 'deep') return n.includes('deep') || n.includes('full home');
    return true;
  };

  const displayedServices = services.filter(matchesCategory);

  const getCategoryEmoji = (category: string, name: string) => {
    if (name.toLowerCase().includes('insta')) return '⚡';
    if (name.toLowerCase().includes('monthly') || name.toLowerCase().includes('subscription')) return '📅';
    if (name.toLowerCase().includes('deep clean')) return '✨';
    if (name.toLowerCase().includes('kitchen')) return '🍳';
    if (name.toLowerCase().includes('bathroom')) return '🚿';
    if (name.toLowerCase().includes('sofa')) return '🛋️';
    if (name.toLowerCase().includes('carpet')) return '🪣';
    if (name.toLowerCase().includes('window')) return '🪟';
    if (category === 'cleaning') return '🧹';
    if (category === 'health') return '🏥';
    if (category === 'maintenance') return '🔧';
    return '🏠';
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  } as const;

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring" as const,
        stiffness: 100
      }
    }
  } as const;

  return (
    <>
      {showLocationSelector && (
        <LocationSelector 
          onLocationConfirmed={handleLocationConfirmed}
          defaultLocation={selectedLocation ? { lat: selectedLocation.lat, lng: selectedLocation.lng } : undefined}
        />
      )}
      
      {!showLocationSelector && (
        <AppLayout userType="customer" userName={profile?.name || "Loading..."}>
          <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-0">
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-2xl font-bold font-heading text-foreground mb-1">{t('customer.services.title')}</h1>
              <p className="text-muted-foreground text-sm">{t('customer.services.subtitle')}</p>
              {selectedLocation && (
                <motion.div 
                  className="mt-2 flex items-center justify-between"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <p className="text-xs text-primary flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {selectedLocation.area && selectedLocation.city 
                      ? `${selectedLocation.area}, ${selectedLocation.city}` 
                      : t('customer.services.locationSet')}
                  </p>
                  <button 
                    onClick={handleChangeLocation}
                    className="text-xs text-primary hover:underline"
                  >
                    {t('customer.services.changeLocation')}
                  </button>
                </motion.div>
              )}
            </motion.div>

            {/* 3 Category Cards */}
            <div className="grid grid-cols-3 gap-3">
              {SERVICE_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => navigate(cat.path)}
                  className={`p-3 rounded-2xl border-2 text-center transition-all ${cat.color} hover:border-primary/60 hover:shadow-md active:scale-95`}
                >
                  <div className="text-2xl mb-1">{cat.icon}</div>
                  <p className="text-xs font-semibold text-foreground leading-tight">{t(cat.labelKey)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block leading-tight">{t(cat.descKey)}</p>
                  <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cat.badgeColor}`}>{t(cat.badgeKey)}</span>
                </button>
              ))}
            </div>

            {/* Deep Cleaning Commercial Quote Banner */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Link
                to="/deep-cleaning-quote"
                className="flex items-center gap-4 p-4 rounded-2xl border-2 border-green-300 bg-green-50 hover:bg-green-100 hover:border-green-400 transition-all group"
              >
                <div className="w-12 h-12 bg-green-200 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-6 h-6 text-green-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-green-900 text-sm leading-tight">Deep Cleaning — Commercial &amp; Residential</p>
                  <p className="text-xs text-green-700 mt-0.5">Villas · Restaurants · Offices · Bungalows</p>
                </div>
                <span className="shrink-0 text-xs font-semibold bg-green-700 text-white px-3 py-1.5 rounded-full whitespace-nowrap">Get Free Quote →</span>
              </Link>
            </motion.div>

            {/* Search */}
            <motion.div
              className="flex gap-3"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  className="input-clean pl-10"
                  placeholder={t('customer.services.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </motion.div>

        {loading ? (
          <motion.div 
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div 
              className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <p className="text-sm text-muted-foreground">{t('customer.services.loading')}</p>
          </motion.div>
        ) : displayedServices.length === 0 ? (
          <motion.div 
            className="text-center py-12"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <motion.div 
              className="text-5xl mb-3"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              🔍
            </motion.div>
            <p className="font-medium text-foreground">{t('customer.services.noServices')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('customer.services.noServicesDesc')}</p>
          </motion.div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {displayedServices.map((service, index) => (
              <div 
                key={service._id} 
                className="card-elevated-hover p-5 group"
              >
                <div className="flex items-start gap-4">
                  <motion.div 
                    className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center text-3xl shrink-0"
                    whileHover={{ scale: 1.15, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {getCategoryEmoji(service.category, service.name)}
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold font-heading text-foreground text-sm">{service.name}</h3>
                      {service.availability && (
                        <span className={`shrink-0 text-xs ${service.availability.available ? 'badge-success' : 'badge-warning'}`}>
                          {service.availability.available ? t('customer.services.available') : t('customer.services.limited')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{service.description}</p>
                  </div>
                </div>

                {/* Availability Info */}
                {service.availability && (
                  <div className="mt-3 p-2 bg-muted rounded-lg flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-foreground">
                      {service.availability.workersCount > 0 
                        ? t('customer.services.workersNearby', { count: service.availability.workersCount })
                        : service.availability.reason}
                    </span>
                  </div>
                )}

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-sm font-bold text-foreground">₹{service.price}</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{service.duration} min</span>
                      </div>
                    </div>
                  </div>
                  
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Link
                      to={`/customer/book/${service._id}`}
                      className={`w-full text-xs py-2 px-3 flex items-center justify-center gap-1 rounded-xl transition-colors ${
                      service.availability?.available === false
                        ? 'bg-muted text-muted-foreground hover:bg-border'
                        : 'btn-brand'
                    }`}
                  >
                    {service.availability?.available === false ? t('customer.services.view') : t('customer.services.bookNow')}
                    </Link>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
      )}
    </>
  );
};

export default ServicesPage;
