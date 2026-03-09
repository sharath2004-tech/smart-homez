import AppLayout from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAdminRole } from '@/hooks/useAdminRole';
import { api } from '@/lib/api';
import {
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Clock,
    IndianRupee,
    Loader2,
    RefreshCw,
    User,
    XCircle
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

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

const TABS = ['all', 'pending', 'approved', 'rejected', 'paid'] as const;
type Tab = typeof TABS[number];

// ── Component ─────────────────────────────────────────────────────────────────

const AdminSalarySettlements = () => {
  const { name, role } = useAdminRole();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>('pending');
  const [requests, setRequests] = useState<SalaryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Action state per request
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState('');

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
  }, [fetchRequests]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/salary-requests/${id}/approve`, notesInput ? { notes: notesInput } : undefined);
      toast({ title: 'Approved', description: 'Salary request approved successfully' });
      setNotesInput('');
      await fetchRequests();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Could not approve', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      toast({ title: 'Reason required', description: 'Please provide a reason for rejection', variant: 'destructive' });
      return;
    }
    setActionLoading(id);
    try {
      await api.patch(`/salary-requests/${id}/reject`, { reason: rejectReason });
      toast({ title: 'Rejected', description: 'Salary request rejected' });
      setRejectReason('');
      setRejectingId(null);
      await fetchRequests();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Could not reject', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPaid = async (id: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/salary-requests/${id}/mark-paid`, notesInput ? { notes: notesInput } : undefined);
      toast({ title: 'Marked as Paid', description: 'Salary settlement complete' });
      setNotesInput('');
      await fetchRequests();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Could not mark as paid', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
    setRejectingId(null);
    setRejectReason('');
    setNotesInput('');
  };

  return (
    <AppLayout userType={role} userName={name}>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Salary Settlements</h1>
            <p className="text-sm text-muted-foreground mt-1">Review and settle worker salary requests</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 w-full overflow-x-auto">
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
              const isActioning = actionLoading === req._id;
              const isRejecting = rejectingId === req._id;

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

                        {/* Actions */}
                        {req.status === 'pending' && (
                          <div className="space-y-3 pt-1">
                            <div className="space-y-1.5">
                              <Label htmlFor={`notes-${req._id}`} className="text-xs">Notes (optional)</Label>
                              <Input
                                id={`notes-${req._id}`}
                                placeholder="Add a note for the worker..."
                                value={notesInput}
                                onChange={e => setNotesInput(e.target.value)}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                className="flex-1"
                                onClick={() => handleApprove(req._id)}
                                disabled={isActioning}
                              >
                                {isActioning && !isRejecting
                                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  : <CheckCircle className="w-4 h-4 mr-2" />}
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                                onClick={() => setRejectingId(isRejecting ? null : req._id)}
                                disabled={isActioning}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                              </Button>
                            </div>
                            {isRejecting && (
                              <div className="space-y-2 bg-red-50 rounded-lg p-3">
                                <Label className="text-xs text-red-700">Reason for rejection *</Label>
                                <Textarea
                                  placeholder="Enter rejection reason..."
                                  value={rejectReason}
                                  onChange={e => setRejectReason(e.target.value)}
                                  rows={2}
                                  className="text-sm"
                                />
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="w-full"
                                  onClick={() => handleReject(req._id)}
                                  disabled={isActioning || !rejectReason.trim()}
                                >
                                  {isActioning
                                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    : null}
                                  Confirm Rejection
                                </Button>
                              </div>
                            )}
                          </div>
                        )}

                        {req.status === 'approved' && (
                          <div className="space-y-3 pt-1">
                            <div className="space-y-1.5">
                              <Label htmlFor={`notes-paid-${req._id}`} className="text-xs">Payment note (optional)</Label>
                              <Input
                                id={`notes-paid-${req._id}`}
                                placeholder="e.g. Paid via UPI / Cash..."
                                value={notesInput}
                                onChange={e => setNotesInput(e.target.value)}
                              />
                            </div>
                            <Button
                              className="w-full bg-green-600 hover:bg-green-700"
                              onClick={() => handleMarkPaid(req._id)}
                              disabled={isActioning}
                            >
                              {isActioning
                                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                : <IndianRupee className="w-4 h-4 mr-2" />}
                              Mark as Paid — ₹{req.requestedAmount.toFixed(2)}
                            </Button>
                          </div>
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
    </AppLayout>
  );
};

export default AdminSalarySettlements;
