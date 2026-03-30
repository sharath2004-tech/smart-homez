import AppLayout from "@/components/AppLayout";
import { api, authAPI } from "@/lib/api";
import { Briefcase, Building2, Clock, FileText, Home, Loader2, MessageSquare, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface QuoteRequest {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  propertyType: string;
  propertyTypeCustom?: string;
  placeSize: string;
  city: string;
  message?: string;
  status: "new" | "contacted" | "closed";
  createdAt: string;
}

const PROPERTY_ICONS: Record<string, React.ElementType> = {
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

const STATUS_CONFIG = {
  new: { label: "Pending Review", color: "bg-amber-100 text-amber-700 border-amber-200" },
  contacted: { label: "Team Called", color: "bg-blue-100 text-blue-700 border-blue-200" },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-600 border-gray-200" },
};

const MyQuotesPage = () => {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ name?: string } | null>(null);

  useEffect(() => {
    authAPI.getProfile().then(d => setProfile(d.user || d)).catch(() => {});
    api.get("/quotes/mine")
      .then((data: { success: boolean; data: QuoteRequest[] }) => {
        if (data.success) setQuotes(data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <AppLayout userType="customer" userName={profile?.name || "Loading..."}>
      <div className="w-full px-4 sm:px-5 md:px-7 lg:px-10 pb-20 md:pb-0 space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">My Quote Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track the status of your deep cleaning quote requests.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : quotes.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
            <div className="text-5xl mb-3">📋</div>
            <p className="font-semibold text-foreground mb-1">No quotes yet</p>
            <p className="text-sm text-muted-foreground mb-5">
              Request a free deep cleaning quote for your space.
            </p>
            <Link
              to="/deep-cleaning-quote"
              className="btn-brand px-6 inline-block text-sm"
            >
              Get a Free Quote
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {quotes.map(q => {
              const Icon = PROPERTY_ICONS[q.propertyType] || Building2;
              const statusCfg = STATUS_CONFIG[q.status] || STATUS_CONFIG.new;
              const propertyLabel =
                q.propertyType === "other" && q.propertyTypeCustom
                  ? q.propertyTypeCustom
                  : (PROPERTY_LABELS[q.propertyType] || q.propertyType);

              return (
                <div key={q._id} className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-green-700" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm leading-tight">{propertyLabel}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{q.city || "—"} · {q.placeSize}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Message */}
                  {q.message && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted rounded-xl p-3">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{q.message}</span>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>Submitted {formatDate(q.createdAt)}</span>
                  </div>

                  {/* Status description */}
                  {q.status === "contacted" && (
                    <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                      Our team has reached out to you. Check your phone / WhatsApp.
                    </div>
                  )}
                  {q.status === "closed" && (
                    <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                      This quote request has been closed.
                    </div>
                  )}
                </div>
              );
            })}

            {/* New quote CTA */}
            <Link
              to="/deep-cleaning-quote"
              className="flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-green-300 hover:bg-green-50 transition-colors group"
            >
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-900">Request Another Quote</p>
                <p className="text-xs text-green-700 mt-0.5">Get a free estimate for a new space</p>
              </div>
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MyQuotesPage;
