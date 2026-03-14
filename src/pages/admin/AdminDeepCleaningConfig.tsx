import AppLayout from "@/components/AppLayout";
import { api } from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Edit2, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Tier { label: string; price: number; }
interface ConfigItem {
  id: string; category: string; name: string; description: string;
  pricingType: "fixed" | "per_unit" | "per_sqft" | "tiered";
  price: number; tiers: Tier[]; maxQty: number; unit: string; icon: string;
  isActive: boolean; sortOrder: number;
}
interface Config { items: ConfigItem[]; minimumCartValue: number; }

const CATEGORIES = [
  { id: "bathroom",   label: "Bathroom",   emoji: "🚿" },
  { id: "kitchen",    label: "Kitchen",    emoji: "🍳" },
  { id: "furniture",  label: "Furniture",  emoji: "🛋️" },
  { id: "appliances", label: "Appliances", emoji: "💨" },
  { id: "fullhouse",  label: "Full House", emoji: "🏡" },
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

export default function AdminDeepCleaningConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeCategory, setActiveCategory] = useState("bathroom");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm]   = useState<ConfigItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm]     = useState<ConfigItem>({ ...BLANK_ITEM });
  const [minCart, setMinCart]     = useState(500);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    api.get("/deep-cleaning/config").then(d => {
      setConfig(d.config);
      setMinCart(d.config.minimumCartValue ?? 500);
    }).finally(() => setLoading(false));
  }, []);

  const save = async (nextItems: ConfigItem[], nextMin = minCart) => {
    setSaving(true);
    try {
      const res = await api.put("/deep-cleaning/config", { items: nextItems, minimumCartValue: nextMin });
      setConfig(res.config);
      setMinCart(res.config.minimumCartValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const toggleActive = (id: string) => {
    if (!config) return;
    const next = config.items.map(i => i.id === id ? { ...i, isActive: !i.isActive } : i);
    save(next);
  };

  const deleteItem = (id: string) => {
    if (!config || !confirm("Delete this item?")) return;
    save(config.items.filter(i => i.id !== id));
  };

  const startEdit = (item: ConfigItem) => {
    setEditingId(item.id);
    setEditForm({ ...item, tiers: item.tiers?.length ? [...item.tiers.map(t => ({ ...t }))] : [{ label: "", price: 0 }] });
    setExpandedId(item.id);
  };

  const saveEdit = () => {
    if (!config || !editForm) return;
    const id = editForm.id.trim() || editForm.name.toLowerCase().replace(/\s+/g, "_");
    const updated = { ...editForm, id };
    const next = config.items.map(i => i.id === editingId ? updated : i);
    save(next);
    setEditingId(null); setEditForm(null);
  };

  const addItem = () => {
    if (!config || !addForm.name.trim()) return;
    const id = addForm.id.trim() || addForm.name.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now();
    const newItem = { ...addForm, id };
    save([...config.items, newItem]);
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
    save(items);
  };

  const catItems = (config?.items ?? []).filter(i => i.category === activeCategory)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (loading) return (
    <AppLayout userType="super_admin">
      <div className="flex items-center justify-center py-24">
        <motion.div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full"
          animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }} />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout userType="super_admin">
      <div className="max-w-3xl mx-auto pb-12 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Deep Cleaning Template</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage services, prices and tiers</p>
          </div>
          <AnimatePresence>
            {saved && (
              <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="text-sm text-green-700 bg-green-100 border border-green-300 px-3 py-1.5 rounded-full font-medium">
                ✓ Saved
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Min cart value */}
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 flex-wrap">
          <label className="text-sm font-semibold text-foreground shrink-0">Minimum Cart Value (₹)</label>
          <input type="number" min="0" value={minCart}
            onChange={e => setMinCart(Number(e.target.value))}
            className="input-clean w-36 text-sm" />
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => save(config?.items ?? [], minCart)}
            disabled={saving}
            className="text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-xl disabled:opacity-50">
            {saving ? "Saving..." : "Update"}
          </motion.button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-border"
              }`}>
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
                    <p className="font-semibold text-foreground text-sm leading-tight truncate">{item.name}</p>
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
                      <ItemEditForm form={editForm} onChange={setEditForm} />
                      <div className="flex gap-2 mt-4">
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
              <p className="text-sm">No items in {CATEGORIES.find(c => c.id === activeCategory)?.label}</p>
              <p className="text-xs mt-1">Click "Add Item" to add one</p>
            </div>
          )}
        </div>

        {/* Add item */}
        <div>
          {!showAddForm ? (
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => { setAddForm({ ...BLANK_ITEM, category: activeCategory }); setShowAddForm(true); }}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-primary/40 text-primary text-sm font-semibold py-3 rounded-2xl hover:bg-primary/5 transition-colors">
              <Plus className="w-4 h-4" /> Add Item to {CATEGORIES.find(c => c.id === activeCategory)?.label}
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
              <ItemEditForm form={addForm} onChange={setAddForm} />
              <div className="flex gap-2 mt-4">
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
function ItemEditForm({ form, onChange }: { form: ConfigItem; onChange: (f: ConfigItem) => void }) {
  const set = (field: keyof ConfigItem, value: unknown) => onChange({ ...form, [field]: value });

  const updateTier = (ti: number, field: keyof Tier, value: string | number) => {
    const tiers = form.tiers.map((t, i) => i === ti ? { ...t, [field]: field === "price" ? Number(value) : value } : t);
    set("tiers", tiers);
  };
  const addTier    = () => set("tiers", [...(form.tiers ?? []), { label: "", price: 0 }]);
  const deleteTier = (ti: number) => set("tiers", (form.tiers ?? []).filter((_, i) => i !== ti));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-clean">Category</label>
          <select value={form.category} onChange={e => set("category", e.target.value)} className="input-clean text-sm">
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
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
        <div className="grid grid-cols-2 gap-3">
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
