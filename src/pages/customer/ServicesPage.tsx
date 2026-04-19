import AppLayout from "@/components/AppLayout";
import LocationSelector, { LocationData } from "@/components/LocationSelector";
import { authAPI, serviceAreasAPI, servicesAPI, setStoredCustomerLocation, settingsAPI } from "@/lib/api";
import { motion } from "framer-motion";
import { CalendarClock, Clock, MapPin, Search, Star, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

interface Service {
  _id: string;
  name: string;
  description: string;
  category: string;
  serviceCategory?: string;
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
}

const CATEGORY_META: Record<string, { icon: string; route: string; color: string; badgeColor: string }> = {
  instant_services:      { icon: '⚡', route: '/customer/services/insta',               color: 'bg-amber-50 border-amber-300',  badgeColor: 'bg-teal-100 text-teal-700' },
  subscription_services: { icon: '📅', route: '/customer/services/subscription',         color: 'bg-blue-50 border-blue-300',    badgeColor: 'bg-teal-100 text-teal-700' },
  deep_cleaning:         { icon: '✨', route: '/customer/deep-cleaning',                 color: 'bg-green-50 border-green-300',  badgeColor: 'bg-teal-100 text-teal-700' },
  spot_cleaning:         { icon: '🧹', route: '/customer/services/category/spot_cleaning',      color: 'bg-cyan-50 border-cyan-300',    badgeColor: 'bg-cyan-100 text-cyan-700' },
  kitchen_services:      { icon: '🍳', route: '/customer/services/category/kitchen_services',   color: 'bg-orange-50 border-orange-300',badgeColor: 'bg-orange-100 text-orange-700' },
  bathroom_services:     { icon: '🚿', route: '/customer/services/category/bathroom_services',  color: 'bg-purple-50 border-purple-300',badgeColor: 'bg-purple-100 text-purple-700' },
  furniture_services:    { icon: '🛋️', route: '/customer/services/category/furniture_services', color: 'bg-rose-50 border-rose-300',    badgeColor: 'bg-rose-100 text-rose-700' },
  hvac_services:         { icon: '❄️', route: '/customer/services/category/hvac_services',      color: 'bg-sky-50 border-sky-300',      badgeColor: 'bg-sky-100 text-sky-700' },
  other:                 { icon: '🏠', route: '/customer/services/category/other',               color: 'bg-slate-50 border-slate-300',  badgeColor: 'bg-slate-100 text-slate-700' },
};

const getCategoryRoute = (serviceCategory: string) =>
  (CATEGORY_META[serviceCategory] ?? CATEGORY_META['other']).route;

const getCategoryIcon = (serviceCategory: string) =>
  (CATEGORY_META[serviceCategory] ?? CATEGORY_META['other']).icon;

const getCategoryColors = (serviceCategory: string) =>
  CATEGORY_META[serviceCategory] ?? CATEGORY_META['other'];

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
  const [todayAvailableSlotCount, setTodayAvailableSlotCount] = useState<number | null>(null);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('favouriteServiceIds');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });

  const toggleFavourite = (serviceId: string) => {
    setFavouriteIds(prev => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      localStorage.setItem('favouriteServiceIds', JSON.stringify([...next]));
      return next;
    });
  };

  // Count how many of today's slots are still in the future
  const countFutureSlots = (slots: string[]): number => {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes() + 30; // 30-min buffer
    return slots.filter((t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m > nowMins;
    }).length;
  };

  useEffect(() => {
    fetchProfile();
    // Fetch available service categories
    servicesAPI.getCategories()
      .then((data: { categories: { serviceCategory: string }[] }) => {
        setAvailableCategories((data.categories || []).map((c) => c.serviceCategory));
      })
      .catch(() => {});
    // Fetch today's available slot count once
    const today = new Date().toISOString().split('T')[0];
    settingsAPI.getAvailableSlotsByDate(today)
      .then((data: { slots?: string[] }) => {
        setTodayAvailableSlotCount(countFutureSlots(data?.slots || []));
      })
      .catch(() => setTodayAvailableSlotCount(null));

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
      toast.warning(t('customer.services.areaNotServiceable'));
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
    return service.serviceCategory === activeCategory
      || service.category === activeCategory;
  };

  const displayedServices = services.filter(matchesCategory).sort((a, b) => {
    const aFav = favouriteIds.has(a._id) ? 0 : 1;
    const bFav = favouriteIds.has(b._id) ? 0 : 1;
    return aFav - bFav;
  });

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
        <div className="w-full px-4 sm:px-5 md:px-7 lg:px-10 space-y-6 pb-20 md:pb-0">
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


          {/* Dynamic Category Cards — driven by serviceCategory values from the API */}
          {availableCategories.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {availableCategories.map((cat) => {
                const colors = getCategoryColors(cat);
                const label = t(`customer.services.cat.${cat}`, cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
                return (
                  <button
                    key={cat}
                    onClick={() => navigate(getCategoryRoute(cat))}
                    className={`p-3 rounded-2xl border-2 text-center transition-all ${colors.color} hover:border-primary/60 hover:shadow-md active:scale-95`}
                  >
                    <div className="text-2xl mb-1">{getCategoryIcon(cat)}</div>
                    <p className="text-xs font-semibold text-foreground leading-tight">{label}</p>
                    <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors.badgeColor}`}>
                      {t('customer.services.explore', 'Explore')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

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
              {displayedServices.map((service) => (
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
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <button
                            onClick={() => toggleFavourite(service._id)}
                            aria-label={favouriteIds.has(service._id) ? 'Remove from favourites' : 'Add to favourites'}
                            className="p-1 rounded-lg hover:bg-accent transition-colors"
                          >
                            <Star className={`w-4 h-4 transition-colors ${favouriteIds.has(service._id) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                          </button>
                          {service.availability && (
                            <span className={`text-xs ${service.availability.available ? 'badge-success' : 'badge-warning'}`}>
                              {service.availability.available ? t('customer.services.available') : t('customer.services.limited')}
                            </span>
                          )}
                          {/* Slot count badge — skip for deep cleaning (quote) and subscriptions */}
                          {!service.isQuoteService && !service.subscriptionOptions?.enabled && todayAvailableSlotCount !== null && (
                            <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              todayAvailableSlotCount === 0
                                ? 'bg-red-100 text-red-700'
                                : todayAvailableSlotCount <= 4
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-primary/10 text-primary'
                            }`}>
                              <CalendarClock className="w-3 h-3" />
                              {todayAvailableSlotCount === 0
                                ? t('servicesPageExtra.fullyBooked')
                                : todayAvailableSlotCount <= 4
                                ? t('servicesPageExtra.slotsLeft', { count: todayAvailableSlotCount })
                                : t('servicesPageExtra.slotsToday', { count: todayAvailableSlotCount })}
                            </span>
                          )}
                        </div>
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
                        {service.isQuoteService ? (
                          <span className="text-sm font-bold text-green-700">{t('servicesPageExtra.customQuote')}</span>
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
                          {requestingServiceId === service._id ? t('servicesPageExtra.sendingRequest') : t('servicesPageExtra.requestInLocation')}
                        </button>
                      ) : service.isQuoteService ? (
                        <Link
                          to="/customer/deep-cleaning"
                          className="w-full text-xs py-2 px-3 flex items-center justify-center gap-1 rounded-xl transition-colors btn-brand"
                        >
                          {t('servicesPageExtra.bookNow')} ✨
                        </Link>
                      ) : service.subscriptionOptions?.enabled ? (
                        <Link
                          to={`/customer/subscribe/${service._id}`}
                          className="w-full text-xs py-2 px-3 flex items-center justify-center gap-1 rounded-xl transition-colors btn-brand"
                        >
                          {t('servicesPageExtra.subscribe')} 📅
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
