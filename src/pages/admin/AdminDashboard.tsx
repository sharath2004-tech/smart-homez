import AppLayout from "@/components/AppLayout";
import { adminAPI } from "@/lib/api";
import { AlertCircle, BarChart2, Calendar, CheckCircle, ChevronRight, Settings, TrendingUp, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface Stats {
  todayBookings: number;
  bookingsChange: string;
  activeWorkers: number;
  workersOnlineInfo: string;
  todayRevenue: number;
  revenueChange: string;
  fulfillmentRate: number;
  fulfillmentChange: string;
}

interface SystemAlert {
  type: 'warning' | 'error';
  message: string;
  action: string;
  count?: number;
  workers?: { name: string }[];
}

interface Booking {
  _id: string;
  customer: { name: string };
  worker: { name: string } | null;
  service: { name: string };
  startTime: string;
  endTime: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

const statusConfig: Record<string, string> = {
  active: "badge-warning",
  ongoing: "badge-warning",
  'in-progress': "badge-warning",
  upcoming: "badge-primary",
  confirmed: "badge-primary",
  completed: "badge-success",
  pending: "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-muted text-muted-foreground",
  cancelled: "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-red-100 text-red-800",
};

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    todayBookings: 0,
    bookingsChange: '+0%',
    activeWorkers: 0,
    workersOnlineInfo: '0 online',
    todayRevenue: 0,
    revenueChange: '+0%',
    fulfillmentRate: 0,
    fulfillmentChange: '+0%'
  });
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsData, alertsData, bookingsData] = await Promise.all([
        adminAPI.getDashboardStats(),
        adminAPI.getAlerts(),
        adminAPI.getRecentBookings(5)
      ]);

      if (statsData.stats) setStats(statsData.stats);
      setAlerts(alertsData.alerts || []);
      setRecentBookings(bookingsData.bookings || []);
    } catch (error) {
      console.error('Error fetching admin dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleResolveAlert = async (alertItem: SystemAlert) => {
    if (alertItem.action === 'assign-workers') {
      // Navigate to bookings page or handle assignment
      window.alert('Auto-assignment in progress. Check bookings page for details.');
    } else if (alertItem.action === 'contact-workers') {
      window.alert('Contact worker feature coming soon!');
    }
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = () => {
    const now = new Date();
    return now.toLocaleDateString('en-IN', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <AppLayout userType="admin" userName="Admin Team">
        <div className="max-w-5xl mx-auto flex items-center justify-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="admin" userName="Admin Team">
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-20 md:pb-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Operations overview for today</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-foreground">{formatDate()}</p>
            <p className="text-muted-foreground">Mumbai Operations</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { 
              label: "Today's Bookings", 
              value: stats.todayBookings, 
              change: stats.bookingsChange, 
              icon: Calendar, 
              color: "text-primary", 
              bg: "bg-primary-light" 
            },
            { 
              label: "Active Workers", 
              value: stats.activeWorkers, 
              change: stats.workersOnlineInfo, 
              icon: Users, 
              color: "text-success", 
              bg: "bg-success-light" 
            },
            { 
              label: "Revenue Today", 
              value: `₹${stats.todayRevenue.toLocaleString()}`, 
              change: stats.revenueChange, 
              icon: TrendingUp, 
              color: "text-warning", 
              bg: "bg-warning-light" 
            },
            { 
              label: "Fulfillment Rate", 
              value: `${stats.fulfillmentRate}%`, 
              change: stats.fulfillmentChange, 
              icon: CheckCircle, 
              color: "text-primary", 
              bg: "bg-primary-light" 
            },
          ].map((card) => (
            <div key={card.label} className="card-elevated p-5">
              <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center mb-3`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
              <p className="text-2xl font-bold font-heading text-foreground">{card.value}</p>
              <p className={`text-xs font-medium mt-1 ${
                typeof card.change === 'string' && card.change.startsWith('+') ? 'text-success' : 'text-muted-foreground'
              }`}>
                {card.change}
              </p>
            </div>
          ))}
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-bold font-heading text-foreground">Alerts</h2>
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-4 rounded-xl border ${
                  alert.type === "warning" ? "bg-warning-light border-warning/30" : "bg-destructive/5 border-destructive/30"
                }`}
              >
                <AlertCircle className={`w-4 h-4 shrink-0 ${alert.type === "warning" ? "text-warning" : "text-destructive"}`} />
                <p className="text-sm text-foreground flex-1">{alert.message}</p>
                <button
                  onClick={() => handleResolveAlert(alert)}
                  className="text-xs font-medium text-primary hover:underline shrink-0"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Quick nav */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { to: "/admin/bookings", icon: Calendar, label: "All Bookings", value: `${stats.todayBookings} today` },
            { to: "/admin/workers", icon: Users, label: "Workers", value: stats.workersOnlineInfo },
            { to: "/admin/settings", icon: Settings, label: "Settings", value: "Configure QR/UPI" },
            { to: "/admin/payments", icon: BarChart2, label: "Revenue", value: `₹${stats.todayRevenue.toLocaleString()} today` },
          ].map((item) => (
            <Link key={item.to} to={item.to} className="card-elevated-hover p-4 group">
              <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center mb-3 group-hover:bg-primary transition-colors">
                <item.icon className="w-4 h-4 text-accent-foreground group-hover:text-primary-foreground transition-colors" />
              </div>
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.value}</p>
            </Link>
          ))}
        </div>

        {/* Recent bookings */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold font-heading text-foreground">Recent Bookings</h2>
            <Link to="/admin/bookings" className="text-sm text-primary font-medium flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {recentBookings.length === 0 ? (
            <div className="card-elevated p-12 text-center">
              <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-bold text-foreground mb-2">No recent bookings</h3>
              <p className="text-sm text-muted-foreground">Bookings will appear here</p>
            </div>
          ) : (
            <div className="card-elevated overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      {["Booking ID", "Customer", "Worker", "Service", "Time", "Amount", "Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map((b, i) => (
                      <tr key={b._id} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{b._id.slice(-8)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{b.customer.name}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{b.worker?.name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{b.service.name}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{b.startTime} - {b.endTime}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground">₹{b.totalAmount}</td>
                        <td className="px-4 py-3">
                          <span className={statusConfig[b.status]}>
                            {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
