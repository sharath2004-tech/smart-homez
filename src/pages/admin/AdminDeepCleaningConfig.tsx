import AppLayout from "@/components/AppLayout";
import { useAdminRole } from "@/hooks/useAdminRole";
import { api } from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronDown, ChevronUp, Edit2, FileClock, Plus, RefreshCcw, Save, Send, ShieldCheck, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Tier { label: string; price: number; }
interface PageContent {
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  categoriesTitle: string;
  categoriesSubtitle: string;
  miniServicesTitle: string;
  miniServicesSubtitle: string;
}
interface ConfigItem {
  id: string; category: string; name: string; description: string;
  pricingType: "fixed" | "per_unit" | "per_sqft" | "tiered";
  price: number; tiers: Tier[]; maxQty: number; unit: string; icon: string;
  isActive: boolean; sortOrder: number;
}
interface DeepCleaningCategory {
  id: string; label: string; emoji: string; isActive: boolean; sortOrder: number;
}
interface Config { items: ConfigItem[]; minimumCartValue: number; categories?: DeepCleaningCategory[]; pageContent?: PageContent; }
interface ChangeRequestUser { name?: string; email?: string; role?: string; }
interface ChangeRequest {
  _id: string;
  title: string;
  requestNote?: string;
  reviewNote?: string;
  status: "pending" | "approved" | "rejected";
  proposedConfig: Config;
  requestedBy?: ChangeRequestUser;
  reviewedBy?: ChangeRequestUser;
  submittedAt?: string;
  reviewedAt?: string;
  createdAt?: string;
}

const FALLBACK_CATEGORIES: DeepCleaningCategory[] = [
  { id: "fullhouse",        label: "Full Home Deep Cleaning",    emoji: "🏡", isActive: true, sortOrder: 1 },
  { id: "bathroom",         label: "Bathroom Cleaning",          emoji: "🚿", isActive: true, sortOrder: 2 },
  { id: "kitchen",          label: "Kitchen Cleaning",           emoji: "🍳", isActive: true, sortOrder: 3 },
  { id: "sofa_upholstery",  label: "Sofa & Upholstery",         emoji: "🛋️", isActive: true, sortOrder: 4 },
  { id: "mattress",         label: "Mattress Cleaning",          emoji: "🛏️", isActive: true, sortOrder: 5 },
  { id: "balcony_window",   label: "Balcony & Window",           emoji: "🪟", isActive: true, sortOrder: 6 },
  { id: "move_in_out",      label: "Move-in / Move-out",         emoji: "📦", isActive: true, sortOrder: 7 },
  { id: "office",           label: "Office Deep Cleaning",       emoji: "🏢", isActive: true, sortOrder: 8 },
  { id: "post_construction",label: "Post-Construction Cleaning", emoji: "🏗️", isActive: true, sortOrder: 9 },
  { id: "appliances",       label: "Appliances",                 emoji: "💨", isActive: true, sortOrder: 10 },
  { id: "furniture",        label: "Furniture",                  emoji: "🪑", isActive: true, sortOrder: 11 },
];

const PRICING_TYPES = [
  { value: "fixed",     label: "Fixed Price" },
  { value: "per_unit",  label: "Per Unit (qty stepper)" },
  { value: "per_sqft",  label: "Per Sq Ft (area input)" },
  { value: "tiered",    label: "Tiered (pick a size/tier)" },
];

const BLANK_ITEM: ConfigItem = {
  id: "", category: "bathroom", name: "", description: "",
  pricingType: "per_unit", price: 0, tiers: [{ label: "", price: 0 }],
  maxQty: 10, unit: "unit", icon: "✨", isActive: true, sortOrder: 99,
};

const BLANK_CATEGORY: DeepCleaningCategory = {
  id: "", label: "", emoji: "✨", isActive: true, sortOrder: 99,
};

const DEFAULT_PAGE_CONTENT: PageContent = {
  heroBadge: "Professional home care",
  heroTitle: "Deep Cleaning Services",
  heroSubtitle: "Choose the right deep cleaning service for your home, move-in, move-out, kitchen, bathroom and more.",
  categoriesTitle: "Choose a deep cleaning service",
  categoriesSubtitle: "Pick a category, enter your requirements and get the final amount based on your home details.",
  miniServicesTitle: "Popular mini services",
  miniServicesSubtitle: "Add-on services for specific areas and appliances.",
};

