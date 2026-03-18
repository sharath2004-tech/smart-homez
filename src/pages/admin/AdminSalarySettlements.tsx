import AppLayout from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAdminRole } from '@/hooks/useAdminRole';
import { api } from '@/lib/api';
import {
    AlertCircle,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Clock,
    IndianRupee,
    Loader2,
    RefreshCw,
    Search,
    Send,
    User,
    XCircle
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Worker {
  _id: string;
  name: string;
  email: string;
  workerProfile?: { hourlyRate?: number };
}

interface TaskPreview {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  serviceName: string;
  minutesWorked: number;
}

interface SalaryPreview {
  periodFrom: string;
  periodTo: string;
  totalMinutesWorked: number;
  totalTasksCompleted: number;
  hourlyRate: number;
  requestedAmount: number;
  tasks: TaskPreview[];
}

interface BookingDetail {
  _id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  actualDurationMinutes?: number;
  service?: { name: string };
}

interface SalaryRequest {
  _id: string;
  worker: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    workerProfile?: { hourlyRate?: number };
  };
  periodFrom: string;
  periodTo: string;
  totalMinutesWorked: number;
  totalTasksCompleted: number;
  hourlyRate: number;
  requestedAmount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  createdAt: string;
  approvedBy?: { name: string };
  rejectedBy?: { name: string };
  rejectionReason?: string;
  adminNotes?: string;
  paidAt?: string;
  bookings: BookingDetail[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMinutes(mins: number): string {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_META = {
  pending:  { label: 'Pending',  badge: 'bg-amber-100 text-amber-800',  icon: Clock },
  approved: { label: 'Approved', badge: 'bg-blue-100 text-blue-800',    icon: CheckCircle },
  rejected: { label: 'Rejected', badge: 'bg-red-100 text-red-800',      icon: XCircle },
  paid:     { label: 'Paid',     badge: 'bg-green-100 text-green-800',  icon: CheckCircle }
} as const;

const TABS = ['all', 'paid'] as const;
type Tab = typeof TABS[number];

// ── Component ─────────────────────────────────────────────────────────────────

const AdminSalarySettlements = () => {
  const { name, role } = useAdminRole();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>('all');
  const [requests, setRequests] = useState<SalaryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Send Salary panel state
  const [sendOpen, setSendOpen] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workerSearch, setWorkerSearch] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [sendFrom, setSendFrom] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [sendPreview, setSendPreview] = useState<SalaryPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  // Partial payment state
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');

  // Helper: get last day of a given month (handles Feb 28/29, 30-day months, etc.)
  const getMonthEndDate = (year: number, month: number): string => {
    // month is 1-based (1=Jan, 12=Dec)
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  };

  // Auto-set "To" to month end when "From" is set
  const handleFromChange = (from: string) => {
    setSendFrom(from);
    if (from) {
      const d = new Date(from);
      const monthEnd = getMonthEndDate(d.getFullYear(), d.getMonth() + 1);
      setSendTo(monthEnd);
    }
  };

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const query = tab === 'all' ? '' : `?status=${tab}`;
      const data = await api.get(`/salary-requests/admin${query}`);
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Fetch requests error:', err);
      toast({ title: 'Error', description: 'Failed to load requests', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

  useEffect(() => {
    fetchRequests();
    fetchWorkers();
  }, [fetchRequests]);

  const fetchWorkers = async () => {
    try {
      const data = await api.get('/admin/workers');
      setWorkers(data.workers || data || []);
    } catch (err) {
      console.error('Fetch workers error:', err);
    }
  };

  const handleWorkerPreview = async () => {
    if (!selectedWorker) {
      toast({ title: 'Select a worker', variant: 'destructive' });
      return;
    }
    if (!sendFrom || !sendTo) {
      toast({ title: 'Select a date range', variant: 'destructive' });
      return;
    }
    if (sendFrom > sendTo) {
      toast({ title: 'Invalid range', description: '"From" must be before "To"', variant: 'destructive' });
      return;
    }
    setPreviewing(true);
    setSendPreview(null);
    try {
      const data = await api.get(
        `/salary-requests/admin/worker-preview?workerId=${selectedWorker._id}&from=${sendFrom}&to=${sendTo}`
      );
      setSendPreview(data.preview);
    } catch (err) {
      toast({
        title: 'Preview failed',
        description: err instanceof Error ? err.message : 'Could not fetch preview',
        variant: 'destructive'
      });
    } finally {
      setPreviewing(false);
    }
  };

  const handleSendSalary = async () => {
    if (!selectedWorker || !sendPreview) return;
    if (isPartialPayment) {
      const amt = Number(partialAmount);
      if (!amt || amt <= 0) {
        toast({ title: 'Invalid amount', description: 'Please enter a valid partial payment amount', variant: 'destructive' });
        return;
      }
      if (amt >= (sendPreview.netPayable ?? sendPreview.totalEarnings)) {
        toast({ title: 'Invalid amount', description: 'Partial amount must be less than the total payable', variant: 'destructive' });
        return;
      }
    }
    setSending(true);
    try {
      const res = await api.post('/salary-requests/admin/send', {
        workerId: selectedWorker._id,
        periodFrom: sendFrom,
        periodTo: sendTo,
        isPartialPayment,
        partialAmount: isPartialPayment ? Number(partialAmount) : undefined
      });
      toast({ title: 'Salary Sent!', description: res.message || `Salary sent to ${selectedWorker.name}` });
      setSendOpen(false);
      setSelectedWorker(null);
      setWorkerSearch('');
      setSendFrom('');
      setSendTo('');
      setSendPreview(null);
      setIsPartialPayment(false);
      setPartialAmount('');
      await fetchRequests();
    } catch (err) {
      toast({
        title: 'Failed',
        description: err instanceof Error ? err.message : 'Could not send salary',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <AppLayout userType={role} userName={name}>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Salary Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Send monthly salary to workers based on their completed work</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* ── Send Salary Panel ── */}
        <Card>
          <div
            className="p-4 cursor-pointer flex items-center justify-between hover:bg-muted/30 transition-colors"
            onClick={() => { setSendOpen(o => !o); setSendPreview(null); }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Send className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Send Salary</p>
                <p className="text-xs text-muted-foreground">Pay a worker for their completed tasks</p>
              </div>
            </div>
            {sendOpen
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>

          {sendOpen && (
            <div className="border-t border-border">
              <CardContent className="p-4 space-y-4">
                {/* Worker search */}
                <div className="space-y-1.5">
                  <Label>Select Worker</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search worker by name or email..."
                      value={workerSearch}
                      onChange={e => { setWorkerSearch(e.target.value); setSelectedWorker(null); setSendPreview(null); }}
                      className="pl-9"
                    />
                  </div>
                  {workerSearch && !selectedWorker && (
                    <div className="bg-background border border-border rounded-md shadow-md max-h-40 overflow-y-auto">
                      {workers
                        .filter(w =>
                          w.name.toLowerCase().includes(workerSearch.toLowerCase()) ||
                          w.email.toLowerCase().includes(workerSearch.toLowerCase())
                        )
                        .map(w => (
                          <button
                            key={w._id}
                            className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors text-sm"
                            onClick={() => { setSelectedWorker(w); setWorkerSearch(w.name); setSendPreview(null); }}
                          >
                            <p className="font-medium">{w.name}</p>
                            <p className="text-xs text-muted-foreground">{w.email}</p>
                          </button>
                        ))}
                      {workers.filter(w =>
                        w.name.toLowerCase().includes(workerSearch.toLowerCase()) ||
                        w.email.toLowerCase().includes(workerSearch.toLowerCase())
                      ).length === 0 && (
                        <p className="px-3 py-3 text-sm text-muted-foreground">No workers found</p>
                      )}
                    </div>
                  )}
                  {selectedWorker && (
                    <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
                      <User className="w-4 h-4 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{selectedWorker.name}</p>
                        <p className="text-xs text-muted-foreground">{selectedWorker.email}</p>
                      </div>
                      <button
                        className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => { setSelectedWorker(null); setWorkerSearch(''); setSendPreview(null); }}
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>

                {/* Date range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="sendFrom">From Date (Join date / 1st of month)</Label>
                    <Input
                      id="sendFrom"
                      type="date"
                      value={sendFrom}
                      onChange={e => { handleFromChange(e.target.value); setSendPreview(null); }}
                    />
                    <p className="text-xs text-muted-foreground">Setting from date auto-fills the month end date</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sendTo">To Date (end of month)</Label>
                    <Input
                      id="sendTo"
                      type="date"
                      value={sendTo}
                      onChange={e => { setSendTo(e.target.value); setSendPreview(null); }}
                    />
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleWorkerPreview}
                  disabled={!selectedWorker || !sendFrom || !sendTo || previewing}
                >
                  {previewing
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Calculating...</>
                    : <><Search className="w-4 h-4 mr-2" />Calculate Salary</>}
                </Button>

                {/* Preview result */}
                {sendPreview && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-background rounded-md p-3">
                        <p className="text-xs text-muted-foreground">Tasks Done</p>
                        <p className="text-xl font-bold">{sendPreview.totalTasksCompleted}</p>
                      </div>
                      <div className="bg-background rounded-md p-3">
                        <p className="text-xs text-muted-foreground">Time Worked</p>
                        <p className="text-xl font-bold">{formatMinutes(sendPreview.totalMinutesWorked)}</p>
                      </div>
                      <div className="bg-background rounded-md p-3">
                        <p className="text-xs text-muted-foreground">Rate / hr</p>
                        <p className="text-xl font-bold">₹{sendPreview.hourlyRate}</p>
                      </div>
                    </div>

                    <div className="bg-primary rounded-lg p-4 text-center">
                      <p className="text-sm text-primary-foreground/80">Salary Amount</p>
                      <p className="text-3xl font-bold text-primary-foreground mt-1">₹{sendPreview.requestedAmount.toFixed(2)}</p>
                    </div>

                    {sendPreview.tasks.length > 0 && (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tasks Included</p>
                        {sendPreview.tasks.map(task => (
                          <div key={task._id} className="flex items-center justify-between bg-background rounded px-3 py-2 text-sm">
                            <div>
                              <p className="font-medium">{task.serviceName}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(task.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                {' · '}{task.startTime} – {task.endTime}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground">{formatMinutes(task.minutesWorked)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {sendPreview.totalTasksCompleted === 0 && (
                      <div className="flex items-center gap-2 text-amber-700 text-sm bg-amber-50 rounded p-3">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        No completed tasks found in this date range.
                      </div>
                    )}

                    <Separator />

                    {/* Partial Payment Option */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="partialPayment"
                          checked={isPartialPayment}
                          onChange={(e) => { setIsPartialPayment(e.target.checked); setPartialAmount(''); }}
                          className="w-4 h-4"
                        />
                        <Label htmlFor="partialPayment" className="cursor-pointer">
                          Pay partial amount (advance / part payment)
                        </Label>
                      </div>
                      {isPartialPayment && (
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">
                            Partial Amount (₹) — must be less than ₹{sendPreview.requestedAmount.toFixed(2)}
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            max={sendPreview.requestedAmount - 1}
                            step="0.01"
                            value={partialAmount}
                            onChange={(e) => setPartialAmount(e.target.value)}
                            placeholder={`e.g. ${(sendPreview.requestedAmount / 2).toFixed(0)}`}
                          />
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={handleSendSalary}
                      disabled={sending || sendPreview.totalTasksCompleted === 0}
                    >
                      {sending
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                        : isPartialPayment && partialAmount
                          ? <><IndianRupee className="w-4 h-4 mr-2" />Pay ₹{Number(partialAmount).toFixed(2)} (Partial) to {selectedWorker?.name}</>
                          : <><IndianRupee className="w-4 h-4 mr-2" />Send ₹{sendPreview.requestedAmount.toFixed(2)} to {selectedWorker?.name}</>}
                    </Button>
                  </div>
                )}
              </CardContent>
            </div>
          )}
        </Card>

        {/* ── Salary History ── */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Salary History</h2>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 w-full overflow-x-auto mb-4">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 min-w-fit px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize
                ${tab === t ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <IndianRupee className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No {tab === 'all' ? '' : tab} requests found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map(req => {
              const meta = STATUS_META[req.status];
              const Icon = meta.icon;
              const isExpanded = expandedId === req._id;

              return (
                <Card key={req._id} className="overflow-hidden">
                  {/* Header row */}
                  <div
                    className="p-4 cursor-pointer flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors"
                    onClick={() => toggleExpand(req._id)}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{req.worker.name}</p>
                        <p className="text-xs text-muted-foreground">{req.worker.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fmtDate(req.periodFrom)} – {fmtDate(req.periodTo)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge className={`${meta.badge} flex items-center gap-1 text-xs`}>
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </Badge>
                      <span className="text-base font-bold text-primary">₹{req.requestedAmount.toFixed(2)}</span>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      <CardContent className="p-4 space-y-4">
                        {/* Work summary */}
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="bg-muted/40 rounded-md p-3">
                            <p className="text-xs text-muted-foreground">Tasks</p>
                            <p className="text-xl font-bold">{req.totalTasksCompleted}</p>
                          </div>
                          <div className="bg-muted/40 rounded-md p-3">
                            <p className="text-xs text-muted-foreground">Time Worked</p>
                            <p className="text-xl font-bold">{formatMinutes(req.totalMinutesWorked)}</p>
                          </div>
                          <div className="bg-muted/40 rounded-md p-3">
                            <p className="text-xs text-muted-foreground">Rate / hr</p>
                            <p className="text-xl font-bold">₹{req.hourlyRate}</p>
                          </div>
                        </div>

                        {/* Task breakdown */}
                        {req.bookings && req.bookings.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Tasks Worked</p>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {req.bookings.map(b => {
                                const mins = b.actualDurationMinutes || 0;
                                return (
                                  <div key={b._id} className="flex items-center justify-between bg-muted/30 rounded px-3 py-2 text-sm">
                                    <div>
                                      <p className="font-medium">{b.service?.name || 'Service'}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {fmtDate(b.bookingDate)} · {b.startTime} – {b.endTime}
                                      </p>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{formatMinutes(mins)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Amount breakdown */}
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Time worked</span>
                            <span>{formatMinutes(req.totalMinutesWorked)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Hourly rate</span>
                            <span>₹{req.hourlyRate}/hr</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-semibold text-primary">
                            <span>Amount to Settle</span>
                            <span>₹{req.requestedAmount.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Rejection reason / notes */}
                        {req.status === 'rejected' && req.rejectionReason && (
                          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-medium">Rejection Reason</p>
                              <p className="mt-0.5">{req.rejectionReason}</p>
                            </div>
                          </div>
                        )}
                        {req.status === 'paid' && req.paidAt && (
                          <p className="text-sm text-green-700 font-medium">
                            Paid on {fmtDate(req.paidAt)}
                          </p>
                        )}
                        {req.adminNotes && (
                          <p className="text-xs text-muted-foreground italic">Admin note: {req.adminNotes}</p>
                        )}
                      </CardContent>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminSalarySettlements;
