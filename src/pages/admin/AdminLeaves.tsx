import AppLayout from "@/components/AppLayout";
import { toast } from "@/hooks/use-toast";
import { useAdminRole } from "@/hooks/useAdminRole";
import { leavesAPI, superAdminAPI } from "@/lib/api";
import { Calendar, CheckCircle, Clock, Plus, User, Users, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// â”€â”€â”€ Interfaces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface WorkerLeave {
  _id: string;
  date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  approvedBy?: string;
}

interface AdminLeave {
  _id: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  approvedBy?: { name: string; email: string } | string;
}

interface PendingLeaveRequest {
  workerId: string;
  workerName: string;
  workerEmail: string;
  workerPhone?: string;
  leaves: WorkerLeave[];
}

interface AdminLeaveRequest {
  adminId: string;
  adminName: string;
  adminEmail: string;
  adminPhone?: string;
  leaves: AdminLeave[];
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

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const AdminLeaves = () => {
  const { role, name, isSuperAdmin } = useAdminRole();

  // Tabs: 'my-leaves' (admin only) | 'worker-leaves' | 'admin-leaves' (super_admin only) | 'statistics'
  const defaultTab = isSuperAdmin ? 'admin-leaves' : 'my-leaves';
  const [selectedTab, setSelectedTab] = useState<string>(defaultTab);

  // Worker leaves (admin manages)
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeaveRequest[]>([]);
  const [statistics, setStatistics] = useState<LeaveStatistics | null>(null);

  // Admin's own leaves
  const [myLeaves, setMyLeaves] = useState<AdminLeave[]>([]);

  // Super admin: admin leave requests
  const [adminLeaveRequests, setAdminLeaveRequests] = useState<AdminLeaveRequest[]>([]);

  // Apply-leave form (admin)
  const [applyForm, setApplyForm] = useState({ fromDate: '', toDate: '', reason: '' });
  const [applyLoading, setApplyLoading] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);

  const [loading, setLoading] = useState(true);

  // Returns today's date as YYYY-MM-DD in the user's local timezone
  const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const promises: Promise<unknown>[] = [
        leavesAPI.getPendingLeaves(),
        leavesAPI.getLeaveStatistics()
      ];
      if (!isSuperAdmin) promises.push(leavesAPI.getAdminMyLeaves());
      if (isSuperAdmin) promises.push(superAdminAPI.getAdminLeaves());

      // Promise.allSettled never rejects — handle each result individually
      const results = await Promise.allSettled(promises);

      if (results[0].status === 'fulfilled') {
        const data = results[0].value as { pendingRequests?: PendingLeaveRequest[] };
        setPendingLeaves(data.pendingRequests || []);
      } else {
        console.error('Failed to fetch pending leaves:', results[0].reason);
      }
      if (results[1].status === 'fulfilled') {
        setStatistics(results[1].value as LeaveStatistics);
      } else {
        console.error('Failed to fetch leave statistics:', results[1].reason);
      }
      if (!isSuperAdmin && results[2]) {
        if (results[2].status === 'fulfilled') {
          const data = results[2].value as { leaves?: AdminLeave[] };
          setMyLeaves(data.leaves || []);
        } else {
          console.error('Failed to fetch own leaves:', results[2].reason);
        }
      }
      if (isSuperAdmin && results[2]) {
        if (results[2].status === 'fulfilled') {
          const data = results[2].value as { adminLeaves?: AdminLeaveRequest[] };
          setAdminLeaveRequests(data.adminLeaves || []);
        } else {
          console.error('Failed to fetch admin leave requests:', results[2].reason);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]); // re-fetch when role resolves or changes

