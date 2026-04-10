import AppLayout from "@/components/AppLayout";
import { authAPI, bookingsAPI } from "@/lib/api";
import {
    AlertTriangle,
    Calendar,
    CheckCircle,
    Clock,
    Download,
    Filter,
    IndianRupee,
    RefreshCw,
    Search,
    XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CancellationItem {
  _id: string;
  service: { name: string; category: string } | null;
  bookingType?: string;
  customer: { name: string; phone: string } | null;
  worker: { name: string } | null;
  bookingDate: string;
  cancellationDate?: string;
  cancellationReason?: string;
  totalAmount: number;
  refundAmount: number;
  penaltyStatus: "paid" | "proof_submitted" | "proof_required" | "none";
  location: { area: string; city: string } | null;
}

interface Summary {
  total: number;
  free: number;
  penaltyPaid: number;
  penaltyPending: number;
  totalPenaltyCollected: number;
  totalRefundIssued: number;
}

interface ServiceRow {
  service: string;
  category: string;
  count: number;
}

interface ReasonRow {
  reason: string;
  count: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (d?: string) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
  } catch {
    return d;
  }
};

const penaltyBadge = (status: CancellationItem["penaltyStatus"]) => {
  switch (status) {
    case "paid":
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold"><CheckCircle className="w-3 h-3" /> Fee Paid</span>;
    case "proof_submitted":
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold"><Clock className="w-3 h-3" /> Proof Submitted</span>;
    case "proof_required":
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold"><AlertTriangle className="w-3 h-3" /> Proof Required</span>;
    default:
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold"><CheckCircle className="w-3 h-3" /> Free</span>;
  }
};

// ─── Component ───────────────────────────────────────────────────────────────

