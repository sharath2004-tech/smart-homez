import AppLayout from "@/components/AppLayout";
import { useAdminRole } from "@/hooks/useAdminRole";
import { api } from "@/lib/api";
import {
    AlertCircle,
    Calendar,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Clock,
    Download,
    IndianRupee,
    Loader2,
    RefreshCw,
    Search,
    Timer,
    User,
    X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

// ─── types ────────────────────────────────────────────────────────────────────
interface SubscriptionRow {
  _id: string;
  customer: { name: string; phone: string } | null;
  worker: { name: string; phone: string } | null;
  service: { name: string; category: string } | null;
  bookingType: string;
  location: { area?: string; city?: string };
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  activationStatus: string;
  bookingStatus?: string;
  isPaused?: boolean;
  isPrepaid?: boolean;
  totalAmount: number;
  paymentStatus?: string;
  preferredTime?: string;
  durationPerSession?: number;
  frequency?: string;
  sessionsTotal: number;
  sessionsDone: number;
  sessionsUpcoming: number;
  totalOvertimeMinutes: number;
  totalOvertimeCharges: number;
  createdAt: string;
}

interface SessionRow {
  sessionNumber: number;
  _id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  worker?: { name: string } | null;
  status: string;
  actualStartTime?: string;
  actualEndTime?: string;
  actualDurationMinutes?: number;
  scheduledDurationMinutes?: number;
  overtimeMinutes: number;
  overtimeCharges: number;
  isProjected?: boolean;
}

interface SessionDetail {
  subscription: SubscriptionRow & { totalAmount: number };
  sessions: SessionRow[];
  summary: {
    total: number;
    done: number;
    upcoming: number;
    totalOvertimeMinutes: number;
    totalOvertimeCharges: number;
  };
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
const resolveDisplayStatus = (sub: { activationStatus: string; bookingStatus?: string; isPaused?: boolean }) => {
  if (sub.bookingStatus === 'cancelled') return 'cancelled';
  if (sub.isPaused) return 'paused';
  return sub.activationStatus;
};
const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    paused: "bg-yellow-100 text-yellow-800",
    payment_pending: "bg-yellow-100 text-yellow-800",
    approval_pending: "bg-blue-100 text-blue-800",
    completed: "bg-slate-100 text-slate-700",
    cancelled: "bg-red-100 text-red-700",
  };
  return map[s] ?? "bg-muted text-muted-foreground";
};

