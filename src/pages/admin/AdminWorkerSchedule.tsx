import AppLayout from "@/components/AppLayout";
import { authAPI } from "@/lib/api";
import { Calendar, Clock, Download, Filter, MapPin, RefreshCw, TrendingDown, TrendingUp, User, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface Booking {
  _id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  bookingType: string;
  isSubscription: boolean;
  subscriptionFrequency: string | null;
  subscriptionDays: string[];
  subscriptionEndDate: string | null;
  autoRenewal: boolean;
  service: {
    name: string;
    category: string;
  };
  customer: {
    name: string;
    phone: string;
  };
  location: {
    apartmentName: string;
    area: string;
    city: string;
  };
}

interface WorkerSchedule {
  worker: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    specialization: string;
    rating: number;
    completedJobs: number;
  };
  statistics: {
    totalBookings: number;
    pastBookings: number;
    todayBookings: number;
    futureBookings: number;
    subscriptionBookings: number;
    oneTimeBookings: number;
    completedBookings: number;
  };
  bookings: Booking[];
}

const AdminWorkerSchedule = () => {
  const [profile, setProfile] = useState<{ name: string } | null>(null);
  const [workerSchedules, setWorkerSchedules] = useState<WorkerSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'past' | 'today' | 'future'>('all');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'subscription' | 'oneTime'>('all');
  const [dateRange, setDateRange] = useState<string>('default'); // default, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [summary, setSummary] = useState<{
    totalWorkers: number;
    totalBookings: number;
    pastBookings: number;
    todayBookings: number;
    futureBookings: number;
    subscriptionBookings: number;
    oneTimeBookings: number;
  } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Build query params
      const params = new URLSearchParams();
      if (selectedWorker !== 'all') params.append('workerId', selectedWorker);
      if (dateRange === 'custom' && startDate) params.append('startDate', startDate);
      if (dateRange === 'custom' && endDate) params.append('endDate', endDate);
      
      const [profileData, scheduleData] = await Promise.all([
        authAPI.getProfile(),
        fetch(`/api/admin/worker-schedule-comprehensive?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json())
      ]);
      
      setProfile(profileData.user || profileData);
      setWorkerSchedules(scheduleData.workerSchedules || []);
      setSummary(scheduleData.summary || {});
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load worker schedules');
    } finally {
      setLoading(false);
    }
  }, [selectedWorker, dateRange, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const token = localStorage.getItem('token');
      
      // Build query params
      const params = new URLSearchParams();
      if (selectedWorker !== 'all') params.append('workerId', selectedWorker);
      if (dateRange === 'custom' && startDate) params.append('startDate', startDate);
      if (dateRange === 'custom' && endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/admin/worker-schedule-export?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `worker-schedule-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Schedule exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export schedule');
    } finally {
      setExporting(false);
    }
  };

  // Get unique workers
  const workers = workerSchedules.map(ws => ws.worker);

  // Filter bookings based on selections
  const filteredSchedules = workerSchedules.map(schedule => {
    let filteredBookings = schedule.bookings;
    
    // Period filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedPeriod === 'past') {
      filteredBookings = filteredBookings.filter(b => {
        const bookingDate = new Date(b.bookingDate);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate < today;
      });
    } else if (selectedPeriod === 'today') {
      filteredBookings = filteredBookings.filter(b => {
        const bookingDate = new Date(b.bookingDate);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate.getTime() === today.getTime();
      });
    } else if (selectedPeriod === 'future') {
      filteredBookings = filteredBookings.filter(b => {
        const bookingDate = new Date(b.bookingDate);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate > today;
      });
    }
    
    // Type filter
    if (selectedFilter === 'subscription') {
      filteredBookings = filteredBookings.filter(b => b.isSubscription);
    } else if (selectedFilter === 'oneTime') {
      filteredBookings = filteredBookings.filter(b => !b.isSubscription);
    }
    
    return {
      ...schedule,
      bookings: filteredBookings
    };
  }).filter(schedule => schedule.bookings.length > 0);

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
    if (date < today) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' (Past)';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getPeriodBadge = (dateStr: string) => {
    const bookingDate = new Date(dateStr);
    const today = new Date();
    bookingDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (bookingDate < today) {
      return <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">Past</span>;
    } else if (bookingDate.getTime() === today.getTime()) {
      return <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Today</span>;
    } else {
      return <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Future</span>;
    }
  };

  if (loading) {
    return (
      <AppLayout userType="admin" userName={profile?.name || "Admin"}>
        <div className="max-w-7xl mx-auto py-12 text-center">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading comprehensive worker schedules...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="admin" userName={profile?.name || "Admin"}>
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Comprehensive Worker Schedule</h1>
              <p className="text-muted-foreground mt-1">View past, present, and future worker assignments with subscription tracking</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="btn-outline flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {exporting ? 'Exporting...' : 'Export Excel'}
              </button>
              <button
                onClick={fetchData}
                className="btn-brand flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card-elevated p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Filters</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    {worker.name} - {worker.specialization}
                  </option>
                ))}
              </select>
            </div>

            {/* Period Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Time Period
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as 'all' | 'past' | 'today' | 'future')}
                className="input-clean"
              >
                <option value="all">All Periods</option>
                <option value="past">Past Work</option>
                <option value="today">Today</option>
                <option value="future">Future Schedule</option>
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Booking Type
              </label>
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value as 'all' | 'subscription' | 'oneTime')}
                className="input-clean"
              >
                <option value="all">All Types</option>
                <option value="subscription">Subscriptions Only</option>
                <option value="oneTime">One-Time Only</option>
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Date Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="input-clean"
              >
                <option value="default">Default (1M past - 3M future)</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>

          {/* Custom Date Range */}
          {dateRange === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-clean"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input-clean"
                />
              </div>
            </div>
          )}
        </div>

        {/* Stats Summary */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
            <div className="card-elevated p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground">Workers</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{summary.totalWorkers}</p>
            </div>
            
            <div className="card-elevated p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-blue-500" />
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{summary.totalBookings}</p>
            </div>
            
            <div className="card-elevated p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-gray-500" />
                <p className="text-xs text-muted-foreground">Past</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{summary.pastBookings}</p>
            </div>
            
            <div className="card-elevated p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-blue-500" />
                <p className="text-xs text-muted-foreground">Today</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{summary.todayBookings}</p>
            </div>
            
            <div className="card-elevated p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <p className="text-xs text-muted-foreground">Future</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{summary.futureBookings}</p>
            </div>
            
            <div className="card-elevated p-4">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="w-4 h-4 text-purple-500" />
                <p className="text-xs text-muted-foreground">Subscriptions</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{summary.subscriptionBookings}</p>
            </div>
            
            <div className="card-elevated p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-orange-500" />
                <p className="text-xs text-muted-foreground">One-Time</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{summary.oneTimeBookings}</p>
            </div>
          </div>
        )}

        {/* Worker Schedule Cards */}
        {filteredSchedules.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Bookings Found</h3>
            <p className="text-muted-foreground">
              No bookings found for the selected filters.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredSchedules.map((schedule) => (
              <div key={schedule.worker._id} className="card-elevated p-6">
                {/* Worker Header */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-border flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-bold text-lg">
                      {schedule.worker.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-lg">{schedule.worker.name}</h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {schedule.worker.specialization} • {schedule.worker.phone} • ⭐ {schedule.worker.rating.toFixed(1)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Worker Statistics */}
                  <div className="flex gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Past</p>
                      <p className="text-lg font-bold text-gray-600">{schedule.statistics.pastBookings}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Today</p>
                      <p className="text-lg font-bold text-blue-600">{schedule.statistics.todayBookings}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Future</p>
                      <p className="text-lg font-bold text-green-600">{schedule.statistics.futureBookings}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Subscriptions</p>
                      <p className="text-lg font-bold text-purple-600">{schedule.statistics.subscriptionBookings}</p>
                    </div>
                  </div>
                </div>

                {/* Bookings List */}
                <div className="space-y-3">
                  {schedule.bookings.map((booking) => (
                    <div
                      key={booking._id}
                      className="border-2 border-border rounded-lg p-4 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-[250px]">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="font-semibold text-foreground">{booking.service.name}</span>
                            {booking.isSubscription && (
                              <span className="badge-primary text-xs">
                                📋 {booking.subscriptionFrequency}
                              </span>
                            )}
                            {getPeriodBadge(booking.bookingDate)}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              booking.status === 'completed' 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : booking.status === 'confirmed' 
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
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
                          {booking.isSubscription && (
                            <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                              <p className="text-xs font-semibold text-foreground mb-1">📋 Subscription Details</p>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <p>• Frequency: <span className="capitalize font-medium text-foreground">{booking.subscriptionFrequency}</span></p>
                                {booking.subscriptionDays && booking.subscriptionDays.length > 0 && (
                                  <p>• Days: <span className="capitalize font-medium text-foreground">
                                    {booking.subscriptionDays.join(', ')}
                                  </span></p>
                                )}
                                {booking.autoRenewal && (
                                  <p>• <span className="text-green-600 dark:text-green-400">✓ Auto-renewal enabled</span></p>
                                )}
                                {booking.subscriptionEndDate && (
                                  <p>• Ends: <span className="font-medium text-foreground">
                                    {new Date(booking.subscriptionEndDate).toLocaleDateString()}
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
