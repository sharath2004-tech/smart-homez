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
  const [reviewLoading, setReviewLoading] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
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
    if (status === "approved") {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (!latitude || !longitude || isNaN(lat) || isNaN(lng)) {
        toast({ title: "Error", description: "Please provide valid coordinates (latitude and longitude) to approve", variant: "destructive" });
        return;
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        toast({ title: "Error", description: "Invalid coordinates. Lat: -90 to 90, Lng: -180 to 180", variant: "destructive" });
        return;
      }
      if (lat === 0 && lng === 0) {
        toast({ title: "Error", description: "Placeholder coordinates [0, 0] are not allowed. Please provide actual location coordinates.", variant: "destructive" });
        return;
      }
    }

    setReviewLoading(true);
    try {
      const coordinates = status === "approved" ? [parseFloat(longitude), parseFloat(latitude)] as [number, number] : undefined;
      const res = await locationRequestsAPI.review(id, status, reviewNote, coordinates);
      toast({
        title: "Success",
        description: status === "approved" ? `Location approved and created: ${res.createdLocation?.apartmentName}` : "Location request rejected.",
      });
      setReviewingId(null);
      setReviewNote("");
      setLatitude("");
      setLongitude("");
      fetchRequests();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to review request", variant: "destructive" });
    } finally {
      setReviewLoading(false);
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
                        <div className="space-y-3 border border-border rounded-lg p-3 bg-muted/30">
                          <div className="text-sm font-medium">Review Details</div>
                          <div>
                            <label htmlFor="review-note" className="block text-xs text-muted-foreground mb-1">Review note (optional)</label>
                            <textarea
                              id="review-note"
                              className="input-clean text-sm w-full"
                              rows={2}
                              placeholder="Add any comments..."
                              value={reviewNote}
                              onChange={(e) => setReviewNote(e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label htmlFor="latitude" className="block text-xs text-muted-foreground mb-1">Latitude <span className="text-destructive">*</span></label>
                              <input
                                id="latitude"
                                type="number"
                                step="any"
                                className="input-clean text-sm w-full"
                                placeholder="e.g. 12.9716"
                                value={latitude}
                                onChange={(e) => setLatitude(e.target.value)}
                                required
                              />
                            </div>
                            <div>
                              <label htmlFor="longitude" className="block text-xs text-muted-foreground mb-1">Longitude <span className="text-destructive">*</span></label>
                              <input
                                id="longitude"
                                type="number"
                                step="any"
                                className="input-clean text-sm w-full"
                                placeholder="e.g. 77.5946"
                                value={longitude}
                                onChange={(e) => setLongitude(e.target.value)}
                                required
                              />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Coordinates are required for approval. You can get them from Google Maps.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReview(req._id, "approved")}
                            disabled={reviewLoading}
                            className="flex-1 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {reviewLoading ? "Processing..." : "✓ Approve & Create Location"}
                          </button>
                          <button
                            onClick={() => handleReview(req._id, "rejected")}
                            disabled={reviewLoading}
                            className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {reviewLoading ? "Processing..." : "✗ Reject"}
                          </button>
                          <button
                            onClick={() => { setReviewingId(null); setReviewNote(""); setLatitude(""); setLongitude(""); }}
                            disabled={reviewLoading}
                            className="py-2 px-3 text-sm border border-border rounded-lg disabled:opacity-50"
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
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-request-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowForm(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowForm(false);
            }}
          >
            <div className="bg-background rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 id="location-request-modal-title" className="text-lg font-bold">Request New Location</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="apartment-name" className="block text-sm font-medium mb-1">Apartment / Society Name <span className="text-destructive">*</span></label>
                  <input id="apartment-name" type="text" required className="input-clean" placeholder="e.g. Green Valley Apartments" value={form.apartmentName} onChange={(e) => setForm({ ...form, apartmentName: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="building" className="block text-sm font-medium mb-1">Building (Optional)</label>
                  <input id="building" type="text" className="input-clean" placeholder="e.g. Block A" value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="area" className="block text-sm font-medium mb-1">Area <span className="text-destructive">*</span></label>
                  <input id="area" type="text" required className="input-clean" placeholder="e.g. Koramangala" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium mb-1">City <span className="text-destructive">*</span></label>
                    <input id="city" type="text" required className="input-clean" placeholder="e.g. Bangalore" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium mb-1">State <span className="text-destructive">*</span></label>
                    <input id="state" type="text" required className="input-clean" placeholder="e.g. Karnataka" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label htmlFor="zipcode" className="block text-sm font-medium mb-1">ZIP Code (Optional)</label>
                  <input id="zipcode" type="text" className="input-clean" placeholder="e.g. 560034" value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="reason" className="block text-sm font-medium mb-1">Reason for request (Optional)</label>
                  <textarea id="reason" className="input-clean" rows={3} maxLength={500} placeholder="Explain why this location should be added..." value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
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
