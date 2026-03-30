import AppLayout from "@/components/AppLayout";
import { serviceCatalogAPI } from "@/lib/api";
import {
    ChevronDown,
    ChevronRight,
    Edit,
    FolderPlus,
    GripVertical,
    Layers,
    Plus,
    Save,
    Trash2,
    X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
  _id?: string;
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
  serviceCount?: number;
}

const EMPTY_SUB: Subcategory = {
  name: "",
  slug: "",
  description: "",
  icon: "✨",
  pricingHint: "",
  isActive: true,
  sortOrder: 0,
};

const EMPTY_CAT: CatalogCategory = {
  name: "",
  slug: "",
  description: "",
  icon: "🏠",
  color: "blue",
  pricingModel: "fixed",
  pricingHint: "",
  isActive: true,
  sortOrder: 0,
  subcategories: [],
};

const PRICING_MODELS = [
  { value: "hourly", label: "Hourly" },
  { value: "fixed", label: "Fixed Price" },
  { value: "per_unit", label: "Per Unit" },
  { value: "subscription", label: "Subscription" },
  { value: "quote", label: "Get a Quote" },
  { value: "mixed", label: "Mixed" },
];

const COLOR_OPTIONS = [
  "blue",
  "green",
  "purple",
  "orange",
  "red",
  "cyan",
  "amber",
  "emerald",
  "rose",
  "indigo",
];

const ICON_SUGGESTIONS = [
  "🏠", "🧹", "🧽", "✨", "🚿", "🍳", "🛋️", "🪟", "💨", "🪑",
  "🛏️", "📦", "🏗️", "🏢", "⚡", "📅", "🔄", "🧴", "🪣", "🔧",
];

/* ─── component ─── */

