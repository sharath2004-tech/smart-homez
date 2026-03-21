import AppLayout from "@/components/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { useAdminRole } from "@/hooks/useAdminRole";
import { businessExpensesAPI } from "@/lib/api";
import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

const EXPENSE_CATEGORIES = [
  { value: "deep_cleaning_material", label: "Deep Cleaning Material" },
  { value: "equipment", label: "Equipment" },
  { value: "utilities", label: "Utilities" },
  { value: "salary", label: "Salary" },
  { value: "rent", label: "Rent" },
  { value: "marketing", label: "Marketing" },
  { value: "transport", label: "Transport" },
  { value: "training", label: "Training" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Other (specify)" },
];

interface Expense {
  _id: string;
  title: string;
  amount: number;
  category: string;
  customCategory?: string;
  description?: string;
  date: string;
  location?: { apartmentName: string; area: string; city: string };
  createdBy: { _id?: string; name: string; email: string; role: string };
  createdByRole: string;
}

const BusinessExpenses = () => {
  const { role, name } = useAdminRole();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [summary, setSummary] = useState<Array<{ _id: string; total: number; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const [form, setForm] = useState({
    title: "",
    amount: "",
    category: "",
    customCategory: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchExpenses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory, filterFrom, filterTo]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const res = await businessExpensesAPI.getAll({
        category: filterCategory || undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
      });
      setExpenses(res.expenses || []);
      setGrandTotal(res.grandTotal || 0);
      setSummary(res.summary || []);
    } catch {
      toast({ title: "Error", description: "Failed to fetch expenses", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.amount || !form.category || !form.date) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }
    if (Number(form.amount) <= 0) {
      toast({ title: "Error", description: "Amount must be a positive number", variant: "destructive" });
      return;
    }
    if (form.category === "other" && !form.customCategory.trim()) {
      toast({ title: "Error", description: "Please specify the category", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await businessExpensesAPI.create({
        title: form.title,
        amount: Number(form.amount),
        category: form.category,
        customCategory: form.category === "other" ? form.customCategory : undefined,
        description: form.description,
        date: form.date,
      });
      toast({ title: "Success", description: "Expense added successfully" });
      setShowForm(false);
      setForm({ title: "", amount: "", category: "", customCategory: "", description: "", date: new Date().toISOString().split("T")[0] });
      fetchExpenses();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to add expense", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await businessExpensesAPI.delete(id);
      toast({ title: "Success", description: "Expense deleted" });
      fetchExpenses();
    } catch {
      toast({ title: "Error", description: "Failed to delete expense", variant: "destructive" });
    }
  };

  const getCategoryLabel = (cat: string, custom?: string) => {
    if (cat === "other" && custom) return custom;
    return EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label || cat;
  };

  return (
    <AppLayout userType={role} userName={name}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Business Expenses</h1>
            <p className="text-sm text-muted-foreground">Track and manage your business expenses</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 btn-brand px-4 py-2 rounded-xl text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>

        {/* Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5">
          <p className="text-sm text-muted-foreground mb-1">Total Expenses</p>
          <p className="text-3xl font-bold text-blue-700">₹{grandTotal.toLocaleString("en-IN")}</p>
          <div className="flex flex-wrap gap-3 mt-3">
            {summary.map((s) => (
              <div key={s._id} className="text-xs bg-white border border-blue-100 rounded-lg px-3 py-1.5">
                <span className="text-muted-foreground">{getCategoryLabel(s._id)}: </span>
                <span className="font-semibold text-foreground">₹{s.total.toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            className="input-clean text-sm flex-1 min-w-[160px]"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input type="date" className="input-clean text-sm" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          <input type="date" className="input-clean text-sm" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          {(filterCategory || filterFrom || filterTo) && (
            <button
              onClick={() => { setFilterCategory(""); setFilterFrom(""); setFilterTo(""); }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {/* Expenses List */}
        {loading ? (
          <div className="text-center py-10 text-muted-foreground">Loading expenses...</div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No expenses found. Add your first expense!</div>
        ) : (
          <div className="space-y-3">
            {expenses.map((exp) => (
              <div key={exp._id} className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{exp.title}</span>
                    <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-lg">
                      {getCategoryLabel(exp.category, exp.customCategory)}
                    </span>
                  </div>
                  {exp.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">{exp.description}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-muted-foreground">{new Date(exp.date).toLocaleDateString("en-IN")}</span>
                    {exp.location && (
                      <span className="text-xs text-muted-foreground">{exp.location.apartmentName}, {exp.location.area}</span>
                    )}
                    {role === "super_admin" && (
                      <span className="text-xs text-muted-foreground">By: {exp.createdBy?.name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground whitespace-nowrap">₹{exp.amount.toLocaleString("en-IN")}</span>
                  {role === "super_admin" && (
                    <button
                      onClick={() => handleDelete(exp._id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Expense Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Add Expense</h2>
                <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title <span className="text-destructive">*</span></label>
                  <input type="text" required className="input-clean" placeholder="e.g. Mop purchase" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Amount (₹) <span className="text-destructive">*</span></label>
                  <input type="number" required min="0" step="0.01" className="input-clean" placeholder="e.g. 500" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category <span className="text-destructive">*</span></label>
                  <select required className="input-clean" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="">Select category</option>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                {form.category === "other" && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Specify Category <span className="text-destructive">*</span></label>
                    <input type="text" required className="input-clean" placeholder="e.g. Pest control" value={form.customCategory} onChange={(e) => setForm({ ...form, customCategory: e.target.value })} />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">Date <span className="text-destructive">*</span></label>
                  <input type="date" required className="input-clean" value={form.date} max={new Date().toISOString().split("T")[0]} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                  <textarea className="input-clean" rows={3} maxLength={500} placeholder="Additional details..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button type="button" onClick={() => setShowForm(false)} className="w-full sm:flex-1 py-2 border border-border rounded-xl text-sm" disabled={submitting}>Cancel</button>
                  <button type="submit" className="w-full sm:flex-1 btn-brand py-2 rounded-xl text-sm font-medium disabled:opacity-50" disabled={submitting}>
                    {submitting ? "Adding..." : "Add Expense"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default BusinessExpenses;
