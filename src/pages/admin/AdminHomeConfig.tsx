import AppLayout from "@/components/AppLayout";
import { useAdminRole } from "@/hooks/useAdminRole";
import { api, servicesAPI } from "@/lib/api";
import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    ChevronDown,
    ChevronRight,
    Edit,
    Eye,
    EyeOff,
    Grid3x3,
    Home,
    Loader2,
    Plus,
    Save,
    Trash2,
    X
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceFilter {
  serviceTypes: string[];
  serviceCategories: string[];
  namePatterns: string[];
  excludeServiceTypes: string[];
  showAll: boolean;
}

interface BannerConfig {
  link: string;
  gradient: string;
  borderColor: string;
  ctaText: string;
}

interface HomeSection {
  sectionId: string;
  title: string;
  description: string;
  emoji: string;
  type: "service_grid" | "promo_banner" | "featured_list" | "category_strip";
  serviceFilter: ServiceFilter;
  bannerConfig: BannerConfig;
  maxItems: number;
  badgeText: string;
  sortOrder: number;
  isActive: boolean;
}

interface ServiceOption {
  _id: string;
  name: string;
  serviceType?: string;
  serviceCategory?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTION_TYPES = [
  { value: "service_grid", label: "Service Grid", desc: "Grid of bookable service cards", icon: "⊞" },
  { value: "featured_list", label: "Featured List", desc: "Horizontal scroll of highlighted services", icon: "★" },
  { value: "promo_banner", label: "Promo Banner", desc: "Full-width promotional banner with CTA", icon: "📢" },
  { value: "category_strip", label: "Category Strip", desc: "Quick-tap category buttons", icon: "🏷️" },
];

const SERVICE_TYPE_OPTIONS = [
  "instant_hourly", "monthly_subscription", "deep_cleaning_full_house", "deep_cleaning_room",
  "deep_cleaning_kitchen", "deep_cleaning_bathroom", "fixed_washroom_basic", "fixed_washroom_deep",
  "fixed_fan_cleaning", "fixed_window_cleaning", "fixed_sofa_cleaning", "fixed_carpet_cleaning",
  "fixed_fridge_cleaning", "fixed_balcony_cleaning", "fixed_microwave_cleaning", "fixed_oven_cleaning",
  "fixed_stove_cleaning", "fixed_chimney_cleaning", "fixed_kitchen_platform_cleaning", "fixed_sink_cleaning",
  "kitchen_appliances_package", "fixed_washbasin_cleaning", "fixed_window_mesh_cleaning",
  "fixed_dining_cleaning", "fixed_cabinet_cleaning", "fixed_utility_cleaning", "fixed_cupboard_cleaning",
  "bedroom_package", "fixed_bed_cleaning", "fixed_mirror_cleaning", "fixed_ac_indoor_cleaning",
  "fixed_ac_outdoor_cleaning", "fixed_door_cleaning"
];

const SERVICE_CATEGORY_OPTIONS = [
  "instant_services", "subscription_services", "deep_cleaning", "spot_cleaning",
  "kitchen_services", "bathroom_services", "furniture_services", "hvac_services", "other"
];

const BANNER_GRADIENTS = [
  { value: "from-teal-50 to-green-50", label: "Teal → Green" },
  { value: "from-blue-50 to-indigo-50", label: "Blue → Indigo" },
  { value: "from-amber-50 to-orange-50", label: "Amber → Orange" },
  { value: "from-rose-50 to-pink-50", label: "Rose → Pink" },
  { value: "from-green-50 to-emerald-50", label: "Green → Emerald" },
  { value: "from-purple-50 to-violet-50", label: "Purple → Violet" },
];

const emptySection = (): Omit<HomeSection, "sectionId" | "sortOrder"> => ({
  title: "",
  description: "",
  emoji: "🏠",
  type: "service_grid",
  serviceFilter: {
    serviceTypes: [],
    serviceCategories: [],
    namePatterns: [],
    excludeServiceTypes: [],
    showAll: false
  },
  bannerConfig: {
    link: "",
    gradient: "from-teal-50 to-green-50",
    borderColor: "border-teal-300",
    ctaText: "Book Now"
  },
  maxItems: 6,
  badgeText: "",
  isActive: true
});

// ─── Multi-select chip component ──────────────────────────────────────────────

function ChipSelect({
  label,
  options,
  selected,
  onChange
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white hover:border-gray-300 transition-colors"
      >
        <span className="text-gray-700 truncate">
          {selected.length === 0 ? "None selected" : `${selected.length} selected`}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
              {v}
              <button type="button" onClick={() => onChange(selected.filter((s) => s !== v))}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(
                  selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]
                );
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors flex items-center gap-2 ${selected.includes(opt) ? "text-teal-700 font-semibold" : "text-gray-700"}`}
            >
              <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${selected.includes(opt) ? "bg-teal-500 border-teal-500 text-white" : "border-gray-300"}`}>
                {selected.includes(opt) && "✓"}
              </span>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section Form ─────────────────────────────────────────────────────────────

function SectionForm({
  initial,
  onSave,
  onCancel,
  saving
}: {
  initial: Omit<HomeSection, "sectionId" | "sortOrder">;
  onSave: (data: Omit<HomeSection, "sectionId" | "sortOrder">) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Omit<HomeSection, "sectionId" | "sortOrder">>(initial);
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const setFilter = <K extends keyof ServiceFilter>(k: K, v: ServiceFilter[K]) =>
    setForm((prev) => ({ ...prev, serviceFilter: { ...prev.serviceFilter, [k]: v } }));

  const setBanner = <K extends keyof BannerConfig>(k: K, v: BannerConfig[K]) =>
    setForm((prev) => ({ ...prev, bannerConfig: { ...prev.bannerConfig, [k]: v } }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(form); }}
      className="space-y-5"
    >
      {/* Basic info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Section Title *</label>
          <input
            required
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Quick Book"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Emoji Icon</label>
          <input
            value={form.emoji}
            onChange={(e) => set("emoji", e.target.value)}
            placeholder="🏠"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <input
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Short description shown under the section title"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40"
        />
      </div>

      {/* Type selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Section Type *</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SECTION_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => set("type", t.value as HomeSection["type"])}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-colors ${form.type === t.value ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"}`}
            >
              <span className="text-xl">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {SECTION_TYPES.find((t) => t.value === form.type)?.desc}
        </p>
      </div>

      {/* Service filter (only for non-banner types) */}
      {form.type !== "promo_banner" && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Grid3x3 className="w-4 h-4" /> Service Filter
            <span className="text-xs font-normal text-gray-500 ml-1">— which services appear in this section</span>
          </h4>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.serviceFilter.showAll}
              onChange={(e) => setFilter("showAll", e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="font-medium text-gray-700">Show ALL active services</span>
            <span className="text-xs text-gray-500">(ignores other filters below)</span>
          </label>

          {!form.serviceFilter.showAll && (
            <>
              <ChipSelect
                label="Service Types (include)"
                options={SERVICE_TYPE_OPTIONS}
                selected={form.serviceFilter.serviceTypes}
                onChange={(v) => setFilter("serviceTypes", v)}
              />
              <ChipSelect
                label="Service Categories (include)"
                options={SERVICE_CATEGORY_OPTIONS}
                selected={form.serviceFilter.serviceCategories}
                onChange={(v) => setFilter("serviceCategories", v)}
              />
              <ChipSelect
                label="Service Types (exclude)"
                options={SERVICE_TYPE_OPTIONS}
                selected={form.serviceFilter.excludeServiceTypes}
                onChange={(v) => setFilter("excludeServiceTypes", v)}
              />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name Patterns (comma-separated)</label>
                <input
                  value={form.serviceFilter.namePatterns.join(", ")}
                  onChange={(e) =>
                    setFilter("namePatterns", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
                  }
                  placeholder="e.g. maid, cleaning, kitchen"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 bg-white"
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Items shown</label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.maxItems}
                onChange={(e) => set("maxItems", Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Badge Text (optional)</label>
              <input
                value={form.badgeText}
                onChange={(e) => set("badgeText", e.target.value)}
                placeholder="e.g. Popular, New, Best Value"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Banner config */}
      {form.type === "promo_banner" && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            📢 Banner Config
          </h4>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Link URL (optional)</label>
            <input
              value={form.bannerConfig.link}
              onChange={(e) => setBanner("link", e.target.value)}
              placeholder="/customer/services or https://..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">CTA Button Text</label>
            <input
              value={form.bannerConfig.ctaText}
              onChange={(e) => setBanner("ctaText", e.target.value)}
              placeholder="Book Now"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Background Gradient</label>
            <div className="flex flex-wrap gap-2">
              {BANNER_GRADIENTS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setBanner("gradient", g.value)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors bg-gradient-to-r ${g.value} ${form.bannerConfig.gradient === g.value ? "border-gray-500 ring-2 ring-gray-300" : "border-gray-200"}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Badge Text (optional)</label>
            <input
              value={form.badgeText}
              onChange={(e) => set("badgeText", e.target.value)}
              placeholder="e.g. Limited Offer"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 bg-white"
            />
          </div>
        </div>
      )}

      {/* Active toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => set("isActive", !form.isActive)}
          className={`w-10 h-5 rounded-full relative transition-colors ${form.isActive ? "bg-teal-500" : "bg-gray-300"}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
        </div>
        <span className="text-sm font-medium text-gray-700">
          {form.isActive ? "Active — visible to customers" : "Hidden — not shown to customers"}
        </span>
      </label>

      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60 flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Section
        </button>
      </div>
    </form>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  section,
  index,
  total,
  onEdit,
  onToggle,
  onDelete,
  onMoveUp,
  onMoveDown
}: {
  section: HomeSection;
  index: number;
  total: number;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const typeLabel = SECTION_TYPES.find((t) => t.value === section.type)?.label ?? section.type;

  return (
    <div className={`bg-white border rounded-xl p-4 flex items-center gap-4 transition-opacity ${section.isActive ? "border-gray-200" : "border-dashed border-gray-300 opacity-60"}`}>
      {/* Reorder */}
      <div className="flex flex-col gap-1 shrink-0">
        <button disabled={index === 0} onClick={onMoveUp} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
          <ArrowUp className="w-3.5 h-3.5 text-gray-500" />
        </button>
        <button disabled={index === total - 1} onClick={onMoveDown} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
          <ArrowDown className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>

      {/* Emoji */}
      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-2xl shrink-0">
        {section.emoji}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">{section.title}</p>
          {section.badgeText && (
            <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">{section.badgeText}</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{section.description || "No description"}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{typeLabel}</span>
          {section.type !== "promo_banner" && (
            <>
              {section.serviceFilter.showAll ? (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">All services</span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {[...section.serviceFilter.serviceTypes, ...section.serviceFilter.serviceCategories].length} filter(s)
                </span>
              )}
              <span className="text-xs text-gray-400">max {section.maxItems} items</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onToggle} title={section.isActive ? "Hide section" : "Show section"}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          {section.isActive ? <Eye className="w-4 h-4 text-teal-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
        </button>
        <button onClick={onEdit} title="Edit section"
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <Edit className="w-4 h-4 text-blue-600" />
        </button>
        <button onClick={onDelete} title="Delete section"
          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const AdminHomeConfig = () => {
  const { role, name } = useAdminRole();
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [availableServices, setAvailableServices] = useState<ServiceOption[]>([]);
  const [expandedPreview, setExpandedPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
    fetchServices();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await api.get("/home-config/admin");
      setSections((res.sections || []).sort((a: HomeSection, b: HomeSection) => a.sortOrder - b.sortOrder));
    } catch {
      toast.error("Failed to load home config");
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const res = await servicesAPI.getAll({ isActive: true, limit: 100 });
      setAvailableServices(res.services || []);
    } catch {
      // non-critical
    }
  };

  const handleAdd = async (data: Omit<HomeSection, "sectionId" | "sortOrder">) => {
    setAddSaving(true);
    try {
      const res = await api.post("/home-config/sections", data as Record<string, unknown>);
      setSections((res.sections || []).sort((a: HomeSection, b: HomeSection) => a.sortOrder - b.sortOrder));
      setShowAddForm(false);
      toast.success("Section added");
    } catch {
      toast.error("Failed to add section");
    } finally {
      setAddSaving(false);
    }
  };

  const handleEdit = async (sectionId: string, data: Omit<HomeSection, "sectionId" | "sortOrder">) => {
    setSaving(true);
    try {
      const res = await api.patch(`/home-config/sections/${sectionId}`, data as Record<string, unknown>);
      setSections((res.sections || []).sort((a: HomeSection, b: HomeSection) => a.sortOrder - b.sortOrder));
      setEditingId(null);
      toast.success("Section updated");
    } catch {
      toast.error("Failed to update section");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (sectionId: string, isActive: boolean) => {
    try {
      const res = await api.patch(`/home-config/sections/${sectionId}`, { isActive } as Record<string, unknown>);
      setSections((res.sections || []).sort((a: HomeSection, b: HomeSection) => a.sortOrder - b.sortOrder));
      toast.success(isActive ? "Section is now visible" : "Section hidden");
    } catch {
      toast.error("Failed to toggle section");
    }
  };

  const handleDelete = async (sectionId: string) => {
    if (!confirm("Delete this section? Customers will no longer see it on the home screen.")) return;
    try {
      const res = await api.delete(`/home-config/sections/${sectionId}`);
      setSections((res.sections || []).sort((a: HomeSection, b: HomeSection) => a.sortOrder - b.sortOrder));
      toast.success("Section deleted");
    } catch {
      toast.error("Failed to delete section");
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const updated = [...sections];
    const swap = direction === "up" ? index - 1 : index + 1;
    [updated[index], updated[swap]] = [updated[swap], updated[index]];

    const reordered = updated.map((s, i) => ({ ...s, sortOrder: i }));
    setSections(reordered);

    try {
      await api.put("/home-config/sections/reorder", {
        order: reordered.map((s) => ({ sectionId: s.sectionId, sortOrder: s.sortOrder }))
      } as Record<string, unknown>);
    } catch {
      toast.error("Failed to save order — refresh the page");
      fetchConfig(); // revert
    }
  };

  const userType = (role === "super_admin" ? "super_admin" : "admin") as "admin" | "super_admin";

  return (
    <AppLayout userType={userType} userName={name}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Home className="w-5 h-5 text-teal-600" />
              <h1 className="text-2xl font-bold text-gray-900">Home Screen Config</h1>
            </div>
            <p className="text-sm text-gray-500">
              Configure what sections and services appear on the customer home screen.
              Drag sections up/down to reorder them.
            </p>
          </div>
          <button
            onClick={() => { setShowAddForm(true); setEditingId(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Add Section
          </button>
        </div>

        {/* How it works */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" /> How Home Screen Sections Work
          </h3>
          <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
            <li><strong>Service Grid</strong> — shows a grid of service cards customers can tap to book.</li>
            <li><strong>Featured List</strong> — horizontal scrollable list of highlighted services.</li>
            <li><strong>Promo Banner</strong> — a full-width promotional banner with a CTA button.</li>
            <li><strong>Category Strip</strong> — quick-tap category buttons that filter the services page.</li>
            <li>Use the <strong>service filter</strong> to control exactly which services appear in each section.</li>
            <li>Toggle the eye icon to instantly show/hide any section from customers.</li>
          </ul>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="bg-white border-2 border-teal-300 rounded-xl p-5">
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-teal-600" /> New Section
            </h3>
            <SectionForm
              initial={emptySection()}
              onSave={handleAdd}
              onCancel={() => setShowAddForm(false)}
              saving={addSaving}
            />
          </div>
        )}

        {/* Sections list */}
        {loading ? (
          <div className="text-center py-16 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-teal-500" />
            <p className="text-sm">Loading home config…</p>
          </div>
        ) : sections.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
            <div className="text-4xl mb-3">🏠</div>
            <p className="text-sm font-medium text-gray-700">No sections configured yet</p>
            <p className="text-xs text-gray-500 mt-1">Click "Add Section" to build your home screen.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((section, index) => (
              <div key={section.sectionId}>
                {editingId === section.sectionId ? (
                  <div className="bg-white border-2 border-blue-300 rounded-xl p-5">
                    <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Edit className="w-4 h-4 text-blue-600" /> Edit: {section.title}
                    </h3>
                    <SectionForm
                      initial={{
                        title: section.title,
                        description: section.description,
                        emoji: section.emoji,
                        type: section.type,
                        serviceFilter: section.serviceFilter,
                        bannerConfig: section.bannerConfig,
                        maxItems: section.maxItems,
                        badgeText: section.badgeText,
                        isActive: section.isActive
                      }}
                      onSave={(data) => handleEdit(section.sectionId, data)}
                      onCancel={() => setEditingId(null)}
                      saving={saving}
                    />
                  </div>
                ) : (
                  <div>
                    <SectionCard
                      section={section}
                      index={index}
                      total={sections.length}
                      onEdit={() => { setEditingId(section.sectionId); setShowAddForm(false); }}
                      onToggle={() => handleToggle(section.sectionId, !section.isActive)}
                      onDelete={() => handleDelete(section.sectionId)}
                      onMoveUp={() => handleMove(index, "up")}
                      onMoveDown={() => handleMove(index, "down")}
                    />
                    {/* Service preview */}
                    {section.type !== "promo_banner" && (
                      <button
                        onClick={() => setExpandedPreview(expandedPreview === section.sectionId ? null : section.sectionId)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 pl-2 mt-1 transition-colors"
                      >
                        {expandedPreview === section.sectionId ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        Preview services that match this filter
                      </button>
                    )}
                    {expandedPreview === section.sectionId && (
                      <div className="mt-2 pl-2">
                        <ServicePreview section={section} allServices={availableServices} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {!loading && sections.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 flex items-center gap-4 flex-wrap">
            <span>Total sections: <strong>{sections.length}</strong></span>
            <span>Active: <strong className="text-teal-700">{sections.filter((s) => s.isActive).length}</strong></span>
            <span>Hidden: <strong>{sections.filter((s) => !s.isActive).length}</strong></span>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

// ─── Service Preview Helper ───────────────────────────────────────────────────

function ServicePreview({ section, allServices }: { section: HomeSection; allServices: ServiceOption[] }) {
  const matched = allServices.filter((s) => {
    const { serviceFilter } = section;
    if (serviceFilter.showAll) return true;
    const typeMatch = serviceFilter.serviceTypes.length === 0 || serviceFilter.serviceTypes.includes(s.serviceType || "");
    const catMatch = serviceFilter.serviceCategories.length === 0 || serviceFilter.serviceCategories.includes(s.serviceCategory || "");
    const patternMatch = serviceFilter.namePatterns.length === 0 || serviceFilter.namePatterns.some((p) => s.name.toLowerCase().includes(p.toLowerCase()));
    return typeMatch || catMatch || patternMatch;
  }).filter((s) => {
    const { excludeServiceTypes } = section.serviceFilter;
    return !excludeServiceTypes.includes(s.serviceType || "");
  }).slice(0, section.maxItems);

  if (matched.length === 0) {
    return (
      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block">
        ⚠️ No services match this filter. Update the filter or check that services are active in Services Management.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {matched.map((s) => (
        <span key={s._id} className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-700">
          {s.name}
        </span>
      ))}
      {allServices.filter((s) => {
        const { serviceFilter } = section;
        if (serviceFilter.showAll) return true;
        return serviceFilter.serviceTypes.includes(s.serviceType || "") ||
          serviceFilter.serviceCategories.includes(s.serviceCategory || "") ||
          serviceFilter.namePatterns.some((p) => s.name.toLowerCase().includes(p.toLowerCase()));
      }).length > section.maxItems && (
        <span className="text-xs text-gray-400 self-center">+ more (limited to {section.maxItems})</span>
      )}
    </div>
  );
}

export default AdminHomeConfig;
