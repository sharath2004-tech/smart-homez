import AppLayout from "@/components/AppLayout";
import { toast } from "@/hooks/use-toast";
import { leavesAPI } from "@/lib/api";
import { Calendar, CheckCircle, Clock, User, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface Leave {
  _id: string;
  date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  approvedBy?: string;
  responseAt?: string;
}

interface PendingLeaveRequest {
  workerId: string;
  workerName: string;
  workerEmail: string;
  workerPhone?: string;
  leaves: Leave[];
}

interface LeaveStatistics {
  totalWorkers: number;
  totalPendingRequests: number;
  totalApprovedLeaves: number;
  totalRejectedLeaves: number;
  workersAtQuota: number;
  upcomingLeaves: Array<{
    workerId: string;
    workerName: string;
    date: string;
    reason: string;
  }>;
}

const AdminLeaves = () => {
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeaveRequest[]>([]);
  const [statistics, setStatistics] = useState<LeaveStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'pending' | 'statistics'>('pending');

  useEffect(() => {
    fetchLeavesData();
  }, []);

  const fetchLeavesData = async () => {
    try {
      setLoading(true);
      const [pendingRes, statsRes] = await Promise.all([
        leavesAPI.getPendingLeaves(),
        leavesAPI.getLeaveStatistics()
      ]);
      setPendingLeaves(pendingRes.pendingRequests || []);
      setStatistics(statsRes);
    } catch (error) {
      console.error('Error fetching leaves data:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch leaves data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveAction = async (workerId: string, leaveId: string, action: 'approved' | 'rejected') => {
    try {
      await leavesAPI.updateLeaveStatus(workerId, leaveId, action);
      toast({
        title: "Success",
        description: `Leave request ${action} successfully`,
        variant: "default"
      });
      fetchLeavesData();
    } catch (error) {
      console.error('Error updating leave status:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${action} leave`,
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <AppLayout userType="admin" userName="Admin Team">
        <div className="text-center py-12">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading leaves data...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="admin" userName="Admin Team">
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Leave Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage worker leave requests and view statistics</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          <button
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              selectedTab === 'pending'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setSelectedTab('pending')}
          >
            Pending Requests {pendingLeaves.length > 0 && `(${pendingLeaves.reduce((sum, w) => sum + w.leaves.length, 0)})`}
          </button>
          <button
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              selectedTab === 'statistics'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setSelectedTab('statistics')}
          >
            Statistics & Upcoming
          </button>
        </div>

        {/* Pending Requests Tab */}
        {selectedTab === 'pending' && (
          <div className="space-y-4">
            {pendingLeaves.length === 0 ? (
              <div className="card-elevated text-center py-12">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-foreground mb-2">All Caught Up!</h3>
                <p className="text-muted-foreground">No pending leave requests at the moment.</p>
              </div>
            ) : (
              pendingLeaves.map((workerLeave) => (
                <div key={workerLeave.workerId} className="card-elevated space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{workerLeave.workerName}</h3>
                        <p className="text-sm text-muted-foreground">{workerLeave.workerEmail}</p>
                        {workerLeave.workerPhone && (
                          <p className="text-sm text-muted-foreground">{workerLeave.workerPhone}</p>
                        )}
                      </div>
                    </div>
                    <span className="badge-warning">
                      {workerLeave.leaves.length} Pending
                    </span>
                  </div>

                  {/* Leave Requests */}
                  <div className="space-y-3 border-t border-border pt-4">
                    {workerLeave.leaves.map((leave) => (
                      <div key={leave._id} className="bg-muted/30 rounded-lg p-4 flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            <span className="font-semibold text-foreground">{formatDate(leave.date)}</span>
                          </div>
                          {leave.reason && (
                            <p className="text-sm text-muted-foreground mb-2">
                              <strong>Reason:</strong> {leave.reason}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Requested: {formatDateTime(leave.requestedAt)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleLeaveAction(workerLeave.workerId, leave._id, 'approved')}
                            className="btn-brand px-4 py-2 text-sm flex items-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleLeaveAction(workerLeave.workerId, leave._id, 'rejected')}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Statistics Tab */}
        {selectedTab === 'statistics' && statistics && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card-elevated">
                <p className="text-sm text-muted-foreground mb-1">Total Workers</p>
                <p className="text-2xl font-bold text-foreground">{statistics.totalWorkers}</p>
              </div>
              <div className="card-elevated">
                <p className="text-sm text-muted-foreground mb-1">Pending Requests</p>
                <p className="text-2xl font-bold text-warning">{statistics.totalPendingRequests}</p>
              </div>
              <div className="card-elevated">
                <p className="text-sm text-muted-foreground mb-1">Approved Leaves</p>
                <p className="text-2xl font-bold text-success">{statistics.totalApprovedLeaves}</p>
              </div>
              <div className="card-elevated">
                <p className="text-sm text-muted-foreground mb-1">At Quota</p>
                <p className="text-2xl font-bold text-destructive">{statistics.workersAtQuota}</p>
              </div>
            </div>

            {/* Upcoming Leaves */}
            <div className="card-elevated">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Upcoming Approved Leaves
              </h3>
              {statistics.upcomingLeaves.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No upcoming leaves scheduled</p>
              ) : (
                <div className="space-y-2">
                  {statistics.upcomingLeaves.map((leave, index) => (
                    <div key={index} className="bg-muted/30 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{leave.workerName}</p>
                          <p className="text-sm text-muted-foreground">{leave.reason || 'No reason provided'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">{formatDate(leave.date)}</p>
                        <span className="badge-success text-xs">Approved</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminLeaves;
