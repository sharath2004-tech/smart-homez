import AppLayout from "@/components/AppLayout";
import { authAPI, workersAPI } from "@/lib/api";
import { Calendar, Clock, Download, IndianRupee, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

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

const WorkerEarnings = () => {
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
        const earnDate = new Date(earning.completedAt);
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

  const calculateHours = (jobCount: number) => {
    // Rough estimate: 1.5 hours per job on average
    const totalMinutes = jobCount * 90;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  const displayStats = {
    today: { earned: `₹${totalEarned.today.toLocaleString('en-IN')}`, hours: calculateHours(stats.today), jobs: stats.today },
    week: { earned: `₹${totalEarned.week.toLocaleString('en-IN')}`, hours: calculateHours(stats.thisWeek), jobs: stats.thisWeek },
    month: { earned: `₹${totalEarned.month.toLocaleString('en-IN')}`, hours: calculateHours(stats.thisMonth), jobs: stats.thisMonth },
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getRecentEarnings = () => {
    return earnings.slice(0, 10);
  };

  if (loading) {
    return (
      <AppLayout userType="worker" userName="Loading...">
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
          <h1 className="text-2xl font-bold font-heading text-foreground mb-1">My Earnings</h1>
          <p className="text-muted-foreground text-sm">Track your income and payment history</p>
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
              {p === "today" ? "Today" : p === "week" ? "This Week" : "This Month"}
            </button>
          ))}
        </div>

        {/* Main earnings card */}
        <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "var(--gradient-brand)" }}>
          <div className="absolute right-4 top-4 opacity-20 text-6xl">💰</div>
          <p className="text-primary-foreground/70 text-sm mb-1">Total Earned</p>
          <p className="text-4xl font-bold font-heading text-primary-foreground mb-4">{displayStats[period].earned}</p>
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

        {/* Working hours requirement */}
        <div className="card-elevated p-5">
          <h3 className="font-bold font-heading text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Daily Activity
          </h3>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Today's progress</span>
            <span className="text-sm font-semibold text-foreground">{displayStats.today.hours} / 7h target</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min((stats.today * 90) / 420 * 100, 100)}%` }} />
           </div>
          <p className="text-xs text-muted-foreground mt-2">
            {stats.today >= 5 ? 'Great job! You met your daily goal!' : `Keep going! Complete ${Math.ceil((420 - stats.today * 90) / 90)} more jobs to reach target`}
          </p>
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
              <h3 className="font-bold text-foreground mb-2">No Earnings Yet</h3>
              <p className="text-muted-foreground text-sm">Complete your first job to see earnings here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {getRecentEarnings().map((earning) => (
                <div key={earning._id} className="card-elevated p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{earning.service.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{earning.customer.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(earning.completedAt)} • {formatTime(earning.startTime)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">₹{earning.totalAmount}</p>
                    <span className="text-xs px-2 py-0.5 bg-success-light text-success rounded-full font-medium">
                      Settled
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default WorkerEarnings;
