import AppLayout from "@/components/AppLayout";
import { authAPI, bookingsAPI, servicesAPI, settingsAPI } from "@/lib/api";
import { Calendar, Clock, Info, MapPin, Sparkles, Star, User, Users, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  subscriptionPlans?: Array<{
    id: string;
    name: string;
    displayName: string;
    icon: string;
    description: string;
    price: number;
    discountPercentage: number;
    isActive: boolean;
    requiresFixedWorker: boolean;
    allowDaySelection: boolean;
    sortOrder: number;
  }>;
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

type TimePeriod = 'morning' | 'afternoon' | 'evening';
type BookingMode = 'now' | 'schedule';

const BookServicePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preferredWorkerId = searchParams.get('preferredWorker') ?? null;
  const preferredWorkerName = searchParams.get('preferredWorkerName') ?? null;
  const [service, setService] = useState<Service | null>(null);
  const [profile, setProfile] = useState<{ name: string; currentLocation?: { area: string; city: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  
  // Booking mode: "now" or "schedule"
  const [bookingMode, setBookingMode] = useState<BookingMode>('now');
  
  // Booking form state
  const [bookingType, setBookingType] = useState<'oneTime' | 'daily' | 'weekly' | 'monthly'>('oneTime');
  const [selectedDate, setSelectedDate] = useState('');
  const [holidays, setHolidays] = useState<Array<{ date: string; label: string }>>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('morning');
  const [selectedExactTime, setSelectedExactTime] = useState<string>('');
  const [selectedWorker, setSelectedWorker] = useState<string | null>(preferredWorkerId);
  const [bookedRanges, setBookedRanges] = useState<{ workerId: string | null; startTime: string; endTime: string }[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [totalWorkersCount, setTotalWorkersCount] = useState(0);
  const [loadingSlots, setLoadingSlots] = useState(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      
      // Fetch upcoming holidays to block those dates
      try {
        const bhData = await settingsAPI.getBusinessHours();
        setHolidays(bhData.businessHours?.upcomingHolidays || []);
      } catch {
        // non-fatal — holidays stay empty
      }

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

  // Local today helper (timezone-safe)
  const localToday = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Fallback local slots (used only if API lookup fails)
  const generateFallbackSlots = (period: TimePeriod): string[] => {
    const ranges: Record<TimePeriod, { start: number; end: number }> = {
      morning:   { start: 6,  end: 12 },
      afternoon: { start: 12, end: 17 },
      evening:   { start: 17, end: 22 }
    };
    const { start, end } = ranges[period];
    const slots: string[] = [];
    for (let h = start; h < end; h++) {
      for (let m = 0; m < 60; m += 15) {
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return slots;
  };

  const getSlotsForPeriod = (period: TimePeriod): string[] => {
    const ranges: Record<TimePeriod, { start: number; end: number }> = {
      morning: { start: 6, end: 12 },
      afternoon: { start: 12, end: 17 },
      evening: { start: 17, end: 24 }
    };

    const { start, end } = ranges[period];
    const source = availableSlots.length > 0
      ? availableSlots
      : generateFallbackSlots(period);

    return source.filter((time) => {
      const [h] = time.split(':').map(Number);
      return !Number.isNaN(h) && h >= start && h < end;
    });
  };

  const formatSlotTime = (time: string): string => {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  };

  // Get booking time string
  const getBookingTime = (): string => {
    if (bookingMode === 'now') {
      const now = new Date();
      const minutes = Math.ceil((now.getMinutes() + 60) / 30) * 30;
      const hours = now.getHours() + Math.floor(minutes / 60);
      return `${String(hours % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    }
    return selectedExactTime || '09:00';
  };

  const calculatePrice = () => {
    if (!service) return 0;
    // Scale price proportionally to selected session duration
    const defaultHours = (service.duration || 60) / 60;
    const durationRatio = durationPerSession / defaultHours;

    if (bookingType !== 'oneTime') {
      // Use the selected subscription plan's price as the base for the default duration
      const plan = subscriptionPlans.find(p => p.name === bookingType);
      if (plan) return Math.round(plan.price * durationRatio);
    }

    // One-time: use pricingPlans.oneTime or service.price as base
    const base = (service.pricingPlans as Record<string, number> | undefined)?.[bookingType]
      ?? service.pricingPlans?.oneTime
      ?? service.price;
    return Math.round(base * durationRatio);
  };

  // MRP = market rate before platform discount
  const calculateMrp = () => {
    if (!service) return 0;
    const defaultHours = (service.duration || 60) / 60;
    const durationRatio = durationPerSession / defaultHours;
    // For subscription plans, MRP = service base price scaled by duration
    // For one-time, MRP = 20% above our price
    if (bookingType !== 'oneTime') {
      return Math.round(service.price * durationRatio);
    }
    return Math.round(calculatePrice() / 0.8);
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
    
    const selectedTime = getBookingTime();

    if (bookingMode === 'schedule' && !selectedDate && bookingType === 'oneTime') {
      toast.error('Please select a date');
      return;
    }
    if (bookingMode === 'schedule' && !selectedExactTime) {
      toast.error('Please select a time slot');
      return;
    }

    try {
      setBooking(true);

      if (!service) {
        toast.error('Service not found. Please go back and try again.');
        return;
      }
      
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
      const rawMsg = error instanceof Error ? error.message : 'Failed to create booking';
      // Surface holiday rejection with extra context
      if (rawMsg.toLowerCase().includes('holiday') || rawMsg.toLowerCase().includes('not available on')) {
        toast.error(rawMsg, { duration: 6000 });
      } else {
        toast.error(rawMsg);
      }
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

  const getTodayDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Fetch booked slots for the selected date
  const fetchBookedSlots = useCallback(async (date: string, manageLoading = true) => {
    if (!date) return;
    if (manageLoading) setLoadingSlots(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/bookings/booked-slots?date=${date}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setBookedRanges(data.bookedRanges || []);
        setTotalWorkersCount(data.totalWorkers || 0);
      }
    } catch (err) {
      console.error('Fetch booked slots error:', err);
    } finally {
      if (manageLoading) setLoadingSlots(false);
    }
  }, []);

  const fetchAvailableSlots = useCallback(async (date: string) => {
    if (!date) return;
    try {
      const data = await settingsAPI.getAvailableSlotsByDate(date) as { slots?: string[] };
      setAvailableSlots(Array.isArray(data?.slots) ? data.slots : []);
    } catch (err) {
      console.error('Fetch available slots error:', err);
      setAvailableSlots([]);
    }
  }, []);

  const fetchDateAvailability = useCallback(async (date: string) => {
    if (!date) return;
    setLoadingSlots(true);
    try {
      await Promise.all([
        fetchBookedSlots(date, false),
        fetchAvailableSlots(date)
      ]);
    } finally {
      setLoadingSlots(false);
    }
  }, [fetchAvailableSlots, fetchBookedSlots]);

  useEffect(() => {
    if (selectedDate) fetchDateAvailability(selectedDate);
    else {
      setBookedRanges([]);
      setAvailableSlots([]);
    }
    setSelectedExactTime('');
  }, [selectedDate, fetchDateAvailability]);

  // Convert HH:MM string to minutes
  const toMinutes = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  // Is a slot in the past (only relevant for today)
  const isSlotInPast = (time: string): boolean => {
    if (!selectedDate || selectedDate !== getTodayDate()) return false;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes() + 30; // 30-min buffer
    return toMinutes(time) <= nowMins;
  };

  // How many workers are available for a given slot (not booked)
  const getAvailableWorkersForSlot = (time: string): number => {
    if (totalWorkersCount === 0) return workers.length;
    const slotStart = toMinutes(time);
    const slotEnd = slotStart + (service?.duration || 60);
    // Count workers who have a conflict at this time
    const busyWorkerIds = new Set<string>();
    for (const range of bookedRanges) {
      const rangeStart = toMinutes(range.startTime);
      const rangeEnd = toMinutes(range.endTime);
      // Overlap check
      if (slotStart < rangeEnd && slotEnd > rangeStart && range.workerId) {
        busyWorkerIds.add(range.workerId);
      }
    }
    return Math.max(0, totalWorkersCount - busyWorkerIds.size);
  };

  // Is a slot fully booked (no workers left) or conflicts with selected worker
  const isSlotUnavailable = (time: string): boolean => {
    if (isSlotInPast(time)) return true;
    const slotStart = toMinutes(time);
    const slotEnd = slotStart + (service?.duration || 60);
    // If a specific worker is selected, check only that worker's conflicts
    if (selectedWorker) {
      return bookedRanges.some(
        r => r.workerId === selectedWorker &&
          slotStart < toMinutes(r.endTime) &&
          slotEnd > toMinutes(r.startTime)
      );
    }
    // Auto-assign: slot is unavailable if all workers are busy
    return totalWorkersCount > 0 && getAvailableWorkersForSlot(time) === 0;
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

  // Use service's subscription plans or fall back to defaults
  const subscriptionPlans = service?.subscriptionPlans && service.subscriptionPlans.length > 0
    ? service.subscriptionPlans.filter(plan => plan.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
    : [
        {
          id: 'oneTime',
          name: 'oneTime',
          displayName: 'One-Time',
          icon: '📅',
          description: 'Single service',
          price: service?.price || 500,
          discountPercentage: 0,
          isActive: true,
          requiresFixedWorker: false,
          allowDaySelection: false,
          sortOrder: 1
        },
        {
          id: 'daily',
          name: 'daily',
          displayName: 'Daily',
          icon: '🌅',
          description: 'Every day',
          price: Math.round((service?.price || 500) * 0.85),
          discountPercentage: 15,
          isActive: true,
          requiresFixedWorker: true,
          allowDaySelection: false,
          sortOrder: 2
        },
        {
          id: 'weekly',
          name: 'weekly',
          displayName: 'Weekly',
          icon: '📆',
          description: 'Select days',
          price: Math.round((service?.price || 500) * 0.75),
          discountPercentage: 25,
          isActive: true,
          requiresFixedWorker: true,
          allowDaySelection: true,
          sortOrder: 3
        },
        {
          id: 'monthly',
          name: 'monthly',
          displayName: 'Monthly',
          icon: '🗓️',
          description: 'Once a month',
          price: Math.round((service?.price || 500) * 0.65),
          discountPercentage: 35,
          isActive: true,
          requiresFixedWorker: true,
          allowDaySelection: false,
          sortOrder: 4
        }
      ];

  return (
    <AppLayout userType="customer" userName={profile?.name || "Guest"}>
      <div className="max-w-2xl mx-auto space-y-6 pb-20 md:pb-0">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Book Service</h1>
          <p className="text-sm text-muted-foreground">Complete your booking details</p>
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

        {/* Booking Form */}
        <form onSubmit={handleBooking} className="space-y-6">
          {/* ── Step 1: Hours per Session (must pick first — price drives everything) */}
          <div className="card-elevated p-6">
            <h3 className="font-bold text-foreground mb-1 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              How many hours?
            </h3>
            {(() => {
              const pricePerHour = Math.round(service.price / ((service.duration || 60) / 60));
              return (
                <p className="text-xs text-muted-foreground mb-4">
                  ₹{pricePerHour.toLocaleString('en-IN')}/hr &nbsp;·&nbsp; Pick duration — plan prices update below
                </p>
              );
            })()}
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 1,   label: '1 hr' },
                { value: 1.5, label: '1.5 hr' },
                { value: 2,   label: '2 hr' },
                { value: 3,   label: '3 hr' },
                { value: 4,   label: '4 hr' },
                { value: 5,   label: '5 hr' },
              ].map(opt => {
                const pricePerHour  = Math.round(service.price / ((service.duration || 60) / 60));
                const sessionPrice  = Math.round(pricePerHour * opt.value);
                const mrpSession    = Math.round(sessionPrice / 0.8);
                const isSelected    = durationPerSession === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDurationPerSession(opt.value)}
                    className={`flex flex-col items-center py-3 px-2 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground line-through mt-0.5">
                      ₹{mrpSession.toLocaleString('en-IN')}
                    </span>
                    <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-green-700'}`}>
                      ₹{sessionPrice.toLocaleString('en-IN')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

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
                    onChange={(e) => {
                      const val = e.target.value;
                      const holiday = holidays.find(h => h.date === val);
                      if (holiday) {
                        toast.error(`${holiday.label || 'Holiday'} — bookings are not available on this date. Please choose another day.`);
                        setSelectedDate('');
                        return;
                      }
                      setSelectedDate(val);
                    }}
                    min={getTodayDate()}
                    className="input-clean"
                    required={bookingMode === 'schedule'}
                  />
                  {holidays.length > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      ⚠️ Closed on: {holidays.map(h => `${h.label} (${h.date})`).join(', ')}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">
                    Select Time Slot
                  </label>

                  {/* Period tabs */}
                  <div className="flex gap-2 mb-4">
                    {(['morning', 'afternoon', 'evening'] as TimePeriod[]).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => { setSelectedPeriod(period); setSelectedExactTime(''); }}
                        className={`px-5 py-2 rounded-full text-sm font-semibold border transition-all capitalize ${
                          selectedPeriod === period
                            ? 'bg-foreground text-background border-foreground shadow-sm'
                            : 'border-border text-muted-foreground hover:border-foreground/40'
                        }`}
                      >
                        {period === 'morning' && '🌅 '}{period === 'afternoon' && '☀️ '}{period === 'evening' && '🌆 '}
                        {period.charAt(0).toUpperCase() + period.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* 15-min slot grid */}
                  <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                    {!selectedDate ? (
                      <p className="col-span-4 text-sm text-muted-foreground py-4 text-center">Select a date first to see available slots</p>
                    ) : loadingSlots ? (
                      <p className="col-span-4 text-sm text-muted-foreground py-4 text-center">Loading slots...</p>
                    ) : (
                      getSlotsForPeriod(selectedPeriod).map((time) => {
                        const unavailable = isSlotUnavailable(time);
                        const isPast = isSlotInPast(time);
                        const available = !unavailable ? getAvailableWorkersForSlot(time) : 0;
                        const isSelected = selectedExactTime === time;
                        return (
                          <button
                            key={time}
                            type="button"
                            disabled={unavailable}
                            onClick={() => !unavailable && setSelectedExactTime(time)}
                            className={`flex flex-col items-center py-3 px-1 rounded-2xl border text-center transition-all ${
                              unavailable
                                ? 'border-border bg-muted/40 opacity-40 cursor-not-allowed'
                                : isSelected
                                ? 'bg-muted border-muted-foreground/40 shadow-inner'
                                : 'border-border hover:border-primary/60 hover:bg-primary/5'
                            }`}
                          >
                            <span className={`text-sm font-bold leading-tight ${
                              unavailable ? 'text-muted-foreground line-through' : 'text-foreground'
                            }`}>
                              {formatSlotTime(time)}
                            </span>
                            <span className={`text-xs font-medium mt-0.5 ${
                              unavailable
                                ? 'text-muted-foreground'
                                : available > 0
                                ? 'text-primary'
                                : 'text-muted-foreground'
                            }`}>
                              {unavailable
                                ? (isPast ? 'Past' : 'Full')
                                : `${available} free`}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {selectedExactTime && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Selected: <span className="font-semibold text-foreground">{formatSlotTime(selectedExactTime)}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

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
              {subscriptionPlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setBookingType(plan.name as 'oneTime' | 'daily' | 'weekly' | 'monthly')}
                  className={`p-4 border-2 rounded-xl transition-all relative ${
                    bookingType === plan.name
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {plan.discountPercentage > 0 && (
                    <div className="absolute top-2 right-2 text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">
                      {plan.discountPercentage}% OFF
                    </div>
                  )}
                  <div className="text-2xl mb-2">{plan.icon}</div>
                  <div className="font-semibold text-foreground">{plan.displayName}</div>
                  <div className="text-xs text-muted-foreground mt-1">{plan.description}</div>
                  {(() => {
                    const sessionFactor = durationPerSession / ((service?.duration || 60) / 60);
                    const ourPrice = Math.round(plan.price * sessionFactor);
                    const mrpPrice = plan.discountPercentage > 0
                      ? Math.round((service?.price ?? plan.price) * sessionFactor)
                      : Math.round(ourPrice / 0.8);
                    const suffix: Record<string, string> = {
                      oneTime: '/session',
                      daily: '/day',
                      weekly: '/week',
                      monthly: '/month',
                    };
                    return (
                      <div className="mt-2">
                        <div className="text-xs text-muted-foreground line-through">
                          ₹{mrpPrice.toLocaleString('en-IN')}{suffix[plan.name] ?? '/session'}
                        </div>
                        <div className="text-lg font-bold text-green-700">
                          ₹{ourPrice.toLocaleString('en-IN')}{suffix[plan.name] ?? '/session'}
                        </div>
                      </div>
                    );
                  })()}
                  {plan.name === 'oneTime' && (
                    <div className="text-xs text-muted-foreground mt-0.5">per session</div>
                  )}
                  {plan.requiresFixedWorker && (
                    <div className="text-xs text-muted-foreground mt-2">✓ Fixed worker</div>
                  )}
                </button>
              ))}
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
                    onChange={(e) => {
                      const val = e.target.value;
                      const holiday = holidays.find(h => h.date === val);
                      if (holiday) {
                        toast.error(`${holiday.label || 'Holiday'} — bookings are not available on this date. Please choose another day.`);
                        setSubscriptionStartDate('');
                        return;
                      }
                      setSubscriptionStartDate(val);
                    }}
                    min={getTodayDate()}
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

          {/* Preferred Worker Banner */}
          {preferredWorkerId && selectedWorker === preferredWorkerId && (
            <div className="card-elevated p-4 bg-blue-50 border-2 border-blue-200 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-blue-800 text-sm">Preferred Worker Selected</p>
                <p className="text-xs text-blue-600">
                  Your previous worker {preferredWorkerName ? <strong>{preferredWorkerName}</strong> : 'from last booking'} will be requested.
                </p>
              </div>
              <button
                onClick={() => setSelectedWorker(null)}
                className="text-xs text-blue-700 underline shrink-0"
              >
                Remove
              </button>
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
                <span className="font-medium text-foreground">
                  {bookingType === 'oneTime'
                    ? `${service.duration} min`
                    : `${durationPerSession >= 1 ? `${durationPerSession}hr` : `${durationPerSession * 60}min`} / session`}
                </span>
              </div>
              <div className="h-px bg-border my-3"></div>
              <div className="flex justify-between items-end text-lg">
                <span className="font-bold text-foreground">Total</span>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground line-through">₹{calculateMrp().toLocaleString('en-IN')}</div>
                  <span className="font-bold text-green-700">₹{calculatePrice().toLocaleString('en-IN')}</span>
                </div>
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
