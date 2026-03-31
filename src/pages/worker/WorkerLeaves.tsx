import AppLayout from '@/components/AppLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { authAPI, leavesAPI } from '@/lib/api';
import { Calendar as CalendarIcon, CheckCircle, Clock, Info, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Leave {
  _id: string;
  date: string;
  dates?: string[];
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  approvedBy?: string;
  penaltyApplied?: boolean;
  penaltyAmount?: number;
}

interface WorkerProfile {
  monthlyLeaveQuota: number;
  leavesUsedThisMonth: number;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toLocalDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const toStoredLeaveDateKey = (value: string) => {
  if (DATE_ONLY_PATTERN.test(value)) {
    return value;
  }

  return toLocalDateValue(new Date(value));
};

const formatLeaveDate = (value: string) => {
  if (DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  return new Date(value).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getDatesInRange = (startStr: string, endStr: string): Date[] => {
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const cur = new Date(start);
  const dates: Date[] = [];
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

const LEAVE_TYPES = [
  { value: 'sick', label: 'Sick Leave', icon: '🏥', color: 'text-red-600 bg-red-50 border-red-200' },
  { value: 'vacation', label: 'Vacation', icon: '🌴', color: 'text-green-600 bg-green-50 border-green-200' },
  { value: 'personal', label: 'Personal', icon: '👤', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'emergency', label: 'Emergency', icon: '🚨', color: 'text-orange-600 bg-orange-50 border-orange-200' },
];

const WorkerLeaves = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [leaveType, setLeaveType] = useState<string>('sick');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [profile, setProfile] = useState<WorkerProfile>({ monthlyLeaveQuota: 2, leavesUsedThisMonth: 0 });
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchLeaves();
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLeaves = async () => {
    try {
      const response = await leavesAPI.getMyLeaves();
      setLeaves(response.leaves || []);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('worker.leaves.failedToFetch'),
        variant: 'destructive'
      });
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await authAPI.getProfile();
      if (response.workerProfile) {
        setProfile({
          monthlyLeaveQuota: response.workerProfile.monthlyLeaveQuota || 2,
          leavesUsedThisMonth: response.workerProfile.leavesUsedThisMonth || 0
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const [penaltyWarning, setPenaltyWarning] = useState(false);

  const checkPenalty = (start: string, end: string) => {
    if (!start) { setPenaltyWarning(false); return; }
    const dates = getDatesInRange(start, end || start);
    const now = new Date();
    const hasShortNotice = dates.some(date => {
      const hoursUntilLeave = (date.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursUntilLeave >= 0 && hoursUntilLeave < 24;
    });
    setPenaltyWarning(hasShortNotice);
  };

  const handleApplyLeave = async () => {
    if (!startDate) {
      toast({
        title: t('common.error'),
        description: t('worker.leaves.pleaseSelectDate'),
        variant: 'destructive'
      });
      return;
    }

    const effectiveEnd = endDate || startDate;
    const dateObjs = getDatesInRange(startDate, effectiveEnd);

    // Build confirmation message
    const dateStrings = dateObjs.map(d =>
      d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    );
    const selectedLeaveType = LEAVE_TYPES.find(lt => lt.value === leaveType)?.label || leaveType;

    const confirmMessage = penaltyWarning
      ? `You are requesting ${selectedLeaveType} for ${dateObjs.length} day(s):\n${dateStrings.join(', ')}\n\n⚠️ A penalty of ₹1,500 will apply because one or more dates are within 24 hours.\n\nDo you want to proceed?`
      : `You are requesting ${selectedLeaveType} for ${dateObjs.length} day(s):\n${dateStrings.join(', ')}\n\nDo you want to proceed?`;

    const confirmed = await confirm({
      title: penaltyWarning ? '⚠️ Leave Request with Penalty' : 'Confirm Leave Request',
      description: confirmMessage,
      confirmLabel: penaltyWarning ? 'Submit with Penalty' : 'Submit',
      cancelLabel: 'Cancel',
      variant: penaltyWarning ? 'destructive' : 'default'
    });

    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const dateValues = dateObjs.map(d => toLocalDateValue(d));
      const fullReason = reason.trim() ? `[${selectedLeaveType}] ${reason.trim()}` : `[${selectedLeaveType}]`;
      const response = await leavesAPI.applyLeave(dateValues, fullReason);

      if (response.penaltyApplied) {
        toast({
          title: t('worker.leaves.penaltyToastTitle'),
          description: t('worker.leaves.penaltyToastDescription', { amount: '1,500' }),
          variant: 'destructive'
        });
      } else {
        toast({
          title: t('common.success'),
          description: `${selectedLeaveType} submitted for ${dateObjs.length} day(s)`
        });
      }

      setStartDate('');
      setEndDate('');
      setLeaveType('sick');
      setPenaltyWarning(false);
      setReason('');
      fetchLeaves();
      fetchProfile();
    } catch (error) {
      console.error('Error applying leave:', error);
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('worker.leaves.failedToApply'),
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> {t('worker.leaves.pending')}</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" /> {t('worker.leaves.approved')}</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" /> {t('worker.leaves.rejected')}</Badge>;
      default:
        return null;
    }
  };

  const handleCancelLeave = async (leaveId: string) => {
    try {
      await leavesAPI.cancelLeave(leaveId);
      setLeaves((prev) => prev.filter((l) => l._id !== leaveId));
      toast({ title: t('worker.leaves.leaveCancelled') });
    } catch (error) {
      toast({ title: t('worker.leaves.failedToCancel'), variant: 'destructive' });
    }
  };

  const remainingLeaves = profile.monthlyLeaveQuota - profile.leavesUsedThisMonth;

  return (
    <AppLayout userType="worker" userName="Worker">
      <div className="container max-w-6xl mx-auto py-6 space-y-6">
        {/* Leave Quota Info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span
                  dangerouslySetInnerHTML={{
                    __html: t('worker.leaves.leavesRemaining', {
                      remaining: remainingLeaves,
                      total: profile.monthlyLeaveQuota
                    })
                  }}
                />
            </div>
          </AlertDescription>
        </Alert>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Apply for Leave */}
          <Card>
            <CardHeader>
              <CardTitle>{t('worker.leaves.applyForLeave')}</CardTitle>
              <CardDescription>{t('worker.leaves.reason')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Leave Type */}
              <div className="space-y-2">
                <label className="text-sm font-semibold">Leave Type <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {LEAVE_TYPES.map(lt => (
                    <button
                      key={lt.value}
                      type="button"
                      onClick={() => setLeaveType(lt.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        leaveType === lt.value
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-white text-foreground border-gray-200 hover:border-primary/50'
                      }`}
                    >
                      <span>{lt.icon}</span>
                      {lt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    min={localToday()}
                    value={startDate}
                    onChange={e => {
                      const val = e.target.value;
                      setStartDate(val);
                      const newEnd = endDate && val <= endDate ? endDate : val;
                      setEndDate(newEnd);
                      checkPenalty(val, newEnd);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">End Date</label>
                  <input
                    type="date"
                    min={startDate || localToday()}
                    value={endDate}
                    onChange={e => {
                      setEndDate(e.target.value);
                      checkPenalty(startDate, e.target.value);
                    }}
                    disabled={!startDate}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Days summary pill */}
              {startDate && (() => {
                const days = getDatesInRange(startDate, endDate || startDate).length;
                const activeType = LEAVE_TYPES.find(lt => lt.value === leaveType);
                return (
                  <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium ${activeType?.color ?? ''}`}>
                    <CalendarIcon className="w-4 h-4" />
                    <span>{days} day{days !== 1 ? 's' : ''}</span>
                    <span className="font-normal opacity-70 ml-1">
                      {formatLeaveDate(startDate).split(',').slice(0, 2).join(',')}
                      {days > 1 && endDate ? ` – ${formatLeaveDate(endDate).split(',').slice(0, 2).join(',')}` : ''}
                    </span>
                  </div>
                );
              })()}

              {/* 24-hour penalty warning */}
              {penaltyWarning && (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">
                    ⚠️ <strong>{t('worker.leaves.penaltyWarningTitle')}:</strong> {t('worker.leaves.penaltyWarningText', { amount: '1,500' })}
                  </AlertDescription>
                </Alert>
              )}

              {/* Reason */}
              <div className="space-y-1.5">
                <label htmlFor="leaveReason" className="text-sm font-semibold">{t('worker.leaves.reasonOptional')}</label>
                <Textarea
                  id="leaveReason"
                  placeholder={t('worker.leaves.enterReason')}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={200}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground text-right">{reason.length}/200</p>
              </div>

              <Button
                onClick={handleApplyLeave}
                disabled={!startDate || isSubmitting || remainingLeaves <= 0}
                className="w-full"
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                {isSubmitting ? t('worker.leaves.submitting') : penaltyWarning ? t('worker.leaves.submitLeavePenalty') : t('worker.leaves.submitLeaveRequest')}
              </Button>

              {remainingLeaves <= 0 && (
                <p className="text-sm text-destructive text-center">
                  {t('worker.leaves.quotaReached')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Leave History */}
          <Card>
            <CardHeader>
              <CardTitle>{t('worker.leaves.leaveHistory')}</CardTitle>
              <CardDescription>{t('worker.leaves.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {leaves.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {t('worker.leaves.noLeaveRequests')}
                  </p>
                ) : (
                  leaves
                    .sort((a, b) => {
                      const dateA = a.dates?.[0] || a.date;
                      const dateB = b.dates?.[0] || b.date;
                      return new Date(dateB).getTime() - new Date(dateA).getTime();
                    })
                    .map((leave) => (
                      <div
                        key={leave._id}
                        className="border rounded-lg p-4 space-y-2 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">
                              {leave.dates && leave.dates.length > 1
                                ? leave.dates.map(d => formatLeaveDate(d)).join(', ')
                                : formatLeaveDate(leave.date)}
                            </span>
                          </div>
                          {getStatusBadge(leave.status)}
                        </div>

                        {leave.dates && leave.dates.length > 1 && (
                          <p className="text-xs text-muted-foreground">
                            {leave.dates.length} days
                          </p>
                        )}

                        {leave.reason && (
                          <p className="text-sm text-muted-foreground">
                            <strong>{t('worker.leaves.reasonLabel')}</strong> {leave.reason}
                          </p>
                        )}

                        {leave.penaltyApplied && (leave.penaltyAmount || 0) > 0 && (
                          <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 inline-flex items-center gap-1">
                            ⚠️ Late leave penalty: ₹{(leave.penaltyAmount || 0).toLocaleString('en-IN')}
                          </p>
                        )}

                        <p className="text-xs text-muted-foreground">
                          {t('worker.leaves.requestedOn')} {new Date(leave.requestedAt).toLocaleDateString()}
                        </p>

                        {leave.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 mt-1"
                            onClick={() => handleCancelLeave(leave._id)}
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            {t('worker.leaves.cancelRequest')}
                          </Button>
                        )}
                      </div>
                    ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default WorkerLeaves;
