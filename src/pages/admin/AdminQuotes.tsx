import AppLayout from "@/components/AppLayout";
import { api } from "@/lib/api";
import { Briefcase, Building2, Home, MapPin, Phone, RefreshCw, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";

interface QuoteRequest {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  propertyType: string;
  propertyTypeCustom?: string;
  placeSize?: string;
  city?: string;
  message?: string;
  status: "new" | "contacted" | "closed";
  createdAt: string;
}

const PROPERTY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  villa: Home,
  bungalow: Home,
  restaurant: UtensilsCrossed,
  corporate_office: Building2,
  business: Briefcase,
  other: Building2,
};

const PROPERTY_LABELS: Record<string, string> = {
  villa: "Villa",
  bungalow: "Bungalow",
  restaurant: "Restaurant",
  corporate_office: "Corporate Office",
  business: "Business",
  other: "Other",
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-amber-100 text-amber-800",
  closed: "bg-green-100 text-green-800",
};

const AdminQuotes = () => {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      const data = await api.get("/quotes");
      setQuotes(data.data || []);
    } catch (err) {
      console.error("Failed to fetch quotes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuotes(); }, []);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      await api.patch(`/quotes/${id}/status`, { status });
      setQuotes(prev => prev.map(q => q._id === id ? { ...q, status: status as QuoteRequest["status"] } : q));
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdating(null);
    }
  };

  const displayed = filterStatus === "all" ? quotes : quotes.filter(q => q.status === filterStatus);

  const counts = {
    all: quotes.length,
    new: quotes.filter(q => q.status === "new").length,
    contacted: quotes.filter(q => q.status === "contacted").length,
    closed: quotes.filter(q => q.status === "closed").length,
  };

  return (
    <AppLayout userType="admin">
      <div className="max-w-5xl mx-auto space-y-6 pb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Quote Requests</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Deep cleaning enquiries from customers</p>
          </div>
          <button onClick={fetchQuotes} className="p-2 rounded-xl hover:bg-muted transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "new", "contacted", "closed"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
                filterStatus === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-border"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}{" "}
              <span className="opacity-70">({counts[s]})</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading quotes...</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-semibold text-foreground">No quote requests</p>
            <p className="text-sm text-muted-foreground mt-1">Quote requests from customers will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(q => {
              const Icon = PROPERTY_ICONS[q.propertyType] || Building2;
              const typeLabel = q.propertyType === "other" && q.propertyTypeCustom
                ? q.propertyTypeCustom
                : PROPERTY_LABELS[q.propertyType] || q.propertyType;

              return (
                <div key={q._id} className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-green-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground">{q.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[q.status]}`}>
                            {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                          <Phone className="w-3.5 h-3.5" />
                          <span>{q.phone}</span>
                          {q.email && <span className="ml-2">· {q.email}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {q.status !== "contacted" && (
                        <button
                          disabled={updating === q._id}
                          onClick={() => updateStatus(q._id, "contacted")}
                          className="text-xs px-3 py-1.5 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          Mark Contacted
                        </button>
                      )}
                      {q.status !== "closed" && (
                        <button
                          disabled={updating === q._id}
                          onClick={() => updateStatus(q._id, "closed")}
                          className="text-xs px-3 py-1.5 bg-green-100 text-green-800 hover:bg-green-200 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          Close
                        </button>
                      )}
                      {q.status === "closed" && (
                        <button
                          disabled={updating === q._id}
                          onClick={() => updateStatus(q._id, "new")}
                          className="text-xs px-3 py-1.5 bg-muted text-muted-foreground hover:bg-border rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <p className="text-muted-foreground">Property</p>
                      <p className="font-medium text-foreground mt-0.5">{typeLabel}</p>
                    </div>
                    {q.city && (
                      <div className="bg-muted rounded-lg px-3 py-2">
                        <p className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />City</p>
                        <p className="font-medium text-foreground mt-0.5">{q.city}</p>
                      </div>
                    )}
                    {q.placeSize && (
                      <div className="bg-muted rounded-lg px-3 py-2">
                        <p className="text-muted-foreground">Size</p>
                        <p className="font-medium text-foreground mt-0.5">{q.placeSize}</p>
                      </div>
                    )}
                  </div>

                  {q.message && (
                    <p className="mt-3 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2 italic">
                      "{q.message}"
                    </p>
                  )}

                  <p className="mt-3 text-xs text-muted-foreground text-right">
                    {new Date(q.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminQuotes;
