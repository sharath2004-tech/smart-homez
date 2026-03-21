import AppLayout from "@/components/AppLayout";
import { businessExpensesAPI, bookingsAPI } from "@/lib/api";
import { Calendar, DollarSign, Edit2, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Expense {
  _id: string;
  title: string;
  amount: number;
  category: string;
  description?: string;
  date: string;
  type: 'project_expense' | 'operational_expense';
  bookingId?: {
    _id: string;
    bookingId: string;
    customerId: string;
  };
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  location?: {
    _id: string;
    apartmentName: string;
    area: string;
    city: string;
  };
  createdAt: string;
}

interface Booking {
  _id: string;
  bookingId: string;
  customerId: string;
  status: string;
}

const EXPENSE_CATEGORIES = [
  'deep_cleaning_material',
  'equipment',
  'utilities',
  'salary',
  'rent',
  'marketing',
  'transport',
  'training',
  'maintenance',
  'other'
];

const CATEGORY_ICONS: Record<string, string> = {
  deep_cleaning_material: '🧹',
  equipment: '🔧',
  utilities: '💡',
  salary: '💰',
  rent: '🏢',
  marketing: '📢',
  transport: '🚗',
  training: '📚',
  maintenance: '🛠️',
  other: '⭐'
};

const AdminExpenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    category: "other",
    customCategory: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
    type: "operational_expense",
    bookingId: "",
    bookingSearch: ""
  });

  const [summary, setSummary] = useState<Record<string, { total: number; count: number }>>({});
  const [grandTotal, setGrandTotal] = useState(0);

  useEffect(() => {
    fetchExpenses();
    fetchBookings();
  }, []);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const data = await businessExpensesAPI.getAll();
      setExpenses(data.expenses || []);
      setSummary(data.summary.reduce((acc: Record<string, any>, item: any) => {
        acc[item._id] = { total: item.total, count: item.count };
        return acc;
      }, {}));
      setGrandTotal(data.grandTotal || 0);
    } catch (error) {
      toast.error("Failed to load expenses");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      const data = await bookingsAPI.getAll({ limit: 1000 });
      setBookings(data.bookings || []);
    } catch (error) {
      console.error("Failed to load bookings");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.amount || !formData.category) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.type === 'project_expense' && !formData.bookingId) {
      toast.error("Booking ID is required for project expenses");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: formData.title,
        amount: parseFloat(formData.amount),
        category: formData.category,
        customCategory: formData.category === 'other' ? formData.customCategory : undefined,
        description: formData.description,
        date: formData.date,
        type: formData.type,
        bookingId: formData.bookingId || undefined
      };

      if (editingId) {
        await businessExpensesAPI.update(editingId, payload);
        toast.success("Expense updated successfully!");
      } else {
        await businessExpensesAPI.create(payload);
        toast.success("Expense created successfully!");
      }

      resetForm();
      fetchExpenses();
      setShowForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save expense");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingId(expense._id);
    setFormData({
      title: expense.title,
      amount: expense.amount.toString(),
      category: expense.category,
      customCategory: "",
      description: expense.description || "",
      date: expense.date.split('T')[0],
      type: expense.type,
      bookingId: expense.bookingId?._id || "",
      bookingSearch: ""
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    try {
      await businessExpensesAPI.delete(id);
      toast.success("Expense deleted successfully!");
      fetchExpenses();
    } catch (error) {
      toast.error("Failed to delete expense");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      amount: "",
      category: "other",
      customCategory: "",
      description: "",
      date: new Date().toISOString().split('T')[0],
      type: "operational_expense",
      bookingId: "",
      bookingSearch: ""
    });
    setEditingId(null);
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.title.toLowerCase().includes(search.toLowerCase()) ||
      expense.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || expense.category === categoryFilter;
    const matchesType = !typeFilter || expense.type === typeFilter;
    return matchesSearch && matchesCategory && matchesType;
  });

  const filteredBookings = bookings.filter(booking =>
    formData.bookingSearch === "" ||
    booking.bookingId.toLowerCase().includes(formData.bookingSearch.toLowerCase()) ||
    booking.customerId.toLowerCase().includes(formData.bookingSearch.toLowerCase())
  );

  return (
    <AppLayout userType="admin" userName="">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-primary" />
            Business Expenses
          </h1>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            New Expense
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingId ? "Edit Expense" : "Create Expense"}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="input input-bordered w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="input input-bordered w-full"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="select select-bordered w-full"
                    required
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                {formData.category === 'other' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Custom Category</label>
                    <input
                      type="text"
                      value={formData.customCategory}
                      onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                      className="input input-bordered w-full"
                      placeholder="Enter custom category"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Type *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="operational_expense"
                      checked={formData.type === 'operational_expense'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="radio radio-primary"
                    />
                    <span>Operational Expense</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="project_expense"
                      checked={formData.type === 'project_expense'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="radio radio-primary"
                    />
                    <span>Project Expense</span>
                  </label>
                </div>
              </div>

              {formData.type === 'project_expense' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Booking ID *</label>
                  <div className="space-y-2">
                    {bookings.length > 5 ? (
                      <>
                        <input
                          type="text"
                          placeholder="Search by booking ID or customer ID..."
                          value={formData.bookingSearch}
                          onChange={(e) => setFormData({ ...formData, bookingSearch: e.target.value })}
                          className="input input-bordered w-full"
                        />
                        {formData.bookingSearch && (
                          <select
                            value={formData.bookingId}
                            onChange={(e) => setFormData({ ...formData, bookingId: e.target.value })}
                            className="select select-bordered w-full"
                          >
                            <option value="">Select a booking</option>
                            {filteredBookings.map(booking => (
                              <option key={booking._id} value={booking._id}>
                                {booking.bookingId} - {booking.customerId}
                              </option>
                            ))}
                          </select>
                        )}
                      </>
                    ) : (
                      <select
                        value={formData.bookingId}
                        onChange={(e) => setFormData({ ...formData, bookingId: e.target.value })}
                        className="select select-bordered w-full"
                        required
                      >
                        <option value="">Select a booking</option>
                        {bookings.map(booking => (
                          <option key={booking._id} value={booking._id}>
                            {booking.bookingId} - {booking.customerId}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="input input-bordered w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="textarea textarea-bordered w-full"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary flex-1"
                >
                  {submitting ? "Saving..." : editingId ? "Update Expense" : "Create Expense"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="btn btn-ghost flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-2xl font-bold">₹{grandTotal.toLocaleString()}</p>
          </div>
          {Object.entries(summary).slice(0, 3).map(([category, data]) => (
            <div key={category} className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground capitalize">{category.replace(/_/g, ' ')}</p>
              <p className="text-2xl font-bold">₹{data.total.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{data.count} expenses</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="select select-bordered"
          >
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="select select-bordered"
          >
            <option value="">All Types</option>
            <option value="operational_expense">Operational</option>
            <option value="project_expense">Project</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12">Loading expenses...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No expenses found
          </div>
        ) : (
          <div className="overflow-x-auto bg-card border border-border rounded-lg">
            <table className="w-full">
              <thead className="border-b border-border bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Category</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Title</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Booking</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Date</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredExpenses.map(expense => (
                  <tr key={expense._id} className="hover:bg-muted/50">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{CATEGORY_ICONS[expense.category] || '📝'}</span>
                        <span className="text-sm">{expense.category.replace(/_/g, ' ')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div>
                        <p className="font-medium">{expense.title}</p>
                        {expense.description && (
                          <p className="text-xs text-muted-foreground">{expense.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`badge ${
                        expense.type === 'project_expense' ? 'badge-primary' : 'badge-ghost'
                      }`}>
                        {expense.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {expense.bookingId ? (
                        <a href={`/admin/bookings/${expense.bookingId._id}`} className="text-primary hover:underline text-sm">
                          {expense.bookingId.bookingId}
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right font-medium">
                      ₹{expense.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {new Date(expense.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="btn btn-sm btn-ghost"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense._id)}
                          className="btn btn-sm btn-ghost text-error"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminExpenses;
