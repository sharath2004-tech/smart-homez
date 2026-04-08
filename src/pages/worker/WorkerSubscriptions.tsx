import AppLayout from "@/components/AppLayout";
import { api } from "@/lib/api";
import {
    Calendar,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Clock,
    Loader2,
    MapPin,
    RefreshCw,
    Timer,
    User,
} from "lucide-react";
import { useEffect, useState } from "react";

// ─── types ────────────────────────────────────────────────────────────────────
interface SessionRow {
  sessionNumber: number;
  _id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  actualStartTime?: string;
  actualEndTime?: string;
  actualDurationMinutes?: number;
  scheduledDurationMinutes?: number;
  overtimeMinutes: number;
  overtimeCharges: number;
}

interface WorkerSubscription {
  _id: string;
  customer: { name: string; phone: string } | null;
  service: { name: string; category: string } | null;
  bookingType: string;
  location: { address?: string; area?: string; city?: string };
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  activationStatus: string;
  isPaused?: boolean;
  isPrepaid?: boolean;
  preferredTime?: string;
  durationPerSession?: number;
  frequency?: string;
  sessionsTotal: number;
  sessionsDone: number;
  sessionsUpcoming: number;
  totalOvertimeMinutes: number;
  totalOvertimeCharges: number;
  sessions: SessionRow[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (mins?: number | null) => {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const fmtTime = (t?: string) => {
  if (!t) return "—";
  try {
    return new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return t;
  }
};
const fmtDate = (d?: string) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
  } catch {
    return d;
  }
};

const statusColor: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-200",
  payment_pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approval_pending: "bg-blue-100 text-blue-800 border-blue-200",
};

const sessionStatusColor: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  "in-progress": "bg-blue-100 text-blue-800",
  confirmed: "bg-slate-100 text-slate-600",
  assigned: "bg-slate-100 text-slate-600",
  pending: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-700",
};

// ─── Component ────────────────────────────────────────────────────────────────
const WorkerSubscriptions = () => {
  const [subscriptions, setSubscriptions] = useState<WorkerSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const workerName = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}").name ?? "Worker";
    } catch {
      return "Worker";
    }
  })();

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/bookings/worker/my-subscriptions");
      setSubscriptions(res.subscriptions ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const activeCount = subscriptions.filter(s => s.activationStatus === "active").length;
  const doneToday = subscriptions.reduce((sum, s) => {
    const today = new Date().toDateString();
    return sum + s.sessions.filter(r => r.status === "completed" && new Date(r.bookingDate).toDateString() === today).length;
  }, 0);
  const pendingOvertimeCharges = subscriptions.reduce((s, r) => s + r.totalOvertimeCharges, 0);

  return (
    <AppLayout userType="worker" userName={workerName}>
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">My Subscriptions</h1>
            <p className="text-sm text-muted-foreground">Track all your assigned subscription customers</p>
          </div>
          <button onClick={fetchData} className="p-2 hover:bg-muted rounded-xl border border-border">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Summary pills */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-green-50 border border-green-200">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-green-800">{activeCount} Active</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-50 border border-blue-200">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-800">{doneToday} Done today</span>
          </div>
          {pendingOvertimeCharges > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-orange-50 border border-orange-200">
              <Timer className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-semibold text-orange-800">₹{pendingOvertimeCharges.toFixed(2)} overtime logged</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <RefreshCw className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No subscriptions assigned yet</p>
            <p className="text-sm mt-1">Your subscription customers will appear here once assigned</p>
          </div>
        ) : (
          <div className="space-y-4">
            {subscriptions.map((sub) => (
              <SubscriptionCard
                key={sub._id}
                sub={sub}
                expanded={expandedId === sub._id}
                onToggle={() => setExpandedId(expandedId === sub._id ? null : sub._id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

// ─── Subscription card ────────────────────────────────────────────────────────
const SubscriptionCard = ({
  sub,
  expanded,
  onToggle,
}: {
  sub: WorkerSubscription;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const pct = sub.sessionsTotal > 0 ? Math.round((sub.sessionsDone / sub.sessionsTotal) * 100) : 0;
  const nextSession = sub.sessions.find(s => ["confirmed", "assigned", "pending"].includes(s.status));

  return (
    <div className={`rounded-2xl border ${statusColor[sub.activationStatus] ?? "border-border"} bg-background overflow-hidden`}>
      {/* Card header */}
      <div className="p-4 space-y-3">
        {/* Customer + service */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-semibold text-foreground">{sub.customer?.name ?? "—"}</span>
              <span className="text-xs text-muted-foreground">{sub.customer?.phone}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 ml-6">
              {sub.service?.name ?? sub.bookingType}
              &nbsp;·&nbsp;{sub.frequency ?? "—"}
              &nbsp;·&nbsp;{sub.durationPerSession}h/session
            </p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${statusColor[sub.activationStatus] ?? "bg-muted text-muted-foreground border-border"}`}>
            {sub.isPaused ? "Paused" : sub.activationStatus?.replace(/_/g, " ")}
          </span>
        </div>

        {/* Location + time */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {sub.location?.area}, {sub.location?.city}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {sub.preferredTime} · {fmtDate(sub.subscriptionStartDate)} – {fmtDate(sub.subscriptionEndDate)}
          </span>
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{sub.sessionsDone} sessions completed</span>
            <span>{sub.sessionsUpcoming} remaining</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5">
            <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{pct}% complete · {sub.sessionsTotal} total sessions</p>
        </div>

        {/* Next session */}
        {nextSession && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-sm text-blue-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Next: <strong>{fmtDate(nextSession.bookingDate)}</strong> at <strong>{nextSession.startTime}</strong>
            </span>
          </div>
        )}

        {/* Overtime summary */}
        {sub.totalOvertimeMinutes > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-sm text-orange-800 flex items-center gap-2">
            <Timer className="w-4 h-4 text-orange-600 shrink-0" />
            <span>
              Total extra time: <strong>{fmt(sub.totalOvertimeMinutes)}</strong> · <strong>₹{sub.totalOvertimeCharges.toFixed(2)}</strong> overtime logged
            </span>
          </div>
        )}
      </div>

      {/* Expand toggle */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t border-border text-xs font-medium text-primary hover:bg-muted/40 transition-colors"
      >
        {expanded ? (
          <><ChevronUp className="w-4 h-4" /> Hide Session Log</>
        ) : (
          <><ChevronDown className="w-4 h-4" /> Show Session Log ({sub.sessions.length})</>
        )}
      </button>

      {/* Session log */}
      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {sub.sessions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">No sessions scheduled yet</p>
          ) : (
            sub.sessions.map((s) => (
              <div key={s._id} className={`px-4 py-3 flex items-center gap-3 text-sm ${s.overtimeMinutes > 0 ? "bg-orange-50/50" : ""}`}>
                <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                  {s.sessionNumber}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{fmtDate(s.bookingDate)}</span>
                    <span className="text-muted-foreground">{s.startTime} – {s.endTime}</span>
                  </div>
                  {s.actualStartTime && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Actual: {fmtTime(s.actualStartTime)} – {fmtTime(s.actualEndTime)}
                      &nbsp;({fmt(s.actualDurationMinutes)})
                    </p>
                  )}
                  {s.overtimeMinutes > 0 && (
                    <p className="text-xs text-orange-700 font-medium mt-0.5">
                      +{fmt(s.overtimeMinutes)} extra → ₹{s.overtimeCharges.toFixed(2)} overtime
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${sessionStatusColor[s.status] ?? "bg-muted text-muted-foreground"}`}>
                  {s.status.replace(/-/g, " ")}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default WorkerSubscriptions;
