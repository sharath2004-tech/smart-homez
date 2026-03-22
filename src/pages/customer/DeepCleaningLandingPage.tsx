import AppLayout from "@/components/AppLayout";
import { api, authAPI } from "@/lib/api";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Layers3, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    type DeepCleaningConfig,
    type UserProfile,
  getCategoryMeta,
    getCategoryAction,
    getStartingPrice
} from "./deepCleaningTemplate";

const getCategoryPriceText = (items: NonNullable<DeepCleaningConfig["items"]>) => {
  if (!items.length) return "Enter details for amount";

  if (items.every((item) => item.pricingType === "per_sqft")) {
    return "Enter area for instant amount";
  }

  const startingPrice = getStartingPrice(items);
  return startingPrice ? `From ₹${startingPrice.toLocaleString("en-IN")}` : "Enter details for amount";
};

const DeepCleaningLandingPage = () => {
  const [config, setConfig] = useState<DeepCleaningConfig | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/deep-cleaning/config"),
      authAPI.getProfile().catch(() => null),
    ])
      .then(([cfg, prof]) => {
        setConfig(cfg.config || null);
        setProfile(prof?.user || prof || null);
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () =>
      (config?.categories || [])
        .filter((category) => category.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [config]
  );

  const featuredMiniServices = useMemo(
    () =>
      (config?.items || [])
        .filter((item) => item.isActive && ["fixed", "per_unit"].includes(item.pricingType))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .slice(0, 8),
    [config]
  );

  if (loading) {
    return (
      <AppLayout userType="customer" userName={profile?.name || "Loading..."}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <motion.div
            className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="customer" userName={profile?.name || "Guest"}>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 pb-20 space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-6 md:p-8"
          style={{ background: "linear-gradient(135deg,#14532d 0%,#16a34a 45%,#86efac 100%)" }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_32%)]" />
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/90">
              <Sparkles className="w-3.5 h-3.5" /> {config?.pageContent?.heroBadge || "Professional home care"}
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold text-white">{config?.pageContent?.heroTitle || "Deep Cleaning Services"}</h1>
            <p className="mt-3 text-sm md:text-base text-white/85 max-w-2xl">
              {config?.pageContent?.heroSubtitle || "Choose the right deep cleaning service for your home, move-in, move-out, kitchen, bathroom and more."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs md:text-sm text-white/90">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><CheckCircle2 className="w-4 h-4" /> Home cleaning categories</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><Layers3 className="w-4 h-4" /> Room and mini services</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><ShieldCheck className="w-4 h-4" /> Instant amount from your inputs</span>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/customer/deep-cleaning/customize" className="btn-brand text-sm px-5 py-2.5">
                Start booking →
              </Link>
              <Link to="/deep-cleaning-quote" className="rounded-xl bg-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors">
                Request commercial quote
              </Link>
            </div>
          </div>
        </motion.section>

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-foreground">{config?.pageContent?.categoriesTitle || "Choose a deep cleaning type"}</h2>
              <p className="text-sm text-muted-foreground mt-1">{config?.pageContent?.categoriesSubtitle || "Pick a category, enter your requirements and get the final amount based on your home details."}</p>
            </div>
            <Link to="/customer/deep-cleaning/customize" className="text-sm font-semibold text-primary hover:underline">
              Open booking builder
            </Link>
          </div>

          {categories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
              No deep-cleaning categories are configured yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {categories.map((category, index) => {
                const categoryItems = (config?.items || [])
                  .filter((item) => item.isActive && item.category === category.id)
                  .sort((a, b) => a.sortOrder - b.sortOrder);
                const meta = getCategoryMeta(category);
                const action = getCategoryAction(category);
                const previewItems = categoryItems.slice(0, 3);

                return (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06 }}
                    className="rounded-3xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-3xl">{category.emoji}</div>
                        <h3 className="mt-3 text-lg font-bold text-foreground leading-tight">{category.label}</h3>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                        {meta.mode === "quote" ? "Quote" : meta.mode === "package" ? "Package" : "Custom"}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-muted-foreground min-h-[42px]">
                      {meta?.description || "Choose the right deep cleaning scope for your home and continue with booking."}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {(meta?.highlights || []).slice(0, 3).map((highlight) => (
                        <span key={highlight} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                          {highlight}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 rounded-2xl bg-muted/60 p-3">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{categoryItems.length} services configured</span>
                        <span>{getCategoryPriceText(categoryItems)}</span>
                      </div>
                      <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                        {previewItems.length > 0 ? previewItems.map((item) => (
                          <li key={item.id} className="flex items-start gap-2">
                            <span className="mt-0.5">{item.icon || category.emoji}</span>
                            <span className="line-clamp-1">{item.name}</span>
                          </li>
                        )) : <li className="text-muted-foreground">No active services yet</li>}
                      </ul>
                    </div>

                    <Link
                      to={action.href}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-95 transition-opacity"
                    >
                      {action.label} <ArrowRight className="w-4 h-4" />
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">{config?.pageContent?.miniServicesTitle || "Popular mini services"}</h2>
            <p className="text-sm text-muted-foreground mt-1">{config?.pageContent?.miniServicesSubtitle || "Add-on services for specific areas and appliances."}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {featuredMiniServices.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.05 }}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-2xl">{item.icon}</div>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                    {item.pricingType === "fixed" ? "Fixed" : "Per unit"}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground leading-tight">{item.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                <p className="mt-3 text-sm font-bold text-green-700">
                  {item.pricingType === "per_sqft"
                    ? "Enter area for amount"
                    : <>
                        ₹{item.price.toLocaleString("en-IN")}
                        {item.pricingType === "per_unit" ? <span className="text-xs font-normal text-muted-foreground"> / {item.unit}</span> : null}
                      </>}
                </p>
                <Link
                  to={`/customer/deep-cleaning/customize?category=${encodeURIComponent(item.category)}`}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Continue <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default DeepCleaningLandingPage;