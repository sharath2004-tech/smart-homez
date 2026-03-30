import AppLayout from "@/components/AppLayout";
import { serviceCatalogAPI } from "@/lib/api";
import { motion } from "framer-motion";
import {
    ArrowRight,
    ChevronRight,
    Clock,
    Search,
    Sparkles
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

/* ─── types ─── */

interface Subcategory {
  _id?: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  pricingHint: string;
  isActive: boolean;
  sortOrder: number;
}

interface CatalogCategory {
  _id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  pricingModel: string;
  pricingHint: string;
  isActive: boolean;
  sortOrder: number;
  subcategories: Subcategory[];
  serviceCount: number;
}

interface CatalogService {
  _id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  duration: number;
  serviceType: string;
  isQuoteService?: boolean;
  catalogSubcategory?: string;
}

/* ─── color map ─── */

const COLOR_MAP: Record<string, { bg: string; border: string; badge: string; iconBg: string; gradient: string }> = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-700',       iconBg: 'bg-blue-100',    gradient: 'from-blue-500 to-blue-600' },
  green:   { bg: 'bg-green-50',   border: 'border-green-200',   badge: 'bg-green-100 text-green-700',     iconBg: 'bg-green-100',   gradient: 'from-green-500 to-green-600' },
  purple:  { bg: 'bg-purple-50',  border: 'border-purple-200',  badge: 'bg-purple-100 text-purple-700',   iconBg: 'bg-purple-100',  gradient: 'from-purple-500 to-purple-600' },
  orange:  { bg: 'bg-orange-50',  border: 'border-orange-200',  badge: 'bg-orange-100 text-orange-700',   iconBg: 'bg-orange-100',  gradient: 'from-orange-500 to-orange-600' },
  red:     { bg: 'bg-red-50',     border: 'border-red-200',     badge: 'bg-red-100 text-red-700',         iconBg: 'bg-red-100',     gradient: 'from-red-500 to-red-600' },
  cyan:    { bg: 'bg-cyan-50',    border: 'border-cyan-200',    badge: 'bg-cyan-100 text-cyan-700',       iconBg: 'bg-cyan-100',    gradient: 'from-cyan-500 to-cyan-600' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700',     iconBg: 'bg-amber-100',   gradient: 'from-amber-500 to-amber-600' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', iconBg: 'bg-emerald-100', gradient: 'from-emerald-500 to-emerald-600' },
  rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-700',       iconBg: 'bg-rose-100',    gradient: 'from-rose-500 to-rose-600' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  badge: 'bg-indigo-100 text-indigo-700',   iconBg: 'bg-indigo-100',  gradient: 'from-indigo-500 to-indigo-600' },
};

const getColor = (c: string) => COLOR_MAP[c] || COLOR_MAP.blue;

/* ─── component ─── */

const ServiceCatalogPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryServices, setCategoryServices] = useState<CatalogService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      const res = await serviceCatalogAPI.getAll({ activeOnly: true });
      setCategories(res.categories || []);
    } catch {
      console.error("Failed to load catalog");
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = async (cat: CatalogCategory) => {
    if (selectedCategoryId === cat._id) {
      setSelectedCategoryId(null);
      setCategoryServices([]);
      return;
    }
    setSelectedCategoryId(cat._id);
    setLoadingServices(true);
    try {
      const res = await serviceCatalogAPI.getById(cat._id);
      setCategoryServices(res.services || []);
    } catch {
      setCategoryServices([]);
    } finally {
      setLoadingServices(false);
    }
  };

  const handleBookService = (serviceId: string) => {
    navigate(`/customer/book/${serviceId}`);
  };

  const filteredCategories = search.trim()
    ? categories.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.description.toLowerCase().includes(search.toLowerCase()) ||
          c.subcategories.some((s) =>
            s.name.toLowerCase().includes(search.toLowerCase())
          )
      )
    : categories;

  const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`;
  const formatDuration = (mins: number) =>
    mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60 ? `${mins % 60}m` : ""}` : `${mins} min`;

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-b from-background to-accent/10">
        {/* Hero */}
        <div className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-8 md:py-12">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-2 text-xs text-primary font-medium mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Healthy Homez
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">
              Home Services at Your Doorstep
            </h1>
            <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-xl">
              Professional cleaning, maintenance &amp; more. Book instantly or subscribe for regular service.
            </p>

            {/* Search */}
            <div className="mt-5 relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-background text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none"
                placeholder="Search services..."
              />
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
          {loading ? (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-40 rounded-xl bg-accent/30 animate-pulse"
                />
              ))}
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="text-center py-16">
              <Sparkles className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="font-semibold">No services found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Try a different search term" : "Service catalog is being set up. Check back soon!"}
              </p>
            </div>
          ) : (
            <>
              {/* Category Grid */}
              <div>
                <h2 className="text-lg font-bold mb-4">All Services</h2>
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
                  {filteredCategories.map((cat, idx) => {
                    const colors = getColor(cat.color);
                    const isSelected = selectedCategoryId === cat._id;

                    return (
                      <motion.button
                        key={cat._id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => handleCategoryClick(cat)}
                        className={`text-left rounded-xl border-2 p-4 transition-all hover:shadow-md group ${
                          isSelected
                            ? `${colors.bg} ${colors.border} shadow-md ring-2 ring-primary/20`
                            : `bg-card border-border hover:${colors.border}`
                        }`}
                      >
                        {/* Icon */}
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3 ${colors.iconBg}`}
                        >
                          {cat.icon}
                        </div>

                        {/* Name */}
                        <h3 className="font-semibold text-sm leading-tight">
                          {cat.name}
                        </h3>

                        {/* Description */}
                        {cat.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {cat.description}
                          </p>
                        )}

                        {/* Pricing hint + service count */}
                        <div className="flex items-center justify-between mt-3">
                          {cat.pricingHint && (
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${colors.badge}`}
                            >
                              {cat.pricingHint}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            {cat.serviceCount} service{cat.serviceCount !== 1 && "s"}
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Expanded category → services list */}
              {selectedCategoryId && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-card border rounded-xl overflow-hidden"
                >
                  {(() => {
                    const cat = categories.find(
                      (c) => c._id === selectedCategoryId
                    );
                    if (!cat) return null;
                    const colors = getColor(cat.color);

                    return (
                      <>
                        {/* Section header */}
                        <div
                          className={`p-4 bg-gradient-to-r ${colors.gradient} text-white`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{cat.icon}</span>
                            <div>
                              <h2 className="font-bold text-lg">
                                {cat.name}
                              </h2>
                              <p className="text-white/80 text-sm">
                                {cat.description}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Subcategory pills */}
                        {cat.subcategories.length > 0 && (
                          <div className="px-4 py-3 border-b flex gap-2 overflow-x-auto">
                            {cat.subcategories
                              .filter((s) => s.isActive)
                              .sort((a, b) => a.sortOrder - b.sortOrder)
                              .map((sub) => (
                                <span
                                  key={sub.slug}
                                  className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full border font-medium ${colors.badge} ${colors.border}`}
                                >
                                  {sub.icon} {sub.name}
                                  {sub.pricingHint && (
                                    <span className="ml-1 opacity-80">
                                      · {sub.pricingHint}
                                    </span>
                                  )}
                                </span>
                              ))}
                          </div>
                        )}

                        {/* Service cards */}
                        <div className="p-4">
                          {loadingServices ? (
                            <div className="space-y-3">
                              {[1, 2, 3].map((i) => (
                                <div
                                  key={i}
                                  className="h-20 rounded-lg bg-accent/30 animate-pulse"
                                />
                              ))}
                            </div>
                          ) : categoryServices.length === 0 ? (
                            <div className="text-center py-8">
                              <p className="text-sm text-muted-foreground">
                                No services available in this category yet.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {categoryServices.map((svc) => (
                                <div
                                  key={svc._id}
                                  className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent/30 transition-colors group"
                                >
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-sm">
                                      {svc.name}
                                    </h4>
                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                      {svc.description}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1.5">
                                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="w-3 h-3" />
                                        {formatDuration(svc.duration)}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        {svc.originalPrice && svc.originalPrice > svc.price && (
                                          <span className="text-xs text-muted-foreground line-through">
                                            {formatPrice(svc.originalPrice)}
                                          </span>
                                        )}
                                        <span className="text-sm font-bold text-primary">
                                          {svc.isQuoteService
                                            ? "Get Quote"
                                            : formatPrice(svc.price)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => handleBookService(svc._id)}
                                    className={`shrink-0 px-4 py-2 text-xs font-semibold rounded-lg border-2 transition-all hover:shadow-sm ${colors.border} ${colors.badge} hover:bg-gradient-to-r hover:${colors.gradient} hover:text-white`}
                                  >
                                    {svc.isQuoteService ? "Get Quote" : "Book Now"}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </motion.div>
              )}

              {/* Quick links to existing flows */}
              <div className="border-t pt-6">
                <h2 className="text-lg font-bold mb-4">Quick Access</h2>
                <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
                  <Link
                    to="/customer/services/insta"
                    className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent/30 transition-colors group"
                  >
                    <span className="text-2xl">⚡</span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">Insta Help</h4>
                      <p className="text-xs text-muted-foreground">
                        On-demand maid service, book instantly
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>

                  <Link
                    to="/customer/services/subscription"
                    className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent/30 transition-colors group"
                  >
                    <span className="text-2xl">📅</span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">Monthly Plans</h4>
                      <p className="text-xs text-muted-foreground">
                        Daily housekeeping subscriptions
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>

                  <Link
                    to="/customer/deep-cleaning"
                    className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent/30 transition-colors group"
                  >
                    <span className="text-2xl">✨</span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">Deep Cleaning</h4>
                      <p className="text-xs text-muted-foreground">
                        Full home, kitchen, bathroom &amp; more
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default ServiceCatalogPage;
