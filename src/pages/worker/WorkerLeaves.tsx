import AppLayout from '@/components/AppLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { authAPI, leavesAPI } from '@/lib/api';
import { Calendar as CalendarIcon, CheckCircle, Clock, Info, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Leave {
  _id: string;
  date: string;
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

const WorkerLeaves = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>();
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

  const checkPenalty = (date: Date | undefined) => {
    if (!date) { setPenaltyWarning(false); return; }
    const now = new Date();
    // Normalize to local midnight so the comparison is day-boundary based
    const leaveStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const hoursUntilLeave = (leaveStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    setPenaltyWarning(hoursUntilLeave >= 0 && hoursUntilLeave < 24);
  };

  const handleApplyLeave = async () => {
    if (!selectedDate) {
      toast({
        title: t('common.error'),
        description: t('worker.leaves.pleaseSelectDate'),
        variant: 'destructive'
      });
      return;
    }

    // Warn about penalty but allow submission
    if (penaltyWarning && !confirm(t('worker.leaves.penaltyConfirmMessage', { amount: '1,500' }))) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await leavesAPI.applyLeave(toLocalDateValue(selectedDate), reason.trim());

      if (response.penaltyApplied) {
        toast({
          title: t('worker.leaves.penaltyToastTitle'),
          description: t('worker.leaves.penaltyToastDescription', { amount: '1,500' }),
          variant: 'destructive'
        });
      } else {
        toast({
          title: t('common.success'),
          description: t('worker.leaves.leaveSubmitted')
        });
      }

      setSelectedDate(undefined);
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

  const isDateDisabled = (date: Date) => {
    // Disable past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return true;

    // Disable dates that already have a leave request
    const dateStr = toLocalDateValue(date);
    return leaves.some(leave => {
      const leaveDate = toStoredLeaveDateKey(leave.date);
      return leaveDate === dateStr;
    });
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
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => { setSelectedDate(date); checkPenalty(date); }}
                  disabled={isDateDisabled}
                  className="rounded-md border"
                />
              </div>

              {/* 24-hour penalty warning */}
              {penaltyWarning && (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">
                    ⚠️ <strong>{t('worker.leaves.penaltyWarningTitle')}:</strong> {t('worker.leaves.penaltyWarningText', { amount: '1,500' })}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label htmlFor="leaveReason" className="text-sm font-medium">{t('worker.leaves.reasonOptional')}</label>
                <Textarea
                  id="leaveReason"
                  placeholder={t('worker.leaves.enterReason')}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={200}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {reason.length}/200
                </p>
              </div>

              <Button
                onClick={handleApplyLeave}
                disabled={!selectedDate || isSubmitting || remainingLeaves <= 0}
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
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((leave) => (
                      <div
                        key={leave._id}
                        className="border rounded-lg p-4 space-y-2 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">
                              {formatLeaveDate(leave.date)}
                            </span>
                          </div>
                          {getStatusBadge(leave.status)}
                        </div>

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
