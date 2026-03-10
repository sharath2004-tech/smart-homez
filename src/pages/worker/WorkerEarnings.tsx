import AppLayout from "@/components/AppLayout";
import { authAPI, workersAPI } from "@/lib/api";
import { Calendar, Clock, Download, IndianRupee } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

// Constants
const HOURLY_RATE = 90;

interface Earning {
  _id: string;
  service: {
    name: string;
  };
  customer: {
    name: string;
  };
  completedAt: string;
  startTime: string;
  totalAmount: number;
  actualStartTime?: string;
  actualEndTime?: string;
  actualDurationMinutes?: number;
  overtimeMinutes?: number;
  overtimeCharges?: number;
}

interface Stats {
  today: number;
  thisWeek: number;
  thisMonth: number;
}

interface Profile {
  name: string;
  email: string;
  role: string;
}

// Helper functions (pure, stable references)
const calculateHoursWorked = (earning: Earning): string => {
  if (earning.actualDurationMinutes) {
    const hours = Math.floor(earning.actualDurationMinutes / 60);
    const minutes = earning.actualDurationMinutes % 60;
    return `${hours}h ${minutes}m`;
  }
  
  if (earning.actualStartTime && earning.actualEndTime) {
    const start = new Date(earning.actualStartTime);
    const end = new Date(earning.actualEndTime);
    const durationMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    return `${hours}h ${minutes}m`;
  }
  
  return 'N/A';
};

const calculateEarningsBreakdown = (earning: Earning) => {
  const durationMinutes = earning.actualDurationMinutes || 0;
  const hours = durationMinutes / 60;
  const baseEarnings = Math.round(hours * HOURLY_RATE * 100) / 100;
  const overtimeEarnings = earning.overtimeCharges || 0;
  const totalGross = baseEarnings + overtimeEarnings;
  
  return {
    hours: hours,
    baseEarnings,
    overtimeEarnings,
    totalGross,
    hourlyRate: HOURLY_RATE
  };
};

