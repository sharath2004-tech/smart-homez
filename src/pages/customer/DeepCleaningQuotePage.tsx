import { API_BASE_URL } from "@/lib/api";
import { Building2, CheckCircle, ChevronDown, Home, Loader2, Phone, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const PROPERTY_TYPES = [
  { value: "villa",            label: "Villa",            icon: Home,           desc: "Independent house / bungalow with garden" },
  { value: "bungalow",         label: "Bungalow",         icon: Home,           desc: "Large single-storey independent house" },
  { value: "restaurant",       label: "Restaurant",       icon: UtensilsCrossed, desc: "Food service outlet, café or cloud kitchen" },
  { value: "corporate_office", label: "Corporate Office", icon: Building2,      desc: "Office space, co-working or business premises" },
];

const DeepCleaningQuotePage = () => {
  const [form, setForm] = useState({ name: "", phone: "", email: "", propertyType: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Name is required"); return; }
    const digits = form.phone.replace(/\D/g, "").slice(-10);
    if (digits.length < 10) { setError("Enter a valid 10-digit phone number"); return; }
    if (!form.propertyType) { setError("Please select a property type"); return; }

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
          Professional deep cleaning for villas, bungalows, restaurants, and offices.
          Pricing is tailored to your property — get a free custom quote.
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* What's covered */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          {PROPERTY_TYPES.map(pt => (
            <div key={pt.value} className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-2xl text-center">
              <pt.icon className="w-6 h-6 text-primary" />
              <span className="text-sm font-semibold text-foreground">{pt.label}</span>
              <span className="text-xs text-muted-foreground leading-tight">{pt.desc}</span>
            </div>
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
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    className="input-clean pl-12"
                    placeholder="98765 43210"
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value.replace(/\D/g, "") }))}
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email Address <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input type="email" className="input-clean" placeholder="you@example.com" value={form.email} onChange={set("email")} />
            </div>

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

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Additional Details <span className="text-muted-foreground font-normal">(optional)</span></label>
              <textarea
                className="input-clean resize-none"
                rows={3}
                placeholder="e.g. 3 BHK villa, approx 2000 sq ft, last cleaned 6 months ago..."
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
            <li>1. We review your request within a few hours</li>
            <li>2. Our team calls you to understand your requirements</li>
            <li>3. We schedule a site visit if needed</li>
            <li>4. You receive a detailed quote with no hidden charges</li>
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
