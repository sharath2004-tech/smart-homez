import AppLayout from "@/components/AppLayout";
import { authAPI, workersAPI } from "@/lib/api";
import { BarChart2, Calendar, Clock, Download, IndianRupee } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

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
  duration?: number;
  actualDurationMinutes?: number;
  overtimeMinutes?: number;
  overtimeCharges?: number;
  workforce?: {
    wageType?: string;
    wageRate?: number;
    totalWorkerWage?: number;
    workerCount?: number;
  };
}

const getWorkerEarning = (earning: Earning): number => {
  const { workforce, actualDurationMinutes, totalAmount } = earning;
  if (workforce?.totalWorkerWage && workforce.totalWorkerWage > 0) {
    return Math.round(workforce.totalWorkerWage / Math.max(workforce.workerCount || 1, 1));
  }
  if (workforce?.wageRate) {
    if (workforce.wageType === 'per_session') return workforce.wageRate;
    const hours = (actualDurationMinutes || 0) / 60;
    return Math.round(workforce.wageRate * hours);
  }
  // Fall back to totalAmount when workforce wage data is not set
  if (totalAmount && totalAmount > 0) return Math.round(totalAmount);
  return 0;
};

interface Stats {
  today: number;
  thisWeek: number;
  thisMonth: number;
}

interface Profile {
  name: string;
  email: string;
  role: string;
  workerProfile?: {
    wageType?: 'hourly' | 'daily' | 'monthly';
    hourlyRate?: number;
    dailyWage?: number;
    monthlyWage?: number;
  };
}

const getPayTypeLabel = (profile: Profile | null) => {
  const workerProfile = profile?.workerProfile;
  if (!workerProfile) return 'Not set yet';
  if (workerProfile.wageType === 'daily' && workerProfile.dailyWage) return `Daily · ₹${workerProfile.dailyWage}/day`;
  if (workerProfile.wageType === 'monthly' && workerProfile.monthlyWage) return `Monthly · ₹${workerProfile.monthlyWage}/month`;
  if (workerProfile.hourlyRate) return `Hourly · ₹${workerProfile.hourlyRate}/hr`;
  return 'Hourly · Rate pending';
};

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

