import AppLayout from "@/components/AppLayout";
import { api } from "@/lib/api";
import { AlertTriangle, CheckCircle, Clock, MapPin, Phone, RefreshCw, Shield, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface SOSAlert {
  _id: string;
  triggeredBy: { _id: string; name: string; phone?: string };
  userType: 'customer' | 'worker';
  location: { coordinates: [number, number] };
  address?: string;
  status: 'active' | 'resolved' | 'false-alarm';
  priority: 'low' | 'medium' | 'high' | 'critical';
  notes?: string;
  createdAt: string;
  resolvedAt?: string;
  respondedBy?: { admin: { name: string }; respondedAt: string; action: string }[];
}

const PRIORITY_META: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: 'text-red-700',    bg: 'bg-red-100 border-red-300' },
  high:     { label: 'High',     color: 'text-orange-700', bg: 'bg-orange-100 border-orange-300' },
  medium:   { label: 'Medium',   color: 'text-yellow-700', bg: 'bg-yellow-100 border-yellow-300' },
  low:      { label: 'Low',      color: 'text-blue-700',   bg: 'bg-blue-100 border-blue-300' },
};

const AdminSOS = () => {
  const [alerts, setAlerts] = useState<SOSAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'active' | 'all'>('active');

  const fetchAlerts = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get('/sos');
      setAlerts(res.alerts ?? []);
    } catch {
      if (!silent) toast.error('Failed to load SOS alerts');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts(false);
    const interval = setInterval(() => fetchAlerts(true), 30000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleResolve = async (id: string, outcome: 'resolved' | 'false-alarm') => {
    const note = actionNote[id]?.trim() || '';
    if (!note) { toast.error('Please add an action note before resolving'); return; }
    try {
      setResolving(id);
      await api.patch(`/sos/${id}/resolve`, { action: `${outcome}: ${note}` });
      toast.success(`Alert marked as ${outcome}`);
      fetchAlerts(true);
    } catch {
      toast.error('Failed to update alert');
    } finally {
      setResolving(null);
    }
  };

  const timeSince = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const mapsUrl = (coords: [number, number]) =>
    `https://www.google.com/maps?q=${coords[1]},${coords[0]}`;

  const displayed = tab === 'active' ? alerts.filter(a => a.status === 'active') : alerts;
  const activeCount = alerts.filter(a => a.status === 'active').length;

  return (
    <AppLayout userType="admin" userName="Admin">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-7 h-7 text-red-500" />
              SOS Alerts
              {activeCount > 0 && (
                <span className="ml-2 px-2.5 py-0.5 bg-red-500 text-white text-sm font-bold rounded-full animate-pulse">
                  {activeCount}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Monitor and respond to emergency alerts</p>
          </div>
          <button onClick={() => fetchAlerts(false)} className="btn-outline flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['active', 'all'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {t === 'active' ? `Active (${activeCount})` : 'All Alerts'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Loading alerts…</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-border rounded-xl">
            <Shield className="w-14 h-14 mx-auto text-green-500 mb-3" />
            <p className="font-semibold text-foreground">All Clear</p>
            <p className="text-sm text-muted-foreground">No {tab === 'active' ? 'active ' : ''}SOS alerts</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.map(alert => {
              const pm = PRIORITY_META[alert.priority] ?? PRIORITY_META.high;
              return (
                <div key={alert._id}
                  className={`rounded-xl border-2 p-5 space-y-4 ${alert.status === 'active' ? pm.bg : 'bg-muted/50 border-border'}`}
                >
                  {/* Alert header */}
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-6 h-6 shrink-0 mt-0.5 ${alert.status === 'active' ? pm.color : 'text-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-bold text-foreground">{alert.triggeredBy.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${pm.bg} ${pm.color}`}>
                          {pm.label}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white border border-border text-muted-foreground capitalize">
                          {alert.userType}
                        </span>
                        {alert.status !== 'active' && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            alert.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          } capitalize`}>
                            {alert.status === 'false-alarm' ? 'False Alarm' : 'Resolved'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {timeSince(alert.createdAt)}
                        </span>
                        {alert.location?.coordinates && (
                          <a
                            href={mapsUrl(alert.location.coordinates)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <MapPin className="w-3 h-3" />
                            {alert.address ?? `${alert.location.coordinates[1].toFixed(4)}, ${alert.location.coordinates[0].toFixed(4)}`}
                          </a>
                        )}
                        {alert.triggeredBy.phone && (
                          <a href={`tel:${alert.triggeredBy.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                            <Phone className="w-3 h-3" /> {alert.triggeredBy.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Response history */}
                  {alert.respondedBy && alert.respondedBy.length > 0 && (
                    <div className="bg-white/70 rounded-lg p-3 space-y-1">
                      <p className="text-xs font-semibold text-foreground mb-1">Response Log</p>
                      {alert.respondedBy.map((r, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {r.action} — {timeSince(r.respondedAt)}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Action panel for active alerts */}
                  {alert.status === 'active' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Add action note (required)…"
                        value={actionNote[alert._id] ?? ''}
                        onChange={e => setActionNote(prev => ({ ...prev, [alert._id]: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:border-primary"
                      />
                      <div className="flex gap-2">
                        <button
                          disabled={resolving === alert._id}
                          onClick={() => handleResolve(alert._id, 'resolved')}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-60"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Resolve
                        </button>
                        <button
                          disabled={resolving === alert._id}
                          onClick={() => handleResolve(alert._id, 'false-alarm')}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-60"
                        >
                          <XCircle className="w-4 h-4" />
                          False Alarm
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">Auto-refreshes every 30 seconds</p>
      </div>
    </AppLayout>
  );
};

export default AdminSOS;
