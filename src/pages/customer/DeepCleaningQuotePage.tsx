import { API_BASE_URL } from "@/lib/api";
import { Building2, CheckCircle, ChevronDown, Home, Loader2, MapPin, Phone, UtensilsCrossed, Briefcase } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const PROPERTY_TYPES = [
  { value: "villa",            label: "Villa",            icon: Home,          desc: "Independent house with garden" },
  { value: "bungalow",         label: "Bungalow",         icon: Home,          desc: "Large single-storey house" },
  { value: "restaurant",       label: "Restaurant",       icon: UtensilsCrossed, desc: "Food outlet, café or cloud kitchen" },
  { value: "corporate_office", label: "Corporate Office", icon: Building2,     desc: "Office or co-working space" },
  { value: "business",         label: "Business",         icon: Briefcase,     desc: "Shop, showroom or retail outlet" },
  { value: "other",            label: "Other",            icon: Building2,     desc: "Mention your place below" },
];

interface CityOption { city: string; }

const DeepCleaningQuotePage = () => {
  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    propertyType: "", propertyTypeCustom: "",
    placeSize: "", city: "", message: ""
  });
  const [cities, setCities] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/locations/public`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.cities) {
          setCities(data.cities.map((c: { city: string }) => ({ city: c.city })));
        }
      })
      .catch(() => {/* non-fatal */});
  }, []);

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Name is required"); return; }
    const digits = form.phone.replace(/\D/g, "").slice(-10);
    if (digits.length < 10) { setError("Enter a valid 10-digit phone number"); return; }
    if (!form.propertyType) { setError("Please select a property type"); return; }
    if (form.propertyType === "other" && !form.propertyTypeCustom.trim()) {
      setError("Please describe your property type"); return;
    }
    if (!form.city.trim()) { setError("Please select your city"); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, phone: "+91" + digits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Submission failed");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md animate-scale-in">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold font-heading text-foreground mb-3">Request Submitted!</h2>
          <p className="text-muted-foreground mb-4">
            Our team will review your request and <strong>call you within 24 hours</strong> with a custom quote.
          </p>
          <p className="text-sm text-muted-foreground bg-muted rounded-xl p-4 mb-6">
            Make sure your phone is reachable. Our team may also send details via WhatsApp.
          </p>
          <Link to="/" className="btn-brand px-8 inline-block">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden py-14 px-6 text-center" style={{ background: "var(--gradient-hero)" }}>
        <h1 className="text-3xl md:text-4xl font-bold font-heading text-primary-foreground mb-3">
          Deep Cleaning — Commercial &amp; Residential
        </h1>
        <p className="text-primary-foreground/80 max-w-xl mx-auto text-base">
          Professional deep cleaning for villas, restaurants, offices and more.
          Tell us about your space and we'll call you with a custom price.
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Property type grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-10">
          {PROPERTY_TYPES.map(pt => (
            <button
              key={pt.value}
              type="button"
              onClick={() => setForm(p => ({ ...p, propertyType: pt.value }))}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all text-center ${
                form.propertyType === pt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              <pt.icon className="w-5 h-5" />
              <span className="text-xs font-semibold leading-tight">{pt.label}</span>
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold font-heading text-foreground mb-1">Get a Free Quote</h2>
          <p className="text-sm text-muted-foreground mb-6">Fill in your details and we'll call you back with a price.</p>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Name + Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Full Name <span className="text-destructive">*</span></label>
                <input className="input-clean" placeholder="e.g. Ramesh Sharma" value={form.name} onChange={set("name")} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <Phone className="inline w-3.5 h-3.5 mr-1" />Phone Number <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">+91</span>
                  <input
                    type="tel" inputMode="numeric" maxLength={10}
                    className="input-clean pl-12" placeholder="98765 43210"
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value.replace(/\D/g, "") }))}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email Address <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input type="email" className="input-clean" placeholder="you@example.com" value={form.email} onChange={set("email")} />
            </div>

            {/* Property Type dropdown */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Property Type <span className="text-destructive">*</span></label>
              <div className="relative">
                <select className="input-clean pr-10 appearance-none" value={form.propertyType} onChange={set("propertyType")} required>
                  <option value="">-- Select property type --</option>
                  {PROPERTY_TYPES.map(pt => (
                    <option key={pt.value} value={pt.value}>{pt.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Custom property type if "other" */}
            {form.propertyType === "other" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Describe Your Place <span className="text-destructive">*</span></label>
                <input
                  className="input-clean"
                  placeholder="e.g. Warehouse, Hospital, School, Gym..."
                  value={form.propertyTypeCustom}
                  onChange={set("propertyTypeCustom")}
                  required
                />
              </div>
            )}

            {/* City + Place Size */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <MapPin className="inline w-3.5 h-3.5 mr-1" />City <span className="text-destructive">*</span>
                </label>
                {cities.length > 0 ? (
                  <div className="relative">
                    <select className="input-clean pr-10 appearance-none" value={form.city} onChange={set("city")} required>
                      <option value="">-- Select city --</option>
                      {cities.map(c => (
                        <option key={c.city} value={c.city}>{c.city}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                ) : (
                  <input className="input-clean" placeholder="e.g. Hyderabad" value={form.city} onChange={set("city")} required />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Place Size <span className="text-muted-foreground font-normal">(optional)</span></label>
                <input
                  className="input-clean"
                  placeholder="e.g. 2000 sq ft, 3 floors, 10 rooms"
                  value={form.placeSize}
                  onChange={set("placeSize")}
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Additional Details <span className="text-muted-foreground font-normal">(optional)</span></label>
              <textarea
                className="input-clean resize-none" rows={3}
                placeholder="e.g. last cleaned 6 months ago, need same-day service, have a specific area of concern..."
                value={form.message}
                onChange={set("message")}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-brand w-full mt-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
              Request Free Quote
            </button>
          </form>
        </div>

        {/* What to expect */}
        <div className="mt-8 p-5 bg-blue-50 border border-blue-200 rounded-2xl">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">What happens next?</h3>
          <ol className="space-y-2 text-sm text-blue-800">
            <li>1. Our regional team receives your request immediately</li>
            <li>2. We call you within 24 hours to discuss your requirements</li>
            <li>3. A site visit is scheduled if needed</li>
            <li>4. You receive a detailed quote — no hidden charges</li>
          </ol>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
};

export default DeepCleaningQuotePage;
