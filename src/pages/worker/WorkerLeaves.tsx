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

interface Leave {
  _id: string;
  date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  approvedBy?: string;
}

interface WorkerProfile {
  monthlyLeaveQuota: number;
  leavesUsedThisMonth: number;
}

const WorkerLeaves = () => {
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
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch leaves',
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

  const handleApplyLeave = async () => {
    if (!selectedDate) {
      toast({
        title: 'Error',
        description: 'Please select a date',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await leavesAPI.applyLeave(selectedDate.toISOString(), reason.trim());

      toast({
        title: 'Success',
        description: 'Leave request submitted successfully'
      });

      setSelectedDate(undefined);
      setReason('');
      fetchLeaves();
      fetchProfile();
    } catch (error) {
      console.error('Error applying leave:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to apply leave',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      default:
        return null;
    }
  };

  const isDateDisabled = (date: Date) => {
    // Disable past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return true;

    // Disable dates that already have a leave request
    const dateStr = date.toISOString().split('T')[0];
    return leaves.some(leave => {
      const leaveDate = new Date(leave.date).toISOString().split('T')[0];
      return leaveDate === dateStr;
    });
  };

  const remainingLeaves = profile.monthlyLeaveQuota - profile.leavesUsedThisMonth;

  return (
    <AppLayout>
      <div className="container max-w-6xl mx-auto py-6 space-y-6">
        {/* Leave Quota Info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>
                You have <strong>{remainingLeaves}</strong> out of <strong>{profile.monthlyLeaveQuota}</strong> leaves remaining this month
              </span>
            </div>
          </AlertDescription>
        </Alert>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Apply for Leave */}
          <Card>
            <CardHeader>
              <CardTitle>Apply for Leave</CardTitle>
              <CardDescription>Select a date and provide a reason</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={isDateDisabled}
                  className="rounded-md border"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Reason (Optional)</label>
                <Textarea
                  placeholder="Enter reason for leave..."
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
                {isSubmitting ? 'Submitting...' : 'Submit Leave Request'}
              </Button>

              {remainingLeaves <= 0 && (
                <p className="text-sm text-destructive text-center">
                  You have reached your monthly leave quota
                </p>
              )}
            </CardContent>
          </Card>

          {/* Leave History */}
          <Card>
            <CardHeader>
              <CardTitle>Leave History</CardTitle>
              <CardDescription>Your past and pending leave requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {leaves.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No leave requests yet
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
                              {new Date(leave.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          {getStatusBadge(leave.status)}
                        </div>

                        {leave.reason && (
                          <p className="text-sm text-muted-foreground">
                            <strong>Reason:</strong> {leave.reason}
                          </p>
                        )}

                        <p className="text-xs text-muted-foreground">
                          Requested on {new Date(leave.requestedAt).toLocaleDateString()}
                        </p>
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