const AdminServiceCatalog = () => {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CatalogCategory>({ ...EMPTY_CAT });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  /* ─── fetch ─── */
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await serviceCatalogAPI.getAll();
      setCategories(res.categories || []);
    } catch {
      toast.error("Failed to load service catalog");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  /* ─── handlers ─── */
  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const resetForm = () => {
    setFormData({ ...EMPTY_CAT });
    setEditingId(null);
    setShowForm(false);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (cat: CatalogCategory) => {
    setFormData({ ...cat });
    setEditingId(cat._id || null);
    setShowForm(true);
  };

  const addSubcategory = () =>
    setFormData((prev) => ({
      ...prev,
      subcategories: [
        ...prev.subcategories,
        { ...EMPTY_SUB, sortOrder: prev.subcategories.length },
      ],
    }));

  const updateSubcategory = (idx: number, field: keyof Subcategory, value: unknown) =>
    setFormData((prev) => ({
      ...prev,
      subcategories: prev.subcategories.map((s, i) =>
        i === idx ? { ...s, [field]: value } : s
      ),
    }));

  const removeSubcategory = (idx: number) =>
    setFormData((prev) => ({
      ...prev,
      subcategories: prev.subcategories.filter((_, i) => i !== idx),
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Category name is required");
      return;
    }
    try {
      if (editingId) {
        await serviceCatalogAPI.update(editingId, formData as unknown as Record<string, unknown>);
        toast.success("Category updated!");
      } else {
        await serviceCatalogAPI.create(formData as unknown as Record<string, unknown>);
        toast.success("Category created!");
      }
      resetForm();
      fetchCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category? Services will be unlinked.")) return;
    try {
      await serviceCatalogAPI.delete(id);
      toast.success("Category deleted");
      fetchCategories();
    } catch {
      toast.error("Failed to delete");
    }
  };

  /* ─── render ─── */
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="w-6 h-6 text-primary" /> Service Catalog
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Create and manage service categories &amp; subcategories. Link services to these categories for organized customer browsing.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <FolderPlus className="w-4 h-4" /> New Category
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-card border rounded-xl p-5 space-y-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? "Edit Category" : "New Category"}
              </h2>
              <button type="button" onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Basic fields */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {/* Name */}
              <div>
                <label className="text-sm font-medium">Category Name *</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Deep Cleaning"
                  required
                />
              </div>

              {/* Slug */}
              <div>
                <label className="text-sm font-medium">Slug</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, slug: e.target.value }))
                  }
                  placeholder="auto-generated from name"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  rows={2}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Brief description for customers"
                />
              </div>

              {/* Icon */}
              <div>
                <label className="text-sm font-medium">Icon</label>
                <div className="mt-1 flex gap-1 flex-wrap">
                  {ICON_SUGGESTIONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, icon }))}
                      className={`w-8 h-8 text-lg rounded-md flex items-center justify-center border transition-colors ${
                        formData.icon === icon
                          ? "border-primary bg-primary/10"
                          : "border-transparent hover:bg-accent"
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="text-sm font-medium">Theme Color</label>
                <div className="mt-1 flex gap-1 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, color: c }))}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === c
                          ? "border-foreground scale-110"
                          : "border-transparent"
                      } bg-${c}-400`}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* Pricing Model */}
              <div>
                <label className="text-sm font-medium">Pricing Model</label>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={formData.pricingModel}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, pricingModel: e.target.value }))
                  }
                >
                  {PRICING_MODELS.map((pm) => (
                    <option key={pm.value} value={pm.value}>
                      {pm.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pricing Hint */}
              <div>
                <label className="text-sm font-medium">Pricing Hint</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={formData.pricingHint}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, pricingHint: e.target.value }))
                  }
                  placeholder="e.g. From ₹200/hr"
                />
              </div>

              {/* Sort Order */}
              <div>
                <label className="text-sm font-medium">Sort Order</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))
                  }
                />
              </div>

              {/* Active */}
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, isActive: e.target.checked }))
                  }
                  className="w-4 h-4"
                />
                <label htmlFor="isActive" className="text-sm font-medium">
                  Active (visible to customers)
                </label>
              </div>
            </div>

            {/* Subcategories */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Subcategories</h3>
                <button
                  type="button"
                  onClick={addSubcategory}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/80 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Subcategory
                </button>
              </div>

              {formData.subcategories.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  No subcategories yet. Add one to group services further.
                </p>
              )}

              {formData.subcategories.map((sub, idx) => (
                <div
                  key={idx}
                  className="bg-accent/30 border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        #{idx + 1}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSubcategory(idx)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
                    <div>
                      <label className="text-xs font-medium">Name *</label>
                      <input
                        className="mt-0.5 w-full rounded-md border px-2 py-1.5 text-sm"
                        value={sub.name}
                        onChange={(e) =>
                          updateSubcategory(idx, "name", e.target.value)
                        }
                        placeholder="e.g. Kitchen Appliances"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Icon</label>
                      <input
                        className="mt-0.5 w-full rounded-md border px-2 py-1.5 text-sm"
                        value={sub.icon}
                        onChange={(e) =>
                          updateSubcategory(idx, "icon", e.target.value)
                        }
                        placeholder="✨"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Pricing Hint</label>
                      <input
                        className="mt-0.5 w-full rounded-md border px-2 py-1.5 text-sm"
                        value={sub.pricingHint}
                        onChange={(e) =>
                          updateSubcategory(idx, "pricingHint", e.target.value)
                        }
                        placeholder="Starts ₹99"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium">Description</label>
                      <input
                        className="mt-0.5 w-full rounded-md border px-2 py-1.5 text-sm"
                        value={sub.description}
                        onChange={(e) =>
                          updateSubcategory(idx, "description", e.target.value)
                        }
                        placeholder="Brief description"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={sub.isActive}
                        onChange={(e) =>
                          updateSubcategory(idx, "isActive", e.target.checked)
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-xs">Active</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Save className="w-4 h-4" />
                {editingId ? "Update Category" : "Create Category"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2 border rounded-lg hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Category List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading catalog...
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-xl">
            <Layers className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-semibold">No categories yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first service category to organize your service catalog.
            </p>
            <button
              onClick={openCreate}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
            >
              Create First Category
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map((cat) => (
              <div
                key={cat._id}
                className={`bg-card border rounded-xl overflow-hidden transition-all ${
                  !cat.isActive ? "opacity-60" : ""
                }`}
              >
                {/* Category header */}
                <div className="flex items-center gap-3 p-4">
                  <button
                    onClick={() => cat._id && toggleExpand(cat._id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {expandedIds.has(cat._id || "") ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>

                  <span className="text-2xl">{cat.icon}</span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm truncate">
                        {cat.name}
                      </h3>
                      {!cat.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          Inactive
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
                        {cat.pricingModel}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {cat.description || "No description"}
                      {cat.pricingHint && (
                        <span className="ml-2 text-primary font-medium">
                          {cat.pricingHint}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      {cat.subcategories.length} sub
                      {cat.subcategories.length !== 1 && "s"}
                    </span>
                    <span>
                      {cat.serviceCount || 0} service
                      {(cat.serviceCount || 0) !== 1 && "s"}
                    </span>
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(cat)}
                      className="p-2 rounded-lg hover:bg-accent transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => cat._id && handleDelete(cat._id)}
                      className="p-2 rounded-lg hover:bg-red-100 text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Subcategories (expanded) */}
                {expandedIds.has(cat._id || "") &&
                  cat.subcategories.length > 0 && (
                    <div className="border-t bg-accent/20 px-4 py-3 space-y-2">
                      {cat.subcategories
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((sub, idx) => (
                          <div
                            key={sub._id || idx}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg bg-background/60 border text-sm ${
                              !sub.isActive ? "opacity-50" : ""
                            }`}
                          >
                            <span className="text-lg">{sub.icon}</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">{sub.name}</span>
                              {sub.description && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  — {sub.description}
                                </span>
                              )}
                            </div>
                            {sub.pricingHint && (
                              <span className="text-xs text-primary font-medium">
                                {sub.pricingHint}
                              </span>
                            )}
                            {!sub.isActive && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                Off
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  )}

                {expandedIds.has(cat._id || "") &&
                  cat.subcategories.length === 0 && (
                    <div className="border-t bg-accent/20 px-4 py-3">
                      <p className="text-xs text-muted-foreground italic">
                        No subcategories. Services in this category will be listed directly.
                      </p>
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminServiceCatalog;
