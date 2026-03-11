import AppLayout from "@/components/AppLayout";
import { API_BASE_URL, authAPI } from "@/lib/api";
import ExcelJS from 'exceljs';
import { Calendar, Clock, FileSpreadsheet, Filter, LayoutGrid, MapPin, RefreshCw, Table2, TrendingDown, TrendingUp, User, Users } from "lucide-react";
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
  const [profile, setProfile] = useState<{ name: string; role?: string } | null>(null);
  const [workerSchedules, setWorkerSchedules] = useState<WorkerSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'past' | 'today' | 'future'>('all');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'subscription' | 'oneTime'>('all');
  const [dateRange, setDateRange] = useState<string>('default'); // default, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'daily'>('table'); // Default to table view
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
        fetch(`${API_BASE_URL}/admin/worker-schedule-comprehensive?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(async res => {
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`API request failed: ${res.status} - ${errorText.substring(0, 100)}`);
          }
          return res.json();
        })
      ]);
      
      setProfile(profileData.user || profileData);
      console.log('📊 Worker schedules loaded:', scheduleData.workerSchedules?.length || 0, 'workers');
      console.log('📊 Summary:', scheduleData.summary);
      setWorkerSchedules(scheduleData.workerSchedules || []);
      setSummary(scheduleData.summary || {});
    } catch (error) {
      console.error('Fetch error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load worker schedules';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [selectedWorker, dateRange, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async (format: 'csv' | 'xlsx' = 'xlsx') => {
    try {
      setExporting(true);
      
      if (format === 'xlsx') {
        // Export to Excel using exceljs library
        await exportToExcel();
      } else {
        // Export CSV from backend
        const token = localStorage.getItem('token');
        
        // Build query params
        const params = new URLSearchParams();
        if (selectedWorker !== 'all') params.append('workerId', selectedWorker);
        if (dateRange === 'custom' && startDate) params.append('startDate', startDate);
        if (dateRange === 'custom' && endDate) params.append('endDate', endDate);
        
        const response = await fetch(`${API_BASE_URL}/admin/worker-schedule-export?${params}`, {
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
      }
      
      toast.success('Schedule exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export schedule');
    } finally {
      setExporting(false);
    }
  };

  const exportToExcel = async () => {
    try {
      // Prepare data for Excel export
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const excelData: Record<string, string | number>[] = [];
      
      filteredSchedules.forEach((schedule) => {
        schedule.bookings.forEach((booking) => {
          const bookingDate = new Date(booking.bookingDate);
          bookingDate.setHours(0, 0, 0, 0);
          
          let period = 'Future';
          if (bookingDate < today) period = 'Past';
          else if (bookingDate.getTime() === today.getTime()) period = 'Today';
          
          const dayName = bookingDate.toLocaleDateString('en-US', { weekday: 'long' });
          const dateStr = bookingDate.toLocaleDateString('en-US');

          excelData.push({
            'Worker Name': schedule.worker.name,
            'Worker Phone': schedule.worker.phone,
            'Specialization': schedule.worker.specialization,
            'Date': dateStr,
            'Day': dayName,
            'Start Time': booking.startTime,
            'End Time': booking.endTime,
            'Status': booking.status,
            'Period': period,
            'Booking Type': booking.isSubscription ? 'Subscription' : 'One-Time',
            'Frequency': booking.subscriptionFrequency || 'N/A',
            'Service': booking.service.name,
            'Category': booking.service.category,
            'Customer Name': booking.customer.name,
            'Customer Phone': booking.customer.phone,
            'Location': booking.location.apartmentName,
            'Area': booking.location.area,
            'City': booking.location.city
          });
        });
      });

      const colWidths = [20, 15, 15, 12, 12, 10, 10, 12, 10, 15, 12, 25, 15, 20, 15, 25, 15, 12];
      const wb = new ExcelJS.Workbook();

      // Main sheet
      const ws = wb.addWorksheet('Worker Schedule');
      if (excelData.length > 0) {
        ws.columns = Object.keys(excelData[0]).map((key, i) => ({
          header: key,
          key,
          width: colWidths[i] || 15
        }));
        excelData.forEach(row => ws.addRow(row));
      }

      // Daily summary sheet
      const dailySummary = calculateDailySummary();
      const wsSummary = wb.addWorksheet('Daily Summary');
      const sumColWidths = [15, 12, 15, 15, 15];
      if (dailySummary.length > 0) {
        wsSummary.columns = Object.keys(dailySummary[0]).map((key, i) => ({
          header: key,
          key,
          width: sumColWidths[i] || 15
        }));
        dailySummary.forEach(row => wsSummary.addRow(row));
      }

      // Statistics sheet
      const statsData = [
        { Metric: 'Total Workers', Value: summary?.totalWorkers || 0 },
        { Metric: 'Total Bookings', Value: summary?.totalBookings || 0 },
        { Metric: 'Past Bookings', Value: summary?.pastBookings || 0 },
        { Metric: 'Today Bookings', Value: summary?.todayBookings || 0 },
        { Metric: 'Future Bookings', Value: summary?.futureBookings || 0 },
        { Metric: 'Subscription Bookings', Value: summary?.subscriptionBookings || 0 },
        { Metric: 'One-Time Bookings', Value: summary?.oneTimeBookings || 0 }
      ];
      const wsStats = wb.addWorksheet('Statistics');
      wsStats.columns = [
        { header: 'Metric', key: 'Metric', width: 25 },
        { header: 'Value', key: 'Value', width: 15 }
      ];
      statsData.forEach(row => wsStats.addRow(row));

      // Trigger browser download
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fileName = `worker-schedule-${new Date().toISOString().split('T')[0]}.xlsx`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);

    } catch (error) {
      console.error('Excel export error:', error);
      throw error;
    }
  };

  const calculateDailySummary = () => {
    const dailyMap = new Map<string, {
      date: Date;
      workerIds: Set<string>;
      bookings: number;
      subscriptions: number;
    }>();

    filteredSchedules.forEach((schedule) => {
      schedule.bookings.forEach((booking) => {
        const dateKey = new Date(booking.bookingDate).toISOString().split('T')[0];
        
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, {
            date: new Date(booking.bookingDate),
            workerIds: new Set(),
            bookings: 0,
            subscriptions: 0
          });
        }
        
        const dayData = dailyMap.get(dateKey)!;
        dayData.workerIds.add(schedule.worker._id);
        dayData.bookings++;
        if (booking.isSubscription) dayData.subscriptions++;
      });
    });

    // Convert to array and sort by date
    return Array.from(dailyMap.entries())
      .map(([dateKey, data]) => ({
        'Date': data.date.toLocaleDateString('en-US'),
        'Day': data.date.toLocaleDateString('en-US', { weekday: 'long' }),
        'Workers Count': data.workerIds.size,
        'Bookings Count': data.bookings,
        'Subscriptions': data.subscriptions
      }))
      .sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
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
      <AppLayout userType={profile?.role === 'super_admin' ? 'super_admin' : 'admin'} userName={profile?.name || "Admin"}>
        <div className="max-w-7xl mx-auto py-12 text-center">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading comprehensive worker schedules...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType={profile?.role === 'super_admin' ? 'super_admin' : 'admin'} userName={profile?.name || "Admin"}>
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Comprehensive Worker Schedule</h1>
              <p className="text-muted-foreground mt-1">View past, present, and future worker assignments with subscription tracking</p>
            </div>
            <div className="flex gap-2">
              <div className="btn-group flex border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-4 py-2 flex items-center gap-2 transition-colors ${
                    viewMode === 'table' 
                      ? 'bg-primary text-white' 
                      : 'bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  <Table2 className="w-4 h-4" />
                  Table
                </button>
                <button
                  onClick={() => setViewMode('daily')}
                  className={`px-4 py-2 flex items-center gap-2 transition-colors border-l border-border ${
                    viewMode === 'daily' 
                      ? 'bg-primary text-white' 
                      : 'bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Daily
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-4 py-2 flex items-center gap-2 transition-colors border-l border-border ${
                    viewMode === 'cards' 
                      ? 'bg-primary text-white' 
                      : 'bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Cards
                </button>
              </div>
              <button
                onClick={() => handleExport('xlsx')}
                disabled={exporting}
                className="btn-outline flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
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

        {/* Worker Schedule - Table, Daily, or Card View */}
        {filteredSchedules.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Bookings Found</h3>
            <p className="text-muted-foreground">
              No bookings found for the selected filters.
            </p>
          </div>
        ) : viewMode === 'daily' ? (
          /* Daily Summary View - Shows worker count by day */
          <div className="card-elevated overflow-hidden">
            <div className="p-4 bg-muted/30 border-b border-border">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Daily Worker Summary - Easy to see how many workers per day
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                View the count of workers performing on each day
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b-2 border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Day</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-foreground uppercase tracking-wider">Workers Count</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-foreground uppercase tracking-wider">Bookings</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-foreground uppercase tracking-wider">Subscriptions</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-foreground uppercase tracking-wider">One-Time</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-foreground uppercase tracking-wider">Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(() => {
                    // Calculate daily summary
                    const dailyMap = new Map<string, {
                      date: Date;
                      workerIds: Set<string>;
                      bookings: Booking[];
                    }>();

                    filteredSchedules.forEach((schedule) => {
                      schedule.bookings.forEach((booking) => {
                        const dateKey = new Date(booking.bookingDate).toISOString().split('T')[0];
                        
                        if (!dailyMap.has(dateKey)) {
                          dailyMap.set(dateKey, {
                            date: new Date(booking.bookingDate),
                            workerIds: new Set(),
                            bookings: []
                          });
                        }
                        
                        const dayData = dailyMap.get(dateKey)!;
                        dayData.workerIds.add(schedule.worker._id);
                        dayData.bookings.push(booking);
                      });
                    });

                    // Convert to sorted array
                    return Array.from(dailyMap.entries())
                      .map(([dateKey, data]) => ({
                        dateKey,
                        ...data,
                        subscriptions: data.bookings.filter(b => b.isSubscription).length,
                        oneTime: data.bookings.filter(b => !b.isSubscription).length
                      }))
                      .sort((a, b) => a.date.getTime() - b.date.getTime())
                      .map((day) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const dayDate = new Date(day.date);
                        dayDate.setHours(0, 0, 0, 0);

                        return (
                          <tr key={day.dateKey} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-foreground">
                                  {day.date.toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-foreground">
                                {day.date.toLocaleDateString('en-US', { weekday: 'long' })}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-lg">
                                <Users className="w-4 h-4 text-primary" />
                                <span className="text-lg font-bold text-primary">{day.workerIds.size}</span>
                                <span className="text-xs text-muted-foreground">workers</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-sm font-semibold text-foreground">{day.bookings.length}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                                📋 {day.subscriptions}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {day.oneTime}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {dayDate < today ? (
                                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">Past</span>
                              ) : dayDate.getTime() === today.getTime() ? (
                                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Today</span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Future</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                  })()}
                </tbody>
              </table>
            </div>
            <div className="bg-muted/30 px-4 py-3 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  📊 Total: {filteredSchedules.reduce((sum, s) => sum + s.bookings.length, 0)} bookings 
                  across {filteredSchedules.length} workers
                </span>
              </div>
            </div>
          </div>
        ) : viewMode === 'table' ? (
          /* Table View - Excel-like format */
          <div className="card-elevated overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b-2 border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider sticky left-0 bg-muted/50 z-10">Worker</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Time Slot</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Service</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-foreground uppercase tracking-wider">Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSchedules.map((schedule) => (
                    schedule.bookings.map((booking, idx) => (
                      <tr 
                        key={booking._id} 
                        className={`hover:bg-muted/30 transition-colors ${
                          idx === 0 ? 'border-t-2 border-primary/20' : ''
                        }`}
                      >
                        <td className="px-4 py-3 sticky left-0 bg-background z-10">
                          {idx === 0 && (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                {schedule.worker.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground text-sm">{schedule.worker.name}</p>
                                <p className="text-xs text-muted-foreground capitalize">{schedule.worker.specialization}</p>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">
                              {new Date(booking.bookingDate).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(booking.bookingDate).toLocaleDateString('en-US', { weekday: 'short' })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-sm text-foreground">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="font-mono">{booking.startTime}</span>
                            <span className="text-muted-foreground">-</span>
                            <span className="font-mono">{booking.endTime}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{booking.service.name}</span>
                            <span className="text-xs text-muted-foreground capitalize">{booking.service.category}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm text-foreground">{booking.customer.name}</span>
                            <span className="text-xs text-muted-foreground">{booking.customer.phone}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col max-w-[200px]">
                            <span className="text-sm text-foreground truncate">{booking.location.apartmentName}</span>
                            <span className="text-xs text-muted-foreground truncate">{booking.location.area}, {booking.location.city}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {booking.isSubscription ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              📋 {booking.subscriptionFrequency}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              One-Time
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            booking.status === 'completed' 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                              : booking.status === 'confirmed' 
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              : booking.status === 'in-progress'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                          }`}>
                            {booking.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {getPeriodBadge(booking.bookingDate)}
                        </td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Summary Footer */}
            <div className="bg-muted/30 px-4 py-3 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Showing {filteredSchedules.reduce((sum, s) => sum + s.bookings.length, 0)} bookings 
                  across {filteredSchedules.length} workers
                </span>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                    <span className="text-muted-foreground">Past: {summary?.pastBookings || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-muted-foreground">Today: {summary?.todayBookings || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-muted-foreground">Future: {summary?.futureBookings || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Card View - Original format */
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
