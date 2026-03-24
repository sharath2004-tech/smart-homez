import AppLayout from "@/components/AppLayout";
import { api, authAPI } from "@/lib/api";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  type ConfigItem,
  type DeepCleaningCategory,
  type DeepCleaningConfig,
  type UserProfile,
  getCategoryMeta,
  getStartingPrice
} from "./deepCleaningTemplate";

const getPrimaryAction = (category: DeepCleaningCategory | null) => {
  const categoryId = category?.id || "";
  const meta = getCategoryMeta(category);
  const mode = meta.mode || "customize";

  if (mode === "package") {
    return {
      href: `/customer/deep-cleaning/customize?category=${encodeURIComponent(categoryId)}`,
      label: "Start booking",
    };
  }
  if (mode === "quote") {
    return { href: "/deep-cleaning-quote", label: meta.primaryActionLabel || "Request custom quote" };
  }
  return {
    href: `/customer/deep-cleaning/customize?category=${encodeURIComponent(categoryId)}`,
    label: meta.primaryActionLabel || "Open custom builder",
  };
};

const getSecondaryAction = (category: DeepCleaningCategory | null) => {
  const categoryId = category?.id || "";
  const meta = getCategoryMeta(category);
  const mode = meta.mode || "customize";

  if (mode === "package") {
    return {
      href: `/customer/deep-cleaning/customize?category=${encodeURIComponent(categoryId)}`,
      label: meta.secondaryActionLabel || "Prefer custom selection?",
    };
  }
  if (mode === "quote") {
    return { href: "/customer/deep-cleaning", label: meta.secondaryActionLabel || "Browse all deep-cleaning types" };
  }
  return { href: "/customer/services/deep-cleaning", label: meta.secondaryActionLabel || "See full-home packages" };
};

const getItemAction = (categoryId: string, item: ConfigItem) => {
  const href = `/customer/deep-cleaning/customize?category=${encodeURIComponent(categoryId)}&item=${encodeURIComponent(item.id)}`;

  if (item.pricingType === "per_sqft") {
    return {
      href,
      label: "Enter area & order",
    };
  }

  if (item.pricingType === "tiered") {
    return {
      href,
      label: "Choose package & order",
    };
  }

  return {
    href,
    label: "Order this service",
  };
};

const priceLabel = (item: ConfigItem) => {
  if (item.pricingType === "tiered") {
    const minTier = Math.min(...(item.tiers || []).map((tier) => tier.price).filter((price) => price > 0));
    return Number.isFinite(minTier) ? `From ₹${minTier.toLocaleString("en-IN")}` : "Custom pricing";
  }

  if (item.pricingType === "per_unit") {
    return `₹${item.price.toLocaleString("en-IN")} / ${item.unit}`;
  }

  if (item.pricingType === "per_sqft") {
    return "Enter area for instant amount";
  }

  return `₹${item.price.toLocaleString("en-IN")}`;
};

const DeepCleaningCategoryPage = () => {
  const { categoryId = "" } = useParams();
  const [config, setConfig] = useState<DeepCleaningConfig | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/deep-cleaning/config"), authAPI.getProfile().catch(() => null)])
      .then(([cfg, prof]) => {
        setConfig(cfg.config || null);
        setProfile(prof?.user || prof || null);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeCategories = useMemo(
    () =>
      (config?.categories || [])
        .filter((category) => category.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [config]
  );

  const category = useMemo(
    () => activeCategories.find((entry) => entry.id === categoryId) || null,
    [activeCategories, categoryId]
  );

  const categoryItems = useMemo(
    () =>
      (config?.items || [])
        .filter((item) => item.isActive && item.category === categoryId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [config, categoryId]
  );

  const meta = getCategoryMeta(category);
  const startingPrice = getStartingPrice(categoryItems);

  if (!loading && !category) {
    return <Navigate to="/customer/deep-cleaning" replace />;
  }

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

  const primaryAction = getPrimaryAction(category);
  const secondaryAction = getSecondaryAction(category);

  return (
    <AppLayout userType="customer" userName={profile?.name || "Guest"}>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 pb-20 space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-6 md:p-8"
          style={{ background: "linear-gradient(135deg,#064e3b 0%,#16a34a 45%,#bbf7d0 100%)" }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_30%)]" />
          <div className="relative z-10 max-w-3xl text-white">
            <Link
              to="/customer/deep-cleaning"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/15"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to all categories
            </Link>

            <div className="mt-5 flex items-center gap-3">
              <span className="text-4xl">{category?.emoji}</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/75">Deep cleaning category</p>
                <h1 className="text-3xl md:text-4xl font-bold">{category?.label}</h1>
              </div>
            </div>

            <p className="mt-4 text-sm md:text-base text-white/88 max-w-2xl">
              {meta?.headline || meta?.description || "Config-driven deep cleaning category with a focused booking flow."}
            </p>

            <div className="mt-5 flex flex-wrap gap-3 text-xs md:text-sm text-white/92">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                <ClipboardList className="h-4 w-4" /> {categoryItems.length} configured services
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                <Sparkles className="h-4 w-4" /> {categoryItems.every((item) => item.pricingType === "per_sqft") ? "Enter area for amount" : startingPrice ? `Starting from ₹${startingPrice.toLocaleString("en-IN")}` : "Custom pricing available"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                <ShieldCheck className="h-4 w-4" /> Easy home booking flow
              </span>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to={primaryAction.href} className="btn-brand px-5 py-2.5 text-sm">
                {primaryAction.label} →
              </Link>
              <Link
                to={secondaryAction.href}
                className="rounded-xl bg-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
              >
                {secondaryAction.label}
              </Link>
            </div>
          </div>
        </motion.section>

        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-6">
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">{meta?.inclusionsTitle || "What this includes"}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                See the active services in this category and start ordering directly from here.
              </p>
            </div>

            {categoryItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
                This category is live, but no active services are configured yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                  >
                    {(() => {
                      const itemAction = getItemAction(categoryId, item);

                      return (
                        <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-2xl">{item.icon || category?.emoji}</div>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                        {item.pricingType.replace("_", " ")}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-foreground">{item.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground min-h-[40px]">{item.description}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-green-700">{priceLabel(item)}</span>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                    <Link
                      to={itemAction.href}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95 transition-opacity"
                    >
                      {itemAction.label} <ArrowRight className="h-4 w-4" />
                    </Link>
                        </>
                      );
                    })()}
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-lg font-bold text-foreground">Ideal for</h2>
              <div className="mt-4 space-y-3">
                {(meta?.idealFor || []).map((entry) => (
                  <div key={entry} className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-green-100 p-1 text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-sm text-muted-foreground">{entry}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-lg font-bold text-foreground">{meta?.howItWorksTitle || "How this works"}</h2>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                {(meta?.howItWorksSteps || []).map((step, index) => (
                  <p key={`${index}-${step}`}>{index + 1}. {step}</p>
                ))}
              </div>
              <Link
                to={primaryAction.href}
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                Open full booking builder <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
};

export default DeepCleaningCategoryPage;