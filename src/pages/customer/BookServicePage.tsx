import AppLayout from "@/components/AppLayout";
import { authAPI, bookingsAPI, servicesAPI } from "@/lib/api";
import { Calendar, ChevronLeft, Clock, Info, MapPin, Sparkles, Star, User, Users, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

interface Service {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration: number;
  pricingPlans?: {
    oneTime: number;
    daily: number;
    weekly: number;
    monthly: number;
  };
}

interface Worker {
  _id: string;
  name: string;
  email: string;
  phone: string;
  profileImage?: string;
  workerProfile: {
    specialization: string;
    rating: number;
    completedBookings: number;
    availability: boolean;
    experience?: number;
  };
  currentLocation?: {
    coordinates: number[];
    area: string;
    city: string;
  };
  gender?: string;
}

interface Preferences {
  workerGenderPreference?: string;
  preferredWorkers?: string[];
  languagePreference?: string;
  religionPreference?: string;
  specialInstructions?: string;
}

type TimeSlot = 'now' | 'morning' | 'afternoon' | 'evening' | 'night';
type BookingMode = 'now' | 'schedule';

const BookServicePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  
  // Booking mode: "now" or "schedule"
  const [bookingMode, setBookingMode] = useState<BookingMode>('now');
  
  // Booking form state
  const [bookingType, setBookingType] = useState<'oneTime' | 'daily' | 'weekly' | 'monthly'>('oneTime');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot>('now');
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Preferences>({
    workerGenderPreference: 'any',
    languagePreference: 'any',
    religionPreference: 'any',
    specialInstructions: ''
  });
  
  // Subscription details state
  const [subscriptionStartDate, setSubscriptionStartDate] = useState('');
  const [subscriptionEndDate, setSubscriptionEndDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [durationPerSession, setDurationPerSession] = useState(1);
  const [selectedDays, setSelectedDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  const [autoRenewal, setAutoRenewal] = useState(true);
  const [allowPause, setAllowPause] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [serviceData, profileData] = await Promise.all([
        servicesAPI.getById(id!),
        authAPI.getProfile()
      ]);
      setService(serviceData.service);
      setProfile(profileData.user || profileData);
      
      // Load saved preferences if any
      if (profileData.user?.preferences) {
        setPreferences({
          workerGenderPreference: profileData.user.preferences.workerGenderPreference || 'any',
          languagePreference: profileData.user.preferences.languagePreference || 'any',
          religionPreference: profileData.user.preferences.religionPreference || 'any',
          specialInstructions: profileData.user.preferences.specialInstructions || ''
        });
      }
      
      // Fetch available workers for this service
      await fetchAvailableWorkers(serviceData.service?.category);
    } catch (error) {
      console.error('Fetch data error:', error);
      toast.error('Failed to load service');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableWorkers = async (category?: string) => {
    try {
      setLoadingWorkers(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/users/workers/available?specialization=${category || ''}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch workers');
      
      const data = await response.json();
      setWorkers(data.workers || []);
    } catch (error) {
      console.error('Fetch workers error:', error);
    } finally {
      setLoadingWorkers(false);
    }
  };

  // Calculate distance between two coordinates using Haversine formula  (in km)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Calculate ETA based on distance (assuming 30 km/h average speed in city)
  const calculateETA = (distanceKm: number): string => {
    const avgSpeed = 30; // km/h
    const hours = distanceKm / avgSpeed;
    const minutes = Math.round(hours * 60);
    
    if (minutes < 5) return '5 mins';
    if (minutes < 60) return `${minutes} mins`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  };

  // Get worker distance and ETA
  const getWorkerDistanceETA = (worker: Worker): { distance: number; eta: string } => {
    const userLocation = localStorage.getItem('userLocation');
    if (!userLocation || !worker.currentLocation?.coordinates) {
      return { distance: 0, eta: 'N/A' };
    }
    
    const location = JSON.parse(userLocation);
    const distance = calculateDistance(
      location.lat,
      location.lng,
      worker.currentLocation.coordinates[1],
      worker.currentLocation.coordinates[0]
    );
    
    return {
      distance: Math.round(distance * 10) / 10, // Round to 1 decimal
      eta: calculateETA(distance)
    };
  };

  // Get time from time slot
  const getTimeFromSlot = (slot: TimeSlot, date?: string): string => {
    const now = new Date();
    
    switch (slot) {
      case 'now': {
        // Round up to next 30 min interval + 1 hour for preparation
        const minutes = Math.ceil((now.getMinutes() + 60) / 30) * 30;
        const hours = now.getHours() + Math.floor(minutes / 60);
        return `${String(hours % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      }
      case 'morning':
        return '09:00';
      case 'afternoon':
        return '14:00';
      case 'evening':
        return '18:00';
      case 'night':
        return '20:00';
      default:
        return '09:00';
    }
  };

  const calculatePrice = () => {
    if (!service) return 0;
    
    if (service.pricingPlans) {
      return service.pricingPlans[bookingType];
    }
    
    // Fallback to default price
    return service.price;
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation for subscription bookings
    if (bookingType !== 'oneTime') {
      if (!selectedWorker) {
        toast.error('Please select a worker for subscription booking');
        return;
      }
      if (!subscriptionStartDate) {
        toast.error('Please select subscription start date');
        return;
      }
      if (bookingType === 'weekly' && selectedDays.length === 0) {
        toast.error('Please select at least one day for weekly subscription');
        return;
      }
    }
    
    const selectedTime = bookingMode === 'now' 
      ? getTimeFromSlot('now')
      : getTimeFromSlot(selectedTimeSlot, selectedDate);
    
    if (bookingMode === 'schedule' && !selectedDate && bookingType === 'oneTime') {
      toast.error('Please select a date');
      return;
    }

    try {
      setBooking(true);
      
      // Get user location from localStorage
      const userLocation = localStorage.getItem('userLocation');
      let location = userLocation ? JSON.parse(userLocation) : null;
      
      // Validate location coordinates
      const hasValidLocation = location && 
        typeof location.lng === 'number' && 
        typeof location.lat === 'number' &&
        !isNaN(location.lng) && 
        !isNaN(location.lat) &&
        location.lng >= -180 && location.lng <= 180 &&
        location.lat >= -90 && location.lat <= 90;

      // If no valid location in localStorage, send partial location
      // Backend will fallback to user's saved address
      if (!hasValidLocation) {
        console.log('No valid location in localStorage, backend will use saved address');
        location = location || {
          address: '',
          area: '',
          city: ''
        };
      }

      const bookingDate = bookingMode === 'now'
        ? new Date().toISOString().split('T')[0]
        : selectedDate;

      const baseBookingData = {
        service: service?._id,
        bookingDate: bookingType === 'oneTime' ? bookingDate : subscriptionStartDate,
        startTime: bookingType === 'oneTime' ? selectedTime : preferredTime,
        endTime: calculateEndTime(
          bookingType === 'oneTime' ? selectedTime : preferredTime, 
          bookingType === 'oneTime' ? (service?.duration || 60) : (durationPerSession * 60)
        ),
        totalAmount: calculatePrice(),
        bookingType,
        // If worker manually selected, assign directly; otherwise auto-assign
        ...(selectedWorker && { worker: selectedWorker }),
        preferences: {
          ...preferences,
          ...(selectedWorker && { preferredWorkers: [selectedWorker] })
        },
        location: {
          ...(hasValidLocation && { coordinates: [location.lng, location.lat] }),
          address: location.address || '',
          area: location.area || '',
          city: location.city || ''
        } as { coordinates?: number[], address: string, area: string, city: string },
        // Enable auto-assignment only when no worker manually selected AND it's one-time
        autoAssign: !selectedWorker && bookingType === 'oneTime'
      };

      // Add subscription-specific data
      const bookingData = bookingType === 'oneTime' 
        ? baseBookingData 
        : {
            ...baseBookingData,
            isSubscription: true,
            subscriptionDetails: {
              startDate: subscriptionStartDate,
              endDate: subscriptionEndDate || null,
              preferredTime,
              durationPerSession,
              selectedDays: bookingType === 'weekly' ? selectedDays : [],
              frequency: bookingType,
              autoRenewal,
              allowPause,
              fixedWorker: selectedWorker // Fixed worker for all subscription bookings
            }
          };

      const response = await bookingsAPI.create(bookingData);
      
      // Check if worker was auto-assigned
      const wasAssigned = response.booking?.worker;
      const workerName = response.booking?.worker?.name;
      
      if (bookingType !== 'oneTime') {
        toast.success(
          `Subscription created! ${workerName} is assigned to all your bookings.`,
          { duration: 5000 }
        );
      } else if (wasAssigned) {
        toast.success(
          bookingMode === 'now' 
            ? `Booking confirmed! ${workerName} is on the way.`
            : `Booking confirmed! ${workerName} assigned to your service.`
        );
      } else {
        toast.success(
          'Booking created! We are finding the best available worker for you.'
        );
      }
      
      navigate('/customer/bookings');
    } catch (error: unknown) {
      console.error('Booking error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create booking';
      toast.error(errorMessage);
    } finally {
      setBooking(false);
    }
  };

  const calculateEndTime = (startTime: string, durationMinutes: number) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  };

  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <AppLayout userType="customer" userName={profile?.name || "Loading..."}>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading service...</p>
        </div>
      </AppLayout>
    );
  }

  if (!service) {
    return (
      <AppLayout userType="customer" userName={profile?.name || "Guest"}>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <div className="text-5xl mb-3">😕</div>
          <p className="font-medium text-foreground">Service not found</p>
          <Link to="/customer/services" className="text-primary hover:underline text-sm mt-2 inline-block">
            Back to services
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="customer" userName={profile?.name || "Guest"}>
      <div className="max-w-2xl mx-auto space-y-6 pb-20 md:pb-0">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/customer/services" className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Book Service</h1>
            <p className="text-sm text-muted-foreground">Complete your booking details</p>
          </div>
        </div>

        {/* Service Details Card */}
        <div className="card-elevated p-6">
          <h2 className="text-xl font-bold text-foreground mb-2">{service.name}</h2>
          <p className="text-sm text-muted-foreground mb-4">{service.description}</p>
          
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{service.duration} min</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>
                {typeof profile?.currentLocation === 'string' 
                  ? profile.currentLocation 
                  : profile?.currentLocation?.area || profile?.currentLocation?.city || 'Your location'}
              </span>
            </div>
            {!loadingWorkers && workers.length > 0 && (
              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
                <Users className="w-4 h-4" />
                <span>{workers.filter(w => w.workerProfile.availability).length} workers available</span>
              </div>
            )}
          </div>
        </div>

        {/* Subscription Showcase Banner */}
        <div className="card-elevated p-6 bg-gradient-to-r from-primary/5 to-primary/10 border-2 border-primary/20">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground mb-1 flex items-center gap-2">
                Save up to 20% with Subscriptions
                <span className="badge-primary text-xs">Popular</span>
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Book recurring services and enjoy discounts, priority booking, and flexible scheduling.
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  ✓ Daily, Weekly & Monthly plans
                </span>
                <span className="flex items-center gap-1">
                  ✓ Pause anytime
                </span>
                <span className="flex items-center gap-1">
                  ✓ Priority support
                </span>
              </div>
              <Link 
                to={`/customer/subscribe/${id}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                View Subscription Plans →
              </Link>
            </div>
          </div>
        </div>

        {/* Booking Form */}
        <form onSubmit={handleBooking} className="space-y-6">
          {/* Booking Mode: Book Now vs Schedule */}
          <div className="card-elevated p-6">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              When do you need it?
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBookingMode('now')}
                className={`p-4 border-2 rounded-xl transition-all ${
                  bookingMode === 'now' 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-2 justify-center mb-1">
                  <Zap className="w-5 h-5 text-primary" />
                  <div className="font-semibold text-foreground">Book Now</div>
                </div>
                <div className="text-xs text-muted-foreground">Within 1-2 hours</div>
              </button>

              <button
                type="button"
                onClick={() => setBookingMode('schedule')}
                className={`p-4 border-2 rounded-xl transition-all ${
                  bookingMode === 'schedule' 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-2 justify-center mb-1">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div className="font-semibold text-foreground">Schedule</div>
                </div>
                <div className="text-xs text-muted-foreground">Pick date & time</div>
              </button>
            </div>
          </div>

          {/* Time Slot Selection (for Schedule mode) */}
          {bookingMode === 'schedule' && (
            <div className="card-elevated p-6">
              <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Select Date & Time Slot
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Select Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={getTomorrowDate()}
                    className="input-clean"
                    required={bookingMode === 'schedule'}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Select Time Slot
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['morning', 'afternoon', 'evening', 'night'].map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedTimeSlot(slot as TimeSlot)}
                        className={`p-3 border rounded-lg text-sm capitalize transition-all ${
                          selectedTimeSlot === slot
                            ? 'border-primary bg-primary/5 text-foreground font-medium'
                            : 'border-border hover:border-primary/50 text-muted-foreground'
                        }`}
                      >
                        {slot === 'morning' && '🌅 Morning (9:00 AM)'}
                        {slot === 'afternoon' && '☀️ Afternoon (2:00 PM)'}
                        {slot === 'evening' && '🌆 Evening (6:00 PM)'}
                        {slot === 'night' && '🌙 Night (8:00 PM)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Booking Type Selection with Subscriptions */}
          <div className="card-elevated p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Select Booking Plan
              </h3>
              {bookingType !== 'oneTime' && (
                <span className="badge-primary text-xs">Save up to 35%</span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBookingType('oneTime')}
                className={`p-4 border-2 rounded-xl transition-all ${
                  bookingType === 'oneTime' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="font-semibold text-foreground">One Time</div>
                <div className="text-xs text-muted-foreground mt-1">Single service</div>
                <div className="text-lg font-bold text-primary mt-2">
                  ₹{service.pricingPlans?.oneTime || service.price}
                </div>
                <div className="text-xs text-muted-foreground mt-2">✓ Flexible scheduling</div>
              </button>

              <button
                type="button"
                onClick={() => setBookingType('daily')}
                className={`p-4 border-2 rounded-xl transition-all relative ${
                  bookingType === 'daily' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="absolute top-2 right-2 text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">15% OFF</div>
                <div className="font-semibold text-foreground">Daily Plan</div>
                <div className="text-xs text-muted-foreground mt-1">Service every day</div>
                <div className="text-lg font-bold text-primary mt-2">
                  ₹{service.pricingPlans?.daily || Math.round(service.price * 0.85)}/day
                </div>
                <div className="text-xs text-muted-foreground mt-2">✓ Priority booking</div>
              </button>

              <button
                type="button"
                onClick={() => setBookingType('weekly')}
                className={`p-4 border-2 rounded-xl transition-all relative ${
                  bookingType === 'weekly' 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/30' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                  <span className="text-xs font-semibold text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded">Most Popular</span>
                  <span className="text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">25% OFF</span>
                </div>
                <div className="font-semibold text-foreground">Weekly Plan</div>
                <div className="text-xs text-muted-foreground mt-1">Choose specific days</div>
                <div className="text-lg font-bold text-primary mt-2">
                  ₹{service.pricingPlans?.weekly || Math.round(service.price * 0.75 * 7)}/week
                </div>
                <div className="text-xs text-muted-foreground mt-2">✓ Pause anytime ✓ Dedicated worker</div>
              </button>

              <button
                type="button"
                onClick={() => setBookingType('monthly')}
                className={`p-4 border-2 rounded-xl transition-all relative ${
                  bookingType === 'monthly' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="absolute top-2 right-2 text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">35% OFF</div>
                <div className="font-semibold text-foreground">Monthly Plan</div>
                <div className="text-xs text-muted-foreground mt-1">Best value • 30 days</div>
                <div className="text-lg font-bold text-primary mt-2">
                  ₹{service.pricingPlans?.monthly || Math.round(service.price * 0.65 * 30)}/month
                </div>
                <div className="text-xs text-muted-foreground mt-2">✓ Premium support ✓ Free rescheduling</div>
              </button>
            </div>
            
            {/* Subscription Benefits */}
            {bookingType !== 'oneTime' && (
              <div className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
                <div className="flex items-start gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">Subscription Benefits</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Cancel or pause your subscription anytime with 24-hour notice</li>
                      <li>• Priority worker assignment during peak hours</li>
                      <li>• Dedicated support team for subscription members</li>
                      <li>• Free unlimited rescheduling (up to 2 hours before service)</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Subscription Schedule Details */}
          {bookingType !== 'oneTime' && (
            <div className="card-elevated p-6">
              <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Subscription Schedule
              </h3>
              
              <div className="space-y-4">
                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Start Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    value={subscriptionStartDate}
                    onChange={(e) => setSubscriptionStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="input-clean"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">When should your subscription begin?</p>
                </div>

                {/* End Date (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    End Date <span className="text-xs text-muted-foreground">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={subscriptionEndDate}
                    onChange={(e) => setSubscriptionEndDate(e.target.value)}
                    min={subscriptionStartDate || new Date().toISOString().split('T')[0]}
                    className="input-clean"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Leave empty for ongoing subscription</p>
                </div>

                {/* Preferred Time */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Preferred Time <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="time"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="input-clean"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">What time should the worker arrive?</p>
                </div>

                {/* Duration Per Session */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Duration Per Session <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={durationPerSession}
                    onChange={(e) => setDurationPerSession(Number(e.target.value))}
                    className="input-clean"
                    required
                  >
                    <option value={0.5}>30 minutes</option>
                    <option value={1}>1 hour</option>
                    <option value={1.5}>1.5 hours</option>
                    <option value={2}>2 hours</option>
                    <option value={3}>3 hours</option>
                    <option value={4}>4 hours</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">How long should each service last?</p>
                </div>

                {/* Day Selection for Weekly */}
                {bookingType === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Select Days <span className="text-destructive">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { value: 'monday', label: 'Monday' },
                        { value: 'tuesday', label: 'Tuesday' },
                        { value: 'wednesday', label: 'Wednesday' },
                        { value: 'thursday', label: 'Thursday' },
                        { value: 'friday', label: 'Friday' },
                        { value: 'saturday', label: 'Saturday' },
                        { value: 'sunday', label: 'Sunday' }
                      ].map((day) => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            if (selectedDays.includes(day.value)) {
                              setSelectedDays(selectedDays.filter(d => d !== day.value));
                            } else {
                              setSelectedDays([...selectedDays, day.value]);
                            }
                          }}
                          className={`p-2 border-2 rounded-lg text-sm font-medium transition-all ${
                            selectedDays.includes(day.value)
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/50'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {selectedDays.length > 0 
                        ? `Selected: ${selectedDays.length} day${selectedDays.length > 1 ? 's' : ''} per week`
                        : 'Please select at least one day'
                      }
                    </p>
                  </div>
                )}

                {/* Auto-Renewal Toggle */}
                <div className="flex items-start justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Auto-Renewal</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Automatically renew subscription when it ends
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoRenewal(!autoRenewal)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      autoRenewal ? 'bg-primary' : 'bg-border'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        autoRenewal ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Allow Pause Toggle */}
                <div className="flex items-start justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Allow Pause</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Enable ability to pause subscription temporarily
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllowPause(!allowPause)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      allowPause ? 'bg-primary' : 'bg-border'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        allowPause ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Subscription Summary */}
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-sm font-semibold text-foreground mb-2">📋 Summary</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>• Plan: <span className="font-medium text-foreground capitalize">{bookingType}</span></p>
                    <p>• Frequency: <span className="font-medium text-foreground">
                      {bookingType === 'daily' && 'Every day'}
                      {bookingType === 'weekly' && `${selectedDays.length} days per week`}
                      {bookingType === 'monthly' && 'Monthly (30 days)'}
                    </span></p>
                    <p>• Time: <span className="font-medium text-foreground">{preferredTime}</span></p>
                    <p>• Duration: <span className="font-medium text-foreground">{durationPerSession} hour{durationPerSession > 1 ? 's' : ''}</span></p>
                    {subscriptionStartDate && <p>• Starts: <span className="font-medium text-foreground">{new Date(subscriptionStartDate).toLocaleDateString()}</span></p>}
                    {subscriptionEndDate && <p>• Ends: <span className="font-medium text-foreground">{new Date(subscriptionEndDate).toLocaleDateString()}</span></p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Available Workers Section (Pronto-style) */}
          {workers.length > 0 && (
            <div className="card-elevated p-6">
              <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Available Workers {workers.filter(w => w.workerProfile.availability).length > 0 && 
                  <span className="text-sm font-normal text-muted-foreground">
                    ({workers.filter(w => w.workerProfile.availability).length} nearby)
                  </span>
                }
              </h3>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {workers.filter(w => w.workerProfile.availability).slice(0, 5).map((worker) => {
                  const { distance, eta } = getWorkerDistanceETA(worker);
                  return (
                    <button
                      key={worker._id}
                      type="button"
                      onClick={() => setSelectedWorker(worker._id === selectedWorker ? null : worker._id)}
                      className={`w-full p-4 border-2 rounded-xl text-left transition-all ${
                        selectedWorker === worker._id
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-bold text-lg shrink-0">
                          {worker.name.charAt(0).toUpperCase()}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className="font-semibold text-foreground">{worker.name}</h4>
                            <div className="flex items-center gap-1 text-amber-500">
                              <Star className="w-4 h-4 fill-current" />
                              <span className="text-sm font-medium">{worker.workerProfile.rating.toFixed(1)}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <span className="capitalize">{worker.workerProfile.specialization}</span>
                            <span>•</span>
                            <span>{worker.workerProfile.completedBookings} jobs</span>
                            {worker.workerProfile.experience && (
                              <>
                                <span>•</span>
                                <span>{worker.workerProfile.experience} yrs exp</span>
                              </>
                            )}
                          </div>
                          
                          {distance > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium">
                                {distance} km away
                              </div>
                              <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                ETA: {eta}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
                
                {workers.filter(w => w.workerProfile.availability).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No workers available right now</p>
                    <p className="text-sm">Please try scheduling for later</p>
                  </div>
                )}
              </div>
              
              <div className="mt-3 pt-3 border-t border-border">
                {bookingType !== 'oneTime' ? (
                  <div className="flex items-start gap-2">
                    {selectedWorker ? (
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                        ✓ This worker will be assigned to all your subscription bookings
                      </p>
                    ) : (
                      <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                        ⚠ Please select a worker - Required for subscription bookings
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {selectedWorker 
                      ? '✓ Selected worker will be assigned' 
                      : 'Leave unselected for automatic assignment based on availability and rating'
                    }
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Worker Preferences */}
          <div className="card-elevated p-6">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Additional Preferences
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Gender Preference
                </label>
                <select
                  value={preferences.workerGenderPreference}
                  onChange={(e) => setPreferences({ ...preferences, workerGenderPreference: e.target.value })}
                  className="input-clean"
                >
                  <option value="any">No Preference</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Language Preference
                </label>
                <select
                  value={preferences.languagePreference}
                  onChange={(e) => setPreferences({ ...preferences, languagePreference: e.target.value })}
                  className="input-clean"
                >
                  <option value="any">No Preference</option>
                  <option value="english">English</option>
                  <option value="hindi">Hindi</option>
                  <option value="tamil">Tamil</option>
                  <option value="telugu">Telugu</option>
                  <option value="kannada">Kannada</option>
                  <option value="malayalam">Malayalam</option>
                  <option value="bengali">Bengali</option>
                  <option value="marathi">Marathi</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Religion Preference
                </label>
                <select
                  value={preferences.religionPreference}
                  onChange={(e) => setPreferences({ ...preferences, religionPreference: e.target.value })}
                  className="input-clean"
                >
                  <option value="any">No Preference</option>
                  <option value="hindu">Hindu</option>
                  <option value="muslim">Muslim</option>
                  <option value="christian">Christian</option>
                  <option value="sikh">Sikh</option>
                  <option value="buddhist">Buddhist</option>
                  <option value="jain">Jain</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Special Instructions (Optional)
                </label>
                <textarea
                  value={preferences.specialInstructions}
                  onChange={(e) => setPreferences({ ...preferences, specialInstructions: e.target.value.slice(0, 500) })}
                  placeholder="Add any special requirements or instructions..."
                  className="input-clean resize-none"
                  rows={4}
                  maxLength={500}
                />
                <div className="text-xs text-muted-foreground mt-1 text-right">
                  {preferences.specialInstructions?.length || 0}/500 characters
                </div>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          {bookingType !== 'oneTime' && (
            <div className="flex gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">Recurring Booking</p>
                <p className="text-blue-700 dark:text-blue-300 mt-1">
                  This {bookingType} booking will automatically schedule services. 
                  You can manage or cancel anytime from your bookings page.
                </p>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="card-elevated p-6 bg-accent border-2 border-primary/20">
            <h3 className="font-bold text-foreground mb-4">Booking Summary</h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service</span>
                <span className="font-medium text-foreground">{service.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium text-foreground capitalize">{bookingType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium text-foreground">{service.duration} minutes</span>
              </div>
              <div className="h-px bg-border my-3"></div>
              <div className="flex justify-between text-lg">
                <span className="font-bold text-foreground">Total</span>
                <span className="font-bold text-primary">₹{calculatePrice()}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Link 
              to="/customer/services"
              className="flex-1 py-3 border-2 border-border rounded-xl text-center font-semibold hover:bg-muted transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={booking}
              className="flex-1 btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {booking ? 'Processing...' : `Confirm Booking - ₹${calculatePrice()}`}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default BookServicePage;
