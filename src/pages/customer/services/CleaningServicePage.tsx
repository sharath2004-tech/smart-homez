import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authAPI, bookingsAPI, servicesAPI } from "@/lib/api";
import { Bath, Bed, ChevronLeft, Home, Sparkles, Users } from "lucide-react";
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
  additionalServiceOptions?: Array<{
    value: string;
    label: string;
    price: number;
  }>;
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

interface CleaningDetails {
  numberOfRooms: number;
  numberOfBedrooms: number;
  numberOfBathrooms: number;
  areaSize: string;
  cleaningType: 'regular' | 'deep' | 'move-in' | 'move-out';
  additionalServices: string[];
  specialInstructions: string;
}

const CleaningServicePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  
  // Booking type and schedule states
  const [bookingType, setBookingType] = useState<'oneTime' | 'daily' | 'weekly' | 'monthly'>('oneTime');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [cleaningDetails, setCleaningDetails] = useState<CleaningDetails>({
    numberOfRooms: 1,
    numberOfBedrooms: 1,
    numberOfBathrooms: 1,
    areaSize: '',
    cleaningType: 'regular',
    additionalServices: [],
    specialInstructions: ''
  });

  // Subscription states
  const [subscriptionStartDate, setSubscriptionStartDate] = useState('');
  const [subscriptionEndDate, setSubscriptionEndDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [durationPerSession, setDurationPerSession] = useState(60);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [allowPause, setAllowPause] = useState(true);

  // Worker selection states
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  const [availableWorkers, setAvailableWorkers] = useState<any[]>([]);

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
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load service details');
    } finally {
      setLoading(false);
    }
  };

  // Fetch available workers for subscriptions
  useEffect(() => {
    const fetchWorkers = async () => {
      if (bookingType !== 'oneTime' && service) {
        try {
          const response = await fetch(`http://localhost:3000/api/users/workers/service/${service._id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          const data = await response.json();
          setAvailableWorkers(data.workers || []);
        } catch (error) {
          console.error('Error fetching workers:', error);
        }
      }
    };
    fetchWorkers();
  }, [bookingType, service]);

  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Use service's additional options or fall back to defaults
  const additionalServiceOptions = service?.additionalServiceOptions && service.additionalServiceOptions.length > 0
    ? service.additionalServiceOptions
    : [
        { value: 'carpet', label: 'Carpet/Rug Cleaning', price: 300 },
        { value: 'windows', label: 'Window Cleaning', price: 200 },
        { value: 'balcony', label: 'Balcony Cleaning', price: 150 },
        { value: 'appliances', label: 'Appliance Deep Clean', price: 400 },
        { value: 'sanitization', label: 'Sanitization Service', price: 500 }
      ];

  const toggleAdditionalService = (value: string) => {
    setCleaningDetails(prev => ({
      ...prev,
      additionalServices: prev.additionalServices.includes(value)
        ? prev.additionalServices.filter(s => s !== value)
        : [...prev.additionalServices, value]
    }));
  };

  const calculateTotalPrice = () => {
    if (!service) return 0;
    
    let basePrice = service.price;
    
    // Adjust price based on cleaning type
    const typeMultipliers = {
      regular: 1,
      deep: 1.5,
      'move-in': 1.3,
      'move-out': 1.4
    };
    basePrice *= typeMultipliers[cleaningDetails.cleaningType];
    
    // Adjust for rooms
    if (cleaningDetails.numberOfRooms > 2) {
      basePrice += (cleaningDetails.numberOfRooms - 2) * 200;
    }
    
    // Add bathroom costs
    if (cleaningDetails.numberOfBathrooms > 1) {
      basePrice += (cleaningDetails.numberOfBathrooms - 1) * 250;
    }
    
    // Add additional services
    const additionalCost = cleaningDetails.additionalServices.reduce((sum, service) => {
      const option = additionalServiceOptions.find(s => s.value === service);
      return sum + (option?.price || 0);
    }, 0);
    
    return Math.round(basePrice + additionalCost);
  };

  const calculateDuration = () => {
    if (!service) return 0;
    
    let baseDuration = service.duration;
    
    // Add time for additional rooms
    baseDuration += Math.max(0, cleaningDetails.numberOfRooms - 2) * 30;
    baseDuration += Math.max(0, cleaningDetails.numberOfBathrooms - 1) * 20;
    
    // Deep cleaning takes longer
    if (cleaningDetails.cleaningType === 'deep') {
      baseDuration = Math.round(baseDuration * 1.5);
    }
    
    // Add time for additional services
    baseDuration += cleaningDetails.additionalServices.length * 20;
    
    return baseDuration;
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    // Get current plan details
    const currentPlan = service?.subscriptionPlans?.find(plan => plan.name === bookingType);

    // Validate based on booking type
    if (bookingType === 'oneTime') {
      if (!selectedDate) {
        toast.error('Please select a date');
        return;
      }
    } else {
      // Subscription validation
      if (!subscriptionStartDate || !subscriptionEndDate) {
        toast.error('Please select subscription start and end dates');
        return;
      }
      if (currentPlan?.allowDaySelection && selectedDays.length === 0) {
        toast.error('Please select at least one day for this subscription');
        return;
      }
      if (currentPlan?.requiresFixedWorker && !selectedWorker) {
        toast.error('Please select a worker for your subscription. Fixed worker assignment is required for this plan.');
        return;
      }
    }

    if (!cleaningDetails.areaSize) {
      toast.error('Please enter the area size');
      return;
    }

    try {
      setBooking(true);
      
      const userLocation = localStorage.getItem('userLocation');
      const location = userLocation ? JSON.parse(userLocation) : null;

      // Calculate duration
      const durationMinutes = calculateDuration();

      // Base booking data
      const bookingData: any = {
        service: service?._id,
        bookingType: bookingType,
        serviceDetails: {
          cleaningType: cleaningDetails.cleaningType,
          numberOfRooms: cleaningDetails.numberOfRooms,
          numberOfBedrooms: cleaningDetails.numberOfBedrooms,
          numberOfBathrooms: cleaningDetails.numberOfBathrooms,
          areaSize: cleaningDetails.areaSize,
          additionalServices: cleaningDetails.additionalServices,
          specialInstructions: cleaningDetails.specialInstructions
        },
        totalAmount: calculateTotalPrice(),
        estimatedDuration: durationMinutes,
        location: location ? {
          type: 'Point',
          coordinates: [location.lng, location.lat],
          address: location.address || '',
          city: location.city || '',
          state: location.state || '',
          zipCode: location.zipCode || ''
        } : undefined
      };

      // Add type-specific data
      if (bookingType === 'oneTime') {
        const [startHour, startMinute] = selectedTime.split(':').map(Number);
        const totalMinutes = startHour * 60 + startMinute + durationMinutes;
        const endHour = Math.floor(totalMinutes / 60) % 24;
        const endMinute = totalMinutes % 60;
        const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

        bookingData.bookingDate = selectedDate;
        bookingData.startTime = selectedTime;
        bookingData.endTime = endTime;
      } else {
        // Subscription data
        bookingData.subscriptionDetails = {
          startDate: subscriptionStartDate,
          endDate: subscriptionEndDate,
          preferredTime: preferredTime,
          durationPerSession: durationPerSession,
          fixedWorker: selectedWorker,
          autoRenewal: autoRenewal,
          allowPause: allowPause
        };

        if (bookingType === 'weekly') {
          bookingData.recurringSchedule = {
            selectedDays: selectedDays
          };
        }

        bookingData.assignedWorker = selectedWorker;
      }

      const response = await bookingsAPI.create(bookingData);
      toast.success(bookingType === 'oneTime' ? 'Booking created successfully!' : 'Subscription created successfully!');
      navigate('/customer/bookings');
    } catch (error: unknown) {
      console.error('Error creating booking:', error);
      const errorMessage = error instanceof Error && 'response' in error 
        ? (error as any).response?.data?.message 
        : 'Failed to create booking';
      toast.error(errorMessage);
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <AppLayout userType="customer" userName={profile?.name}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading service details...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <AppLayout userType="customer" userName={profile?.name}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link to="/customer/services" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ChevronLeft className="w-4 h-4" />
            Back to Services
          </Link>
          
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-2xl p-6 border border-blue-100 dark:border-blue-900">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-8 h-8 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold mb-2">{service?.name}</h1>
                <p className="text-muted-foreground mb-3">{service?.description}</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <span className="font-semibold">Base Price:</span>
                    <span className="text-primary font-bold">₹{service?.price}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="font-semibold">Base Duration:</span>
                    <span>{service?.duration} mins</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleBooking} className="space-y-6">
          {/* Booking Type Selection - Dynamic from Service */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-bold mb-4">Select Booking Plan</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {service?.subscriptionPlans
                ?.filter(plan => plan.isActive)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setBookingType(plan.name as any)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      bookingType === plan.name
                        ? 'border-primary bg-primary/10 shadow-md'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-2">{plan.icon}</div>
                      <div className="font-semibold">{plan.displayName}</div>
                      <div className="text-xs text-muted-foreground">{plan.description}</div>
                      {plan.discountPercentage > 0 && (
                        <div className="text-xs text-primary font-bold mt-1">
                          {plan.discountPercentage}% off
                        </div>
                      )}
                    </div>
                  </button>
                ))
              }
            </div>
          </div>

          {/* Schedule Section - One-Time */}
          {bookingType === 'oneTime' && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-xl font-bold mb-4">Schedule Your Cleaning</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Select Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    min={minDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="time">Select Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Subscription Schedule Section */}
          {bookingType !== 'oneTime' && (
            <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl border-2 border-primary/20 p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Subscription Schedule
              </h2>
              
              <div className="space-y-4">
                {/* Date Range */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="subStartDate">Start Date</Label>
                    <Input
                      id="subStartDate"
                      type="date"
                      value={subscriptionStartDate}
                      min={minDate}
                      onChange={(e) => setSubscriptionStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="subEndDate">End Date</Label>
                    <Input
                      id="subEndDate"
                      type="date"
                      value={subscriptionEndDate}
                      min={subscriptionStartDate || minDate}
                      onChange={(e) => setSubscriptionEndDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Time and Duration */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="preferredTime">Preferred Time</Label>
                    <Input
                      id="preferredTime"
                      type="time"
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="duration">Duration per Session (minutes)</Label>
                    <select
                      id="duration"
                      value={durationPerSession}
                      onChange={(e) => setDurationPerSession(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background"
                      required
                    >
                      <option value={60}>60 minutes</option>
                      <option value={90}>90 minutes</option>
                      <option value={120}>120 minutes</option>
                      <option value={180}>180 minutes</option>
                    </select>
                  </div>
                </div>

                {/* Day Selection - Show if current plan allows it */}
                {service?.subscriptionPlans?.find(plan => plan.name === bookingType)?.allowDaySelection && (
                  <div>
                    <Label>Select Days</Label>
                    <div className="grid grid-cols-7 gap-2 mt-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                            selectedDays.includes(day)
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subscription Options */}
                <div className="space-y-3 pt-3 border-t border-primary/20">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRenewal}
                      onChange={(e) => setAutoRenewal(e.target.checked)}
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-sm">Auto-renewal after subscription period ends</span>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowPause}
                      onChange={(e) => setAllowPause(e.target.checked)}
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-sm">Allow subscription pause/resume</span>
                  </label>
                </div>

                {/* Subscription Summary Box */}
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4 border border-primary/30">
                  <h3 className="font-semibold mb-2">Subscription Summary</h3>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>• Plan: <span className="font-medium text-foreground capitalize">{bookingType}</span></p>
                    {subscriptionStartDate && subscriptionEndDate && (
                      <p>• Duration: <span className="font-medium text-foreground">
                        {Math.ceil((new Date(subscriptionEndDate).getTime() - new Date(subscriptionStartDate).getTime()) / (1000 * 60 * 60 * 24))} days
                      </span></p>
                    )}
                    {service?.subscriptionPlans?.find(plan => plan.name === bookingType)?.allowDaySelection && selectedDays.length > 0 && (
                      <p>• Days: <span className="font-medium text-foreground">{selectedDays.join(', ')}</span></p>
                    )}
                    <p>• Time: <span className="font-medium text-foreground">{preferredTime}</span></p>
                    <p>• Session Duration: <span className="font-medium text-foreground">{durationPerSession} mins</span></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Worker Selection - Show if plan requires fixed worker */}
          {bookingType !== 'oneTime' && service?.subscriptionPlans?.find(plan => plan.name === bookingType)?.requiresFixedWorker && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl border-2 border-amber-200 dark:border-amber-900 p-6">
              <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                Select Your Fixed Worker
                <span className="text-sm font-normal text-amber-600 dark:text-amber-400">(Required for subscription)</span>
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                For subscription plans, you must select a fixed worker who will be assigned to all your sessions. This ensures consistency and builds a trusted relationship.
              </p>
              
              {availableWorkers.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-3">
                  {availableWorkers.map((worker) => (
                    <button
                      key={worker._id}
                      type="button"
                      onClick={() => setSelectedWorker(worker._id)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        selectedWorker === worker._id
                          ? 'border-primary bg-primary/10 shadow-md'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                          {worker.name?.charAt(0) || 'W'}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">{worker.name}</div>
                          <div className="text-sm text-muted-foreground">
                            ⭐ {worker.rating?.toFixed(1) || 'New'} • {worker.completedServices || 0} jobs
                          </div>
                        </div>
                        {selectedWorker === worker._id && (
                          <div className="text-primary">✓</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Loading available workers...</p>
                </div>
              )}
            </div>
          )}

          {/* Schedule Section - moved from above */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-bold mb-4">Cleaning Type</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { value: 'regular', label: 'Regular Cleaning', desc: 'Standard cleaning' },
                { value: 'deep', label: 'Deep Cleaning', desc: '+50% - Thorough cleaning' },
                { value: 'move-in', label: 'Move-In Cleaning', desc: '+30% - Pre-occupancy clean' },
                { value: 'move-out', label: 'Move-Out Cleaning', desc: '+40% - Post-occupancy clean' }
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setCleaningDetails(prev => ({ ...prev, cleaningType: type.value as any }))}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    cleaningDetails.cleaningType === type.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-semibold">{type.label}</div>
                  <div className="text-sm text-muted-foreground">{type.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Property Details */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-bold mb-4">Property Details</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rooms" className="flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  Number of Rooms
                </Label>
                <Input
                  id="rooms"
                  type="number"
                  min="1"
                  max="10"
                  value={cleaningDetails.numberOfRooms}
                  onChange={(e) => setCleaningDetails(prev => ({ ...prev, numberOfRooms: parseInt(e.target.value) || 1 }))}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">+₹200 per room after 2</p>
              </div>
              
              <div>
                <Label htmlFor="bedrooms" className="flex items-center gap-2">
                  <Bed className="w-4 h-4" />
                  Number of Bedrooms
                </Label>
                <Input
                  id="bedrooms"
                  type="number"
                  min="1"
                  max="10"
                  value={cleaningDetails.numberOfBedrooms}
                  onChange={(e) => setCleaningDetails(prev => ({ ...prev, numberOfBedrooms: parseInt(e.target.value) || 1 }))}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="bathrooms" className="flex items-center gap-2">
                  <Bath className="w-4 h-4" />
                  Number of Bathrooms
                </Label>
                <Input
                  id="bathrooms"
                  type="number"
                  min="1"
                  max="6"
                  value={cleaningDetails.numberOfBathrooms}
                  onChange={(e) => setCleaningDetails(prev => ({ ...prev, numberOfBathrooms: parseInt(e.target.value) || 1 }))}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">+₹250 per bathroom after 1</p>
              </div>
              
              <div>
                <Label htmlFor="areaSize">Area Size (sq ft)</Label>
                <Input
                  id="areaSize"
                  type="text"
                  placeholder="e.g., 1200"
                  value={cleaningDetails.areaSize}
                  onChange={(e) => setCleaningDetails(prev => ({ ...prev, areaSize: e.target.value }))}
                  required
                />
              </div>
            </div>
          </div>

          {/* Additional Services */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-bold mb-4">Additional Services</h2>
            <div className="space-y-3">
              {additionalServiceOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={cleaningDetails.additionalServices.includes(option.value)}
                      onChange={() => toggleAdditionalService(option.value)}
                      className="w-4 h-4 text-primary"
                    />
                    <span className="font-medium">{option.label}</span>
                  </div>
                  <span className="text-primary font-semibold">+₹{option.price}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Special Instructions */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-bold mb-4">Special Instructions</h2>
            <textarea
              placeholder="Any specific requirements or areas of focus..."
              value={cleaningDetails.specialInstructions}
              onChange={(e) => setCleaningDetails(prev => ({ ...prev, specialInstructions: e.target.value }))}
              className="w-full min-h-[100px] p-3 rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border-2 border-primary/20 p-6">
            <h2 className="text-xl font-bold mb-4">Booking Summary</h2>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated Duration:</span>
                <span className="font-semibold">{calculateDuration()} minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cleaning Type:</span>
                <span className="font-semibold capitalize">{cleaningDetails.cleaningType.replace('-', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Additional Services:</span>
                <span className="font-semibold">{cleaningDetails.additionalServices.length}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-primary/20">
                <span className="text-lg font-bold">Total Amount:</span>
                <span className="text-2xl font-bold text-primary">₹{calculateTotalPrice()}</span>
              </div>
            </div>
            
            <Button
              type="submit"
              disabled={booking}
              className="w-full h-12 text-lg"
            >
              {booking ? 'Creating Booking...' : 'Confirm Booking'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default CleaningServicePage;
