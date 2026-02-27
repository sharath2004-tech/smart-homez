import AppLayout from "@/components/AppLayout";
import LocationSelector, { LocationData } from "@/components/LocationSelector";
import { authAPI, servicesAPI } from "@/lib/api";
import { motion } from "framer-motion";
import { ChevronRight, Clock, Filter, MapPin, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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

const ServicesPage = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
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

  useEffect(() => {
    if (selectedLocation && !showLocationSelector) {
      fetchServices();
    }
  }, [selectedLocation, search]);

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
      alert("Sorry, we don't service this area yet. We'll notify you when we expand!");
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

  const fetchServices = async () => {
    try {
      setLoading(true);
      const defaultAddress = profile?.addresses?.find((addr: any) => addr.isDefault);
      
      const params: any = {
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
      setServices(data.services || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

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
          <motion.div 
            className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-2xl font-bold font-heading text-foreground mb-1">Our Services</h1>
            <p className="text-muted-foreground text-sm">Choose from a wide range of home services</p>
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
                    : 'Location set'}
                </p>
                <button 
                  onClick={handleChangeLocation}
                  className="text-xs text-primary hover:underline"
                >
                  Change Location
                </button>
              </motion.div>
            )}
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
              placeholder="Search services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <motion.button 
            className="p-3 bg-card border border-border rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            whileHover={{ scale: 1.05, rotate: 15 }}
            whileTap={{ scale: 0.95 }}
          >
            <Filter className="w-4 h-4" />
          </motion.button>
        </motion.div>

        {/* Loading State */}
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
            <p className="text-sm text-muted-foreground">Loading services...</p>
          </motion.div>
        ) : services.length === 0 ? (
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
            <p className="font-medium text-foreground">No services found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or check back later</p>
          </motion.div>
        ) : (
          <motion.div 
            className="grid gap-4 sm:grid-cols-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {services.map((service, index) => (
              <motion.div 
                key={service._id} 
                className="card-elevated-hover p-5 group"
                variants={itemVariants}
                custom={index}
                whileHover={{ scale: 1.03, y: -5 }}
                transition={{ type: "spring", stiffness: 300 }}
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
                          {service.availability.available ? 'Available' : 'Limited'}
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
                        ? `${service.availability.workersCount} workers nearby`
                        : service.availability.reason}
                    </span>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-foreground">₹{service.price}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{service.duration} min</span>
                    </div>
                  </div>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Link
                      to={`/customer/book/${service._id}`}
                      className={`text-xs py-2 px-4 flex items-center gap-1 rounded-xl transition-colors ${
                      service.availability?.available 
                        ? 'btn-brand'
                        : 'bg-muted text-muted-foreground hover:bg-border'
                    }`}
                  >
                    {service.availability?.available ? 'Book' : 'View'} <ChevronRight className="w-3 h-3" />
                    </Link>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </AppLayout>
      )}
    </>
  );
};

export default ServicesPage;
