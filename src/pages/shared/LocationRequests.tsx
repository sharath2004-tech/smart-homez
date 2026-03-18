import AppLayout from "@/components/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { useAdminRole } from "@/hooks/useAdminRole";
import { locationRequestsAPI } from "@/lib/api";
import { CheckCircle, Clock, Plus, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface LocationRequest {
  _id: string;
  apartmentName: string;
  building?: string;
  area: string;
  city: string;
  state: string;
  zipCode?: string;
  reason?: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: { name: string; email: string };
  reviewedBy?: { name: string; email: string };
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
}

const LocationRequests = () => {
  const { role } = useAdminRole();
  const { toast } = useToast();
  const [requests, setRequests] = useState<LocationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [form, setForm] = useState({
    apartmentName: "",
    building: "",
    area: "",
    city: "",
    state: "",
    zipCode: "",
    reason: "",
  });

  const isSuperAdmin = role === "super_admin";

  useEffect(() => {
    fetchRequests();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await locationRequestsAPI.getAll(filterStatus || undefined);
      setRequests(res.requests || []);
    } catch {
      toast({ title: "Error", description: "Failed to fetch location requests", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await locationRequestsAPI.create({
        apartmentName: form.apartmentName,
        building: form.building || undefined,
        area: form.area,
        city: form.city,
        state: form.state,
        zipCode: form.zipCode || undefined,
        reason: form.reason || undefined,
      });
      toast({ title: "Success", description: "Location request submitted successfully. Super admin will review it." });
      setShowForm(false);
      setForm({ apartmentName: "", building: "", area: "", city: "", state: "", zipCode: "", reason: "" });
      fetchRequests();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to submit request", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (id: string, status: "approved" | "rejected") => {
    try {
      const res = await locationRequestsAPI.review(id, status, reviewNote);
      toast({
        title: "Success",
        description: status === "approved" ? `Location approved and created: ${res.createdLocation?.apartmentName}` : "Location request rejected.",
      });
      setReviewingId(null);
      setReviewNote("");
      fetchRequests();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to review request", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> Pending</span>;
      case "approved": return <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" /> Approved</span>;
      case "rejected": return <span className="flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Rejected</span>;
      default: return null;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Location Requests</h1>
            <p className="text-sm text-muted-foreground">
              {isSuperAdmin ? "Review and approve location creation requests from admins" : "Request new location creation from super admin"}
            </p>
          </div>
          {!isSuperAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 btn-brand px-4 py-2 rounded-xl text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> New Request
            </button>
          )}
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          {["", "pending", "approved", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
            </button>
          ))}
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="text-center py-10 text-muted-foreground">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            {isSuperAdmin ? "No location requests yet." : "You haven't submitted any location requests."}
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={req._id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{req.apartmentName}{req.building ? `, ${req.building}` : ""}</h3>
                    <p className="text-sm text-muted-foreground">{req.area}, {req.city}, {req.state}{req.zipCode ? ` - ${req.zipCode}` : ""}</p>
                  </div>
                  {getStatusBadge(req.status)}
                </div>
                {req.reason && <p className="text-sm text-muted-foreground">Reason: {req.reason}</p>}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Requested by: {req.requestedBy?.name}</span>
                  <span>{new Date(req.createdAt).toLocaleDateString("en-IN")}</span>
                </div>
                {req.reviewedBy && (
                  <div className="text-xs text-muted-foreground">
                    Reviewed by: {req.reviewedBy.name}{req.reviewedAt ? ` on ${new Date(req.reviewedAt).toLocaleDateString("en-IN")}` : ""}
                    {req.reviewNote && <span> — Note: {req.reviewNote}</span>}
                  </div>
                )}

                {/* Super admin review actions */}
                {isSuperAdmin && req.status === "pending" && (
                  <div className="space-y-2">
                    {reviewingId === req._id ? (
                      <>
                        <textarea
                          className="input-clean text-sm w-full"
                          rows={2}
                          placeholder="Review note (optional)"
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReview(req._id, "approved")}
                            className="flex-1 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                          >
                            ✓ Approve & Create Location
                          </button>
                          <button
                            onClick={() => handleReview(req._id, "rejected")}
                            className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                          >
                            ✗ Reject
                          </button>
                          <button
                            onClick={() => { setReviewingId(null); setReviewNote(""); }}
                            className="py-2 px-3 text-sm border border-border rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => setReviewingId(req._id)}
                        className="text-sm text-primary hover:underline"
                      >
                        Review this request →
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Admin: New Request Form */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Request New Location</h2>
                <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Apartment / Society Name <span className="text-destructive">*</span></label>
                  <input type="text" required className="input-clean" placeholder="e.g. Green Valley Apartments" value={form.apartmentName} onChange={(e) => setForm({ ...form, apartmentName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Building (Optional)</label>
                  <input type="text" className="input-clean" placeholder="e.g. Block A" value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Area <span className="text-destructive">*</span></label>
                  <input type="text" required className="input-clean" placeholder="e.g. Koramangala" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">City <span className="text-destructive">*</span></label>
                    <input type="text" required className="input-clean" placeholder="e.g. Bangalore" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">State <span className="text-destructive">*</span></label>
                    <input type="text" required className="input-clean" placeholder="e.g. Karnataka" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ZIP Code (Optional)</label>
                  <input type="text" className="input-clean" placeholder="e.g. 560034" value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Reason for request (Optional)</label>
                  <textarea className="input-clean" rows={3} maxLength={500} placeholder="Explain why this location should be added..." value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-border rounded-xl text-sm" disabled={submitting}>Cancel</button>
                  <button type="submit" className="flex-1 btn-brand py-2 rounded-xl text-sm font-medium disabled:opacity-50" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default LocationRequests;
