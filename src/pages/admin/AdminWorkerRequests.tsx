import AppLayout from "@/components/AppLayout";
import { adminAPI } from "@/lib/api";
import { CheckCircle, Clock, ExternalLink, Loader2, User, X } from "lucide-react";
import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const UPLOADS_BASE = API_BASE_URL.replace("/api", "");

interface PendingWorker {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  profileImage?: string;
  createdAt: string;
  workerProfile?: {
    specialization?: string[];
    experience?: number;
    accountStatus?: string;
    documents?: {
      aadhaarFront?: string;
      aadhaarBack?: string;
    };
  };
}

const AdminWorkerRequests = () => {
  const [workers, setWorkers] = useState<PendingWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<PendingWorker | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getPendingWorkers();
      setWorkers(res.workers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load worker requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const handleApprove = async (workerId: string, workerName: string) => {
    setActionLoading(workerId);
    setError("");
    try {
      await adminAPI.approveWorker(workerId);
      setSuccess(`${workerName} has been approved!`);
      setWorkers((prev) => prev.filter((w) => w._id !== workerId));
      if (selectedWorker?._id === workerId) setSelectedWorker(null);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (workerId: string) => {
    const reason = window.prompt("Reason for rejection (optional):");
    if (reason === null) return; // user cancelled
    setActionLoading(workerId);
    setError("");
    try {
      await adminAPI.rejectWorker(workerId, reason || undefined);
      setSuccess("Worker application rejected.");
      setWorkers((prev) => prev.filter((w) => w._id !== workerId));
      if (selectedWorker?._id === workerId) setSelectedWorker(null);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold font-heading text-foreground">Worker Approval Requests</h1>
          <p className="text-muted-foreground mt-1">Review and approve new worker applications</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> {success}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : workers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mb-3 text-green-400" />
            <p className="font-medium">No pending requests</p>
            <p className="text-sm mt-1">All worker applications have been reviewed.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {workers.map((worker) => (
              <div
                key={worker._id}
                className="bg-card border border-border rounded-2xl p-5 shadow-card flex flex-col sm:flex-row gap-4"
              >
                {/* Avatar */}
                <div className="shrink-0">
                  {worker.profileImage ? (
                    <img
                      src={`${UPLOADS_BASE}${worker.profileImage}`}
                      alt={worker.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-border"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="font-semibold text-foreground text-lg">{worker.name}</h3>
                      <p className="text-sm text-muted-foreground">{worker.email}</p>
                      {worker.phone && <p className="text-sm text-muted-foreground">{worker.phone}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 rounded-full text-amber-700 text-xs font-medium">
                      <Clock className="w-3 h-3" /> Pending Review
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {(worker.workerProfile?.specialization || []).map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">{s}</span>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    {worker.workerProfile?.experience !== undefined && (
                      <span>{worker.workerProfile.experience} yr{worker.workerProfile.experience === 1 ? "" : "s"} experience</span>
                    )}
                    {worker.gender && <span className="capitalize">{worker.gender.replace("_", " ")}</span>}
                    <span>Applied {formatDate(worker.createdAt)}</span>
                  </div>

                  {/* Document links */}
                  {(worker.workerProfile?.documents?.aadhaarFront || worker.workerProfile?.documents?.aadhaarBack) && (
                    <div className="mt-3 flex gap-3">
                      {worker.workerProfile.documents.aadhaarFront && (
                        <a
                          href={`${UPLOADS_BASE}${worker.workerProfile.documents.aadhaarFront}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> Aadhaar Front
                        </a>
                      )}
                      {worker.workerProfile.documents.aadhaarBack && (
                        <a
                          href={`${UPLOADS_BASE}${worker.workerProfile.documents.aadhaarBack}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> Aadhaar Back
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex sm:flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(worker._id, worker.name)}
                    disabled={actionLoading === worker._id}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === worker._id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <><CheckCircle className="w-4 h-4" /> Approve</>
                    )}
                  </button>
                  <button
                    onClick={() => handleReject(worker._id)}
                    disabled={actionLoading === worker._id}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 border border-destructive text-destructive rounded-xl text-sm font-medium hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminWorkerRequests;
