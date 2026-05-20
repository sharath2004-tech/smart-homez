import AppLayout from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminAPI } from '@/lib/api';
import {
    Clock,
    Download,
    IndianRupee,
    Loader2,
    RefreshCw,
    Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

// ── Helpers ────────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0];
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

const fmt = (v: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface WorkerWageRow {
  _id: string;
  name: string;
  phone: string;
  hourlyRate: number;
  completedTasks: number;
  totalMinutesWorked: number;
  totalHoursWorked: number;
  wageEarned: number;
}

interface WageReportSummary {
  totalWorkers: number;
  totalMinutesWorked: number;
  totalHoursWorked: number;
  totalWageEarned: number;
}

interface CustomerBillRow {
  _id: string;
  name: string;
  phone: string;
  totalBookings: number;
  subscriptionBookings: number;
  oneTimeBookings: number;
  subscriptionBill: number;
  oneTimeBill: number;
  extraUtilisationBill: number;
  totalBill: number;
}

interface BillReportSummary {
  totalCustomers: number;
  totalSubscriptionBill: number;
  totalOneTimeBill: number;
  totalExtraUtilisationBill: number;
  grandTotal: number;
}

// ── Component ──────────────────────────────────────────────────────────────────

const AdminReports = () => {
  const [tab, setTab] = useState<'wages' | 'bills'>('wages');

  // Wage report state
  const [wageFrom, setWageFrom] = useState(monthStart());
  const [wageTo, setWageTo] = useState(today());
  const [wageLoading, setWageLoading] = useState(false);
  const [wageExporting, setWageExporting] = useState(false);
  const [wageWorkers, setWageWorkers] = useState<WorkerWageRow[]>([]);
  const [wageSummary, setWageSummary] = useState<WageReportSummary | null>(null);

  // Bill report state
  const [billFrom, setBillFrom] = useState(monthStart());
  const [billTo, setBillTo] = useState(today());
  const [billLoading, setBillLoading] = useState(false);
  const [billExporting, setBillExporting] = useState(false);
  const [billCustomers, setBillCustomers] = useState<CustomerBillRow[]>([]);
  const [billSummary, setBillSummary] = useState<BillReportSummary | null>(null);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadWageReport = async () => {
    setWageLoading(true);
    try {
      const data = await adminAPI.getWorkerWageReport({ from: wageFrom, to: wageTo });
      setWageWorkers(data.workers || []);
      setWageSummary(data.summary || null);
    } catch {
      toast.error('Failed to load worker wage report');
    } finally {
      setWageLoading(false);
    }
  };

  const loadBillReport = async () => {
    setBillLoading(true);
    try {
      const data = await adminAPI.getCustomerBillReport({ from: billFrom, to: billTo });
      setBillCustomers(data.customers || []);
      setBillSummary(data.summary || null);
    } catch {
      toast.error('Failed to load customer bill report');
    } finally {
      setBillLoading(false);
    }
  };

  useEffect(() => { loadWageReport(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadBillReport(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Export handlers ────────────────────────────────────────────────────────

  const exportWages = async () => {
    setWageExporting(true);
    try {
      const blob = await adminAPI.getWorkerWageReportExportUrl({ from: wageFrom, to: wageTo });
      triggerDownload(blob, `worker-wages-${wageFrom}-to-${wageTo}.csv`);
      toast.success('Report downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setWageExporting(false);
    }
  };

  const exportBills = async () => {
    setBillExporting(true);
    try {
      const blob = await adminAPI.getCustomerBillReportExportUrl({ from: billFrom, to: billTo });
      triggerDownload(blob, `customer-bills-${billFrom}-to-${billTo}.csv`);
      toast.success('Report downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setBillExporting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppLayout userType="admin">
      <div className="px-4 py-6 sm:px-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">Worker wages &amp; customer billing summaries</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border pb-0">
          <button
            onClick={() => setTab('wages')}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              tab === 'wages'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Worker Wages
          </button>
          <button
            onClick={() => setTab('bills')}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              tab === 'bills'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Customer Bills
          </button>
        </div>

        {/* ── Worker Wages Tab ────────────────────────────────────────────────── */}
        {tab === 'wages' && (
          <div className="space-y-5">
            {/* Filters */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
                    <input
                      type="date"
                      className="input-clean text-sm"
                      value={wageFrom}
                      max={wageTo}
                      onChange={e => setWageFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
                    <input
                      type="date"
                      className="input-clean text-sm"
                      value={wageTo}
                      min={wageFrom}
                      max={today()}
                      onChange={e => setWageTo(e.target.value)}
                    />
                  </div>
                  <Button size="sm" variant="outline" onClick={loadWageReport} disabled={wageLoading}>
                    {wageLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span className="ml-1.5">Apply</span>
                  </Button>
                  <Button size="sm" onClick={exportWages} disabled={wageExporting || wageWorkers.length === 0}>
                    {wageExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span className="ml-1.5">Download CSV</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Summary cards */}
            {wageSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground mb-1">Workers</p>
                    <p className="text-2xl font-bold text-foreground">{wageSummary.totalWorkers}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground mb-1">Total Hours</p>
                    <p className="text-2xl font-bold text-foreground">{fmt(wageSummary.totalHoursWorked)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground mb-1">Total Minutes</p>
                    <p className="text-2xl font-bold text-foreground">{wageSummary.totalMinutesWorked}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground mb-1">Total Wages Due</p>
                    <p className="text-2xl font-bold text-green-600">₹{fmt(wageSummary.totalWageEarned)}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Worker-wise Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {wageLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : wageWorkers.length === 0 ? (
                  <div className="text-center text-muted-foreground py-16">
                    No completed tasks found for the selected period.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">#</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Worker</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Phone</th>
                          <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Tasks</th>
                          <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Minutes</th>
                          <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Hours</th>
                          <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Rate (₹/hr)</th>
                          <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Wage Due (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wageWorkers.map((w, i) => (
                          <tr key={w._id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-3 font-medium text-foreground">{w.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{w.phone || '—'}</td>
                            <td className="px-4 py-3 text-right">
                              <Badge variant="outline">{w.completedTasks}</Badge>
                            </td>
                            <td className="px-4 py-3 text-right text-muted-foreground">{w.totalMinutesWorked}</td>
                            <td className="px-4 py-3 text-right font-medium">
                              <span className="flex items-center justify-end gap-1">
                                <Clock className="w-3 h-3 text-muted-foreground" />
                                {fmt(w.totalHoursWorked)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-muted-foreground">{w.hourlyRate ?? '—'}</td>
                            <td className="px-4 py-3 text-right font-bold text-green-600">
                              <span className="flex items-center justify-end gap-1">
                                <IndianRupee className="w-3 h-3" />
                                {fmt(w.wageEarned)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {wageSummary && (
                        <tfoot>
                          <tr className="bg-muted/50 font-semibold">
                            <td colSpan={3} className="px-4 py-3">Total</td>
                            <td className="px-4 py-3 text-right">{wageWorkers.reduce((s, w) => s + w.completedTasks, 0)}</td>
                            <td className="px-4 py-3 text-right">{wageSummary.totalMinutesWorked}</td>
                            <td className="px-4 py-3 text-right">{fmt(wageSummary.totalHoursWorked)}</td>
                            <td className="px-4 py-3 text-right">—</td>
                            <td className="px-4 py-3 text-right text-green-600">₹{fmt(wageSummary.totalWageEarned)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Customer Bills Tab ──────────────────────────────────────────────── */}
        {tab === 'bills' && (
          <div className="space-y-5">
            {/* Filters */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
                    <input
                      type="date"
                      className="input-clean text-sm"
                      value={billFrom}
                      max={billTo}
                      onChange={e => setBillFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
                    <input
                      type="date"
                      className="input-clean text-sm"
                      value={billTo}
                      min={billFrom}
                      onChange={e => setBillTo(e.target.value)}
                    />
                  </div>
                  <Button size="sm" variant="outline" onClick={loadBillReport} disabled={billLoading}>
                    {billLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span className="ml-1.5">Apply</span>
                  </Button>
                  <Button size="sm" onClick={exportBills} disabled={billExporting || billCustomers.length === 0}>
                    {billExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span className="ml-1.5">Download CSV</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Summary cards */}
            {billSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground mb-1">Customers</p>
                    <p className="text-2xl font-bold text-foreground">{billSummary.totalCustomers}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground mb-1">Subscription Bill</p>
                    <p className="text-2xl font-bold text-blue-600">₹{fmt(billSummary.totalSubscriptionBill)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground mb-1">Extra Utilisation</p>
                    <p className="text-2xl font-bold text-amber-600">₹{fmt(billSummary.totalExtraUtilisationBill)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground mb-1">Grand Total</p>
                    <p className="text-2xl font-bold text-green-600">₹{fmt(billSummary.grandTotal)}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <IndianRupee className="w-4 h-4" />
                  Customer-wise Billing
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {billLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : billCustomers.length === 0 ? (
                  <div className="text-center text-muted-foreground py-16">
                    No completed bookings found for the selected period.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">#</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Customer</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Phone</th>
                          <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Bookings</th>
                          <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Sub. Bill (₹)</th>
                          <th className="text-right px-4 py-3 font-semibold text-muted-foreground">One-Time (₹)</th>
                          <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Extra Use (₹)</th>
                          <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Total Bill (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billCustomers.map((c, i) => (
                          <tr key={c._id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{c.phone || '—'}</td>
                            <td className="px-4 py-3 text-right">
                              <Badge variant="outline">{c.totalBookings}</Badge>
                            </td>
                            <td className="px-4 py-3 text-right text-blue-600 font-medium">
                              {c.subscriptionBill > 0 ? `₹${fmt(c.subscriptionBill)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right text-muted-foreground">
                              {c.oneTimeBill > 0 ? `₹${fmt(c.oneTimeBill)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right text-amber-600">
                              {c.extraUtilisationBill > 0 ? `₹${fmt(c.extraUtilisationBill)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-green-600">
                              ₹{fmt(c.totalBill)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {billSummary && (
                        <tfoot>
                          <tr className="bg-muted/50 font-semibold">
                            <td colSpan={3} className="px-4 py-3">Total</td>
                            <td className="px-4 py-3 text-right">{billCustomers.reduce((s, c) => s + c.totalBookings, 0)}</td>
                            <td className="px-4 py-3 text-right text-blue-600">₹{fmt(billSummary.totalSubscriptionBill)}</td>
                            <td className="px-4 py-3 text-right">₹{fmt(billSummary.totalOneTimeBill)}</td>
                            <td className="px-4 py-3 text-right text-amber-600">₹{fmt(billSummary.totalExtraUtilisationBill)}</td>
                            <td className="px-4 py-3 text-right text-green-600">₹{fmt(billSummary.grandTotal)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminReports;
