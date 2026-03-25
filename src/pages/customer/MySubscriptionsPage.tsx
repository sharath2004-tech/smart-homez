import AppLayout from "@/components/AppLayout";
import SubscriptionCalendar from "@/components/SubscriptionCalendar";
import { authAPI, bookingsAPI } from "@/lib/api";
import { AlertTriangle, Calendar, CalendarDays, CheckCircle, Clock, Edit2, MapPin, RefreshCw, User, UserCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Booking {
  _id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  bookingType: string;
  subscription?: {
    isSubscription: boolean;
    activationStatus?: 'payment_pending' | 'active';
    fixedWorker?: string;
    autoRenewal?: boolean;
    allowPause?: boolean;
    isPaused?: boolean;
    subscriptionStartDate?: string;
    subscriptionEndDate?: string;
    preferredTime?: string;
    durationPerSession?: number;
  };
  recurringSchedule?: {
    frequency: string;
    selectedDays?: string[];
    startDate?: string;
    endDate?: string;
  };
  worker?: {
    _id: string;
    name: string;
    phone: string;
    email: string;
    workerProfile: {
      specialization: string;
      rating: number;
      completedBookings: number;
    };
  } | null;
  service: {
    _id: string;
    name: string;
    description: string;
    category: string;
  };
  location: {
    address: string;
    area: string;
    city: string;
    apartmentName?: string;
  };
  totalAmount: number;
}

interface Worker {
  _id: string;
  name: string;
  email: string;
  phone: string;
  workerProfile: {
    specialization: string;
    rating: number;
    completedBookings: number;
    availability: boolean;
  };
}

const MySubscriptionsPage = () => {
  const [profile, setProfile] = useState<{ role: string; name?: string } | null>(null);
  const [subscriptions, setSubscriptions] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingWorker, setChangingWorker] = useState<string | null>(null);
  const [availableWorkers, setAvailableWorkers] = useState<Worker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [expandedCalendars, setExpandedCalendars] = useState<Set<string>>(new Set());

  const toggleCalendar = (id: string) =>
    setExpandedCalendars(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profileData, bookingsData] = await Promise.all([
        authAPI.getProfile(),
        bookingsAPI.getAll()
      ]);
      
      setProfile(profileData.user || profileData);
      
      // Filter for subscription bookings
      const subscriptionBookings = (bookingsData.bookings || [])
        .filter((booking: Booking) => 
          booking.subscription?.isSubscription && 
          (booking.subscription?.activationStatus || 'active') === 'active' &&
          booking.status !== 'cancelled' &&
          booking.status !== 'completed'
        )
        .sort((a: Booking, b: Booking) => {
          return new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime();
        });
      
      setSubscriptions(subscriptionBookings);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableWorkers = async (serviceCategory: string) => {
    try {
      setLoadingWorkers(true);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/users/workers/available?specialization=${serviceCategory}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch workers');
      
      const data = await response.json();
      setAvailableWorkers(data.workers || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
      toast.error('Failed to load available workers');
    } finally {
      setLoadingWorkers(false);
    }
  };

  const handleChangeWorkerClick = async (subscription: Booking) => {
    setChangingWorker(subscription._id);
    await fetchAvailableWorkers(subscription.service.category);
  };

  const handleWorkerChange = async (bookingId: string, newWorkerId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/bookings/${bookingId}/change-subscription-worker`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ workerId: newWorkerId })
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to change worker');
      }
      
      toast.success('Worker change request sent to admin successfully.');
      setChangingWorker(null);
      setAvailableWorkers([]);
      await fetchData();
    } catch (error) {
      console.error('Error changing worker:', error);
      toast.error((error as Error).message || 'Failed to change worker');
    }
  };

  const handlePauseSubscription = async (bookingId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/bookings/${bookingId}/pause-subscription`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to pause subscription');
      }
      
      toast.success('Subscription paused successfully');
      await fetchData();
    } catch (error) {
      console.error('Error pausing subscription:', error);
      toast.error((error as Error).message || 'Failed to pause subscription');
    }
  };

  const handleResumeSubscription = async (bookingId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/bookings/${bookingId}/resume-subscription`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to resume subscription');
      }
      
      toast.success('Subscription resumed successfully');
      await fetchData();
    } catch (error) {
      console.error('Error resuming subscription:', error);
      toast.error((error as Error).message || 'Failed to resume subscription');
    }
  };

  if (loading) {
    return (
      <AppLayout userType="customer" userName={profile?.name || "Customer"}>
        <div className="max-w-6xl mx-auto py-12 text-center">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading subscriptions...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="customer" userName={profile?.name || "Customer"}>
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">My Subscriptions</h1>
          <p className="text-muted-foreground">Manage your active subscriptions and assigned workers</p>
        </div>

        {/* Renewal reminder banners */}
        {subscriptions
          .filter(s => {
            const end = s.subscription?.subscriptionEndDate;
            if (!end) return false;
            const daysLeft = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
            return daysLeft >= 0 && daysLeft <= 3;
          })
          .map(s => {
            const daysLeft = Math.ceil((new Date(s.subscription!.subscriptionEndDate!).getTime() - Date.now()) / 86400000);
            return (
              <div key={`renewal-${s._id}`} className="mb-3 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-orange-800">
                    {s.service.name} subscription expires {daysLeft <= 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`}
                  </p>
                  <p className="text-xs text-orange-600 mt-0.5">
                    Renew before {new Date(s.subscription!.subscriptionEndDate!).toLocaleDateString()} to keep your service uninterrupted.
                  </p>
                </div>
                <a href="/customer/services" className="text-xs font-semibold text-orange-700 underline underline-offset-2 shrink-0">
                  Renew
                </a>
              </div>
            );
          })
        }

        {/* Subscriptions List */}
        {subscriptions.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Active Subscriptions</h3>
            <p className="text-muted-foreground mb-4">
              You don't have any active subscriptions yet.
            </p>
            <a href="/customer/services" className="btn-brand inline-flex">
              Browse Services
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {subscriptions.map((subscription) => (
              <div key={subscription._id} className="card-elevated p-4 sm:p-5 md:p-6">
                {/* Subscription Header */}
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-border">
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-1">
                      {subscription.service.name}
                    </h3>
                    <p className="text-sm text-muted-foreground capitalize">
                      {subscription.recurringSchedule?.frequency} Subscription
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {subscription.subscription?.isPaused ? (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                        Paused
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Subscription Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Time:</span>
                      <span className="font-medium text-foreground">
                        {subscription.subscription?.preferredTime || subscription.startTime}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Started:</span>
                      <span className="font-medium text-foreground">
                        {new Date(subscription.subscription?.subscriptionStartDate || subscription.bookingDate).toLocaleDateString()}
                      </span>
                    </div>

                    {subscription.subscription?.subscriptionEndDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Ends:</span>
                        <span className="font-medium text-foreground">
                          {new Date(subscription.subscription.subscriptionEndDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Location:</span>
                      <span className="font-medium text-foreground line-clamp-2 break-words">
                        {subscription.location.area}, {subscription.location.city}
                      </span>
                    </div>
                  </div>

                  {/* Assigned Worker Card */}
                  <div className="border-2 border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-primary" />
                        Assigned Worker
                      </p>
                      {subscription.worker && (
                        <button
                          onClick={() => handleChangeWorkerClick(subscription)}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          Change
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      After the first visit starts, you can request an admin-approved worker change for future visits.
                    </p>

                    {subscription.worker ? (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-bold">
                          {subscription.worker.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{subscription.worker.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 break-words">
                            {subscription.worker.workerProfile.specialization} • ⭐ {subscription.worker.workerProfile.rating.toFixed(1)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-muted/60 px-3 py-3 text-sm text-muted-foreground">
                        We’re assigning your worker for this cycle now. Their profile will show up here as soon as the schedule is locked.
                      </div>
                    )}
                  </div>
                </div>

                {/* Subscription Features */}
                {subscription.recurringSchedule?.selectedDays && subscription.recurringSchedule.selectedDays.length > 0 && (
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-foreground">📅 Service Days</p>
                      <button
                        onClick={() => toggleCalendar(subscription._id)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <CalendarDays className="w-3 h-3" />
                        {expandedCalendars.has(subscription._id) ? 'Hide Calendar' : 'View Calendar'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {subscription.recurringSchedule.selectedDays.map((day) => (
                        <span
                          key={day}
                          className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium capitalize"
                        >
                          {day}
                        </span>
                      ))}
                    </div>
                    {expandedCalendars.has(subscription._id) && (
                      <div className="mt-3">
                        <SubscriptionCalendar
                          selectedDays={subscription.recurringSchedule.selectedDays}
                          startDate={subscription.recurringSchedule.startDate || subscription.subscription?.subscriptionStartDate}
                          endDate={subscription.recurringSchedule.endDate || subscription.subscription?.subscriptionEndDate}
                          isPaused={subscription.subscription?.isPaused}
                          preferredTime={subscription.subscription?.preferredTime || subscription.startTime}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Features */}
                <div className="flex flex-wrap gap-3 mb-4 text-xs text-muted-foreground">
                  {subscription.subscription?.autoRenewal && (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      Auto-renewal enabled
                    </span>
                  )}
                  {subscription.subscription?.allowPause && (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-blue-600" />
                      Pause available
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-purple-600" />
                    {subscription.subscription?.durationPerSession || 1}hr per session
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {subscription.subscription?.allowPause && (
                    subscription.subscription?.isPaused ? (
                      <button
                        onClick={() => handleResumeSubscription(subscription._id)}
                        className="btn-outline flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Resume
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePauseSubscription(subscription._id)}
                        className="btn-outline flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Pause
                      </button>
                    )
                  )}
                </div>

                {/* Worker Change Modal */}
                {changingWorker === subscription._id && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-background rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
                      <h3 className="text-xl font-bold text-foreground mb-4">
                        Request Worker Change
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Pick the worker you want and we’ll send the request to admin for approval.
                      </p>
                      
                      {loadingWorkers ? (
                        <div className="py-12 text-center">
                          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                          <p className="text-sm text-muted-foreground">Loading workers...</p>
                        </div>
                      ) : availableWorkers.length === 0 ? (
                        <div className="py-12 text-center">
                          <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                          <p className="text-muted-foreground">No workers available</p>
                        </div>
                      ) : (
                        <div className="space-y-3 mb-6">
                          {availableWorkers
                            .filter(w => w._id !== subscription.worker?._id)
                            .map((worker) => (
                              <button
                                key={worker._id}
                                onClick={() => handleWorkerChange(subscription._id, worker._id)}
                                className="w-full p-4 border-2 border-border hover:border-primary rounded-lg text-left transition-all"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-bold text-lg">
                                    {worker.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-semibold text-foreground">{worker.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {worker.workerProfile.specialization} • ⭐ {worker.workerProfile.rating.toFixed(1)} ({worker.workerProfile.completedBookings} jobs)
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ))}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setChangingWorker(null);
                          setAvailableWorkers([]);
                        }}
                        className="btn-outline w-full"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MySubscriptionsPage;