const WorkerEarnings = () => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<"today" | "week" | "month">("week");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ today: 0, thisWeek: 0, thisMonth: 0 });
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [totalEarned, setTotalEarned] = useState({ today: 0, week: 0, month: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEarningsData();
  }, []);

  const fetchEarningsData = async () => {
    try {
      setLoading(true);
      const [profileData, statsData, earningsData] = await Promise.all([
        authAPI.getProfile(),
        workersAPI.getDashboardStats(),
        workersAPI.getEarnings()
      ]);

      setProfile(profileData.user || profileData);
      setStats(statsData.stats || { today: 0, thisWeek: 0, thisMonth: 0 });
      setEarnings(earningsData.earnings || []);

      // Calculate totals for different periods
      const now = new Date();
      const today = now.toDateString();
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);

      let todayTotal = 0, weekTotal = 0, monthTotal = 0;
      
      (earningsData.earnings || []).forEach((earning: Earning) => {
        if (!earning.completedAt || !earning.totalAmount) return;
        
        const earnDate = new Date(earning.completedAt);
        if (isNaN(earnDate.getTime())) return; // Skip invalid dates
        
        const amount = earning.totalAmount;
        
        if (earnDate.toDateString() === today) todayTotal += amount;
        if (earnDate >= weekAgo) weekTotal += amount;
        if (earnDate >= monthAgo) monthTotal += amount;
      });

      setTotalEarned({ today: todayTotal, week: weekTotal, month: monthTotal });
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return 'N/A';
    try {
      const [hours, minutes] = timeString.split(':');
      if (!hours || !minutes) return 'N/A';
      const hour = parseInt(hours);
      if (isNaN(hour)) return 'N/A';
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return 'N/A';
    }
  };

  const getRecentEarnings = () => {
    return earnings.slice(0, 10);
  };

  // Calculate total hours and earnings for a period (memoized to avoid recalculation)
  const periodTotals = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    let todayHours = 0, weekHours = 0, monthHours = 0;
    let todayEarnings = 0, weekEarnings = 0, monthEarnings = 0;
    
    earnings.forEach((earning) => {
      if (!earning.completedAt) return;
      
      const earnDate = new Date(earning.completedAt);
      if (isNaN(earnDate.getTime())) return;
      
      const hours = (earning.actualDurationMinutes || 0) / 60;
      const amount = calculateEarningsBreakdown(earning).totalGross;
      
      if (earnDate.toDateString() === today) {
        todayHours += hours;
        todayEarnings += amount;
      }
      if (earnDate >= weekAgo) {
        weekHours += hours;
        weekEarnings += amount;
      }
      if (earnDate >= monthAgo) {
        monthHours += hours;
        monthEarnings += amount;
      }
    });

    return {
      today: { hours: todayHours, earnings: todayEarnings, jobs: stats.today },
      week: { hours: weekHours, earnings: weekEarnings, jobs: stats.thisWeek },
      month: { hours: monthHours, earnings: monthEarnings, jobs: stats.thisMonth }
    };
  }, [earnings, stats]);

  const displayStats = {
    today: { 
      earned: `₹${Math.round(periodTotals.today.earnings).toLocaleString('en-IN')}`, 
      hours: `${Math.floor(periodTotals.today.hours)}h ${Math.round((periodTotals.today.hours % 1) * 60)}m`, 
      jobs: periodTotals.today.jobs,
      avgRate: periodTotals.today.hours > 0 ? `₹${Math.round(periodTotals.today.earnings / periodTotals.today.hours)}/hr` : '₹0/hr'
    },
    week: { 
      earned: `₹${Math.round(periodTotals.week.earnings).toLocaleString('en-IN')}`, 
      hours: `${Math.floor(periodTotals.week.hours)}h ${Math.round((periodTotals.week.hours % 1) * 60)}m`, 
      jobs: periodTotals.week.jobs,
      avgRate: periodTotals.week.hours > 0 ? `₹${Math.round(periodTotals.week.earnings / periodTotals.week.hours)}/hr` : '₹0/hr'
    },
    month: { 
      earned: `₹${Math.round(periodTotals.month.earnings).toLocaleString('en-IN')}`, 
      hours: `${Math.floor(periodTotals.month.hours)}h ${Math.round((periodTotals.month.hours % 1) * 60)}m`, 
      jobs: periodTotals.month.jobs,
      avgRate: periodTotals.month.hours > 0 ? `₹${Math.round(periodTotals.month.earnings / periodTotals.month.hours)}/hr` : '₹0/hr'
    },
  };

  if (loading) {
    return (
      <AppLayout userType="worker" userName={t('common.loading')}>
        <div className="max-w-3xl mx-auto flex items-center justify-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="worker" userName={profile?.name || "Worker"}>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground mb-1">Salary Management</h1>
          <p className="text-muted-foreground text-sm">{t('worker.earnings.subtitle')}</p>
        </div>

        {/* Period toggle */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl">
          {(["today", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                period === p ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "today" ? t('worker.dashboard.today') : p === "week" ? t('worker.dashboard.thisWeek') : t('worker.dashboard.thisMonth')}
            </button>
          ))}
        </div>

        {/* Hourly Rate Card */}
        <div className="card-elevated p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <IndianRupee className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Your Hourly Rate</p>
                <p className="text-2xl font-bold text-foreground">₹{HOURLY_RATE}<span className="text-base text-muted-foreground">/hour</span></p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Earnings calculated</p>
              <p className="text-sm font-semibold text-primary">Start to End time</p>
            </div>
          </div>
        </div>

        {/* Main earnings card */}
        <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "var(--gradient-brand)" }}>
          <div className="absolute right-4 top-4 opacity-20 text-6xl">💰</div>
          <p className="text-primary-foreground/70 text-sm mb-1">{t('worker.earnings.totalEarnings')}</p>
          <p className="text-4xl font-bold font-heading text-primary-foreground mb-1">{displayStats[period].earned}</p>
          <p className="text-primary-foreground/80 text-sm mb-4">{displayStats[period].avgRate} average</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary-foreground/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-primary-foreground/60 text-xs mb-1">
                <Clock className="w-3.5 h-3.5" /> Hours Worked
              </div>
              <p className="text-primary-foreground font-bold">{displayStats[period].hours}</p>
            </div>
            <div className="bg-primary-foreground/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-primary-foreground/60 text-xs mb-1">
                <Calendar className="w-3.5 h-3.5" /> Jobs Done
              </div>
              <p className="text-primary-foreground font-bold">{displayStats[period].jobs}</p>
            </div>
          </div>
        </div>

        {/* Transaction history */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold font-heading text-foreground">Recent Transactions</h2>
            <button className="flex items-center gap-1.5 text-sm text-primary font-medium">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
          
          {getRecentEarnings().length === 0 ? (
            <div className="card-elevated p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <IndianRupee className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-bold text-foreground mb-2">{t('worker.earnings.noEarnings')}</h3>
              <p className="text-muted-foreground text-sm">{t('worker.earnings.startCompleting')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {getRecentEarnings().filter(earning => earning.service && earning.customer).map((earning) => {
                const breakdown = calculateEarningsBreakdown(earning);
                const hoursWorked = calculateHoursWorked(earning);
                
                return (
                  <div key={earning._id} className="card-elevated p-4">
                    <div className="flex items-start gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{earning.service?.name || 'Service'}</p>
                        <p className="text-sm text-muted-foreground truncate">{earning.customer?.name || 'Customer'}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-muted-foreground">
                            {formatDate(earning.completedAt)} • {formatTime(earning.startTime)}
                          </p>
                          {hoursWorked !== 'N/A' && (
                            <div className="flex items-center gap-1 text-xs font-medium text-primary">
                              <Clock className="w-3 h-3" />
                              {hoursWorked}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">₹{Math.round(breakdown.totalGross)}</p>
                        <span className="text-xs px-2 py-0.5 bg-success-light text-success rounded-full font-medium">
                          Settled
                        </span>
                      </div>
                    </div>
                    
                    {/* Earnings Breakdown */}
                    {breakdown.hours > 0 && (
                      <div className="pt-3 border-t border-border space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Base ({breakdown.hours.toFixed(2)}h × ₹{breakdown.hourlyRate}/hr)
                          </span>
                          <span className="font-medium text-foreground">₹{Math.round(breakdown.baseEarnings)}</span>
                        </div>
                        {breakdown.overtimeEarnings > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Overtime charges</span>
                            <span className="font-medium text-warning">+₹{Math.round(breakdown.overtimeEarnings)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs pt-1 border-t border-border/50">
                          <span className="font-medium text-foreground">Total Gross</span>
                          <span className="font-bold text-foreground">₹{Math.round(breakdown.totalGross)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Salary Settlement CTA */}
        <div className="card-elevated p-5 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-foreground text-sm mb-1">View your salary payments</h3>
              <p className="text-xs text-muted-foreground">See your monthly salary payments sent by admin.</p>
            </div>
            <a
              href="/worker/salary"
              className="btn-brand py-2.5 px-4 text-sm whitespace-nowrap flex items-center gap-1.5 shrink-0"
            >
              <IndianRupee className="w-4 h-4" />
              Salary History
            </a>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default WorkerEarnings;
