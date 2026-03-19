import AppLayout from "@/components/AppLayout";
import { api } from "@/lib/api";
import { AlertTriangle, BarChart3, MapPin, RefreshCw, TrendingDown, TrendingUp, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface AreaStat {
  area: string;
  city: string;
  workerCount: number;
  bookingCount: number;
}

const AdminHeatmap = () => {
  const [stats, setStats] = useState<AreaStat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get('/admin/area-stats');
      setStats(res.stats ?? []);
    } catch {
      if (!silent) toast.error('Failed to load area stats');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(false);
  }, [fetchStats]);

  const maxBookings = Math.max(...stats.map(s => s.bookingCount), 1);
  const maxWorkers  = Math.max(...stats.map(s => s.workerCount), 1);

  const getDemandLevel = (s: AreaStat) => {
    if (s.workerCount === 0 && s.bookingCount > 3)  return 'critical';
    if (s.bookingCount / Math.max(s.workerCount, 1) > 5) return 'high';
    if (s.bookingCount / Math.max(s.workerCount, 1) > 2) return 'medium';
    return 'healthy';
  };

  const DEMAND_META = {
    critical: { label: 'No Coverage',    bg: 'bg-red-50 border-red-300',    badge: 'bg-red-100 text-red-700',    icon: AlertTriangle, iconColor: 'text-red-500' },
    high:     { label: 'High Demand',     bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700', icon: TrendingUp,    iconColor: 'text-orange-500' },
    medium:   { label: 'Growing',         bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', icon: TrendingUp,    iconColor: 'text-yellow-500' },
    healthy:  { label: 'Well Staffed',    bg: 'bg-green-50 border-green-200',   badge: 'bg-green-100 text-green-700',  icon: TrendingDown,  iconColor: 'text-green-500' },
  };

  const totalWorkers  = stats.reduce((s, a) => s + a.workerCount, 0);
  const totalBookings = stats.reduce((s, a) => s + a.bookingCount, 0);
  const understaffed  = stats.filter(s => getDemandLevel(s) === 'critical' || getDemandLevel(s) === 'high').length;

  return (
    <AppLayout userType="super_admin" userName="Super Admin">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-primary" />
              Worker Demand Heatmap
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Worker density vs booking demand per area (last 30 days)</p>
          </div>
          <button onClick={() => fetchStats(false)} className="btn-outline flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card-elevated p-4 text-center">
            <Users className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{totalWorkers}</p>
            <p className="text-xs text-muted-foreground">Total Workers</p>
          </div>
          <div className="card-elevated p-4 text-center">
            <BarChart3 className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{totalBookings}</p>
            <p className="text-xs text-muted-foreground">Bookings (30d)</p>
          </div>
          <div className="card-elevated p-4 text-center">
            <AlertTriangle className={`w-6 h-6 mx-auto mb-1 ${understaffed > 0 ? 'text-red-500' : 'text-green-500'}`} />
            <p className="text-2xl font-bold text-foreground">{understaffed}</p>
            <p className="text-xs text-muted-foreground">Understaffed Areas</p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Loading area data…</p>
          </div>
        ) : stats.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-border rounded-xl">
            <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-semibold text-foreground">No area data yet</p>
            <p className="text-sm text-muted-foreground">Workers must be assigned to locations first</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.map((s) => {
              const level = getDemandLevel(s);
              const meta  = DEMAND_META[level];
              const Icon  = meta.icon;
              const bookingPct = Math.round((s.bookingCount / maxBookings) * 100);
              const workerPct  = Math.round((s.workerCount  / maxWorkers)  * 100);
              const ratio = s.workerCount > 0
                ? `${(s.bookingCount / s.workerCount).toFixed(1)} bookings/worker`
                : s.bookingCount > 0 ? 'No workers assigned' : 'No activity';
              return (
                <div key={`${s.area}-${s.city}`}
                  className={`rounded-xl border p-4 space-y-3 ${meta.bg}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={`w-5 h-5 shrink-0 ${meta.iconColor}`} />
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground line-clamp-2 break-words">{s.area}</p>
                        <p className="text-xs text-muted-foreground">{s.city} · {ratio}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${meta.badge}`}>
                      {meta.label}
                    </span>
                  </div>

                  {/* Workers bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Workers</span>
                      <span className="font-medium text-foreground">{s.workerCount}</span>
                    </div>
                    <div className="h-2 bg-white/70 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${workerPct}%` }} />
                    </div>
                  </div>

                  {/* Bookings bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Bookings (30d)</span>
                      <span className="font-medium text-foreground">{s.bookingCount}</span>
                    </div>
                    <div className="h-2 bg-white/70 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          level === 'critical' ? 'bg-red-500' :
                          level === 'high'     ? 'bg-orange-500' :
                          level === 'medium'   ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${bookingPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminHeatmap;