// Weekly bar chart — last 7 days
const WeeklyEarningsChart = ({ earnings }: { earnings: Earning[] }) => {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const dailyTotals = days.map(d => {
    const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
    const total = earnings.reduce((sum, e) => {
      if (!e.completedAt) return sum;
      const ed = new Date(e.completedAt);
      if (ed.toDateString() === d.toDateString()) return sum + getWorkerEarning(e);
      return sum;
    }, 0);
    return { label, total };
  });

  const maxTotal = Math.max(...dailyTotals.map(d => d.total), 1);

  return (
    <div className="card-elevated p-4 sm:p-5 md:p-6 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Last 7 Days Earnings</h2>
      </div>
      <div className="flex items-end gap-2 h-24">
        {dailyTotals.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md bg-primary/80 min-h-[4px] transition-all"
              style={{ height: `${Math.max((d.total / maxTotal) * 80, d.total > 0 ? 4 : 0)}px` }}
              title={`₹${d.total}`}
            />
            <span className="text-[10px] text-muted-foreground">{d.label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Peak day: {dailyTotals.reduce((a, b) => b.total > a.total ? b : a).label} — ₹{Math.round(dailyTotals.reduce((a, b) => b.total > a.total ? b : a).total).toLocaleString('en-IN')}
      </p>
    </div>
  );
};

// Top services by earnings
const TopServicesCard = ({ earnings }: { earnings: Earning[] }) => {
  const byService: Record<string, { count: number; total: number }> = {};
  earnings.forEach(e => {
    const name = e.service?.name || 'Other';
    if (!byService[name]) byService[name] = { count: 0, total: 0 };
    byService[name].count++;
    byService[name].total += getWorkerEarning(e);
  });

  const sorted = Object.entries(byService)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);

  if (sorted.length === 0) return null;
  const maxTotal = sorted[0].total;

  return (
    <div className="card-elevated p-4 sm:p-5 md:p-6 space-y-3">
      <div className="space-y-2">
        {sorted.map(s => (
          <div key={s.name}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-foreground font-medium line-clamp-2 break-words md:max-w-[60%]">{s.name}</span>
              <span className="text-muted-foreground">{s.count} job{s.count > 1 ? 's' : ''} · ₹{Math.round(s.total).toLocaleString('en-IN')}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${(s.total / maxTotal) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
        if (!earning.completedAt) return;
        
        const earnDate = new Date(earning.completedAt);
        if (isNaN(earnDate.getTime())) return; // Skip invalid dates
        
        const amount = getWorkerEarning(earning);
        
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
      
      const durationMins = earning.actualDurationMinutes || (earning.duration ? earning.duration * 60 : 0);
      const hours = durationMins / 60;
      const amount = getWorkerEarning(earning);
      
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
      <div className="max-w-3xl mx-auto px-3 sm:px-4 md:px-6 space-y-6 animate-fade-in pb-20 md:pb-0">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground mb-1">{t('worker.earnings.salaryManagement')}</h1>
          <p className="text-muted-foreground text-sm">{t('worker.earnings.subtitle')}</p>
        </div>

        <div className="card-elevated p-4 sm:p-5 md:p-6 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm text-muted-foreground">Approved pay type</p>
              <p className="text-lg font-bold text-foreground">{getPayTypeLabel(profile)}</p>
            </div>
            <p className="text-xs text-muted-foreground">This is the pay structure approved by admin / super admin.</p>
          </div>
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
              {p === "today" ? t('worker.tasks.today') : p === "week" ? t('worker.tasks.thisWeek') : t('worker.tasks.thisMonth')}
            </button>
          ))}
        </div>

        {/* Main earnings card */}
        <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "var(--gradient-brand)" }}>
          <div className="absolute right-4 top-4 opacity-20 text-6xl">💰</div>
          <p className="text-primary-foreground/70 text-sm mb-1">{t('worker.earnings.totalEarnings')}</p>
          <p className="text-4xl font-bold font-heading text-primary-foreground mb-1">{displayStats[period].earned}</p>
          <p className="text-primary-foreground/80 text-sm mb-4">{displayStats[period].avgRate} {t('worker.earnings.average')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-primary-foreground/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-primary-foreground/60 text-xs mb-1">
                <Clock className="w-3.5 h-3.5" /> {t('worker.earnings.hoursWorked')}
              </div>
              <p className="text-primary-foreground font-bold">{displayStats[period].hours}</p>
            </div>
            <div className="bg-primary-foreground/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-primary-foreground/60 text-xs mb-1">
                <Calendar className="w-3.5 h-3.5" /> {t('worker.earnings.jobsDone')}
              </div>
              <p className="text-primary-foreground font-bold">{displayStats[period].jobs}</p>
            </div>
          </div>
        </div>

        {/* Weekly Earnings Chart */}
        <WeeklyEarningsChart earnings={earnings} />

        {/* Top Services */}
        <TopServicesCard earnings={earnings} />

        {/* Transaction history */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold font-heading text-foreground">{t('worker.earnings.recentTransactions')}</h2>
            <button className="flex items-center gap-1.5 text-sm text-primary font-medium">
              <Download className="w-3.5 h-3.5" /> {t('worker.earnings.export')}
            </button>
          </div>
          {getRecentEarnings().filter(earning => earning.service && earning.customer).length === 0 ? (
            <div className="card-elevated p-4 sm:p-5 md:p-6 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <IndianRupee className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-bold text-foreground mb-2">{t('worker.earnings.noEarnings')}</h3>
              <p className="text-muted-foreground text-sm">{t('worker.earnings.startCompleting')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {getRecentEarnings().filter(earning => earning.service && earning.customer).map((earning) => {
                const workerWage = getWorkerEarning(earning);
                const hoursWorked = calculateHoursWorked(earning);
                
                return (
                  <div key={earning._id} className="card-elevated p-4 sm:p-5 md:p-6">
                    <div className="flex items-start gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground line-clamp-2 break-words">{earning.service?.name || 'Service'}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2 break-words">{earning.customer?.name || 'Customer'}</p>
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
                        <p className="font-bold text-foreground">₹{workerWage > 0 ? workerWage : '—'}</p>
                        <span className="text-xs px-2 py-0.5 bg-success-light text-success rounded-full font-medium">
                          {t('worker.earnings.settled')}
                        </span>
                      </div>
                    </div>
                    
                    {/* Hours worked */}
                    {hoursWorked !== 'N/A' && (
                      <div className="pt-3 border-t border-border">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {t('worker.earnings.hoursWorked')}</span>
                          <span className="font-medium text-foreground">{hoursWorked}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>


      </div>
    </AppLayout>
  );
};

export default WorkerEarnings;
