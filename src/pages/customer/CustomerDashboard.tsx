import AppLayout from "@/components/AppLayout";
import { useGeolocation } from "@/hooks/useGeolocation";
import { authAPI, bookingsAPI, locationsAPI } from "@/lib/api";
import { ArrowRight, Bell, ChevronRight, Clock, MapPin, Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface Booking {
  _id: string;
  service: { name: string };
  worker?: { name: string; workerProfile: { rating: number } };
  scheduledDate: string;
  scheduledTime: string;
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

const quickServices = [
  { icon: "🧹", name: "Insta Maid", subtitle: "Available now", badge: "15 min" },
  { icon: "✨", name: "Deep Clean", subtitle: "Full home", badge: "Fixed price" },
  { icon: "🍳", name: "Kitchen", subtitle: "Deep clean", badge: "" },
  { icon: "🚿", name: "Bathroom", subtitle: "Sanitize", badge: "" },
];

const CustomerDashboard = () => {
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nearbyWorkersCount, setNearbyWorkersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { latitude, longitude, error: locationError } = useGeolocation();

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
    ? "Location unavailable"
    : latitude && longitude
    ? "Current location"
    : "Loading location...";

  const formatDate = (dateString: string, timeString?: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dateText = "";
    if (date.toDateString() === today.toDateString()) {
      dateText = "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dateText = "Tomorrow";
    } else {
      dateText = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    }

    return timeString ? `${dateText}, ${timeString}` : dateText;
  };

  return (
    <AppLayout userType="customer" userName={profile?.name || "Loading..."}>
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20 md:pb-0">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-sm mb-1">Good morning 👋</p>
            <h1 className="text-2xl font-bold font-heading text-foreground">{profile?.name || "Loading..."}</h1>
          </div>
          <button className="relative p-2.5 bg-card rounded-xl border border-border">
            <Bell className="w-5 h-5 text-muted-foreground" />
            {upcomingBookings.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full"></span>
            )}
          </button>
        </div>

        {/* Location bar */}
        <Link to="/customer/profile" className="flex items-center gap-2 p-3 bg-card rounded-xl border border-border hover:bg-muted transition-colors">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm text-foreground font-medium truncate">{displayAddress}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
        </Link>

        {/* Hero Banner */}
        {nearbyWorkersCount > 0 && (
          <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "var(--gradient-brand)" }}>
            <div className="absolute right-0 top-0 bottom-0 w-32 flex items-center justify-center text-5xl opacity-20 pr-4">🏠</div>
            <div className="relative">
              <div className="badge-primary mb-3 inline-flex text-xs" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white" }}>
                <Sparkles className="w-3 h-3" />
                <span>Insta service available</span>
              </div>
              <h2 className="text-xl font-bold font-heading text-primary-foreground mb-1">Get a maid in 15 minutes!</h2>
              <p className="text-primary-foreground/70 text-sm mb-4">{nearbyWorkersCount} workers available near you right now</p>
              <Link
                to="/customer/services"
                className="inline-flex items-center gap-2 bg-primary-foreground text-primary font-semibold py-2.5 px-5 rounded-xl text-sm hover:opacity-90 transition-all"
              >
                Book Now <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Quick Services */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold font-heading text-foreground">Quick Book</h2>
            <Link to="/customer/services" className="text-sm text-primary font-medium flex items-center gap-1">
              All services <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickServices.map((s) => (
              <Link to="/customer/services" key={s.name} className="card-elevated-hover p-4 text-center group">
                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">{s.icon}</div>
                <p className="text-sm font-semibold text-foreground">{s.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.subtitle}</p>
                {s.badge && <span className="badge-primary mt-2 text-xs">{s.badge}</span>}
              </Link>
            ))}
          </div>
        </div>

        {/* Upcoming Bookings */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold font-heading text-foreground">Upcoming Bookings</h2>
            <Link to="/customer/bookings" className="text-sm text-primary font-medium flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm">Loading bookings...</p>
            </div>
          ) : upcomingBookings.length === 0 ? (
            <div className="card-elevated p-8 text-center">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-sm font-medium text-foreground">No upcoming bookings</p>
              <p className="text-xs text-muted-foreground mt-1">Book a service to get started</p>
              <Link to="/customer/services" className="btn-brand mt-4 text-sm inline-flex items-center gap-2">
                Browse Services <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map((b) => (
                <div key={b._id} className="card-elevated p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-xl shrink-0">
                    {b.service.name.toLowerCase().includes("deep") ? "✨" : "🧹"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">{b.service.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {b.worker?.name || "Worker will be assigned"}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" /> {formatDate(b.scheduledDate, b.scheduledTime)}
                      </span>
                      {b.worker && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="w-3 h-3 fill-warning text-warning" /> {b.worker.workerProfile.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold badge-primary">
                    {b.status === "confirmed" ? "Confirmed" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subscription banner */}
        <div className="card-elevated p-5 flex items-center gap-4 bg-secondary">
          <div className="text-4xl">📅</div>
          <div className="flex-1">
            <p className="font-bold text-foreground font-heading text-sm">Save 20% with Monthly Plan</p>
            <p className="text-xs text-muted-foreground mt-0.5">Regular cleaning at discounted rates</p>
          </div>
          <Link to="/customer/services" className="btn-brand text-xs py-2 px-4 shrink-0">
            Explore
          </Link>
        </div>
      </div>
    </AppLayout>
  );
};

export default CustomerDashboard;
