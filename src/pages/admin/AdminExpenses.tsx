import AppLayout from "@/components/AppLayout";
import { useAdminRole } from "@/hooks/useAdminRole";
import { adminAPI, bookingsAPI, businessExpensesAPI } from "@/lib/api";
import { DollarSign, Edit2, Plus, Trash2, X, TrendingUp, TrendingDown } from "lucide-react";
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
  const { role, name } = useAdminRole();
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

  // Profit stats state
  const [profitStats, setProfitStats] = useState({
    totalRevenue: 0,
    revenueCount: 0,
    totalExpenses: 0,
    expensesCount: 0,
    totalWages: 0,
    wagesCount: 0,
    totalProfit: 0,
    profitMargin: 0,
    dateRange: {
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0]
    }
  });
  const [loadingProfit, setLoadingProfit] = useState(false);

  useEffect(() => {
    fetchExpenses();
    fetchBookings();
    // Only fetch profit stats for super_admin
    if (role === 'super_admin') {
      fetchProfitStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const data = await businessExpensesAPI.getAll();
      setExpenses(data.expenses || []);
      setSummary(data.summary.reduce((acc: Record<string, { total: number; count: number }>, item: { _id: string; total: number; count: number }) => {
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

  const fetchProfitStats = async (from?: string, to?: string) => {
    try {
      setLoadingProfit(true);
      const data = await adminAPI.getProfitStats(
        from || profitStats.dateRange.from,
        to || profitStats.dateRange.to
      );
      if (data.success) {
        setProfitStats({
          ...data.profitStats,
          dateRange: {
            from: from || profitStats.dateRange.from,
            to: to || profitStats.dateRange.to
          }
        });
      }
    } catch (error) {
      toast.error("Failed to load profit statistics");
      console.error(error);
    } finally {
      setLoadingProfit(false);
    }
  };

  const handleDateRangeChange = (from: string, to: string) => {
    setProfitStats({
      ...profitStats,
      dateRange: { from, to }
    });
    fetchProfitStats(from, to);
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

  const filteredBookings = bookings.filter(booking => {
    if (formData.bookingSearch === "") return true;
    try {
      const search = (formData.bookingSearch || "").toLowerCase();
      const bookingId = (booking.bookingId || "").toString().toLowerCase();
      const customerId = (booking.customerId || "").toString().toLowerCase();
      return bookingId.includes(search) || customerId.includes(search);
    } catch (err) {
      console.error("Booking filter error:", err);
      return false;
    }
  });

  return (
    <AppLayout userType={role} userName={name}>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3 mb-2">
              <DollarSign className="h-9 w-9 text-primary" />
              Business Expenses
            </h1>
            <p className="text-muted-foreground">Track and manage all business expenses</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="btn-brand flex items-center gap-2 px-4 py-2 rounded-lg"
          >
            <Plus className="h-5 w-5" />
            Add Expense
          </button>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-foreground">
                  {editingId ? "✏️ Edit Expense" : "➕ New Expense"}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="p-1 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Title & Amount Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="input-clean w-full"
                      placeholder="e.g., Cleaning supplies"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Amount (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="input-clean w-full"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                {/* Category & Date Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="input-clean w-full"
                      required
                    >
                      <option value="">Select category</option>
                      {EXPENSE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>
                          {CATEGORY_ICONS[cat]} {cat.replace(/_/g, ' ').toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="input-clean w-full"
                      required
                    />
                  </div>
                </div>

                {/* Custom Category */}
                {formData.category === 'other' && (
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Custom Category
                    </label>
                    <input
                      type="text"
                      value={formData.customCategory}
                      onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                      className="input-clean w-full"
                      placeholder="Enter custom category"
                    />
                  </div>
                )}

                {/* Type Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-foreground">Expense Type <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.type === 'operational_expense'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}>
                      <input
                        type="radio"
                        value="operational_expense"
                        checked={formData.type === 'operational_expense'}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as 'operational_expense' | 'project_expense' })}
                        className="mr-2"
                      />
                      <span className="font-medium">Operational</span>
                      <p className="text-xs text-muted-foreground mt-1">General business expenses</p>
                    </label>
                    <label className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.type === 'project_expense'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}>
                      <input
                        type="radio"
                        value="project_expense"
                        checked={formData.type === 'project_expense'}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as 'operational_expense' | 'project_expense' })}
                        className="mr-2"
                      />
                      <span className="font-medium">Project-Based</span>
                      <p className="text-xs text-muted-foreground mt-1">Linked to a booking</p>
                    </label>
                  </div>
                </div>

                {/* Booking Selector for Project Expenses */}
                {formData.type === 'project_expense' && (
                  <div className="space-y-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <label className="block text-sm font-semibold text-blue-900 mb-2">
                      Select Booking <span className="text-red-500">*</span>
                    </label>
                    {bookings.length === 0 ? (
                      <p className="text-sm text-red-600">❌ No bookings found. Please create a booking first.</p>
                    ) : bookings.length > 5 ? (
                      <>
                        <input
                          type="text"
                          placeholder="🔍 Search booking ID or customer name..."
                          value={formData.bookingSearch}
                          onChange={(e) => setFormData({ ...formData, bookingSearch: e.target.value })}
                          className="input-clean w-full"
                          autoComplete="off"
                        />
                        {formData.bookingSearch ? (
                          filteredBookings.length > 0 ? (
                            <select
                              value={formData.bookingId}
                              onChange={(e) => setFormData({ ...formData, bookingId: e.target.value })}
                              className="input-clean w-full bg-white"
                              required
                            >
                              <option value="">Select a booking from results</option>
                              {filteredBookings.map(booking => (
                                <option key={booking._id} value={booking._id}>
                                  {booking.bookingId} - {booking.customerId}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="p-3 bg-white border border-amber-200 rounded text-sm text-amber-700">
                              ⚠️ No bookings match "{formData.bookingSearch}". Try a different search.
                            </div>
                          )
                        ) : (
                          <p className="text-xs text-blue-700 italic">👉 Type a booking ID or customer name to search...</p>
                        )}
                      </>
                    ) : (
                      <select
                        value={formData.bookingId}
                        onChange={(e) => setFormData({ ...formData, bookingId: e.target.value })}
                        className="input-clean w-full bg-white"
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
                )}

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-clean w-full resize-none"
                    rows={3}
                    placeholder="Optional notes about this expense..."
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-brand flex-1 flex items-center justify-center gap-2"
                  >
                    {submitting ? "Saving..." : editingId ? "Update Expense" : "Create Expense"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="btn-outline flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Total Profit Section - Only visible to super_admin */}
        {role === 'super_admin' && (
        <div className="card-elevated p-6 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-3 mb-2">
                <TrendingUp className="h-7 w-7 text-primary" />
                Total Profit & System Overview
              </h2>
              <p className="text-sm text-muted-foreground">
                Revenue, expenses, wages, and overall profit calculation
              </p>
            </div>
            <div className="flex gap-3 items-center">
              <div className="flex flex-col sm:flex-row gap-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
                  <input
                    type="date"
                    value={profitStats.dateRange.from}
                    onChange={(e) => handleDateRangeChange(e.target.value, profitStats.dateRange.to)}
                    className="input-clean text-sm py-1 px-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
                  <input
                    type="date"
                    value={profitStats.dateRange.to}
                    onChange={(e) => handleDateRangeChange(profitStats.dateRange.from, e.target.value)}
                    className="input-clean text-sm py-1 px-2"
                  />
                </div>
              </div>
            </div>
          </div>

          {loadingProfit ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin">⏳</div>
              <p className="text-muted-foreground mt-2">Loading profit statistics...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Revenue */}
              <div className="card-elevated p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
                <p className="text-sm font-medium text-green-700 mb-1">💰 Total Revenue</p>
                <p className="text-3xl font-bold text-green-600">₹{profitStats.totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-green-600 mt-1">{profitStats.revenueCount} completed bookings</p>
              </div>

              {/* Total Expenses */}
              <div className="card-elevated p-4 bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200">
                <p className="text-sm font-medium text-orange-700 mb-1">📊 Total Expenses</p>
                <p className="text-3xl font-bold text-orange-600">₹{profitStats.totalExpenses.toLocaleString()}</p>
                <p className="text-xs text-orange-600 mt-1">{profitStats.expensesCount} expenses recorded</p>
              </div>

              {/* Total Wages */}
              <div className="card-elevated p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200">
                <p className="text-sm font-medium text-blue-700 mb-1">👥 Total Wages Paid</p>
                <p className="text-3xl font-bold text-blue-600">₹{profitStats.totalWages.toLocaleString()}</p>
                <p className="text-xs text-blue-600 mt-1">{profitStats.wagesCount} payments made</p>
              </div>

              {/* Overall Profit */}
              <div className={`card-elevated p-4 border-2 ${
                profitStats.totalProfit >= 0
                  ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-300'
                  : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <p className={`text-sm font-medium ${profitStats.totalProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {profitStats.totalProfit >= 0 ? '✅ Overall Profit' : '⚠️ Overall Loss'}
                  </p>
                  {profitStats.totalProfit >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <p className={`text-3xl font-bold ${profitStats.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  ₹{profitStats.totalProfit.toLocaleString()}
                </p>
                <p className={`text-xs mt-1 ${profitStats.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {profitStats.profitMargin}% profit margin
                </p>
              </div>
            </div>
          )}

          {/* Profit Formula Explanation */}
          <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground text-center">
              <span className="font-semibold">Profit Formula:</span> Total Profit = Revenue (₹{profitStats.totalRevenue.toLocaleString()}) - Expenses (₹{profitStats.totalExpenses.toLocaleString()}) - Wages (₹{profitStats.totalWages.toLocaleString()})
            </p>
          </div>
        </div>
        )}

        {/* Stats Cards - Only visible to super_admin */}
        {role === 'super_admin' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total */}
          <div className="card-elevated p-3 bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
            <p className="text-sm text-muted-foreground font-medium mb-1">💰 Total Expenses</p>
            <p className="text-2xl font-bold text-primary">₹{grandTotal.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{Object.values(summary).reduce((a, b) => a + b.count, 0)} total expenses</p>
          </div>

          {/* Category Breakdown */}
          {Object.entries(summary).slice(0, 3).map(([category, data]) => {
            const colors: Record<string, { bg: string; text: string }> = {
              deep_cleaning_material: { bg: 'from-blue-50 to-cyan-50', text: 'text-blue-600' },
              equipment: { bg: 'from-orange-50 to-red-50', text: 'text-orange-600' },
              utilities: { bg: 'from-yellow-50 to-amber-50', text: 'text-yellow-600' },
              salary: { bg: 'from-green-50 to-emerald-50', text: 'text-green-600' },
              rent: { bg: 'from-purple-50 to-pink-50', text: 'text-purple-600' },
              marketing: { bg: 'from-indigo-50 to-blue-50', text: 'text-indigo-600' },
            };
            const color = colors[category] || { bg: 'from-gray-50 to-slate-50', text: 'text-gray-600' };

            return (
              <div key={category} className={`card-elevated p-3 bg-gradient-to-br ${color.bg}`}>
                <p className="text-sm text-muted-foreground font-medium mb-1">{CATEGORY_ICONS[category]} {category.replace(/_/g, ' ').toUpperCase()}</p>
                <p className={`text-xl font-bold ${color.text}`}>₹{data.total.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{data.count} expense{data.count !== 1 ? 's' : ''}</p>
              </div>
            );
          })}
        </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="🔍 Search expenses by title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-clean w-full"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input-clean w-full sm:w-48"
          >
            <option value="">📁 All Categories</option>
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{CATEGORY_ICONS[cat]} {cat.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input-clean w-full sm:w-48"
          >
            <option value="">🏷️ All Types</option>
            <option value="operational_expense">💼 Operational</option>
            <option value="project_expense">📊 Project-Based</option>
          </select>
        </div>

        {/* Expenses Table */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin">⏳</div>
            <p className="text-muted-foreground mt-2">Loading expenses...</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="card-elevated p-8 text-center">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-base font-medium text-foreground">No Expenses Found</p>
            <p className="text-muted-foreground mt-1">
              {filteredExpenses.length === expenses.length
                ? "No expenses created yet. Click 'Add Expense' to get started."
                : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          <div className="card-elevated overflow-hidden border border-border">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Category</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Description</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Booking</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-foreground">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Date</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredExpenses.map(expense => (
                  <tr key={expense._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{CATEGORY_ICONS[expense.category] || '📝'}</span>
                        <span className="text-sm font-medium text-foreground capitalize">
                          {expense.category.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-foreground">{expense.title}</p>
                        {expense.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{expense.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${
                        expense.type === 'project_expense'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {expense.type === 'project_expense' ? '📊' : '💼'} {expense.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {expense.bookingId ? (
                        <a
                          href={`/admin/bookings/${expense.bookingId._id}`}
                          className="text-primary hover:underline font-medium text-sm"
                        >
                          {expense.bookingId.bookingId}
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="font-bold text-lg text-primary">₹{expense.amount.toLocaleString()}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(expense.date).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors"
                          title="Edit expense"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense._id)}
                          className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition-colors"
                          title="Delete expense"
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
