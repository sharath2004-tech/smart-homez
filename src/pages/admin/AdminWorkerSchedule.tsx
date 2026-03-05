import AppLayout from "@/components/AppLayout";
import { authAPI, bookingsAPI } from "@/lib/api";
import { Calendar, Clock, Filter, MapPin, RefreshCw, User, Users } from "lucide-react";
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
    fixedWorker?: string;
    autoRenewal?: boolean;
    subscriptionEndDate?: string;
  };
  recurringSchedule?: {
    frequency: string;
    selectedDays?: string[];
    endDate?: string;
  };
  worker: {
    _id: string;
    name: string;
    phone: string;
    workerProfile: {
      specialization: string;
    };
  };
  customer: {
    _id: string;
    name: string;
    phone: string;
  };
  service: {
    _id: string;
    name: string;
  };
  location: {
    address: string;
    area: string;
    city: string;
    apartmentName?: string;
  };
}

const AdminWorkerSchedule = () => {
  const [profile, setProfile] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<string>('all');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'subscription' | 'oneTime'>('all');
  const [dateRange, setDateRange] = useState<'7days' | '30days' | '90days'>('30days');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profileData, bookingsData] = await Promise.all([
        authAPI.getProfile(),
        bookingsAPI.getAll({ limit: 500 }) // Get more bookings to see future schedules
      ]);
      
      setProfile(profileData.user || profileData);
      
      // Filter for future and confirmed bookings
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const futureBookings = (bookingsData.bookings || [])
        .filter((booking: Booking) => {
          const bookingDate = new Date(booking.bookingDate);
          return bookingDate >= today && 
                 (booking.status === 'confirmed' || booking.status === 'pending') &&
                 booking.worker; // Only show bookings with assigned workers
        })
        .sort((a: Booking, b: Booking) => {
          const dateA = new Date(a.bookingDate + ' ' + a.startTime);
          const dateB = new Date(b.bookingDate + ' ' + b.startTime);
          return dateA.getTime() - dateB.getTime();
        });
      
      setBookings(futureBookings);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load worker schedules');
    } finally {
      setLoading(false);
    }
  };

  // Get unique workers from bookings
  const workers = Array.from(
    new Map(
      bookings
        .filter(b => b.worker)
        .map(b => [b.worker._id, b.worker])
    ).values()
  );

  // Filter bookings based on selections
  const filteredBookings = bookings.filter(booking => {
    // Worker filter
    if (selectedWorker !== 'all' && booking.worker?._id !== selectedWorker) {
      return false;
    }
    
    // Type filter
    if (selectedFilter === 'subscription' && !booking.subscription?.isSubscription) {
      return false;
    }
    if (selectedFilter === 'oneTime' && booking.subscription?.isSubscription) {
      return false;
    }
    
    // Date range filter
    const bookingDate = new Date(booking.bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const daysToAdd = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 90;
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + daysToAdd);
    
    return bookingDate <= endDate;
  });

  // Group bookings by worker
  const bookingsByWorker = filteredBookings.reduce((acc, booking) => {
    const workerId = booking.worker?._id;
    if (!workerId) return acc;
    
    if (!acc[workerId]) {
      acc[workerId] = {
        worker: booking.worker,
        bookings: []
      };
    }
    acc[workerId].bookings.push(booking);
    return acc;
  }, {} as Record<string, { worker: any; bookings: Booking[] }>);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <AppLayout userType="admin" userName={profile?.name || "Admin"}>
        <div className="max-w-7xl mx-auto py-12 text-center">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading worker schedules...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="admin" userName={profile?.name || "Admin"}>
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Worker Schedules</h1>
              <p className="text-muted-foreground mt-1">View and manage future worker assignments</p>
            </div>
            <button
              onClick={fetchData}
              className="btn-brand flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card-elevated p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Filters</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Worker Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Worker
              </label>
              <select
                value={selectedWorker}
                onChange={(e) => setSelectedWorker(e.target.value)}
                className="input-clean"
              >
                <option value="all">All Workers ({workers.length})</option>
                {workers.map(worker => (
                  <option key={worker._id} value={worker._id}>
                    {worker.name} - {worker.workerProfile.specialization}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Booking Type
              </label>
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value as any)}
                className="input-clean"
              >
                <option value="all">All Types</option>
                <option value="subscription">Subscriptions Only</option>
                <option value="oneTime">One-Time Only</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Date Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="input-clean"
              >
                <option value="7days">Next 7 Days</option>
                <option value="30days">Next 30 Days</option>
                <option value="90days">Next 90 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card-elevated p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Workers</p>
                <p className="text-2xl font-bold text-foreground">{Object.keys(bookingsByWorker).length}</p>
              </div>
            </div>
          </div>
          
          <div className="card-elevated p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Bookings</p>
                <p className="text-2xl font-bold text-foreground">{filteredBookings.length}</p>
              </div>
            </div>
          </div>
          
          <div className="card-elevated p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Subscriptions</p>
                <p className="text-2xl font-bold text-foreground">
                  {filteredBookings.filter(b => b.subscription?.isSubscription).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="card-elevated p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">One-Time</p>
                <p className="text-2xl font-bold text-foreground">
                  {filteredBookings.filter(b => !b.subscription?.isSubscription).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Worker Schedule Cards */}
        {Object.keys(bookingsByWorker).length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Scheduled Bookings</h3>
            <p className="text-muted-foreground">
              No future bookings found for the selected filters.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.values(bookingsByWorker).map(({ worker, bookings }) => (
              <div key={worker._id} className="card-elevated p-6">
                {/* Worker Header */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-bold text-lg">
                      {worker.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-lg">{worker.name}</h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {worker.workerProfile.specialization} • {worker.phone}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Upcoming Bookings</p>
                    <p className="text-2xl font-bold text-primary">{bookings.length}</p>
                  </div>
                </div>

                {/* Bookings List */}
                <div className="space-y-3">
                  {bookings.map((booking) => (
                    <div
                      key={booking._id}
                      className="border-2 border-border rounded-lg p-4 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-foreground">{booking.service.name}</span>
                            {booking.subscription?.isSubscription && (
                              <span className="badge-primary text-xs">Subscription</span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              booking.status === 'confirmed' 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                            }`}>
                              {booking.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              <span>{formatDate(booking.bookingDate)}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              <span>{booking.startTime} - {booking.endTime}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <User className="w-4 h-4" />
                              <span>{booking.customer.name}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="w-4 h-4" />
                              <span className="truncate">{booking.location.area}, {booking.location.city}</span>
                            </div>
                          </div>

                          {/* Subscription Details */}
                          {booking.subscription?.isSubscription && booking.recurringSchedule && (
                            <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                              <p className="text-xs font-semibold text-foreground mb-1">📋 Subscription Details</p>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <p>• Frequency: <span className="capitalize font-medium text-foreground">{booking.recurringSchedule.frequency}</span></p>
                                {booking.recurringSchedule.selectedDays && booking.recurringSchedule.selectedDays.length > 0 && (
                                  <p>• Days: <span className="capitalize font-medium text-foreground">
                                    {booking.recurringSchedule.selectedDays.join(', ')}
                                  </span></p>
                                )}
                                {booking.subscription.autoRenewal && (
                                  <p>• <span className="text-green-600 dark:text-green-400">✓ Auto-renewal enabled</span></p>
                                )}
                                {booking.subscription.subscriptionEndDate && (
                                  <p>• Ends: <span className="font-medium text-foreground">
                                    {new Date(booking.subscription.subscriptionEndDate).toLocaleDateString()}
                                  </span></p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminWorkerSchedule;
