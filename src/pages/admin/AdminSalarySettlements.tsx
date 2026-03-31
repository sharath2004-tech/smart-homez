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
  workerProfile?: {
    wageType?: 'hourly' | 'daily' | 'monthly';
    hourlyRate?: number;
    dailyWage?: number;
    monthlyWage?: number;
  };
}

interface TaskPreview {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  serviceName: string;
  workType?: string;
  minutesWorked: number;
  revenueGenerated?: number;
}

interface PerformanceSummary {
  totalRevenueGenerated: number;
  totalMinutesWorked: number;
  totalTasksCompleted: number;
  averageRevenuePerTask: number;
  serviceTypesWorked: number;
  serviceBreakdown: Array<{
    serviceName: string;
    workType: string;
    tasksCompleted: number;
    minutesWorked: number;
    revenueGenerated: number;
  }>;
}

interface SalaryPreview {
  periodFrom: string;
  periodTo: string;
  totalMinutesWorked: number;
  totalTasksCompleted: number;
  wageType: 'hourly' | 'daily' | 'monthly';
  hourlyRate: number;
  dailyWage?: number | null;
  monthlyWage?: number | null;
  rateAmount: number;
  payUnitsWorked: number;
  payUnitLabel: 'hour' | 'day' | 'month';
  requestedAmount: number;
  netAmount?: number;
  totalPenaltyAmount?: number;
  penaltyBreakdown?: Array<{
    leaveDate: string;
    requestedAt?: string;
    reason?: string;
    amount: number;
    leaveStatus?: 'pending' | 'approved' | 'rejected';
  }>;
  performanceSummary?: PerformanceSummary;
  tasks: TaskPreview[];
}

interface BookingDetail {
  _id: string;
  bookingDate: string;
  bookingType?: string;
  startTime: string;
  endTime: string;
  actualDurationMinutes?: number;
  totalAmount?: number;
  service?: { name: string; category?: string };
}

interface SalaryRequest {
  _id: string;
  worker: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    workerProfile?: {
      wageType?: 'hourly' | 'daily' | 'monthly';
      hourlyRate?: number;
      dailyWage?: number;
      monthlyWage?: number;
    };
  };
  periodFrom: string;
  periodTo: string;
  totalMinutesWorked: number;
  totalTasksCompleted: number;
  wageType?: 'hourly' | 'daily' | 'monthly';
  hourlyRate: number;
  dailyWage?: number | null;
  monthlyWage?: number | null;
  rateAmount?: number;
  payUnitsWorked?: number;
  payUnitLabel?: 'hour' | 'day' | 'month';
  requestedAmount: number;
  netAmount?: number | null;
  totalPenaltyAmount?: number;
  penaltyTreatment?: 'included' | 'excluded';
  penaltyBreakdown?: Array<{
    leaveDate: string;
    requestedAt?: string;
    reason?: string;
    amount: number;
    leaveStatus?: 'pending' | 'approved' | 'rejected';
  }>;
  penaltyDecidedBy?: { name?: string; role?: string } | string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  createdAt: string;
  approvedBy?: { name: string };
  rejectedBy?: { name: string };
  rejectionReason?: string;
  adminNotes?: string;
  paidAt?: string;
  bookings: BookingDetail[];
  performanceSummary?: PerformanceSummary;
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

function getSettlementAmount(amount: number, penaltyAmount: number, applyPenaltyDeduction: boolean) {
  if (!applyPenaltyDeduction) {
    return amount;
  }

  return Math.max(0, Number((amount - penaltyAmount).toFixed(2)));
}

function getPaidAmount(request: SalaryRequest) {
  return request.netAmount ?? request.requestedAmount;
}

function getRateLabel(data: {
  wageType?: 'hourly' | 'daily' | 'monthly';
  hourlyRate?: number;
  dailyWage?: number | null;
  monthlyWage?: number | null;
  rateAmount?: number;
}) {
  if (data.wageType === 'daily') {
    return `₹${data.dailyWage ?? data.rateAmount ?? 0}/day`;
  }
  if (data.wageType === 'monthly') {
    return `₹${data.monthlyWage ?? data.rateAmount ?? 0}/month`;
  }
  return `₹${data.hourlyRate ?? data.rateAmount ?? 0}/hr`;
}

