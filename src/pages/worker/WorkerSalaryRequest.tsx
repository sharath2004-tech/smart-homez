import AppLayout from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { api, authAPI } from '@/lib/api';
import { AlertCircle, CheckCircle, Clock, IndianRupee, Loader2, Search, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface TaskPreview {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  serviceName: string;
  minutesWorked: number;
}

interface Preview {
  periodFrom: string;
  periodTo: string;
  totalMinutesWorked: number;
  totalTasksCompleted: number;
  hourlyRate: number;
  requestedAmount: number;
  tasks: TaskPreview[];
}

interface SalaryRequest {
  _id: string;
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
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMinutes(mins: number): string {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STATUS_META = {
  pending:  { label: 'Pending',  color: 'bg-amber-100 text-amber-800',   icon: Clock },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-800',     icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800',       icon: XCircle },
  paid:     { label: 'Paid',     color: 'bg-green-100 text-green-800',   icon: CheckCircle }
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

const WorkerSalaryRequest = () => {
  const { toast } = useToast();

  const [userName, setUserName] = useState('Worker');
  const [requests, setRequests] = useState<SalaryRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const today = localToday();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(today);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    authAPI.getProfile().then(res => {
      const u = res?.user || res;
      if (u?.name) setUserName(u.name);
    }).catch(() => {});
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await api.get('/salary-requests/my');
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Fetch salary requests error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Preview ─────────────────────────────────────────────────────────────────
  const handlePreview = async () => {
    if (!fromDate || !toDate) {
      toast({ title: 'Missing dates', description: 'Select both from and to dates', variant: 'destructive' });
      return;
    }
    if (fromDate > toDate) {
      toast({ title: 'Invalid range', description: '"From" date must be before "To" date', variant: 'destructive' });
      return;
    }
    setPreviewing(true);
    setPreview(null);
    try {
      const data = await api.get(`/salary-requests/preview?from=${fromDate}&to=${toDate}`);
      setPreview(data.preview);
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

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!preview) return;
    if (preview.totalTasksCompleted === 0) {
      toast({ title: 'No tasks', description: 'No completed tasks found in this period', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/salary-requests', { periodFrom: fromDate, periodTo: toDate });
      toast({ title: 'Request submitted', description: 'Your salary request has been sent to the admin' });
      setPreview(null);
      setFromDate('');
      setToDate(today);
      await fetchRequests();
    } catch (err) {
      toast({
        title: 'Submission failed',
        description: err instanceof Error ? err.message : 'Could not submit request',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AppLayout userType="worker" userName={userName}>
      <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Salary Request</h1>
          <p className="text-sm text-muted-foreground mt-1">Request your salary for the time you've worked</p>
        </div>

        {/* ── Request Form ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fromDate">From Date</Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  max={today}
                  onChange={e => { setFromDate(e.target.value); setPreview(null); }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="toDate">To Date</Label>
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  max={today}
                  onChange={e => { setToDate(e.target.value); setPreview(null); }}
                />
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handlePreview}
              disabled={!fromDate || !toDate || previewing}
            >
              {previewing
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Calculating...</>
                : <><Search className="w-4 h-4 mr-2" />Preview Hours & Amount</>}
            </Button>

            {/* Preview result */}
            {preview && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                {/* Summary row */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-background rounded-md p-3">
                    <p className="text-xs text-muted-foreground">Tasks Done</p>
                    <p className="text-xl font-bold text-foreground">{preview.totalTasksCompleted}</p>
                  </div>
                  <div className="bg-background rounded-md p-3">
                    <p className="text-xs text-muted-foreground">Time Worked</p>
                    <p className="text-xl font-bold text-foreground">{formatMinutes(preview.totalMinutesWorked)}</p>
                  </div>
                  <div className="bg-background rounded-md p-3">
                    <p className="text-xs text-muted-foreground">Rate / hr</p>
                    <p className="text-xl font-bold text-foreground">₹{preview.hourlyRate}</p>
                  </div>
                </div>

                {/* Amount banner */}
                <div className="bg-primary rounded-lg p-4 text-center">
                  <p className="text-sm text-primary-foreground/80">Salary to be Settled</p>
                  <p className="text-3xl font-bold text-primary-foreground mt-1">₹{preview.requestedAmount.toFixed(2)}</p>
                </div>

                {/* Task list */}
                {preview.tasks.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tasks Included</p>
                    {preview.tasks.map(task => (
                      <div key={task._id} className="flex items-center justify-between bg-background rounded px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium text-foreground">{task.serviceName}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(task.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {' · '}{task.startTime} – {task.endTime}
                          </p>
                        </div>
                        <span className="text-muted-foreground text-xs">{formatMinutes(task.minutesWorked)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {preview.totalTasksCompleted === 0 && (
                  <div className="flex items-center gap-2 text-amber-700 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    No completed tasks found in this date range.
                  </div>
                )}

                <Separator />

                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={submitting || preview.totalTasksCompleted === 0}
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                    : <><IndianRupee className="w-4 h-4 mr-2" />Submit Salary Request</>}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── History ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No requests yet</p>
            ) : (
              <div className="space-y-3">
                {requests.map(req => {
                  const meta = STATUS_META[req.status];
                  const Icon = meta.icon;
                  return (
                    <div key={req._id} className="rounded-lg border border-border p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {new Date(req.periodFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' – '}
                            {new Date(req.periodTo).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {req.totalTasksCompleted} task{req.totalTasksCompleted !== 1 ? 's' : ''} · {formatMinutes(req.totalMinutesWorked)} worked
                          </p>
                        </div>
                        <Badge className={`${meta.color} flex items-center gap-1 text-xs shrink-0`}>
                          <Icon className="w-3 h-3" />
                          {meta.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1 text-primary font-semibold">
                        <IndianRupee className="w-4 h-4" />
                        <span>₹{req.requestedAmount.toFixed(2)}</span>
                      </div>

                      {req.status === 'rejected' && req.rejectionReason && (
                        <div className="flex items-start gap-2 bg-red-50 rounded p-2 text-xs text-red-700">
                          <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>{req.rejectionReason}</span>
                        </div>
                      )}
                      {req.status === 'paid' && (
                        <p className="text-xs text-green-700">
                          Paid on {req.paidAt ? new Date(req.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </p>
                      )}
                      {req.adminNotes && (
                        <p className="text-xs text-muted-foreground italic">Note: {req.adminNotes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default WorkerSalaryRequest;