const getSortedCategories = (categories?: DeepCleaningCategory[]) =>
  (categories?.length ? categories : FALLBACK_CATEGORIES)
    .map(category => ({ ...category }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

const getSnapshot = (items: ConfigItem[], minimumCartValue: number, categories: DeepCleaningCategory[]): Config => ({
  items,
  minimumCartValue,
  categories: getSortedCategories(categories),
  pageContent: DEFAULT_PAGE_CONTENT,
});

const statusClasses: Record<ChangeRequest["status"], string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};

export default function AdminDeepCleaningConfig() {
  const { name, role, isSuperAdmin } = useAdminRole();
  const [config, setConfig]           = useState<Config | null>(null);
  const [liveConfig, setLiveConfig]   = useState<Config | null>(null);
  const [loading, setLoading]         = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [categories, setCategories]   = useState<DeepCleaningCategory[]>([]);
  const [requests, setRequests]       = useState<ChangeRequest[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editForm, setEditForm]       = useState<ConfigItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm]         = useState<ConfigItem>({ ...BLANK_ITEM });
  const [minCart, setMinCart]         = useState(500);
  // Category management state
  const [showCatManager, setShowCatManager] = useState(false);
  const [showAddCat, setShowAddCat]   = useState(false);
  const [addCatForm, setAddCatForm]   = useState<DeepCleaningCategory>({ ...BLANK_CATEGORY });
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatForm, setEditCatForm] = useState<DeepCleaningCategory | null>(null);
  const [requestTitle, setRequestTitle] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setLoadingRequests(true);
      try {
        const [configRes, requestsRes] = await Promise.all([
          api.get("/deep-cleaning/config"),
          api.get("/deep-cleaning/change-requests").catch(() => ({ requests: [] })),
        ]);

        const initialConfig = {
          ...configRes.config,
          categories: getSortedCategories(configRes.config.categories),
          pageContent: { ...DEFAULT_PAGE_CONTENT, ...(configRes.config.pageContent || {}) },
        };

        setLiveConfig(initialConfig);
        setConfig(initialConfig);
        setMinCart(initialConfig.minimumCartValue ?? 500);
        setCategories(getSortedCategories(initialConfig.categories));
        setActiveCategory(prev => prev || (getSortedCategories(initialConfig.categories).find(c => c.isActive)?.id ?? getSortedCategories(initialConfig.categories)[0]?.id ?? ""));
        setRequests(requestsRes.requests || []);
        setHasDraftChanges(false);
      } catch (error) {
        console.error(error);
          toast.error(error instanceof Error ? error.message : "Failed to load deep-cleaning customer page");
      } finally {
        setLoading(false);
        setLoadingRequests(false);
      }
    };

    loadData();
  }, [role]);

  const applyConfigState = (nextConfig: Config, options?: { updateLive?: boolean; clearDraft?: boolean }) => {
    const normalized = {
      ...nextConfig,
      categories: getSortedCategories(nextConfig.categories),
      pageContent: { ...DEFAULT_PAGE_CONTENT, ...(nextConfig.pageContent || {}) },
    };

    setConfig(normalized);
    setMinCart(normalized.minimumCartValue ?? 500);

    const nextCategories = getSortedCategories(normalized.categories);
    setCategories(nextCategories);
    setActiveCategory(prev => nextCategories.some(category => category.id === prev)
      ? prev
      : nextCategories.find(category => category.isActive)?.id ?? nextCategories[0]?.id ?? "");

    if (options?.updateLive) {
      setLiveConfig(normalized);
    }
    if (options?.clearDraft) {
      setHasDraftChanges(false);
    }
  };

  const refreshRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await api.get("/deep-cleaning/change-requests");
      setRequests(res.requests || []);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to refresh change requests");
    } finally {
      setLoadingRequests(false);
    }
  };

  const saveAll = async (nextItems: ConfigItem[], nextMin = minCart, nextCats = categories) => {
    const snapshot = {
      ...getSnapshot(nextItems, nextMin, nextCats),
      pageContent: config?.pageContent || DEFAULT_PAGE_CONTENT,
    };

    if (!isSuperAdmin) {
      applyConfigState(snapshot);
      setHasDraftChanges(true);
      return;
    }

    setSaving(true);
    try {
      const res = await api.put("/deep-cleaning/config", snapshot);
      applyConfigState(res.config, { updateLive: true, clearDraft: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success("Deep-cleaning customer page published");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to save customer page");
    }
    finally { setSaving(false); }
  };

  const resetDraftToLive = () => {
    if (!liveConfig) return;
    applyConfigState(liveConfig, { clearDraft: true });
    setRequestTitle("");
    setRequestNote("");
    toast.success("Draft reset to live configuration");
  };

  const submitChangeRequest = async () => {
    if (!config) return;

    const title = requestTitle.trim() || `Deep cleaning page update · ${new Date().toLocaleDateString("en-IN")}`;

    setSubmittingRequest(true);
    try {
      await api.post("/deep-cleaning/change-requests", {
        title,
        requestNote,
        proposedConfig: {
          ...getSnapshot(config.items, minCart, categories),
          pageContent: config.pageContent || DEFAULT_PAGE_CONTENT,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setHasDraftChanges(false);
      setRequestTitle("");
      setRequestNote("");
      await refreshRequests();
      toast.success("Change request submitted for super-admin review");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to submit change request");
    } finally {
      setSubmittingRequest(false);
    }
  };

  const reviewRequest = async (id: string, status: "approved" | "rejected") => {
    setSaving(true);
    try {
      const res = await api.post(`/deep-cleaning/change-requests/${id}/review`, {
        status,
        reviewNote,
      });

      if (status === "approved" && res.config) {
        applyConfigState(res.config, { updateLive: true, clearDraft: true });
      }

      setReviewingId(null);
      setReviewNote("");
      await refreshRequests();
      toast.success(`Request ${status}`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : `Failed to ${status} request`);
    } finally {
      setSaving(false);
    }
  };

  // ── Items ──────────────────────────────────────────────────────────────────
  const toggleActive = (id: string) => {
    if (!config) return;
    const next = config.items.map(i => i.id === id ? { ...i, isActive: !i.isActive } : i);
    saveAll(next);
  };

  const deleteItem = (id: string) => {
    if (!config || !confirm("Delete this item?")) return;
    saveAll(config.items.filter(i => i.id !== id));
  };

  const startEdit = (item: ConfigItem) => {
    setEditingId(item.id);
    setEditForm({ ...item, tiers: item.tiers?.length ? [...item.tiers.map(t => ({ ...t }))] : [{ label: "", price: 0 }] });
  };

  const saveEdit = () => {
    if (!config || !editForm) return;
    const id = editForm.id.trim() || editForm.name.toLowerCase().replace(/\s+/g, "_");
    const updated = { ...editForm, id };
    const next = config.items.map(i => i.id === editingId ? updated : i);
    saveAll(next);
    setEditingId(null); setEditForm(null);
  };

  const addItem = () => {
    if (!config || !addForm.name.trim()) return;
    const id = addForm.id.trim() || addForm.name.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now();
    const newItem = { ...addForm, id };
    saveAll([...config.items, newItem]);
    setShowAddForm(false);
    setAddForm({ ...BLANK_ITEM });
  };

  const moveItem = (id: string, dir: -1 | 1) => {
    if (!config) return;
    const items = [...config.items];
    const idx = items.findIndex(i => i.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];
    items[idx].sortOrder   = idx;
    items[swapIdx].sortOrder = swapIdx;
    saveAll(items);
  };

  // ── Categories ─────────────────────────────────────────────────────────────
  const toggleCategory = (id: string) => {
    const next = categories.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c);
    setCategories(next);
    saveAll(config?.items ?? [], minCart, next);
  };

  const deleteCategory = (id: string) => {
    if (!confirm("Delete this category? Items in this category will no longer appear in the customer view.")) return;
    const next = categories.filter(c => c.id !== id);
    setCategories(next);
    if (activeCategory === id) setActiveCategory(next.find(c => c.isActive)?.id ?? next[0]?.id ?? "");
    saveAll(config?.items ?? [], minCart, next);
  };

  const moveCategory = (id: string, dir: -1 | 1) => {
    const arr = [...categories];
    const idx = arr.findIndex(c => c.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= arr.length) return;
    [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
    arr[idx].sortOrder   = idx + 1;
    arr[swapIdx].sortOrder = swapIdx + 1;
    setCategories(arr);
    saveAll(config?.items ?? [], minCart, arr);
  };

  const addCategory = () => {
    if (!addCatForm.label.trim()) return;
    const id = addCatForm.id.trim() || addCatForm.label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (categories.some(c => c.id === id)) { toast.error("A category with this ID already exists."); return; }
    const next = [...categories, { ...addCatForm, id, sortOrder: categories.length + 1 }];
    setCategories(next);
    saveAll(config?.items ?? [], minCart, next);
    setShowAddCat(false);
    setAddCatForm({ ...BLANK_CATEGORY });
  };

  const saveCategoryEdit = () => {
    if (!editCatForm) return;
    const next = categories.map(c => c.id === editingCatId ? { ...editCatForm } : c);
    setCategories(next);
    saveAll(config?.items ?? [], minCart, next);
    setEditingCatId(null); setEditCatForm(null);
  };

  const catItems = (config?.items ?? []).filter(i => i.category === activeCategory)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const updatePageContent = (field: keyof PageContent, value: string) => {
    if (!config) return;

    const nextConfig: Config = {
      ...config,
      pageContent: {
        ...(config.pageContent || DEFAULT_PAGE_CONTENT),
        [field]: value,
      },
    };

    applyConfigState(nextConfig);
    if (!isSuperAdmin) {
      setHasDraftChanges(true);
    }
  };

  const activeCatLabel = categories.find(c => c.id === activeCategory)?.label ?? activeCategory;
  const pendingRequestCount = useMemo(() => requests.filter(req => req.status === "pending").length, [requests]);

  if (loading) return (
    <AppLayout userType={role} userName={name}>
      <div className="flex items-center justify-center py-24">
        <motion.div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full"
          animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }} />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout userType={role} userName={name}>
      <div className="max-w-3xl mx-auto px-3 sm:px-4 md:px-6 pb-12 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Deep Cleaning Customer Page</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isSuperAdmin
                ? "Publish the live customer page, categories and pricing rules"
                : "Edit the customer page draft and submit it for super-admin approval"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${isSuperAdmin ? "bg-primary/10 text-primary border-primary/20" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
              {isSuperAdmin ? "Super Admin · Live Publish" : "Admin · Request Mode"}
            </span>
            {pendingRequestCount > 0 && (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full border bg-amber-100 text-amber-800 border-amber-200">
                {pendingRequestCount} pending request{pendingRequestCount !== 1 ? "s" : ""}
              </span>
            )}
            <AnimatePresence>
              {saved && (
                <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="text-sm text-green-700 bg-green-100 border border-green-300 px-3 py-1.5 rounded-full font-medium">
                  {isSuperAdmin ? "✓ Published" : "✓ Request sent"}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {!isSuperAdmin && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-4">
            <div className="flex items-start gap-3">
              <FileClock className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-amber-900">Draft change request</h2>
                <p className="text-sm text-amber-800 mt-1">
                  Your edits stay local until you submit them. A super admin can then approve and publish the proposed customer page snapshot.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label-clean">Request title</label>
                <input
                  value={requestTitle}
                  onChange={e => setRequestTitle(e.target.value)}
                  className="input-clean text-sm"
                  placeholder="e.g. Add move-out detail services"
                />
              </div>
              <div>
                <label className="label-clean">Draft status</label>
                <div className="input-clean text-sm flex items-center justify-between">
                  <span>{hasDraftChanges ? "Unsaved draft changes ready" : "Draft matches last submitted/live state"}</span>
                  {hasDraftChanges ? <CheckCircle2 className="w-4 h-4 text-amber-600" /> : <ShieldCheck className="w-4 h-4 text-green-600" />}
                </div>
              </div>
            </div>

            <div>
              <label className="label-clean">Request note (optional)</label>
              <textarea
                value={requestNote}
                onChange={e => setRequestNote(e.target.value)}
                rows={3}
                className="input-clean min-h-[88px] text-sm"
                placeholder="Summarize what changed and why it should be published"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={submitChangeRequest}
                disabled={submittingRequest || !config}
                className="flex items-center justify-center gap-2 text-sm font-semibold bg-primary text-primary-foreground px-4 py-2.5 rounded-xl disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> {submittingRequest ? "Submitting..." : "Submit change request"}
              </motion.button>
              <button
                onClick={resetDraftToLive}
                disabled={!liveConfig}
                className="flex items-center justify-center gap-2 text-sm font-semibold bg-muted text-muted-foreground px-4 py-2.5 rounded-xl hover:bg-border disabled:opacity-50"
              >
                <RefreshCcw className="w-4 h-4" /> Reset to live config
              </button>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-foreground">{isSuperAdmin ? "Change requests" : "My submitted requests"}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isSuperAdmin ? "Approve or reject pending admin customer-page proposals." : "Track review status for your customer-page proposals."}
              </p>
            </div>
            <button
              onClick={refreshRequests}
              disabled={loadingRequests}
              className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
            >
              {loadingRequests ? "Refreshing..." : "Refresh requests"}
            </button>
          </div>

          {requests.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed border-border rounded-xl p-4 text-center">
              No change requests yet.
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request._id} className="border border-border rounded-2xl p-4 bg-muted/20 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground">{request.title}</h3>
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${statusClasses[request.status]}`}>
                          {request.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        By {request.requestedBy?.name || "Admin"}
                        {request.createdAt || request.submittedAt ? ` · ${new Date(request.createdAt || request.submittedAt || "").toLocaleString("en-IN")}` : ""}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      <div>{request.proposedConfig.categories?.length || 0} categories</div>
                      <div>{request.proposedConfig.items?.length || 0} items</div>
                      <div>Min cart ₹{request.proposedConfig.minimumCartValue ?? 0}</div>
                    </div>
                  </div>

                  {request.requestNote && (
                    <div className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-3">
                      {request.requestNote}
                    </div>
                  )}

                  {request.reviewNote && (
                    <div className="text-xs text-muted-foreground bg-card border border-border rounded-xl p-3">
                      <span className="font-semibold text-foreground">Review note:</span> {request.reviewNote}
                    </div>
                  )}

                  {isSuperAdmin && request.status === "pending" && (
                    <div className="space-y-2">
                      {reviewingId === request._id ? (
                        <>
                          <textarea
                            value={reviewNote}
                            onChange={e => setReviewNote(e.target.value)}
                            rows={3}
                            className="input-clean min-h-[84px] text-sm"
                            placeholder="Optional note for the admin"
                          />
                          <div className="flex flex-col sm:flex-row gap-2">
                            <motion.button whileTap={{ scale: 0.97 }} onClick={() => reviewRequest(request._id, "approved")}
                              disabled={saving}
                              className="text-sm font-semibold bg-green-600 text-white px-4 py-2 rounded-xl disabled:opacity-50">
                              Approve & publish
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.97 }} onClick={() => reviewRequest(request._id, "rejected")}
                              disabled={saving}
                              className="text-sm font-semibold bg-red-600 text-white px-4 py-2 rounded-xl disabled:opacity-50">
                              Reject request
                            </motion.button>
                            <button onClick={() => { setReviewingId(null); setReviewNote(""); }}
                              className="text-sm font-semibold bg-muted text-muted-foreground px-4 py-2 rounded-xl hover:bg-border">
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <button onClick={() => { setReviewingId(request._id); setReviewNote(request.reviewNote || ""); }}
                          className="text-sm font-semibold text-primary hover:underline">
                          Review request
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Customer page content</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Edit the copy shown on `/customer/deep-cleaning`.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label-clean">Hero badge</label>
              <input value={config?.pageContent?.heroBadge || ""} onChange={e => updatePageContent("heroBadge", e.target.value)} className="input-clean text-sm" />
            </div>
            <div>
              <label className="label-clean">Hero title</label>
              <input value={config?.pageContent?.heroTitle || ""} onChange={e => updatePageContent("heroTitle", e.target.value)} className="input-clean text-sm" />
            </div>
          </div>

          <div>
            <label className="label-clean">Hero subtitle</label>
            <textarea value={config?.pageContent?.heroSubtitle || ""} onChange={e => updatePageContent("heroSubtitle", e.target.value)} rows={3} className="input-clean min-h-[84px] text-sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label-clean">Categories title</label>
              <input value={config?.pageContent?.categoriesTitle || ""} onChange={e => updatePageContent("categoriesTitle", e.target.value)} className="input-clean text-sm" />
            </div>
            <div>
              <label className="label-clean">Mini services title</label>
              <input value={config?.pageContent?.miniServicesTitle || ""} onChange={e => updatePageContent("miniServicesTitle", e.target.value)} className="input-clean text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label-clean">Categories subtitle</label>
              <textarea value={config?.pageContent?.categoriesSubtitle || ""} onChange={e => updatePageContent("categoriesSubtitle", e.target.value)} rows={3} className="input-clean min-h-[84px] text-sm" />
            </div>
            <div>
              <label className="label-clean">Mini services subtitle</label>
              <textarea value={config?.pageContent?.miniServicesSubtitle || ""} onChange={e => updatePageContent("miniServicesSubtitle", e.target.value)} rows={3} className="input-clean min-h-[84px] text-sm" />
            </div>
          </div>
        </div>

        {/* Min cart value */}
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 flex-wrap">
          <label className="text-sm font-semibold text-foreground shrink-0">Minimum Cart Value (₹)</label>
          <input type="number" min="0" value={minCart}
            onChange={e => { setMinCart(Number(e.target.value)); if (!isSuperAdmin) setHasDraftChanges(true); }}
            className="input-clean w-36 text-sm" />
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => saveAll(config?.items ?? [], minCart)}
            disabled={saving}
            className="text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-xl disabled:opacity-50">
            {saving ? "Saving..." : isSuperAdmin ? "Publish" : "Save in draft"}
          </motion.button>
        </div>

        {/* ── Category Manager ───────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowCatManager(v => !v)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🗂️</span>
              <span className="font-semibold text-foreground text-sm">Manage Categories</span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {categories.filter(c => c.isActive).length} active / {categories.length} total
              </span>
            </div>
            <motion.div animate={{ rotate: showCatManager ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showCatManager && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="overflow-hidden border-t border-border"
              >
                <div className="p-4 space-y-2">
                  {categories.map((cat, idx) => (
                    <div key={cat.id} className={`border rounded-xl overflow-hidden transition-colors ${cat.isActive ? "border-border bg-card" : "border-dashed border-muted-foreground/30 bg-muted/30"}`}>
                      <div className="flex items-center gap-2 p-3">
                        <span className="text-xl w-8 text-center">{cat.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${cat.isActive ? "text-foreground" : "text-muted-foreground line-through"}`}>
                            {cat.label}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">{cat.id}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Active toggle */}
                          <button onClick={() => toggleCategory(cat.id)}
                            className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
                              cat.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                            }`}>
                            {cat.isActive ? "On" : "Off"}
                          </button>
                          {/* Reorder */}
                          <button onClick={() => moveCategory(cat.id, -1)} disabled={idx === 0}
                            className="p-1 hover:bg-muted rounded-lg disabled:opacity-30">
                            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => moveCategory(cat.id, 1)} disabled={idx === categories.length - 1}
                            className="p-1 hover:bg-muted rounded-lg disabled:opacity-30">
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          {/* Edit */}
                          <button
                            onClick={() => {
                              if (editingCatId === cat.id) { setEditingCatId(null); setEditCatForm(null); }
                              else { setEditingCatId(cat.id); setEditCatForm({ ...cat }); }
                            }}
                            className="p-1.5 hover:bg-muted rounded-xl transition-colors">
                            <Edit2 className="w-3.5 h-3.5 text-primary" />
                          </button>
                          {/* Delete */}
                          <button onClick={() => deleteCategory(cat.id)}
                            className="p-1.5 hover:bg-red-50 rounded-xl transition-colors">
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                      </div>

                      {/* Inline edit for category */}
                      <AnimatePresence>
                        {editingCatId === cat.id && editCatForm && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-border bg-muted/40 p-3 overflow-hidden"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
                              <div>
                                <label className="label-clean">Emoji</label>
                                <input value={editCatForm.emoji}
                                  onChange={e => setEditCatForm(f => f ? { ...f, emoji: e.target.value } : f)}
                                  className="input-clean text-sm" maxLength={4} />
                              </div>
                              <div className="col-span-2">
                                <label className="label-clean">Label</label>
                                <input value={editCatForm.label}
                                  onChange={e => setEditCatForm(f => f ? { ...f, label: e.target.value } : f)}
                                  className="input-clean text-sm" placeholder="Display name" />
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <motion.button whileTap={{ scale: 0.95 }} onClick={saveCategoryEdit}
                                disabled={saving}
                                className="flex items-center gap-1 text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-xl disabled:opacity-50">
                                <Save className="w-3 h-3" /> Save
                              </motion.button>
                              <button onClick={() => { setEditingCatId(null); setEditCatForm(null); }}
                                className="text-xs px-3 py-1.5 bg-muted rounded-xl hover:bg-border text-muted-foreground">
                                Cancel
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}

                  {/* Add Category form */}
                  {!showAddCat ? (
                    <motion.button whileTap={{ scale: 0.96 }}
                      onClick={() => { setAddCatForm({ ...BLANK_CATEGORY }); setShowAddCat(true); }}
                      className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-primary/40 text-primary text-sm font-semibold py-2.5 rounded-xl hover:bg-primary/5 transition-colors">
                      <Plus className="w-4 h-4" /> Add Category
                    </motion.button>
                  ) : (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="border-2 border-primary/30 rounded-xl p-4 bg-card">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-foreground text-sm">New Category</h4>
                        <button onClick={() => setShowAddCat(false)} className="p-1 hover:bg-muted rounded-lg">
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
                        <div>
                          <label className="label-clean">Emoji</label>
                          <input value={addCatForm.emoji}
                            onChange={e => setAddCatForm(f => ({ ...f, emoji: e.target.value }))}
                            className="input-clean text-sm" maxLength={4} placeholder="✨" />
                        </div>
                        <div className="col-span-2">
                          <label className="label-clean">Label *</label>
                          <input value={addCatForm.label}
                            onChange={e => setAddCatForm(f => ({ ...f, label: e.target.value }))}
                            className="input-clean text-sm" placeholder="Display name" />
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="label-clean">ID (optional — auto-generated from label)</label>
                        <input value={addCatForm.id}
                          onChange={e => setAddCatForm(f => ({ ...f, id: e.target.value }))}
                          className="input-clean text-sm font-mono" placeholder="e.g. pest_control" />
                      </div>
                      <div className="flex gap-2">
                        <motion.button whileTap={{ scale: 0.95 }} onClick={addCategory}
                          disabled={saving || !addCatForm.label.trim()}
                          className="flex items-center gap-1.5 text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-xl disabled:opacity-50">
                          <Plus className="w-4 h-4" /> Add
                        </motion.button>
                        <button onClick={() => setShowAddCat(false)}
                          className="text-sm px-4 py-2 bg-muted rounded-xl hover:bg-border text-muted-foreground">
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Category tabs (for items view) */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-border"
              } ${!cat.isActive ? "opacity-50" : ""}`}>
              <span>{cat.emoji}</span><span>{cat.label}</span>
              <span className="ml-1 opacity-60 text-xs">
                ({(config?.items ?? []).filter(i => i.category === cat.id).length})
              </span>
            </button>
          ))}
        </div>

        {/* Items list */}
        <div className="space-y-3">
          <AnimatePresence>
            {catItems.map((item, idx) => (
              <motion.div key={item.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12, scale: 0.96 }}
                transition={{ delay: idx * 0.05 }}
                className={`border rounded-2xl overflow-hidden bg-card transition-colors ${
                  !item.isActive ? "opacity-50 border-dashed" : "border-border"
                }`}
              >
                {/* Collapsed view */}
                <div className="flex items-center gap-3 p-4">
                  <span className="text-2xl">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-2 break-words">{item.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.pricingType === "tiered"
                        ? item.tiers?.map(t => `${t.label}: ₹${t.price}`).join(" · ")
                        : item.pricingType === "per_sqft"
                          ? `₹${item.price}/sqft`
                          : `₹${item.price}${item.pricingType === "per_unit" ? ` / ${item.unit}` : ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Active toggle */}
                    <button onClick={() => toggleActive(item.id)}
                      className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
                        item.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                      }`}>
                      {item.isActive ? "On" : "Off"}
                    </button>
                    {/* Sort */}
                    <button onClick={() => moveItem(item.id, -1)} className="p-1 hover:bg-muted rounded-lg">
                      <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => moveItem(item.id, 1)} className="p-1 hover:bg-muted rounded-lg">
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    {/* Edit */}
                    <button onClick={() => editingId === item.id ? (setEditingId(null), setEditForm(null)) : startEdit(item)}
                      className="p-1.5 hover:bg-muted rounded-xl transition-colors">
                      <Edit2 className="w-4 h-4 text-primary" />
                    </button>
                    {/* Delete */}
                    <button onClick={() => deleteItem(item.id)}
                      className="p-1.5 hover:bg-red-50 rounded-xl transition-colors">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Inline edit panel */}
                <AnimatePresence>
                  {editingId === item.id && editForm && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 28 }}
                      className="border-t border-border bg-muted/40 p-4 overflow-hidden"
                    >
                      <ItemEditForm form={editForm} onChange={setEditForm} categoryOptions={categories} />
                      <div className="flex flex-col sm:flex-row gap-2 mt-4">
                        <motion.button whileTap={{ scale: 0.95 }} onClick={saveEdit}
                          disabled={saving}
                          className="flex items-center gap-1.5 text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-xl disabled:opacity-50">
                          <Save className="w-4 h-4" /> Save
                        </motion.button>
                        <button onClick={() => { setEditingId(null); setEditForm(null); }}
                          className="text-sm px-4 py-2 bg-muted rounded-xl hover:bg-border text-muted-foreground">
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>

          {catItems.length === 0 && (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
              <p className="text-3xl mb-2">➕</p>
              <p className="text-sm">No items in {activeCatLabel}</p>
              <p className="text-xs mt-1">Click "Add Item" to add one</p>
            </div>
          )}
        </div>

        {/* Add item */}
        <div>
          {!showAddForm ? (
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => { setAddForm({ ...BLANK_ITEM, category: activeCategory }); setShowAddForm(true); }}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-primary/40 text-primary text-sm font-semibold py-3 rounded-2xl hover:bg-primary/5 transition-colors">
              <Plus className="w-4 h-4" /> Add Item to {activeCatLabel}
            </motion.button>
          ) : (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="border-2 border-primary/30 rounded-2xl p-5 bg-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">New Item</h3>
                <button onClick={() => setShowAddForm(false)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <ItemEditForm form={addForm} onChange={setAddForm} categoryOptions={categories} />
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <motion.button whileTap={{ scale: 0.95 }} onClick={addItem}
                  disabled={saving || !addForm.name.trim()}
                  className="flex items-center gap-1.5 text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-xl disabled:opacity-50">
                  <Plus className="w-4 h-4" /> Add Item
                </motion.button>
                <button onClick={() => setShowAddForm(false)}
                  className="text-sm px-4 py-2 bg-muted rounded-xl hover:bg-border text-muted-foreground">
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Shared form for editing / adding an item ─────────────────────────────────
function ItemEditForm({
  form, onChange, categoryOptions,
}: {
  form: ConfigItem;
  onChange: (f: ConfigItem) => void;
  categoryOptions: DeepCleaningCategory[];
}) {
  const set = (field: keyof ConfigItem, value: unknown) => onChange({ ...form, [field]: value });

  const updateTier = (ti: number, field: keyof Tier, value: string | number) => {
    const tiers = form.tiers.map((t, i) => i === ti ? { ...t, [field]: field === "price" ? Number(value) : value } : t);
    set("tiers", tiers);
  };
  const addTier    = () => set("tiers", [...(form.tiers ?? []), { label: "", price: 0 }]);
  const deleteTier = (ti: number) => set("tiers", (form.tiers ?? []).filter((_, i) => i !== ti));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label-clean">Name *</label>
          <input value={form.name} onChange={e => set("name", e.target.value)} className="input-clean text-sm" placeholder="Service name" />
        </div>
        <div>
          <label className="label-clean">Icon (emoji)</label>
          <input value={form.icon} onChange={e => set("icon", e.target.value)} className="input-clean text-sm" placeholder="✨" />
        </div>
      </div>
      <div>
        <label className="label-clean">Description</label>
        <input value={form.description} onChange={e => set("description", e.target.value)} className="input-clean text-sm" placeholder="What's included..." />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label-clean">Category</label>
          <select value={form.category} onChange={e => set("category", e.target.value)} className="input-clean text-sm">
            {categoryOptions.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label-clean">Pricing Type</label>
          <select value={form.pricingType} onChange={e => set("pricingType", e.target.value as ConfigItem["pricingType"])} className="input-clean text-sm">
            {PRICING_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* Price field (for non-tiered) */}
      {form.pricingType !== "tiered" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label-clean">
              {form.pricingType === "per_sqft" ? "Price per sq ft (₹)" : "Price (₹)"}
            </label>
            <input type="number" min="0" value={form.price} onChange={e => set("price", Number(e.target.value))} className="input-clean text-sm" />
          </div>
          {form.pricingType === "per_unit" && (
            <div>
              <label className="label-clean">Unit label</label>
              <input value={form.unit} onChange={e => set("unit", e.target.value)} className="input-clean text-sm" placeholder="bathroom, fan..." />
            </div>
          )}
          {form.pricingType === "per_unit" && (
            <div>
              <label className="label-clean">Max qty</label>
              <input type="number" min="1" max="50" value={form.maxQty} onChange={e => set("maxQty", Number(e.target.value))} className="input-clean text-sm" />
            </div>
          )}
        </div>
      )}

      {/* Tiers editor */}
      {form.pricingType === "tiered" && (
        <div>
          <label className="label-clean">Tiers (e.g. 2 BHK → ₹2600)</label>
          <div className="space-y-2 mt-1">
            {(form.tiers ?? []).map((tier, ti) => (
              <div key={ti} className="flex gap-2 items-center">
                <input value={tier.label} placeholder="Label (2 BHK, L-Shape...)"
                  onChange={e => updateTier(ti, "label", e.target.value)}
                  className="input-clean flex-1 text-sm py-1.5 h-9" />
                <input type="number" min="0" value={tier.price} placeholder="₹"
                  onChange={e => updateTier(ti, "price", e.target.value)}
                  className="input-clean w-24 text-sm py-1.5 h-9" />
                <button onClick={() => deleteTier(ti)} className="p-1.5 hover:bg-red-50 rounded-lg">
                  <X className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))}
            <button onClick={addTier}
              className="text-xs text-primary font-medium flex items-center gap-1 hover:underline mt-1">
              <Plus className="w-3 h-3" /> Add tier
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