function getWorkBasisLabel(data: { payUnitsWorked?: number; payUnitLabel?: 'hour' | 'day' | 'month'; totalMinutesWorked: number }) {
  if (data.payUnitLabel === 'day') {
    return `${data.payUnitsWorked ?? 0} worked day${(data.payUnitsWorked ?? 0) === 1 ? '' : 's'}`;
  }
  if (data.payUnitLabel === 'month') {
    return `${data.payUnitsWorked ?? 0} month${(data.payUnitsWorked ?? 0) === 1 ? '' : 's'} covered`;
  }
  const hours = (data.payUnitsWorked ?? (data.totalMinutesWorked / 60));
  return `${hours.toFixed(2)} worked hour${hours === 1 ? '' : 's'}`;
}

function formatWorkTypeLabel(value?: string | null) {
  if (!value) return 'General Service';

  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function getBookingServiceName(booking: BookingDetail) {
  if (booking.service?.name) return booking.service.name;
  if (booking.bookingType === 'deep-cleaning-cart') return 'Move In / Move Out — Commercial & Residential';
  return 'Service';
}

function getBookingWorkType(booking: BookingDetail) {
  if (booking.service?.category) return formatWorkTypeLabel(booking.service.category);
  if (booking.bookingType === 'deep-cleaning-cart') return 'Move In / Move Out';
  if (booking.bookingType) return formatWorkTypeLabel(booking.bookingType);
  return 'General Service';
}

function buildPerformanceSummaryFromBookings(bookings: BookingDetail[] = []): PerformanceSummary {
  const serviceMap = new Map<string, PerformanceSummary['serviceBreakdown'][number]>();
  let totalRevenueGenerated = 0;
  let totalMinutesWorked = 0;

  bookings.forEach((booking) => {
    const serviceName = getBookingServiceName(booking);
    const workType = getBookingWorkType(booking);
    const revenueGenerated = Number((booking.totalAmount || 0).toFixed(2));
    const minutesWorked = booking.actualDurationMinutes || 0;
    const key = `${serviceName}__${workType}`;

    totalRevenueGenerated += revenueGenerated;
    totalMinutesWorked += minutesWorked;

    const existing = serviceMap.get(key) || {
      serviceName,
      workType,
      tasksCompleted: 0,
      minutesWorked: 0,
      revenueGenerated: 0,
    };

    existing.tasksCompleted += 1;
    existing.minutesWorked += minutesWorked;
    existing.revenueGenerated = Number((existing.revenueGenerated + revenueGenerated).toFixed(2));
    serviceMap.set(key, existing);
  });

  const serviceBreakdown = Array.from(serviceMap.values()).sort((left, right) => {
    if (right.revenueGenerated !== left.revenueGenerated) {
      return right.revenueGenerated - left.revenueGenerated;
    }

    return right.tasksCompleted - left.tasksCompleted;
  });

  return {
    totalRevenueGenerated: Number(totalRevenueGenerated.toFixed(2)),
    totalMinutesWorked,
    totalTasksCompleted: bookings.length,
    averageRevenuePerTask: bookings.length > 0 ? Number((totalRevenueGenerated / bookings.length).toFixed(2)) : 0,
    serviceTypesWorked: serviceBreakdown.length,
    serviceBreakdown,
  };
}

const STATUS_META = {
  pending:  { label: 'Pending',  badge: 'bg-amber-100 text-amber-800',  icon: IndianRupee },
  approved: { label: 'Approved', badge: 'bg-blue-100 text-blue-800',    icon: CheckCircle },
  rejected: { label: 'Rejected', badge: 'bg-red-100 text-red-800',      icon: XCircle },
  paid:     { label: 'Paid',     badge: 'bg-green-100 text-green-800',  icon: CheckCircle }
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

const AdminSalarySettlements = () => {
  const { name, role } = useAdminRole();
  const { toast } = useToast();

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
  const [applyPenaltyDeduction, setApplyPenaltyDeduction] = useState(true);
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
      const data = await api.get('/salary-requests/admin?status=paid');
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Fetch requests error:', err);
      toast({ title: 'Error', description: 'Failed to load requests', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
      setApplyPenaltyDeduction((data.preview?.totalPenaltyAmount || 0) > 0);
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
    const finalSettlementAmount = getSettlementAmount(
      sendPreview.requestedAmount,
      sendPreview.totalPenaltyAmount || 0,
      applyPenaltyDeduction
    );

    if (isPartialPayment) {
      const amt = Number(partialAmount);
      if (!amt || amt <= 0) {
        toast({ title: 'Invalid amount', description: 'Please enter a valid partial payment amount', variant: 'destructive' });
        return;
      }
      if (amt >= finalSettlementAmount) {
        toast({ title: 'Invalid amount', description: 'Partial amount must be less than the total requested amount', variant: 'destructive' });
        return;
      }
    }
    setSending(true);
    try {
      const res = await api.post('/salary-requests/admin/send', {
        workerId: selectedWorker._id,
        periodFrom: sendFrom,
        periodTo: sendTo,
        applyPenaltyDeduction,
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
      setApplyPenaltyDeduction(true);
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

  const previewPenaltyAmount = sendPreview?.totalPenaltyAmount || 0;
  const previewFinalAmount = sendPreview
    ? getSettlementAmount(sendPreview.requestedAmount, previewPenaltyAmount, applyPenaltyDeduction)
    : 0;

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
            onClick={() => {
              setSendOpen(o => !o);
              setSendPreview(null);
              setApplyPenaltyDeduction(true);
            }}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-center">
                      <div className="bg-background rounded-md p-3">
                        <p className="text-xs text-muted-foreground">Tasks Done</p>
                        <p className="text-xl font-bold">{sendPreview.totalTasksCompleted}</p>
                      </div>
                      <div className="bg-background rounded-md p-3">
                        <p className="text-xs text-muted-foreground">Time Worked</p>
                        <p className="text-xl font-bold">{formatMinutes(sendPreview.totalMinutesWorked)}</p>
                      </div>
                      <div className="bg-background rounded-md p-3">
                        <p className="text-xs text-muted-foreground">Rate</p>
                        <p className="text-xl font-bold">{getRateLabel(sendPreview)}</p>
                      </div>
                      <div className="bg-background rounded-md p-3">
                        <p className="text-xs text-muted-foreground">Pay basis</p>
                        <p className="text-sm font-bold">{getWorkBasisLabel(sendPreview)}</p>
                      </div>
                      <div className="bg-background rounded-md p-3">
                        <p className="text-xs text-muted-foreground">Revenue Generated</p>
                        <p className="text-xl font-bold">₹{(sendPreview.performanceSummary?.totalRevenueGenerated || 0).toFixed(2)}</p>
                      </div>
                      <div className="bg-background rounded-md p-3">
                        <p className="text-xs text-muted-foreground">Service Types</p>
                        <p className="text-xl font-bold">{sendPreview.performanceSummary?.serviceTypesWorked || 0}</p>
                      </div>
                      <div className="bg-background rounded-md p-3">
                        <p className="text-xs text-muted-foreground">Avg Revenue / Task</p>
                        <p className="text-xl font-bold">₹{(sendPreview.performanceSummary?.averageRevenuePerTask || 0).toFixed(2)}</p>
                      </div>
                    </div>

                    {sendPreview.performanceSummary && sendPreview.performanceSummary.serviceBreakdown.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Work Type & Revenue Breakdown</p>
                        <div className="space-y-2">
                          {sendPreview.performanceSummary.serviceBreakdown.map((item, index) => (
                            <div key={`preview-service-${index}`} className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm gap-3">
                              <div>
                                <p className="font-medium text-foreground">{item.serviceName}</p>
                                <p className="text-xs text-muted-foreground">{item.workType} · {item.tasksCompleted} task{item.tasksCompleted === 1 ? '' : 's'} · {formatMinutes(item.minutesWorked)}</p>
                              </div>
                              <span className="font-semibold text-emerald-700">₹{item.revenueGenerated.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-primary rounded-lg p-4 text-center">
                      <p className="text-sm text-primary-foreground/80">Settlement Amount</p>
                      <p className="text-3xl font-bold text-primary-foreground mt-1">₹{previewFinalAmount.toFixed(2)}</p>
                      {(sendPreview.totalPenaltyAmount || 0) > 0 && (
                        <p className="text-xs text-primary-foreground/80 mt-2">
                          Base ₹{sendPreview.requestedAmount.toFixed(2)} · Penalties ₹{(sendPreview.totalPenaltyAmount || 0).toFixed(2)} {applyPenaltyDeduction ? 'deducted' : 'waived'}
                        </p>
                      )}
                    </div>

                    {previewPenaltyAmount > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-amber-900">Late leave penalties found</p>
                            <p className="text-xs text-amber-800">Admin or super admin can decide whether to deduct them in this settlement.</p>
                          </div>
                          <div className="text-sm font-bold text-amber-900">₹{previewPenaltyAmount.toFixed(2)}</div>
                        </div>

                        <div className="space-y-2">
                          {sendPreview.penaltyBreakdown?.map((penalty, index) => (
                            <div key={`preview-penalty-${index}`} className="flex items-center justify-between rounded-md bg-white/80 px-3 py-2 text-xs sm:text-sm">
                              <div>
                                <p className="font-medium text-foreground">{fmtDate(penalty.leaveDate)}</p>
                                <p className="text-muted-foreground">{penalty.reason || 'Late leave penalty'}{penalty.leaveStatus ? ` · ${penalty.leaveStatus}` : ''}</p>
                              </div>
                              <span className="font-semibold text-red-700">₹{penalty.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className={`flex items-start gap-3 rounded-md border px-3 py-3 cursor-pointer transition-colors ${applyPenaltyDeduction ? 'border-red-300 bg-red-50' : 'border-border bg-background'}`}>
                            <input
                              type="radio"
                              name="penaltyTreatment"
                              checked={applyPenaltyDeduction}
                              onChange={() => setApplyPenaltyDeduction(true)}
                              className="mt-1"
                            />
                            <div>
                              <p className="font-medium text-foreground">Include penalties</p>
                              <p className="text-xs text-muted-foreground">Deduct ₹{previewPenaltyAmount.toFixed(2)} from this salary settlement.</p>
                            </div>
                          </label>
                          <label className={`flex items-start gap-3 rounded-md border px-3 py-3 cursor-pointer transition-colors ${!applyPenaltyDeduction ? 'border-green-300 bg-green-50' : 'border-border bg-background'}`}>
                            <input
                              type="radio"
                              name="penaltyTreatment"
                              checked={!applyPenaltyDeduction}
                              onChange={() => setApplyPenaltyDeduction(false)}
                              className="mt-1"
                            />
                            <div>
                              <p className="font-medium text-foreground">Exclude penalties</p>
                              <p className="text-xs text-muted-foreground">Do not deduct the penalty from this salary settlement.</p>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}

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
                              {task.workType && (
                                <p className="text-xs text-muted-foreground">{task.workType}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="block text-xs text-muted-foreground">{formatMinutes(task.minutesWorked)}</span>
                              <span className="block text-xs font-semibold text-emerald-700">₹{(task.revenueGenerated || 0).toFixed(2)}</span>
                            </div>
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
                            Partial Amount (₹) — must be less than ₹{previewFinalAmount.toFixed(2)}
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            max={Math.max(previewFinalAmount - 1, 1)}
                            step="0.01"
                            value={partialAmount}
                            onChange={(e) => setPartialAmount(e.target.value)}
                            placeholder={`e.g. ${(previewFinalAmount / 2).toFixed(0)}`}
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
                          : <><IndianRupee className="w-4 h-4 mr-2" />Send ₹{previewFinalAmount.toFixed(2)} to {selectedWorker?.name}</>}
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

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <IndianRupee className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No salary payments found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map(req => {
              const meta = STATUS_META[req.status];
              const Icon = meta.icon;
              const isExpanded = expandedId === req._id;
              const performanceSummary = req.performanceSummary || buildPerformanceSummaryFromBookings(req.bookings || []);

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
                        <p className="font-semibold text-foreground line-clamp-2 break-words">{req.worker.name}</p>
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
                      <span className="text-base font-bold text-primary">₹{getPaidAmount(req).toFixed(2)}</span>
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-center">
                          <div className="bg-muted/40 rounded-md p-3">
                            <p className="text-xs text-muted-foreground">Tasks</p>
                            <p className="text-xl font-bold">{req.totalTasksCompleted}</p>
                          </div>
                          <div className="bg-muted/40 rounded-md p-3">
                            <p className="text-xs text-muted-foreground">Time Worked</p>
                            <p className="text-xl font-bold">{formatMinutes(req.totalMinutesWorked)}</p>
                          </div>
                          <div className="bg-muted/40 rounded-md p-3">
                            <p className="text-xs text-muted-foreground">Rate</p>
                            <p className="text-xl font-bold">{getRateLabel(req)}</p>
                          </div>
                          <div className="bg-muted/40 rounded-md p-3">
                            <p className="text-xs text-muted-foreground">Pay basis</p>
                            <p className="text-sm font-bold">{getWorkBasisLabel(req)}</p>
                          </div>
                          <div className="bg-muted/40 rounded-md p-3">
                            <p className="text-xs text-muted-foreground">Revenue Generated</p>
                            <p className="text-xl font-bold">₹{performanceSummary.totalRevenueGenerated.toFixed(2)}</p>
                          </div>
                          <div className="bg-muted/40 rounded-md p-3">
                            <p className="text-xs text-muted-foreground">Service Types</p>
                            <p className="text-xl font-bold">{performanceSummary.serviceTypesWorked}</p>
                          </div>
                          <div className="bg-muted/40 rounded-md p-3">
                            <p className="text-xs text-muted-foreground">Avg Revenue / Task</p>
                            <p className="text-xl font-bold">₹{performanceSummary.averageRevenuePerTask.toFixed(2)}</p>
                          </div>
                        </div>

                        {performanceSummary.serviceBreakdown.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Service Performance Breakdown</p>
                            <div className="space-y-1.5">
                              {performanceSummary.serviceBreakdown.map((item, index) => (
                                <div key={`${req._id}-service-${index}`} className="flex items-center justify-between bg-muted/30 rounded px-3 py-2 text-sm gap-3">
                                  <div>
                                    <p className="font-medium">{item.serviceName}</p>
                                    <p className="text-xs text-muted-foreground">{item.workType} · {item.tasksCompleted} task{item.tasksCompleted === 1 ? '' : 's'} · {formatMinutes(item.minutesWorked)}</p>
                                  </div>
                                  <span className="font-semibold text-emerald-700">₹{item.revenueGenerated.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

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
                                        <p className="font-medium">{getBookingServiceName(b)}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {fmtDate(b.bookingDate)} · {b.startTime} – {b.endTime}
                                      </p>
                                        <p className="text-xs text-muted-foreground">{getBookingWorkType(b)}</p>
                                    </div>
                                      <div className="text-right">
                                        <span className="block text-xs text-muted-foreground">{formatMinutes(mins)}</span>
                                        <span className="block text-xs font-semibold text-emerald-700">₹{(b.totalAmount || 0).toFixed(2)}</span>
                                      </div>
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
                            <span className="text-muted-foreground">Pay rate</span>
                            <span>{getRateLabel(req)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Pay basis</span>
                            <span>{getWorkBasisLabel(req)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Revenue generated</span>
                            <span>₹{performanceSummary.totalRevenueGenerated.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Average revenue per task</span>
                            <span>₹{performanceSummary.averageRevenuePerTask.toFixed(2)}</span>
                          </div>
                          {(req.totalPenaltyAmount || 0) > 0 && (
                            <>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Base salary</span>
                                <span>₹{req.requestedAmount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Penalty treatment</span>
                                <span className={req.penaltyTreatment === 'included' ? 'text-red-700 font-medium' : 'text-green-700 font-medium'}>
                                  {req.penaltyTreatment === 'included' ? 'Included in settlement' : 'Excluded from settlement'}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Penalty total</span>
                                <span>₹{(req.totalPenaltyAmount || 0).toFixed(2)}</span>
                              </div>
                            </>
                          )}
                          <Separator />
                          <div className="flex justify-between font-semibold text-primary">
                            <span>Amount Settled</span>
                            <span>₹{getPaidAmount(req).toFixed(2)}</span>
                          </div>
                        </div>

                        {(req.totalPenaltyAmount || 0) > 0 && req.penaltyBreakdown && req.penaltyBreakdown.length > 0 && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-amber-900">Penalty breakdown</p>
                              <span className={`text-xs font-semibold ${req.penaltyTreatment === 'included' ? 'text-red-700' : 'text-green-700'}`}>
                                {req.penaltyTreatment === 'included' ? 'Deducted' : 'Excluded'}
                              </span>
                            </div>
                            {req.penaltyBreakdown.map((penalty, index) => (
                              <div key={`${req._id}-penalty-${index}`} className="flex items-center justify-between rounded-md bg-white/80 px-3 py-2 text-xs sm:text-sm">
                                <div>
                                  <p className="font-medium text-foreground">{fmtDate(penalty.leaveDate)}</p>
                                  <p className="text-muted-foreground">{penalty.reason || 'Late leave penalty'}{penalty.leaveStatus ? ` · ${penalty.leaveStatus}` : ''}</p>
                                </div>
                                <span className="font-semibold text-red-700">₹{penalty.amount.toFixed(2)}</span>
                              </div>
                            ))}
                            {req.penaltyDecidedBy && typeof req.penaltyDecidedBy !== 'string' && req.penaltyDecidedBy.name && (
                              <p className="text-xs text-muted-foreground">
                                Decision made by {req.penaltyDecidedBy.name}{req.penaltyDecidedBy.role ? ` (${req.penaltyDecidedBy.role.replace('_', ' ')})` : ''}
                              </p>
                            )}
                          </div>
                        )}

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
