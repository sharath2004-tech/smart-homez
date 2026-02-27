import AppLayout from "@/components/AppLayout";
import { toast } from "@/hooks/use-toast";
import { leavesAPI } from "@/lib/api";
import { Calendar, CheckCircle, Clock, User, Users, XCircle } from "lucide-react";
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
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20 md:pb-0">
        {/* Header with gradient */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl -z-10"></div>
          <div className="p-6">
            <h1 className="text-3xl font-bold font-heading text-foreground mb-2">Leave Management</h1>
            <p className="text-muted-foreground">Manage worker leave requests and view statistics</p>
          </div>
        </div>

        {/* Tabs - Enhanced Design */}
        <div className="bg-muted/30 rounded-xl p-1 inline-flex gap-1">
          <button
            className={`px-6 py-2.5 font-semibold rounded-lg transition-all duration-200 ${
              selectedTab === 'pending'
                ? 'bg-white shadow-sm text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setSelectedTab('pending')}
          >
            Pending Requests {pendingLeaves.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">
                {pendingLeaves.reduce((sum, w) => sum + w.leaves.length, 0)}
              </span>
            )}
          </button>
          <button
            className={`px-6 py-2.5 font-semibold rounded-lg transition-all duration-200 ${
              selectedTab === 'statistics'
                ? 'bg-white shadow-sm text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setSelectedTab('statistics')}
          >
            Statistics & Upcoming
          </button>
        </div>

        {/* Pending Requests Tab */}
        {selectedTab === 'pending' && (
          <div className="space-y-5">
            {pendingLeaves.length === 0 ? (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl text-center py-16 shadow-sm">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">All Caught Up!</h3>
                <p className="text-muted-foreground">No pending leave requests at the moment.</p>
              </div>
            ) : (
              pendingLeaves.map((workerLeave) => (
                <div key={workerLeave.workerId} className="bg-white rounded-2xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
                  {/* Worker Header */}
                  <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-5 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
                          <User className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{workerLeave.workerName}</h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            {workerLeave.workerEmail}
                          </p>
                          {workerLeave.workerPhone && (
                            <p className="text-sm text-muted-foreground mt-0.5">{workerLeave.workerPhone}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
                          <Clock className="w-4 h-4" />
                          {workerLeave.leaves.length} Pending
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Leave Requests */}
                  <div className="p-5 space-y-3">
                    {workerLeave.leaves.map((leave) => (
                      <div key={leave._id} className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-5 border border-gray-200 hover:border-primary/50 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <span className="text-lg font-bold text-foreground">{formatDate(leave.date)}</span>
                                <p className="text-xs text-muted-foreground">
                                  Requested {formatDateTime(leave.requestedAt)}
                                </p>
                              </div>
                            </div>
                            {leave.reason && (
                              <div className="bg-white rounded-lg p-3 border border-gray-100">
                                <p className="text-sm text-foreground">
                                  <span className="font-semibold text-muted-foreground">Reason:</span> {leave.reason}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleLeaveAction(workerLeave.workerId, leave._id, 'approved')}
                              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-md hover:shadow-lg transition-all duration-200"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleLeaveAction(workerLeave.workerId, leave._id, 'rejected')}
                              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all duration-200"
                            >
                              <XCircle className="w-4 h-4" />
                              Reject
                            </button>
                          </div>
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
          <div className="space-y-8">
            {/* Stats Cards - Enhanced */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200 shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <Users className="w-8 h-8 text-blue-600" />
                  <div className="w-10 h-10 bg-blue-200/50 rounded-full"></div>
                </div>
                <p className="text-sm font-medium text-blue-700 mb-1">Total Workers</p>
                <p className="text-3xl font-bold text-blue-900">{statistics.totalWorkers}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 border border-orange-200 shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <Clock className="w-8 h-8 text-orange-600" />
                  <div className="w-10 h-10 bg-orange-200/50 rounded-full"></div>
                </div>
                <p className="text-sm font-medium text-orange-700 mb-1">Pending Requests</p>
                <p className="text-3xl font-bold text-orange-900">{statistics.totalPendingRequests}</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200 shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div className="w-10 h-10 bg-green-200/50 rounded-full"></div>
                </div>
                <p className="text-sm font-medium text-green-700 mb-1">Approved Leaves</p>
                <p className="text-3xl font-bold text-green-900">{statistics.totalApprovedLeaves}</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 border border-red-200 shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <XCircle className="w-8 h-8 text-red-600" />
                  <div className="w-10 h-10 bg-red-200/50 rounded-full"></div>
                </div>
                <p className="text-sm font-medium text-red-700 mb-1">At Quota</p>
                <p className="text-3xl font-bold text-red-900">{statistics.workersAtQuota}</p>
              </div>
            </div>

            {/* Upcoming Leaves - Enhanced */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-6 border-b border-gray-100">
                <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  Upcoming Approved Leaves
                </h3>
              </div>
              {statistics.upcomingLeaves.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-muted-foreground">No upcoming leaves scheduled</p>
                </div>
              ) : (
                <div className="p-6 space-y-3">
                  {statistics.upcomingLeaves.map((leave, index) => (
                    <div key={index} className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-5 border border-gray-200 hover:border-primary/50 transition-all hover:shadow-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                            <User className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold text-foreground text-lg">{leave.workerName}</p>
                            <p className="text-sm text-muted-foreground">{leave.reason || 'No reason provided'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-foreground mb-1">{formatDate(leave.date)}</p>
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                            <CheckCircle className="w-3 h-3" />
                            Approved
                          </span>
                        </div>
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