const AdminCancellationReport = () => {
  const { t } = useTranslation();

  const [profile, setProfile] = useState<{ role: string; name?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [cancellations, setCancellations] = useState<CancellationItem[]>([]);
  const [serviceBreakdown, setServiceBreakdown] = useState<ServiceRow[]>([]);
  const [reasonBreakdown, setReasonBreakdown] = useState<ReasonRow[]>([]);

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [penaltyFilter, setPenaltyFilter] = useState<"all" | CancellationItem["penaltyStatus"]>("all");

  const isSuperAdmin = profile?.role === "super_admin";

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await bookingsAPI.getCancellationReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setSummary(data.summary);
      setCancellations(data.cancellations ?? []);
      setServiceBreakdown(data.serviceBreakdown ?? []);
      setReasonBreakdown(data.reasonBreakdown ?? []);
    } catch (err) {
      console.error("Failed to load cancellation report", err);
      toast.error("Failed to load cancellation report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    authAPI.getProfile().then((res) => setProfile(res.user || res)).catch(console.error);
  }, []);

  useEffect(() => {
    if (profile) fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const filtered = useMemo(() => {
    return cancellations.filter((c) => {
      const term = search.toLowerCase();
      const matchSearch =
        !term ||
        (c.customer?.name ?? "").toLowerCase().includes(term) ||
        (c.service?.name ?? c.bookingType ?? "").toLowerCase().includes(term) ||
        (c.cancellationReason ?? "").toLowerCase().includes(term) ||
        c._id.toLowerCase().includes(term);
      const matchPenalty = penaltyFilter === "all" || c.penaltyStatus === penaltyFilter;
      return matchSearch && matchPenalty;
    });
  }, [cancellations, search, penaltyFilter]);

  const exportCSV = () => {
    if (!filtered.length) return;
    const rows = [
      ["Booking ID", "Service", "Customer", "Customer Phone", "Worker", "Booking Date", "Cancellation Date", "Reason", "Amount", "Refund", "Penalty Status", "Location"],
      ...filtered.map((c) => [
        c._id.slice(-8).toUpperCase(),
        c.service?.name ?? c.bookingType ?? "—",
        c.customer?.name ?? "—",
        c.customer?.phone ?? "—",
        c.worker?.name ?? "—",
        fmtDate(c.bookingDate),
        fmtDate(c.cancellationDate),
        `"${(c.cancellationReason ?? "").replace(/"/g, "'")}"`,
        c.totalAmount,
        c.refundAmount,
        c.penaltyStatus,
        c.location ? `${c.location.area}, ${c.location.city}` : "—",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cancellations-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const userType = (profile?.role === "super_admin" ? "super_admin" : "admin") as "admin" | "super_admin";

  return (
    <AppLayout userType={userType} userName={profile?.name ?? "Admin"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6 py-4">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cancellation Report</h1>
            <p className="text-sm text-muted-foreground mt-0.5">All cancelled bookings with penalty and refund details</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchReport}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={exportCSV}
              disabled={!filtered.length}
              className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Date Filters */}
        <div className="card-elevated p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-clean text-sm h-9"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-clean text-sm h-9"
            />
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 h-9"
          >
            <Filter className="w-4 h-4" />
            Apply
          </button>
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(""); setEndDate(""); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear dates
            </button>
          )}
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Cancelled", value: summary.total, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
              { label: "Free Cancellations", value: summary.free, icon: CheckCircle, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Penalty Paid", value: summary.penaltyPaid, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
              { label: "Proof Pending", value: summary.penaltyPending, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Penalty Collected", value: `₹${summary.totalPenaltyCollected.toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-purple-600", bg: "bg-purple-50" },
              { label: "Refunds Issued", value: `₹${summary.totalRefundIssued.toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-orange-600", bg: "bg-orange-50" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className={`card-elevated p-4 flex flex-col gap-1 ${bg}`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Breakdowns */}
        {(serviceBreakdown.length > 0 || reasonBreakdown.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By Service */}
            <div className="card-elevated p-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Cancellations by Service
              </h3>
              <div className="space-y-2">
                {serviceBreakdown.slice(0, 8).map((row) => (
                  <div key={row.service} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{row.service}</p>
                      <p className="text-xs text-muted-foreground capitalize">{row.category}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* By Reason */}
            <div className="card-elevated p-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Top Cancellation Reasons
              </h3>
              <div className="space-y-2">
                {reasonBreakdown.map((row, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 py-1.5 border-b border-border last:border-0">
                    <p className="text-sm text-foreground break-words flex-1">{row.reason}</p>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold shrink-0">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search customer, service, reason…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 input-clean text-sm"
            />
          </div>
          <select
            value={penaltyFilter}
            onChange={(e) => setPenaltyFilter(e.target.value as typeof penaltyFilter)}
            className="input-clean text-sm"
          >
            <option value="all">All penalty states</option>
            <option value="none">Free cancellation</option>
            <option value="paid">Penalty paid</option>
            <option value="proof_submitted">Proof submitted</option>
            <option value="proof_required">Proof required</option>
          </select>
          <span className="text-xs text-muted-foreground">{filtered.length} records</span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="card-elevated p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading cancellation data…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <XCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">No cancellations found for the selected filters</p>
          </div>
        ) : (
          <div className="card-elevated overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 border-b border-border">
                <tr>
                  {["Booking", "Service", "Customer", "Worker", "Booking Date", "Cancelled On", "Amount", "Refund", "Penalty", "Reason"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, idx) => (
                  <tr key={c._id} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c._id.slice(-8).toUpperCase()}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium text-foreground">{c.service?.name ?? c.bookingType ?? "—"}</p>
                      {c.service?.category && <p className="text-xs text-muted-foreground capitalize">{c.service.category}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium text-foreground">{c.customer?.name ?? "—"}</p>
                      {c.customer?.phone && <p className="text-xs text-muted-foreground">{c.customer.phone}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-foreground">{c.worker?.name ?? <span className="text-muted-foreground">Unassigned</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-foreground">{fmtDate(c.bookingDate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-foreground">{fmtDate(c.cancellationDate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">₹{c.totalAmount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {c.refundAmount > 0
                        ? <span className="text-green-600 font-semibold">₹{c.refundAmount.toLocaleString("en-IN")}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">{penaltyBadge(c.penaltyStatus)}</td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-xs text-muted-foreground line-clamp-2 break-words">{c.cancellationReason ?? "—"}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminCancellationReport;
