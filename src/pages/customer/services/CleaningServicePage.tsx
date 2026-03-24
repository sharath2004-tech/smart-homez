import AppLayout from "@/components/AppLayout";
import ServiceLocationCard from "@/components/ServiceLocationCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServiceBookingAvailability } from "@/hooks/useServiceBookingAvailability";
import { authAPI, bookingsAPI, servicesAPI, usersAPI } from "@/lib/api";
import { ChevronLeft, Sparkles, Users } from "lucide-react";
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

interface Worker {
  _id: string;
  name: string;
  workerProfile: {
    rating: number;
    totalReviews?: number;
    availability: boolean;
  };
}

interface BookingProfile {
  role: string;
  name?: string;
  addresses?: Array<{
    isDefault?: boolean;
    apartmentName?: string;
    address?: string;
    area?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    location?: { coordinates?: number[] };
  }>;
}

const CleaningServicePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [profile, setProfile] = useState<BookingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  // Booking type
  const [bookingType, setBookingType] = useState<'oneTime' | 'daily' | 'weekly' | 'monthly'>('oneTime');

  // One-time schedule
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00');

  // Additional services & instructions
  const [selectedAdditional, setSelectedAdditional] = useState<string[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Subscription states
  const [subscriptionStartDate, setSubscriptionStartDate] = useState('');
  const [subscriptionEndDate, setSubscriptionEndDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [durationPerSession, setDurationPerSession] = useState(60);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [allowPause, setAllowPause] = useState(true);

  // Worker selection
  const [selectedWorker, setSelectedWorker] = useState<string>('auto-assign');
  const [availableWorkers, setAvailableWorkers] = useState<Worker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [bookedRanges, setBookedRanges] = useState<Array<{ workerId: string | null; startTime: string; endTime: string }>>([]);
  const [totalWorkersCount, setTotalWorkersCount] = useState(0);
  const [checkingSlots, setCheckingSlots] = useState(false);

  const {
    availability,
    checkingAvailability,
    requestingService,
    resolvedLocation,
    hasResolvedLocation,
    isOutOfRegion,
    canBookService,
    requestService,
  } = useServiceBookingAvailability(service?._id, profile);

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
    } catch {
      toast.error('Failed to load service details');
    } finally {
      setLoading(false);
    }
  };

  // Fetch workers when subscription plan requires a fixed worker
  useEffect(() => {
    const fetchWorkers = async () => {
      if (bookingType !== 'oneTime' && service) {
        try {
          setLoadingWorkers(true);
          const data = await usersAPI.getAvailableWorkers(service.category, 3.0);
          setAvailableWorkers(data.workers || []);
        } catch {
          toast.error('Failed to load available workers');
        } finally {
          setLoadingWorkers(false);
        }
      } else {
        setAvailableWorkers([]);
        setSelectedWorker('auto-assign');
      }
    };
    fetchWorkers();
  }, [bookingType, service]);

  const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours * 60) + minutes;
  };

  const getEndTimeFromStart = (startTime: string, durationMinutes: number) => {
    const startMinutes = toMinutes(startTime);
    const endMinutes = startMinutes + durationMinutes;
    const endHours = Math.floor(endMinutes / 60) % 24;
    const remainingMinutes = endMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`;
  };

  const getAvailableWorkersForSlot = (
    startTime: string,
    endTime: string,
    ranges: Array<{ workerId: string | null; startTime: string; endTime: string }> = bookedRanges,
    totalWorkers: number = totalWorkersCount,
  ) => {
    if (totalWorkers <= 0) {
      return 0;
    }

    const requestedStart = toMinutes(startTime);
    const requestedEnd = toMinutes(endTime);
    const busyWorkerIds = new Set<string>();

    for (const range of ranges) {
      if (!range.workerId) continue;
      const rangeStart = toMinutes(range.startTime);
      const rangeEnd = toMinutes(range.endTime);

      if (requestedStart < rangeEnd && requestedEnd > rangeStart) {
        busyWorkerIds.add(range.workerId);
      }
    }

    return Math.max(0, totalWorkers - busyWorkerIds.size);
  };

  useEffect(() => {
    const fetchBookedSlots = async () => {
      if (
        bookingType !== 'oneTime'
        || !selectedDate
        || !service?._id
        || !resolvedLocation
        || !canBookService
      ) {
        setBookedRanges([]);
        setTotalWorkersCount(0);
        return;
      }

      try {
        setCheckingSlots(true);
        const data = await bookingsAPI.getBookedSlots(
          selectedDate,
          { lng: resolvedLocation.longitude, lat: resolvedLocation.latitude },
          { service: service._id }
        );

        setBookedRanges(data.bookedRanges || []);
        setTotalWorkersCount(data.totalWorkers || 0);
      } catch (error) {
        console.error('Failed to fetch slot availability:', error);
        setBookedRanges([]);
        setTotalWorkersCount(0);
      } finally {
        setCheckingSlots(false);
      }
    };

    fetchBookedSlots();
  }, [bookingType, selectedDate, service?._id, resolvedLocation, canBookService]);

  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleAdditional = (value: string) => {
    setSelectedAdditional(prev =>
      prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
    );
  };

  // Only admin-configured additional options
  const additionalServiceOptions = service?.additionalServiceOptions?.length
    ? service.additionalServiceOptions
    : [];

  // Only admin-configured subscription plans
  const subscriptionPlans = service?.subscriptionPlans?.length
    ? service.subscriptionPlans.filter(p => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  const hasSubscriptionPlans = subscriptionPlans.length > 0;

  const calculateTotalPrice = () => {
    if (!service) return 0;
    const additionalCost = selectedAdditional.reduce((sum, val) => {
      const opt = additionalServiceOptions.find(o => o.value === val);
      return sum + (opt?.price || 0);
    }, 0);
    return Math.round(service.price + additionalCost);
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isOutOfRegion) {
      await requestService(service?.name);
      return;
    }

    if (!canBookService) {
      toast.error(
        hasResolvedLocation
          ? 'Checking whether this service is available in your region. Please wait a moment.'
          : 'Please set a service location in your profile or services page before booking.'
      );
      return;
    }

    const currentPlan = subscriptionPlans.find(p => p.name === bookingType);

    if (bookingType === 'oneTime') {
      if (!selectedDate) { toast.error('Please select a date'); return; }
    } else {
      if (!subscriptionStartDate || !subscriptionEndDate) {
        toast.error('Please select subscription start and end dates'); return;
      }
      if (currentPlan?.allowDaySelection && selectedDays.length === 0) {
        toast.error('Please select at least one day for this subscription'); return;
      }
    }

    try {
      setBooking(true);
      if (!service) { toast.error('Service not found'); return; }

      if (!resolvedLocation) {
        toast.error('Please pin your selected service location or enable auto location before booking.');
        return;
      }

      const bookingData: Record<string, unknown> = {
        service: service._id,
        bookingType,
        serviceDetails: {
          additionalServices: selectedAdditional,
          specialInstructions,
        },
        totalAmount: calculateTotalPrice(),
        estimatedDuration: service.duration,
        location: {
          type: 'Point',
          coordinates: [resolvedLocation.longitude, resolvedLocation.latitude],
          apartmentName: resolvedLocation.apartmentName || '',
          address: resolvedLocation.address || '',
          area: resolvedLocation.area || '',
          city: resolvedLocation.city || '',
          state: resolvedLocation.state || '',
          zipCode: resolvedLocation.zipCode || ''
        }
      };

      if (bookingType === 'oneTime') {
        const endTime = getEndTimeFromStart(selectedTime, service.duration);

        const latestSlotData = await bookingsAPI.getBookedSlots(
          selectedDate,
          resolvedLocation ? { lng: resolvedLocation.longitude, lat: resolvedLocation.latitude } : null,
          { service: service._id }
        );

        const latestBookedRanges = latestSlotData.bookedRanges || [];
        const latestTotalWorkers = latestSlotData.totalWorkers || 0;
        const availableWorkersForSlot = getAvailableWorkersForSlot(
          selectedTime,
          endTime,
          latestBookedRanges,
          latestTotalWorkers,
        );

        if (latestTotalWorkers <= 0) {
          toast.error('No workers are available in your service region for this date. Please choose another date or time.');
          return;
        }

        if (availableWorkersForSlot <= 0) {
          toast.error('That time slot is already full. Please choose another time.');
          return;
        }

        bookingData.bookingDate = selectedDate;
        bookingData.startTime = selectedTime;
        bookingData.endTime = endTime;
        bookingData.autoAssign = true;
      } else {
        bookingData.subscriptionDetails = {
          startDate: subscriptionStartDate,
          endDate: subscriptionEndDate,
          frequency: bookingType,
          selectedDays,
          preferredTime,
          durationPerSession,
          fixedWorker: selectedWorker !== 'auto-assign' ? selectedWorker : undefined,
          autoRenewal,
          allowPause,
        };
        if (selectedWorker !== 'auto-assign') bookingData.worker = selectedWorker;
      }

      await bookingsAPI.create(bookingData);
      toast.success(bookingType === 'oneTime' ? 'Booking created!' : 'Subscription created!');
      navigate('/customer/bookings');
    } catch (error) {
      const msg = (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to create booking';
      toast.error(msg);
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <AppLayout userType="customer" userName={profile?.name}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const minDate = new Date().toISOString().split('T')[0];
  const currentPlan = subscriptionPlans.find(p => p.name === bookingType);

  return (
    <AppLayout userType="customer" userName={profile?.name}>
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6">

        {/* Header */}
        <div className="mb-6">
          <Link to="/customer/services" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ChevronLeft className="w-4 h-4" /> Back to Services
          </Link>
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-2xl p-4 sm:p-6 border border-blue-100 dark:border-blue-900">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-8 h-8 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold mb-2">{service?.name}</h1>
                <p className="text-muted-foreground mb-3">{service?.description}</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span><span className="font-semibold">Base Price:</span> <span className="text-primary font-bold">₹{service?.price}</span></span>
                  <span><span className="font-semibold">Duration:</span> <span>{service?.duration} mins</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ServiceLocationCard
          className="mb-6"
          serviceLabel="This service"
          checkingAvailability={checkingAvailability}
          hasResolvedLocation={hasResolvedLocation}
          isOutOfRegion={isOutOfRegion}
          availabilityReason={availability?.reason}
          resolvedLocation={resolvedLocation}
        />

        <form onSubmit={handleBooking} className="space-y-6">

          {/* Booking Plan — only if admin configured subscription plans */}
          {hasSubscriptionPlans && (
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
              <h2 className="text-xl font-bold mb-4">Select Booking Plan</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {subscriptionPlans.map(plan => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setBookingType(plan.name as 'oneTime' | 'daily' | 'weekly' | 'monthly')}
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
                        <div className="text-xs text-primary font-bold mt-1">{plan.discountPercentage}% off</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* One-time schedule */}
          {bookingType === 'oneTime' && (
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
              <h2 className="text-xl font-bold mb-4">Schedule</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Select Date</Label>
                  <Input id="date" type="date" value={selectedDate} min={minDate}
                    onChange={e => setSelectedDate(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="time">Select Time</Label>
                  <Input id="time" type="time" value={selectedTime}
                    onChange={e => setSelectedTime(e.target.value)} required />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {checkingSlots
                      ? 'Checking live worker availability for this date...'
                      : selectedDate && totalWorkersCount > 0
                      ? `${getAvailableWorkersForSlot(selectedTime, getEndTimeFromStart(selectedTime, service?.duration || 0))} of ${totalWorkersCount} workers currently free for this time.`
                      : selectedDate && !checkingSlots
                      ? 'No workers are currently free in this region for the selected date.'
                      : 'Select a date to check live worker availability.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Subscription schedule */}
          {bookingType !== 'oneTime' && (
            <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl border-2 border-primary/20 p-4 sm:p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> Subscription Schedule
              </h2>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="subStart">Start Date</Label>
                    <Input id="subStart" type="date" value={subscriptionStartDate} min={minDate}
                      onChange={e => setSubscriptionStartDate(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="subEnd">End Date</Label>
                    <Input id="subEnd" type="date" value={subscriptionEndDate} min={subscriptionStartDate || minDate}
                      onChange={e => setSubscriptionEndDate(e.target.value)} required />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="prefTime">Preferred Time</Label>
                    <Input id="prefTime" type="time" value={preferredTime}
                      onChange={e => setPreferredTime(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="duration">Duration per Session (minutes)</Label>
                    <select id="duration" value={durationPerSession}
                      onChange={e => setDurationPerSession(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background" required>
                      <option value={60}>60 minutes</option>
                      <option value={90}>90 minutes</option>
                      <option value={120}>120 minutes</option>
                      <option value={180}>180 minutes</option>
                    </select>
                  </div>
                </div>

                {currentPlan?.allowDaySelection && (
                  <div>
                    <Label>Select Days</Label>
                    <div className="grid grid-cols-7 gap-2 mt-2">
                      {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(day => (
                        <button key={day} type="button" onClick={() => toggleDay(day)}
                          className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                            selectedDays.includes(day)
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border hover:border-primary/50'
                          }`}>
                          {day.slice(0, 3).charAt(0).toUpperCase() + day.slice(1, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-3 border-t border-primary/20">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={autoRenewal} onChange={e => setAutoRenewal(e.target.checked)} className="w-4 h-4" />
                    <span className="text-sm">Auto-renewal after subscription period ends</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={allowPause} onChange={e => setAllowPause(e.target.checked)} className="w-4 h-4" />
                    <span className="text-sm">Allow subscription pause/resume</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Worker selection — only if plan requires fixed worker */}
          {bookingType !== 'oneTime' && currentPlan?.requiresFixedWorker && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl border-2 border-amber-200 dark:border-amber-900 p-4 sm:p-6">
              <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                Select Your Fixed Worker
                <span className="text-sm font-normal text-amber-600">(Required for subscription)</span>
              </h2>
              {loadingWorkers ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50 animate-pulse" />
                  <p>Loading available workers...</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  <button type="button" onClick={() => setSelectedWorker('auto-assign')}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedWorker === 'auto-assign' ? 'border-primary bg-primary/10 shadow-md' : 'border-border hover:border-primary/50'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-bold text-white">⚡</div>
                      <div className="flex-1">
                        <div className="font-semibold">Auto-Assign Worker</div>
                        <div className="text-sm text-muted-foreground">System will assign the best match</div>
                      </div>
                      {selectedWorker === 'auto-assign' && <span className="text-primary">✓</span>}
                    </div>
                  </button>
                  {availableWorkers.map(worker => (
                    <button key={worker._id} type="button" onClick={() => setSelectedWorker(worker._id)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        selectedWorker === worker._id ? 'border-primary bg-primary/10 shadow-md' : 'border-border hover:border-primary/50'
                      }`}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                          {worker.name?.charAt(0) || 'W'}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">{worker.name}</div>
                          <div className="text-sm text-muted-foreground">
                            ⭐ {worker.workerProfile?.rating?.toFixed(1) || 'New'} · {worker.workerProfile?.totalReviews || 0} reviews
                          </div>
                        </div>
                        {selectedWorker === worker._id && <span className="text-primary">✓</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Additional services — only if admin configured them */}
          {additionalServiceOptions.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
              <h2 className="text-xl font-bold mb-4">Additional Services</h2>
              <div className="space-y-3">
                {additionalServiceOptions.map(option => (
                  <label key={option.value}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={selectedAdditional.includes(option.value)}
                        onChange={() => toggleAdditional(option.value)} className="w-4 h-4 text-primary" />
                      <span className="font-medium">{option.label}</span>
                    </div>
                    <span className="text-primary font-semibold">+₹{option.price}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Special Instructions */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
            <h2 className="text-xl font-bold mb-4">Special Instructions</h2>
            <textarea
              placeholder="Any specific requirements or areas of focus..."
              value={specialInstructions}
              onChange={e => setSpecialInstructions(e.target.value)}
              className="w-full min-h-[100px] p-3 rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border-2 border-primary/20 p-4 sm:p-6">
            <h2 className="text-xl font-bold mb-4">Booking Summary</h2>
            <div className="space-y-2 mb-4">
              {selectedAdditional.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Additional Services:</span>
                  <span className="font-semibold">{selectedAdditional.length}</span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-primary/20">
                <span className="text-lg font-bold">Total Amount:</span>
                <span className="text-2xl font-bold text-primary">₹{calculateTotalPrice()}</span>
              </div>
            </div>
            {isOutOfRegion ? (
              <Button
                type="button"
                onClick={() => requestService(service?.name)}
                disabled={requestingService || checkingAvailability}
                className="w-full h-12 text-lg bg-amber-100 text-amber-900 hover:bg-amber-200"
              >
                {requestingService ? 'Sending request...' : 'Request Service'}
              </Button>
            ) : (
              <Button type="submit" disabled={booking || checkingAvailability || !canBookService} className="w-full h-12 text-lg">
                {checkingAvailability ? 'Checking region...' : booking ? 'Creating Booking...' : !hasResolvedLocation ? 'Set Location First' : 'Confirm Booking'}
              </Button>
            )}
          </div>

        </form>
      </div>
    </AppLayout>
  );
};

export default CleaningServicePage;