  const formatDate = (ds: string) =>
    new Date(ds).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const formatDateTime = (ds: string) =>
    new Date(ds).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const statusBadge = (status: 'pending' | 'approved' | 'rejected') => {
    const map = {
      pending: 'bg-orange-100 text-orange-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700'
    };
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold capitalize ${map[status]}`}>
        {status === 'pending' && <Clock className="w-3 h-3" />}
        {status === 'approved' && <CheckCircle className="w-3 h-3" />}
        {status === 'rejected' && <XCircle className="w-3 h-3" />}
        {status}
      </span>
    );
  };

  // â”€â”€ Worker leave actions (admin) â”€â”€
  const handleWorkerLeaveAction = async (workerId: string, leaveId: string, action: 'approved' | 'rejected') => {
    try {
      await leavesAPI.updateLeaveStatus(workerId, leaveId, action);
      toast({ title: 'Success', description: `Leave ${action}`, variant: 'default' });
      fetchAll();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : `Failed to ${action} leave`, variant: 'destructive' });
    }
  };

  // â”€â”€ Admin own leave actions â”€â”€
  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.fromDate || !applyForm.toDate) {
      toast({ title: 'Error', description: 'Please select from and to dates', variant: 'destructive' });
      return;
    }
    setApplyLoading(true);
    try {
      await leavesAPI.applyAdminLeave(applyForm.fromDate, applyForm.toDate, applyForm.reason);
      toast({ title: 'Success', description: 'Leave request submitted. Awaiting super admin approval.' });
      setApplyForm({ fromDate: '', toDate: '', reason: '' });
      setShowApplyForm(false);
      fetchAll();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to submit leave', variant: 'destructive' });
    } finally {
      setApplyLoading(false);
    }
  };

  const handleCancelMyLeave = async (leaveId: string) => {
    try {
      await leavesAPI.cancelAdminLeave(leaveId);
      toast({ title: 'Success', description: 'Leave request cancelled' });
      fetchAll();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to cancel leave', variant: 'destructive' });
    }
  };

  // â”€â”€ Super admin: admin leave approval â”€â”€
  const handleAdminLeaveAction = async (adminId: string, leaveId: string, action: 'approved' | 'rejected') => {
    try {
      await superAdminAPI.updateAdminLeaveStatus(adminId, leaveId, action);
      toast({ title: 'Success', description: `Leave ${action} successfully` });
      fetchAll();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : `Failed to ${action} leave`, variant: 'destructive' });
    }
  };

  // â”€â”€ Pending counts â”€â”€
  const workerPendingCount = pendingLeaves.reduce((s, w) => s + w.leaves.length, 0);
  const adminPendingCount = adminLeaveRequests.reduce((s, a) => s + a.leaves.filter(l => l.status === 'pending').length, 0);

  if (loading) {
    return (
      <AppLayout userType={role} userName={name}>
        <div className="text-center py-12">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading leaves data...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType={role} userName={name}>
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20 md:pb-0">
        {/* Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl -z-10"></div>
          <div className="p-6">
            <h1 className="text-3xl font-bold font-heading text-foreground mb-2">Leave Management</h1>
            <p className="text-muted-foreground">
              {isSuperAdmin ? 'Approve admin leaves and manage worker leave requests' : 'Apply for leaves and manage worker leave requests'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-muted/30 rounded-xl p-1 inline-flex flex-wrap gap-1">
          {!isSuperAdmin && (
            <button
              className={`px-5 py-2.5 font-semibold rounded-lg transition-all duration-200 text-sm ${selectedTab === 'my-leaves' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setSelectedTab('my-leaves')}
            >
              My Leave Requests
            </button>
          )}
          <button
            className={`px-5 py-2.5 font-semibold rounded-lg transition-all duration-200 text-sm ${selectedTab === 'worker-leaves' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setSelectedTab('worker-leaves')}
          >
            Worker Leaves
            {workerPendingCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">{workerPendingCount}</span>
            )}
          </button>
          {isSuperAdmin && (
            <button
              className={`px-5 py-2.5 font-semibold rounded-lg transition-all duration-200 text-sm ${selectedTab === 'admin-leaves' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setSelectedTab('admin-leaves')}
            >
              Admin Leave Requests
              {adminPendingCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">{adminPendingCount}</span>
              )}
            </button>
          )}
          <button
            className={`px-5 py-2.5 font-semibold rounded-lg transition-all duration-200 text-sm ${selectedTab === 'statistics' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setSelectedTab('statistics')}
          >
            Statistics
          </button>
        </div>

        {/* â”€â”€ My Leave Requests (admin only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {selectedTab === 'my-leaves' && !isSuperAdmin && (
          <div className="space-y-5">
            {/* Apply Leave Toggle */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowApplyForm(!showApplyForm)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold shadow-md hover:bg-primary/90 transition-all"
              >
                <Plus className="w-4 h-4" />
                {showApplyForm ? 'Cancel' : 'Apply for Leave'}
              </button>
            </div>

            {/* Apply Leave Form */}
            {showApplyForm && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-6">
                <h3 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  New Leave Request
                </h3>
                <form onSubmit={handleApplyLeave} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-1.5">From Date <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        min={localToday()}
                        value={applyForm.fromDate}
                        onChange={e => setApplyForm(f => ({ ...f, fromDate: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-1.5">To Date <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        min={applyForm.fromDate || localToday()}
                        value={applyForm.toDate}
                        onChange={e => setApplyForm(f => ({ ...f, toDate: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">Reason (optional)</label>
                    <textarea
                      rows={3}
                      value={applyForm.reason}
                      onChange={e => setApplyForm(f => ({ ...f, reason: e.target.value }))}
                      placeholder="Provide a reason for your leave request..."
                      maxLength={500}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm resize-none"
                    />
                    <p className="text-xs text-muted-foreground text-right mt-1">{applyForm.reason.length}/500</p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={applyLoading}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-semibold shadow-md hover:bg-primary/90 disabled:opacity-60 transition-all"
                    >
                      {applyLoading ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <CheckCircle className="w-4 h-4" />}
                      Submit Request
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* My Leaves List */}
            {myLeaves.length === 0 ? (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl text-center py-16 shadow-sm">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">No Leave Requests</h3>
                <p className="text-muted-foreground">You haven't applied for any leaves yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myLeaves.map((leave) => (
                  <div key={leave._id} className="bg-white rounded-2xl border border-gray-200 shadow-md p-5 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-foreground text-base">
                            {formatDate(leave.fromDate)}
                            {leave.fromDate !== leave.toDate && ` â†’ ${formatDate(leave.toDate)}`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">Requested {formatDateTime(leave.requestedAt)}</p>
                          {leave.reason && (
                            <p className="text-sm text-foreground mt-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                              <span className="font-semibold text-muted-foreground">Reason:</span> {leave.reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {statusBadge(leave.status)}
                        {leave.status === 'pending' && (
                          <button
                            onClick={() => handleCancelMyLeave(leave._id)}
                            className="text-xs text-red-500 hover:text-red-700 font-semibold underline underline-offset-2"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ Worker Leaves (existing admin view) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {selectedTab === 'worker-leaves' && (
          <div className="space-y-5">
            {pendingLeaves.length === 0 ? (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl text-center py-16 shadow-sm">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">All Caught Up!</h3>
                <p className="text-muted-foreground">No pending worker leave requests at the moment.</p>
              </div>
            ) : (
              pendingLeaves.map((workerLeave) => (
                <div key={workerLeave.workerId} className="bg-white rounded-2xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                  <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-5 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
                          <User className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{workerLeave.workerName}</h3>
                          <p className="text-sm text-muted-foreground">{workerLeave.workerEmail}</p>
                          {workerLeave.workerPhone && <p className="text-sm text-muted-foreground mt-0.5">{workerLeave.workerPhone}</p>}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
                        <Clock className="w-4 h-4" />
                        {workerLeave.leaves.length} Pending
                      </span>
                    </div>
                  </div>
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
                                <p className="text-xs text-muted-foreground">Requested {formatDateTime(leave.requestedAt)}</p>
                              </div>
                            </div>
                            {leave.reason && (
                              <div className="bg-white rounded-lg p-3 border border-gray-100">
                                <p className="text-sm text-foreground"><span className="font-semibold text-muted-foreground">Reason:</span> {leave.reason}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleWorkerLeaveAction(workerLeave.workerId, leave._id, 'approved')}
                              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-md hover:shadow-lg transition-all"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleWorkerLeaveAction(workerLeave.workerId, leave._id, 'rejected')}
                              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all"
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

        {/* â”€â”€ Admin Leave Requests (super_admin only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {selectedTab === 'admin-leaves' && isSuperAdmin && (
          <div className="space-y-5">
            {adminLeaveRequests.length === 0 ? (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl text-center py-16 shadow-sm">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">No Admin Leave Requests</h3>
                <p className="text-muted-foreground">No admin leave requests to review at the moment.</p>
              </div>
            ) : (
              adminLeaveRequests.map((adminReq) => (
                <div key={adminReq.adminId} className="bg-white rounded-2xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100/50 p-5 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                          <User className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{adminReq.adminName}</h3>
                          <p className="text-sm text-muted-foreground">{adminReq.adminEmail}</p>
                          {adminReq.adminPhone && <p className="text-sm text-muted-foreground mt-0.5">{adminReq.adminPhone}</p>}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                        <Users className="w-4 h-4" />
                        Admin
                      </span>
                    </div>
                  </div>
                  <div className="p-5 space-y-3">
                    {adminReq.leaves.map((leave) => (
                      <div key={leave._id} className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-5 border border-gray-200 hover:border-purple-300 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-purple-600" />
                              </div>
                              <div>
                                <span className="text-base font-bold text-foreground">
                                  {formatDate(leave.fromDate)}
                                  {leave.fromDate !== leave.toDate && ` â†’ ${formatDate(leave.toDate)}`}
                                </span>
                                <p className="text-xs text-muted-foreground">Requested {formatDateTime(leave.requestedAt)}</p>
                              </div>
                            </div>
                            {leave.reason && (
                              <div className="bg-white rounded-lg p-3 border border-gray-100">
                                <p className="text-sm text-foreground"><span className="font-semibold text-muted-foreground">Reason:</span> {leave.reason}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {leave.status === 'pending' ? (
                              <>
                                <button
                                  onClick={() => handleAdminLeaveAction(adminReq.adminId, leave._id, 'approved')}
                                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-md hover:shadow-lg transition-all"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleAdminLeaveAction(adminReq.adminId, leave._id, 'rejected')}
                                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Reject
                                </button>
                              </>
                            ) : (
                              statusBadge(leave.status)
                            )}
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

        {/* â”€â”€ Statistics Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {selectedTab === 'statistics' && statistics && (
          <div className="space-y-8">
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
