import AppLayout from "@/components/AppLayout";
import LocationSelector, { LocationData } from "@/components/LocationSelector";
import { authAPI, serviceAreasAPI, servicesAPI, setStoredCustomerLocation } from "@/lib/api";
import { motion } from "framer-motion";
import { Clock, MapPin, Search, Sparkles, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

interface Service {
  _id: string;
  name: string;
  description: string;
  category: string;
  serviceType?: string;
  price: number;
  duration: number;
  isQuoteService?: boolean;
  subscriptionOptions?: { enabled?: boolean };
  availability?: {
    available: boolean;
    workersCount: number;
    reason: string;
  };
  sizeParameters?: {
    enabled: boolean;
    options?: Array<{ value: string; label: string; price: number }>;
  };
  image?: string | null;
  rating?: number;
  reviewCount?: number;
  highlight?: string;
  serviceCategory?: string;
}

const SERVICE_CATEGORIES = [
  { key: 'insta',        labelKey: 'customer.services.catInstaLabel', icon: '⚡', descKey: 'customer.services.catInstaDesc', color: 'bg-amber-50 border-amber-300',  badgeKey: 'customer.services.catInstaBadge', badgeColor: 'bg-teal-100 text-teal-700', path: '/customer/services/insta' },
  { key: 'subscription', labelKey: 'customer.services.catSubLabel',   icon: '📅', descKey: 'customer.services.catSubDesc',   color: 'bg-blue-50 border-blue-300',    badgeKey: 'customer.services.catSubBadge',   badgeColor: 'bg-teal-100 text-teal-700', path: '/customer/services/subscription' },
  { key: 'deep',         labelKey: 'customer.services.catDeepLabel',  icon: '✨', descKey: 'customer.services.catDeepDesc',  color: 'bg-green-50 border-green-300',  badgeKey: 'customer.services.catDeepBadge',  badgeColor: 'bg-teal-100 text-teal-700', path: '/customer/deep-cleaning' },
];

const HIDDEN_ROOT_SERVICE_TYPES = new Set([
  'instant_hourly',
  'monthly_subscription',
  'deep_cleaning_full_house',
]);

const dedupeServices = (items: Service[]) => {
  const seen = new Set<string>();

  return items.filter((service) => {
    const serviceKey = service._id || `${service.serviceType || 'service'}:${service.name.toLowerCase()}`;

    if (seen.has(serviceKey)) {
      return false;
    }

    seen.add(serviceKey);
    return true;
  });
};

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
  const [requestingServiceId, setRequestingServiceId] = useState<string | null>(null);
  const [subCategoryFilter, setSubCategoryFilter] = useState<string | null>(null);

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

    setStoredCustomerLocation(location, 'selected');
  };

  const handleChangeLocation = () => {
    setShowLocationSelector(true);
  };

  const handleUnavailableServiceRequest = async (service: Service) => {
    if (!selectedLocation) {
      toast.error("Please select your location first.");
      setShowLocationSelector(true);
      return;
    }

    try {
      setRequestingServiceId(service._id);
      const response = await serviceAreasAPI.requestUnavailableService({
        serviceId: service._id,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        address: selectedLocation.address,
        area: selectedLocation.area,
        city: selectedLocation.city,
        zipCode: selectedLocation.zipCode,
        serviceAreaId: selectedLocation.serviceAreaId,
      });

      toast.success(response.message || `Request saved for ${service.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit service request.");
    } finally {
      setRequestingServiceId(null);
    }
  };

  const handleQuickServiceAction = async (matcher: (service: Service) => boolean) => {
    const matchedService = services.find(matcher);

    if (!matchedService) {
      toast.error("This service is not configured yet.");
      return;
    }

    if (matchedService.availability?.available === false) {
      await handleUnavailableServiceRequest(matchedService);
      return;
    }

    navigate(`/customer/book/${matchedService._id}`);
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
      const uniqueServices = dedupeServices(data.services || []);
      console.log('Services fetched:', uniqueServices);
      setServices(uniqueServices);
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

  const displayedServices = services.filter((service) => {
    if (service.serviceType && HIDDEN_ROOT_SERVICE_TYPES.has(service.serviceType)) {
      return false;
    }
    return matchesCategory(service);
  });

  const SUB_CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
    spot_cleaning:         { label: 'Spot Clean',    icon: '🧹' },
    kitchen_services:     { label: 'Kitchen',       icon: '🍳' },
    bathroom_services:    { label: 'Bathroom',      icon: '🛀' },
    furniture_services:   { label: 'Furniture',     icon: '🛋️' },
    hvac_services:        { label: 'HVAC / AC',     icon: '❄️' },
    deep_cleaning:        { label: 'Deep Clean',    icon: '🏠' },
    instant_services:     { label: 'Instant',       icon: '⚡' },
    subscription_services:{ label: 'Subscription',  icon: '📅' },
    other:                { label: 'Other',         icon: '📦' },
  };

  const availableSubCategories = [...new Set(
    displayedServices.map(s => s.serviceCategory).filter(Boolean) as string[]
  )];

  const filteredDisplayedServices = subCategoryFilter
    ? displayedServices.filter(s => s.serviceCategory === subCategoryFilter)
    : displayedServices;

  const getCategoryEmoji = (category: string, name: string) => {
    if (name.toLowerCase().includes('insta')) return '⚡';
    if (name.toLowerCase().includes('monthly') || name.toLowerCase().includes('subscription')) return '📅';
    if (name.toLowerCase().includes('deep clean')) return '✨';
    if (name.toLowerCase().includes('kitchen')) return '🍳';
    if (name.toLowerCase().includes('bathroom')) return '🚿';
    if (name.toLowerCase().includes('sofa')) return '🛋️';
    if (name.toLowerCase().includes('carpet')) return '🪣';
    if (name.toLowerCase().includes('window')) return '🪟';
    if (name.toLowerCase().includes('fan')) return '🌀';
    if (name.toLowerCase().includes('balcony')) return '🌿';
    if (name.toLowerCase().includes('fridge')) return '❄️';
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
      <AppLayout userType="customer" userName={profile?.name || "Loading..."}>
        <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 space-y-6 pb-20 md:pb-0">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SERVICE_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => navigate(cat.path)}
                className={`p-3 rounded-2xl border-2 text-center transition-all ${cat.color} hover:border-primary/60 hover:shadow-md active:scale-95`}
              >
                <div className="text-2xl mb-1">{cat.icon}</div>
                <div>
                  <p className="text-xs font-semibold text-foreground leading-tight">
                    {cat.key === 'deep' ? 'Move In / Move Out Cleaning' : t(cat.labelKey)}
                  </p>
                  {cat.key === 'deep' && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Full Home Deep Clean</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block leading-tight">{t(cat.descKey)}</p>
                <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cat.badgeColor}`}>{t(cat.badgeKey)}</span>
              </button>
            ))}
          </div>

          {/* Spot Clean Mini Services Banner */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.40 }}
          >
            <Link
              to="/customer/services/spot-clean"
              className="flex items-center gap-4 p-4 rounded-2xl border-2 border-cyan-300 bg-cyan-50 hover:bg-cyan-100 hover:border-cyan-400 transition-all group"
            >
              <div className="w-12 h-12 bg-cyan-200 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform text-2xl">
                🧹
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-cyan-900 text-sm leading-tight">Mini Services  — Spot Cleaning</p>
                <p className="text-xs text-cyan-700 mt-0.5">Kitchen · Bathroom · Sofa · Fan · Fridge · Balcony &amp; more</p>
              </div>
              <span className="shrink-0 text-xs font-semibold bg-cyan-700 text-white px-3 py-1.5 rounded-full whitespace-nowrap">From ₹149 →</span>
            </Link>
          </motion.div>

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
                <p className="font-bold text-green-900 text-sm leading-tight">Post Construction — Commercial &amp; Residential</p>
                <p className="text-xs text-green-700 mt-0.5">Villas · Restaurants · Offices · Bungalows</p>
              </div>
              <span className="shrink-0 text-xs font-semibold bg-green-700 text-white px-3 py-1.5 rounded-full whitespace-nowrap">Get Free Quote →</span>
            </Link>
          </motion.div>

          {/* Deep Cleaning Sub-Services Cards */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="space-y-3"
          >
            <h3 className="text-sm font-semibold text-foreground px-1">Dedicated Deep-Clean Service Pages</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                to="/customer/services/intense-washroom-cleaning"
                className="p-4 rounded-xl border-2 border-purple-300 bg-purple-50 hover:bg-purple-100 hover:border-purple-400 transition-all text-center group"
              >
                <div className="text-3xl mb-2">🚿</div>
                <p className="font-semibold text-purple-900 text-sm">Intense Washroom Cleaning</p>
                <p className="text-xs text-purple-700 mt-1">Tiles · fittings · stain removal</p>
                <span className="inline-block mt-2 text-[10px] font-semibold bg-purple-600 text-white px-2 py-1 rounded-full">Open Page</span>
              </Link>

              <Link
                to="/customer/services/kitchen-deep-clean"
                className="p-4 rounded-xl border-2 border-orange-300 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 transition-all text-center group"
              >
                <div className="text-3xl mb-2">🍽️</div>
                <p className="font-semibold text-orange-900 text-sm">Kitchen Deep Clean</p>
                <p className="text-xs text-orange-700 mt-1">Grease · appliances · tiles</p>
                <span className="inline-block mt-2 text-[10px] font-semibold bg-orange-600 text-white px-2 py-1 rounded-full">Open Page</span>
              </Link>

              <Link
                to="/customer/services/window-deep-cleaning"
                className="p-4 rounded-xl border-2 border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition-all text-center group"
              >
                <div className="text-3xl mb-2">🪟</div>
                <p className="font-semibold text-blue-900 text-sm">Window Deep Cleaning</p>
                <p className="text-xs text-blue-700 mt-1">Glass · frames · tracks</p>
                <span className="inline-block mt-2 text-[10px] font-semibold bg-blue-600 text-white px-2 py-1 rounded-full">Open Page</span>
              </Link>
            </div>
          </motion.div>

          {/* Our Promise Trust Bar */}
          <div className="flex items-center justify-center gap-3 sm:gap-6 flex-wrap py-2.5 px-3 rounded-xl bg-muted/40 border border-border">
            {[
              { icon: '✅', text: 'Verified Professionals' },
              { icon: '📅', text: 'Hassle-Free Booking' },
              { icon: '💰', text: 'Transparent Pricing' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-1.5">
                <span className="text-sm">{item.icon}</span>
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{item.text}</span>
              </div>
            ))}
          </div>

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
            <>
              {/* Sub-category filter tabs */}
              {availableSubCategories.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
                  <button
                    onClick={() => setSubCategoryFilter(null)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      !subCategoryFilter
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    All ({displayedServices.length})
                  </button>
                  {availableSubCategories.map(cat => {
                    const meta = SUB_CATEGORY_LABELS[cat] || { label: cat, icon: '📦' };
                    const count = displayedServices.filter(s => s.serviceCategory === cat).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => setSubCategoryFilter(subCategoryFilter === cat ? null : cat)}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          subCategoryFilter === cat
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        <span>{meta.icon}</span>
                        {meta.label} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {filteredDisplayedServices.length === 0 ? (
                <div className="text-center py-8">
                  <p className="font-medium text-foreground">No services in this category</p>
                  <button onClick={() => setSubCategoryFilter(null)} className="text-xs text-primary mt-2 hover:underline">Show all</button>
                </div>
              ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredDisplayedServices.map((service) => (
                <div 
                  key={service._id} 
                  className="card-elevated-hover p-5 group"
                >
                  <div className="flex items-start gap-4">
                    <motion.div 
                      className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center text-3xl shrink-0 overflow-hidden"
                      whileHover={{ scale: 1.15, rotate: service.image ? 0 : 5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      {service.image
                        ? <img src={service.image} alt={service.name} className="w-full h-full object-cover rounded-2xl" />
                        : getCategoryEmoji(service.category, service.name)
                      }
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
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{service.highlight || service.description}</p>
                      {service.rating && service.rating > 0 ? (
                        <div className="flex items-center gap-1 mt-1.5">
                          <span className="text-yellow-500 text-xs leading-none">★</span>
                          <span className="text-xs font-semibold text-foreground">{service.rating.toFixed(1)}</span>
                          {service.reviewCount && service.reviewCount > 0 ? (
                            <span className="text-xs text-muted-foreground">({service.reviewCount.toLocaleString('en-IN')} reviews)</span>
                          ) : null}
                        </div>
                      ) : null}
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
                        {service.isQuoteService ? (
                          <span className="text-sm font-bold text-green-700">Custom Quote</span>
                        ) : service.subscriptionOptions?.enabled ? (
                          <div>
                            <div className="text-xs text-muted-foreground line-through">
                              ₹{Math.round(service.price / 0.8).toLocaleString('en-IN')}<span className="font-normal">/mo</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-green-700">From ₹{service.price.toLocaleString('en-IN')}<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
                              <span className="text-xs font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">20% off</span>
                            </div>
                          </div>
                        ) : service.sizeParameters?.enabled && (service.sizeParameters?.options?.length ?? 0) > 0 ? (
                          <div>
                            <div className="text-xs text-muted-foreground">Starts at</div>
                            <span className="text-sm font-bold text-green-700">
                              ₹{Math.min(...(service.sizeParameters!.options!.map(o => o.price))).toLocaleString('en-IN')}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <div className="text-xs text-muted-foreground line-through">
                              ₹{Math.round(service.price / 0.8).toLocaleString('en-IN')}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-green-700">₹{service.price.toLocaleString('en-IN')}</span>
                              <span className="text-xs font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">20% off</span>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{service.duration} min</span>
                        </div>
                      </div>
                    </div>

                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      {service.availability?.available === false ? (
                        <button
                          type="button"
                          onClick={() => handleUnavailableServiceRequest(service)}
                          disabled={requestingServiceId === service._id}
                          className="w-full text-xs py-2 px-3 flex items-center justify-center gap-1 rounded-xl transition-colors bg-amber-100 text-amber-900 hover:bg-amber-200 disabled:opacity-60"
                        >
                          {requestingServiceId === service._id ? "Sending request..." : "Request service in my location"}
                        </button>
                      ) : service.isQuoteService ? (
                        <Link
                          to="/customer/deep-cleaning"
                          className="w-full text-xs py-2 px-3 flex items-center justify-center gap-1 rounded-xl transition-colors btn-brand"
                        >
                          Book Now ✨
                        </Link>
                      ) : service.subscriptionOptions?.enabled ? (
                        <Link
                          to={`/customer/subscribe/${service._id}`}
                          className="w-full text-xs py-2 px-3 flex items-center justify-center gap-1 rounded-xl transition-colors btn-brand"
                        >
                          Subscribe 📅
                        </Link>
                      ) : (
                        <Link
                          to={`/customer/book/${service._id}`}
                          className="w-full text-xs py-2 px-3 flex items-center justify-center gap-1 rounded-xl transition-colors btn-brand"
                        >
                          {t('customer.services.bookNow')}
                        </Link>
                      )}
                    </motion.div>
                  </div>
                </div>
              ))}
            </div>
              )}
            </>
          )}
        </div>
      </AppLayout>

      {showLocationSelector && (
        <LocationSelector
          key={selectedLocation ? `${selectedLocation.lat}-${selectedLocation.lng}` : 'location-selector'}
          onLocationConfirmed={handleLocationConfirmed}
          onClose={selectedLocation ? () => setShowLocationSelector(false) : undefined}
          showCloseButton={!!selectedLocation}
          defaultLocation={selectedLocation ? { lat: selectedLocation.lat, lng: selectedLocation.lng } : undefined}
        />
      )}
    </>
  );
};

export default ServicesPage;