// ─── CSV export ───────────────────────────────────────────────────────────────
function downloadCSV(detail: SessionDetail) {
  const sub = detail.subscription;
  const header = [
    "Session#", "Date", "Worker", "Scheduled Start", "Scheduled End",
    "Actual Start", "Actual End", "Actual Duration (min)", "Extra Time (min)", "Overtime Charge (₹)", "Status",
  ].join(",");
  const rows = detail.sessions.map((r) =>
    [
      r.sessionNumber,
      fmtDate(r.bookingDate),
      r.worker?.name ?? "—",
      r.startTime,
      r.endTime,
      r.actualStartTime ? fmtTime(r.actualStartTime) : "—",
      r.actualEndTime ? fmtTime(r.actualEndTime) : "—",
      r.actualDurationMinutes ?? "—",
      r.overtimeMinutes || 0,
      r.overtimeCharges.toFixed(2),
      r.status,
    ].join(",")
  );
  const blob = new Blob(
    [`Subscription Statement\nCustomer: ${sub.customer?.name}\nService: ${sub.service?.name}\nPrepaid: ₹${sub.totalAmount}\n\n${header}\n${rows.join("\n")}\n\nTotal Overtime Charges,₹${detail.summary.totalOvertimeCharges.toFixed(2)}`],
    { type: "text/csv" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `subscription-${sub._id}-statement.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── component ────────────────────────────────────────────────────────────────
const AdminSubscriptionTracker = () => {
  const { role, name } = useAdminRole();
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const LIMIT = 30;

  // Detail drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Summary stats
  const totalActive = subscriptions.filter(s => s.activationStatus === "active").length;
  const totalPaused = subscriptions.filter(s => s.isPaused).length;
  const totalPending = subscriptions.filter(s => s.activationStatus === "payment_pending").length;
  const totalOvertimeDue = subscriptions.reduce((s, r) => s + r.totalOvertimeCharges, 0);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get(
        `/admin/subscription-tracker?status=${statusFilter}&search=${encodeURIComponent(search)}&page=${page}&limit=${LIMIT}`
      );
      setSubscriptions(res.subscriptions ?? []);
      setTotal(res.total ?? 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [statusFilter, page]);
  // debounce search
  useEffect(() => {
    const t = setTimeout(fetchData, 400);
    return () => clearTimeout(t);
  }, [search]);

  const openDetail = async (id: string) => {
    setDrawerOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.get(`/admin/subscription-tracker/${id}/sessions`);
      setDetail(res);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <AppLayout userType={role as "admin" | "super_admin"} userName={name}>
      <div className="px-4 py-6 sm:px-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Subscription Tracker</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitor sessions done / remaining, overtime charges and billing statements
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:bg-muted text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active", value: totalActive, icon: CheckCircle, color: "text-green-600 bg-green-50" },
            { label: "Paused", value: totalPaused, icon: Clock, color: "text-yellow-600 bg-yellow-50" },
            { label: "Pending Payment", value: totalPending, icon: AlertCircle, color: "text-blue-600 bg-blue-50" },
            { label: "Overtime Due", value: `₹${totalOvertimeDue.toFixed(2)}`, icon: IndianRupee, color: "text-orange-600 bg-orange-50" },
          ].map((c) => (
            <div key={c.label} className="bg-background border border-border rounded-2xl p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color}`}>
                <c.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search customer or service…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="py-2.5 px-3 border border-border rounded-xl text-sm focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="payment_pending">Payment Pending</option>
            <option value="approval_pending">Approval Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <RefreshCw className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No subscriptions found</p>
          </div>
        ) : (
          <div className="bg-background border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    {["Customer", "Service", "Worker", "Schedule", "Sessions", "Overtime", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subscriptions.map((sub) => (
                    <tr key={sub._id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{sub.customer?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{sub.customer?.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{sub.service?.name ?? sub.bookingType}</p>
                        <p className="text-xs text-muted-foreground">
                          {sub.frequency ?? "—"} · {sub.durationPerSession}h/session
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span>{sub.worker?.name ?? "Unassigned"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-xs text-foreground">
                          {fmtDate(sub.subscriptionStartDate)} – {fmtDate(sub.subscriptionEndDate)}
                        </p>
                        <p className="text-xs text-muted-foreground">{sub.preferredTime}</p>
                      </td>
                      <td className="px-4 py-3">
                        {/* Progress bar */}
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: sub.sessionsTotal > 0 ? `${(sub.sessionsDone / sub.sessionsTotal) * 100}%` : "0%" }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {sub.sessionsDone}/{sub.sessionsTotal}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{sub.sessionsUpcoming} left</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {sub.totalOvertimeMinutes > 0 ? (
                          <div className="text-orange-700">
                            <p className="text-xs font-semibold">+{fmt(sub.totalOvertimeMinutes)}</p>
                            <p className="text-xs">₹{sub.totalOvertimeCharges.toFixed(2)}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadge(resolveDisplayStatus(sub))}`}>
                          {resolveDisplayStatus(sub).replace(/_/g, " ")}
                        </span>
                        {sub.isPrepaid && (
                          <p className="text-xs text-green-700 mt-0.5 flex items-center gap-0.5">
                            <CheckCircle className="w-3 h-3" /> Prepaid
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openDetail(sub._id)}
                          className="text-xs text-primary font-semibold hover:underline whitespace-nowrap"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 border border-border rounded-lg text-xs disabled:opacity-40">Prev</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1.5 border border-border rounded-lg text-xs disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Detail Drawer ─────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* backdrop */}
          <div className="flex-1 bg-black/40" onClick={() => setDrawerOpen(false)} />
          {/* panel */}
          <div
            ref={drawerRef}
            className="w-full max-w-2xl bg-background shadow-2xl overflow-y-auto flex flex-col"
          >
            {/* Drawer header */}
            <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-foreground">Session Statement</h2>
              <div className="flex items-center gap-2">
                {detail && (
                  <button
                    onClick={() => downloadCSV(detail)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-muted text-xs font-medium"
                  >
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                )}
                <button onClick={() => setDrawerOpen(false)} className="p-2 hover:bg-muted rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-5 flex-1">
              {detailLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : !detail ? (
                <p className="text-center text-muted-foreground py-12">Failed to load sessions</p>
              ) : (
                <>
                  {/* Sub info */}
                  <div className="bg-muted/40 rounded-2xl p-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-base">{detail.subscription.service?.name ?? detail.subscription.bookingType}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadge(resolveDisplayStatus(detail.subscription))}`}>
                        {resolveDisplayStatus(detail.subscription).replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      <div><span className="text-muted-foreground">Customer: </span><span className="font-medium">{detail.subscription.customer?.name}</span></div>
                      <div><span className="text-muted-foreground">Worker: </span><span className="font-medium">{detail.subscription.worker?.name ?? "—"}</span></div>
                      <div><span className="text-muted-foreground">Period: </span><span className="font-medium">{fmtDate(detail.subscription.subscriptionStartDate)} – {fmtDate(detail.subscription.subscriptionEndDate)}</span></div>
                      <div><span className="text-muted-foreground">Frequency: </span><span className="font-medium capitalize">{detail.subscription.frequency ?? "—"}</span></div>
                      <div><span className="text-muted-foreground">Time: </span><span className="font-medium">{detail.subscription.preferredTime} · {detail.subscription.durationPerSession}h/session</span></div>
                      <div><span className="text-muted-foreground">Location: </span><span className="font-medium">{detail.subscription.location?.area}, {detail.subscription.location?.city}</span></div>
                    </div>
                  </div>

                  {/* Bill panel */}
                  <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 space-y-2">
                    <p className="font-bold text-foreground flex items-center gap-2">
                      <IndianRupee className="w-4 h-4 text-primary" />
                      Subscription Bill Statement
                    </p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Prepaid Amount</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">₹{detail.subscription.totalAmount.toLocaleString("en-IN")}</span>
                          {(detail.subscription.isPrepaid || detail.subscription.paymentStatus === "paid") ? (
                            <span className="text-xs text-green-700 font-medium flex items-center gap-0.5">
                              <CheckCircle className="w-3 h-3" /> Paid
                            </span>
                          ) : (
                            <span className="text-xs text-yellow-700 font-medium">Pending</span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sessions Done</span>
                        <span className="font-semibold">{detail.summary.done} of {detail.summary.total}</span>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full bg-muted rounded-full h-2 my-1">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: detail.summary.total > 0 ? `${(detail.summary.done / detail.summary.total) * 100}%` : "0%" }}
                        />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sessions Remaining</span>
                        <span className="font-semibold">{detail.summary.upcoming}</span>
                      </div>
                      {detail.summary.totalOvertimeCharges > 0 && (
                        <>
                          <div className="border-t border-orange-200 pt-1.5 mt-1.5 flex justify-between text-orange-700">
                            <span className="font-medium flex items-center gap-1">
                              <Timer className="w-3.5 h-3.5" />
                              Extra Time ({fmt(detail.summary.totalOvertimeMinutes)})
                            </span>
                            <span className="font-semibold">₹{detail.summary.totalOvertimeCharges.toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-orange-600">⚠ Overtime charges are billed separately after each session</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Session table */}
                  <div>
                    <p className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      Session Log ({detail.summary.done} done · {detail.summary.upcoming} upcoming · {detail.sessions.length} total)
                    </p>
                    <div className="space-y-2">
                      {detail.sessions.map((s) => (
                        <SessionCard key={s._id} session={s} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

// ─── Session card ──────────────────────────────────────────────────────────────
const SESSION_STATUS_COLOR: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  "in-progress": "bg-blue-100 text-blue-800",
  confirmed: "bg-slate-100 text-slate-700",
  assigned: "bg-slate-100 text-slate-700",
  pending: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-700",
  scheduled: "bg-sky-50 text-sky-600 border border-sky-200",
};

const SessionCard = ({ session: s }: { session: SessionRow }) => {
  const [open, setOpen] = useState(false);
  const hasOvertime = s.overtimeMinutes > 0;
  const isProjected = s.isProjected;

  return (
    <div className={`rounded-xl border ${
      isProjected
        ? "border-sky-200 bg-sky-50/30 opacity-75"
        : hasOvertime ? "border-orange-200 bg-orange-50/40" : "border-border bg-background"
    }`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm"
        onClick={() => !isProjected && setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            isProjected ? "bg-sky-100 text-sky-500" : "bg-muted text-muted-foreground"
          }`}>
            {s.sessionNumber}
          </span>
          <span className={`font-medium ${isProjected ? "text-muted-foreground" : "text-foreground"}`}>{fmtDate(s.bookingDate)}</span>
          <span className="text-xs text-muted-foreground">{s.startTime} – {s.endTime}</span>
          {!isProjected && s.worker?.name && (
            <span className="text-xs text-muted-foreground">· {s.worker.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isProjected && hasOvertime && (
            <span className="text-xs text-orange-700 font-medium bg-orange-100 px-2 py-0.5 rounded-full">
              +{fmt(s.overtimeMinutes)} ₹{s.overtimeCharges.toFixed(0)}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SESSION_STATUS_COLOR[s.status] ?? "bg-muted text-muted-foreground"}`}>
            {isProjected ? "📅 scheduled" : s.status.replace(/-/g, " ")}
          </span>
          {!isProjected && (open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />)}
        </div>
      </button>

      {open && !isProjected && (
        <div className="border-t border-border px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground">Scheduled</p>
            <p className="font-medium">{s.startTime} – {s.endTime}</p>
            <p className="text-muted-foreground">{fmt(s.scheduledDurationMinutes)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Actual</p>
            <p className="font-medium">{fmtTime(s.actualStartTime)} – {fmtTime(s.actualEndTime)}</p>
            <p className="text-muted-foreground">{fmt(s.actualDurationMinutes)}</p>
          </div>
          {hasOvertime && (
            <div className="text-orange-700">
              <p className="text-orange-500">Extra Time</p>
              <p className="font-bold">+{fmt(s.overtimeMinutes)}</p>
              <p>₹{s.overtimeCharges.toFixed(2)} charged</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminSubscriptionTracker;
