import AppLayout from "@/components/AppLayout";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useConfirm } from "@/hooks/useConfirm";
import { API_BASE_URL, adminAPI, bookingsAPI, businessExpensesAPI } from "@/lib/api";
import { Edit2, IndianRupee, Plus, Trash2, TrendingDown, TrendingUp, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface ExpenseProofFile {
  url: string;
  originalName?: string | null;
  mimeType?: string | null;
  uploadedAt?: string;
}

interface Expense {
  _id: string;
  title: string;
  amount: number;
  category: string;
  customCategory?: string;
  description?: string;
  date: string;
  type: 'project_expense' | 'operational_expense';
  bookingId?: {
    _id: string;
    bookingId?: string;
    customerId?: string;
    bookingDate?: string;
    status?: string;
    totalAmount?: number;
    customer?: {
      name?: string;
      email?: string;
      phone?: string;
    };
    service?: {
      name?: string;
      serviceType?: string;
    };
    location?: {
      apartmentName?: string;
      area?: string;
      city?: string;
    };
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
  proofFiles?: ExpenseProofFile[];
  receipt?: string | null;
  createdAt: string;
}

interface LocationOption {
  _id: string;
  apartmentName: string;
  area: string;
  city: string;
}

interface RevenueByServiceItem {
  serviceId: string;
  serviceName: string;
  totalRevenue: number;
  bookingCount: number;
}

interface WageDetailItem {
  _id: string;
  worker: {
    name: string;
    email?: string;
    phone?: string;
  } | null;
  paidBy: {
    name: string;
    email?: string;
  } | null;
  amount: number;
  paidAt?: string | null;
  totalMinutesWorked: number;
  totalTasksCompleted: number;
  hourlyRate: number;
  periodFrom: string;
  periodTo: string;
  location?: {
    apartmentName?: string;
    area?: string;
    city?: string;
  } | null;
  bookingBreakdown: Array<{
    bookingMongoId: string;
    bookingId?: string | null;
    bookingDate?: string | null;
    serviceName: string;
    minutesWorked: number;
    allocatedAmount: number;
    location?: {
      apartmentName?: string;
      area?: string;
      city?: string;
    } | null;
  }>;
}

interface ProfitStatsState {
  totalRevenue: number;
  revenueCount: number;
  revenueByService: RevenueByServiceItem[];
  totalExpenses: number;
  expensesCount: number;
  totalWages: number;
  wagesCount: number;
  wageDetails: WageDetailItem[];
  totalProfit: number;
  profitMargin: number;
  dateRange: {
    from: string;
    to: string;
  };
}

interface Booking {
  _id: string;
  bookingId?: string;
  customerId?: string;
  customer?: {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  status: string;
}

interface NormalizedBooking {
  _id: string;
  displayId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerRef: string;
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

const DEFAULT_VISIBLE_ITEMS = 2;
const MAX_PROOF_FILES = 5;

const getFileIdentity = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

const AdminExpenses = () => {
  const { role, name } = useAdminRole();
  const confirm = useConfirm();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAllRevenueServices, setShowAllRevenueServices] = useState(false);
  const [showAllWages, setShowAllWages] = useState(false);
  const [expandedWageBreakdowns, setExpandedWageBreakdowns] = useState<Record<string, boolean>>({});
  const [selectedProofFiles, setSelectedProofFiles] = useState<File[]>([]);
  const proofFileInputRef = useRef<HTMLInputElement>(null);

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
  const [profitStats, setProfitStats] = useState<ProfitStatsState>({
    totalRevenue: 0,
    revenueCount: 0,
    revenueByService: [],
    totalExpenses: 0,
    expensesCount: 0,
    totalWages: 0,
    wagesCount: 0,
    wageDetails: [],
    totalProfit: 0,
    profitMargin: 0,
    dateRange: {
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0]
    }
  });
  const [loadingProfit, setLoadingProfit] = useState(false);

  const activeLocationId = role === 'super_admin' && selectedLocationId !== 'all'
    ? selectedLocationId
    : undefined;

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await businessExpensesAPI.getAll({
        ...(activeLocationId ? { locationId: activeLocationId } : {})
      });
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
  }, [activeLocationId]);

  const fetchBookings = useCallback(async () => {
    try {
      const data = await bookingsAPI.getAll({ limit: 1000 });
      setBookings(data.bookings || []);
    } catch (error) {
      console.error("Failed to load bookings");
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const data = await adminAPI.getLocations();
      setLocations(data.locations || []);
    } catch (error) {
      console.error('Failed to load locations', error);
    }
  }, []);

  const fetchProfitStats = useCallback(async (from?: string, to?: string) => {
    const nextFrom = from || profitStats.dateRange.from;
    const nextTo = to || profitStats.dateRange.to;

    try {
      setLoadingProfit(true);
      const data = await adminAPI.getProfitStats(
        nextFrom,
        nextTo,
        activeLocationId
      );
      if (data.success) {
        setProfitStats((current) => ({
          ...current,
          ...data.profitStats,
          revenueByService: data.profitStats.revenueByService || [],
          wageDetails: data.profitStats.wageDetails || [],
          dateRange: {
            from: nextFrom,
            to: nextTo
          }
        }));
      }
    } catch (error) {
      toast.error("Failed to load profit statistics");
      console.error(error);
    } finally {
      setLoadingProfit(false);
    }
  }, [activeLocationId, profitStats.dateRange.from, profitStats.dateRange.to]);

  useEffect(() => {
    void fetchExpenses();
    // Only fetch profit stats for super_admin
    if (role === 'super_admin') {
      void fetchProfitStats();
    }
  }, [fetchExpenses, fetchProfitStats, role]);

  useEffect(() => {
    void fetchBookings();
    if (role === 'super_admin') {
      void fetchLocations();
    }
  }, [fetchBookings, fetchLocations, role]);

  const getExpenseProofs = (expense: Expense): ExpenseProofFile[] => {
    if (expense.proofFiles && expense.proofFiles.length > 0) {
      return expense.proofFiles;
    }
    if (expense.receipt) {
      return [{ url: expense.receipt, originalName: 'Expense proof' }];
    }
    return [];
  };

  const getProofUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE_URL.replace('/api', '')}${url}`;
  };

  const handleProofFileSelection = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setSelectedProofFiles((current) => {
      const combined = [...current, ...Array.from(files)];
      const deduped = combined.filter((file, index, array) => (
        index === array.findIndex((candidate) => getFileIdentity(candidate) === getFileIdentity(file))
      ));

      if (deduped.length > MAX_PROOF_FILES) {
        toast.error(`You can upload up to ${MAX_PROOF_FILES} proof files for one expense.`);
      }

      return deduped.slice(0, MAX_PROOF_FILES);
    });

    if (proofFileInputRef.current) {
      proofFileInputRef.current.value = '';
    }
  };

  const removeSelectedProofFile = (fileToRemove: File) => {
    setSelectedProofFiles((current) => current.filter((file) => getFileIdentity(file) !== getFileIdentity(fileToRemove)));
  };

  const handleDateRangeChange = (from: string, to: string) => {
    setProfitStats((current) => ({
      ...current,
      dateRange: { from, to }
    }));
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
      const payload = new FormData();
      payload.append('title', formData.title);
      payload.append('amount', String(parseFloat(formData.amount)));
      payload.append('category', formData.category);
      if (formData.category === 'other' && formData.customCategory.trim()) {
        payload.append('customCategory', formData.customCategory.trim());
      }
      if (formData.description.trim()) {
        payload.append('description', formData.description.trim());
      }
      payload.append('date', formData.date);
      payload.append('type', formData.type);
      if (formData.bookingId) {
        payload.append('bookingId', formData.bookingId);
      }
      selectedProofFiles.forEach((file) => payload.append('proofFiles', file));

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
    setSelectedProofFiles([]);
    if (proofFileInputRef.current) {
      proofFileInputRef.current.value = '';
    }
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
    if (!await confirm("Are you sure you want to delete this expense?")) return;

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
    setSelectedProofFiles([]);
    if (proofFileInputRef.current) {
      proofFileInputRef.current.value = '';
    }
    setEditingId(null);
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.title.toLowerCase().includes(search.toLowerCase()) ||
      expense.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || expense.category === categoryFilter;
    const matchesType = !typeFilter || expense.type === typeFilter;
    return matchesSearch && matchesCategory && matchesType;
  });

  const normalizedBookings = useMemo<NormalizedBooking[]>(() => bookings.map((booking) => {
    const displayId = booking.bookingId || booking._id.slice(-8).toUpperCase();
    const customerName = booking.customer?.name || "Unknown customer";
    const customerEmail = booking.customer?.email || "";
    const customerPhone = booking.customer?.phone || "";
    const customerRef = booking.customerId || booking.customer?._id || "";

    return {
      _id: booking._id,
      displayId,
      customerName,
      customerEmail,
      customerPhone,
      customerRef,
      status: booking.status,
    };
  }), [bookings]);

  const filteredBookings = normalizedBookings.filter(booking => {
    if (formData.bookingSearch === "") return true;
    try {
      const search = (formData.bookingSearch || "").toLowerCase();
      return [
        booking.displayId,
        booking._id,
        booking.customerName,
        booking.customerEmail,
        booking.customerPhone,
        booking.customerRef,
      ].some((value) => value.toLowerCase().includes(search));
    } catch (err) {
      console.error("Booking filter error:", err);
      return false;
    }
  });

  const formatCategoryLabel = (category: string, customCategory?: string) => {
    if (category === 'other' && customCategory?.trim()) {
      return customCategory.trim();
    }
    return category.replace(/_/g, ' ');
  };

  const formatMinutes = (mins: number) => {
    if (!mins || mins <= 0) return '0m';
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const formatLocationLabel = (location?: { apartmentName?: string; area?: string; city?: string } | null) => {
    if (!location) return '';
    return [location.apartmentName, location.area, location.city].filter(Boolean).join(', ');
  };

  const selectedLocationLabel = useMemo(() => {
    if (selectedLocationId === 'all') {
      return 'All locations';
    }
    const selectedLocation = locations.find((location) => location._id === selectedLocationId);
    return selectedLocation
      ? formatLocationLabel(selectedLocation)
      : 'Selected location';
  }, [locations, selectedLocationId]);

  const getBookingDisplayId = (expense: Expense) => {
    if (!expense.bookingId) return '—';
    return expense.bookingId.bookingId || `BK-${expense.bookingId._id.slice(-6).toUpperCase()}`;
  };

  const getWageBookingDisplayId = (booking: WageDetailItem['bookingBreakdown'][number]) => {
    if (booking.bookingId) return booking.bookingId;
    return `BK-${booking.bookingMongoId.slice(-6).toUpperCase()}`;
  };

  const visibleRevenueServices = showAllRevenueServices
    ? profitStats.revenueByService
    : profitStats.revenueByService.slice(0, DEFAULT_VISIBLE_ITEMS);

  const visibleWages = showAllWages
    ? profitStats.wageDetails
    : profitStats.wageDetails.slice(0, DEFAULT_VISIBLE_ITEMS);

  const toggleWageBreakdown = (wageId: string) => {
    setExpandedWageBreakdowns((current) => ({
      ...current,
      [wageId]: !current[wageId]
    }));
  };

  const superAdminExpenseDetails = useMemo(() => {
    const projectExpenses = expenses.filter(expense => expense.type === 'project_expense');
    const operationalExpenses = expenses.filter(expense => expense.type === 'operational_expense');
    const averageExpense = expenses.length > 0 ? grandTotal / expenses.length : 0;
    const highestExpense = expenses.reduce<Expense | null>((highest, expense) => {
      if (!highest || expense.amount > highest.amount) {
        return expense;
      }
      return highest;
    }, null);

    const topCategoryEntry = Object.entries(summary).sort(([, a], [, b]) => b.total - a.total)[0] || null;

    return {
      projectTotal: projectExpenses.reduce((sum, expense) => sum + expense.amount, 0),
      projectCount: projectExpenses.length,
      operationalTotal: operationalExpenses.reduce((sum, expense) => sum + expense.amount, 0),
      operationalCount: operationalExpenses.length,
      averageExpense,
      highestExpense,
      topCategoryEntry,
    };
  }, [expenses, grandTotal, summary]);

  return (
    <AppLayout userType={role} userName={name}>
      <div className="space-y-6 px-4 py-6 sm:px-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3 mb-2">
              <IndianRupee className="h-9 w-9 text-primary" />
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
                    ) : normalizedBookings.length > 5 ? (
                      <>
                        <input
                          type="text"
                          placeholder="🔍 Search booking ID, customer name, phone, or email..."
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
                                  {booking.displayId} - {booking.customerName}
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
                        {normalizedBookings.map(booking => (
                          <option key={booking._id} value={booking._id}>
                            {booking.displayId} - {booking.customerName}
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

                <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Expense Proofs
                    </label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Upload bills, receipts, or product photos for reference. Admins can attach 2, 3, or up to 5 proof files for the same expense.
                    </p>
                    <input
                      ref={proofFileInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => handleProofFileSelection(e.target.files)}
                    />
                    <button
                      type="button"
                      onClick={() => proofFileInputRef.current?.click()}
                      className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {selectedProofFiles.length > 0
                          ? `${selectedProofFiles.length} file${selectedProofFiles.length !== 1 ? 's' : ''} selected`
                          : 'Click to add proof files'}
                      </span>
                    </button>
                  </div>

                  {selectedProofFiles.length > 0 && (
                    <div className="rounded-lg bg-background p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">New files to upload</p>
                      <div className="space-y-2">
                        {selectedProofFiles.map((file) => (
                          <div
                            key={`${file.name}-${file.lastModified}`}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                          >
                            <p className="text-sm text-foreground break-all">{file.name}</p>
                            <button
                              type="button"
                              onClick={() => removeSelectedProofFile(file)}
                              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                              aria-label={`Remove ${file.name}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {editingId && getExpenseProofs(expenses.find((expense) => expense._id === editingId) || { _id: '', title: '', amount: 0, category: '', date: '', type: 'operational_expense', createdBy: { _id: '', name: '', email: '' }, createdAt: '' }).length > 0 && (
                    <div className="rounded-lg bg-background p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Existing proofs</p>
                      <div className="flex flex-wrap gap-2">
                        {getExpenseProofs(expenses.find((expense) => expense._id === editingId) || { _id: '', title: '', amount: 0, category: '', date: '', type: 'operational_expense', createdBy: { _id: '', name: '', email: '' }, createdAt: '' }).map((proof, index) => (
                          <a
                            key={`${proof.url}-${index}`}
                            href={getProofUrl(proof.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/70"
                          >
                            {proof.originalName || `Proof ${index + 1}`}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
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
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-3 mb-2">
                <TrendingUp className="h-7 w-7 text-primary" />
                Total Profit & System Overview
              </h2>
              <p className="text-sm text-muted-foreground">
                Revenue, expenses, wages, and overall profit calculation
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Scope: {selectedLocationLabel}
              </p>
            </div>
            <div className="flex gap-3 items-center w-full sm:w-auto">
              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
                  <select
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    className="input-clean text-sm py-1 px-2 w-full sm:min-w-[220px]"
                  >
                    <option value="all">All locations</option>
                    {locations.map((location) => (
                      <option key={location._id} value={location._id}>
                        {formatLocationLabel(location)}
                      </option>
                    ))}
                  </select>
                </div>
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

          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Revenue by Service</p>
                <p className="text-sm text-emerald-800/80">Overall revenue is now rolled up from each completed service in the selected scope.</p>
              </div>
            </div>

            {profitStats.revenueByService.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed services found in the selected range.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {visibleRevenueServices.map((item) => (
                    <div key={`${item.serviceId}-${item.serviceName}`} className="rounded-xl border border-emerald-100 bg-white/80 p-4">
                      <p className="text-sm font-semibold text-foreground break-words">{item.serviceName}</p>
                      <p className="mt-2 text-2xl font-bold text-emerald-700">₹{item.totalRevenue.toLocaleString()}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.bookingCount} completed booking{item.bookingCount !== 1 ? 's' : ''}</p>
                    </div>
                  ))}
                </div>
                {profitStats.revenueByService.length > DEFAULT_VISIBLE_ITEMS && (
                  <div className="mt-3 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setShowAllRevenueServices((current) => !current)}
                      className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      {showAllRevenueServices
                        ? 'Show fewer services'
                        : `Show ${profitStats.revenueByService.length - DEFAULT_VISIBLE_ITEMS} more service${profitStats.revenueByService.length - DEFAULT_VISIBLE_ITEMS !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Wage Payments</p>
              <p className="text-sm text-blue-900/80">See who was paid, how long they worked, and who processed the payment in the selected scope.</p>
            </div>

            {profitStats.wageDetails.length === 0 ? (
              <p className="text-sm text-muted-foreground">No wage payments found in the selected range.</p>
            ) : (
              <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {visibleWages.map((wage) => {
                  const isBreakdownExpanded = !!expandedWageBreakdowns[wage._id];
                  const visibleBookingBreakdown = isBreakdownExpanded
                    ? wage.bookingBreakdown
                    : wage.bookingBreakdown.slice(0, DEFAULT_VISIBLE_ITEMS);

                  return (
                  <div key={wage._id} className="rounded-xl border border-blue-100 bg-white/85 p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Paid to</p>
                        <p className="text-sm font-semibold text-foreground break-words">{wage.worker?.name || 'Worker'}</p>
                        {wage.worker?.email && (
                          <p className="text-xs text-muted-foreground break-all">{wage.worker.email}</p>
                        )}
                        {wage.worker?.phone && (
                          <p className="text-xs text-muted-foreground">Phone: {wage.worker.phone}</p>
                        )}
                      </div>
                      <p className="text-lg font-bold text-blue-700">₹{wage.amount.toLocaleString()}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-blue-50 p-2">
                        <p className="text-muted-foreground">Time worked</p>
                        <p className="font-semibold text-foreground">{formatMinutes(wage.totalMinutesWorked)}</p>
                      </div>
                      <div className="rounded-lg bg-blue-50 p-2">
                        <p className="text-muted-foreground">Tasks</p>
                        <p className="font-semibold text-foreground">{wage.totalTasksCompleted}</p>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p><span className="font-medium text-foreground">Paid by:</span> {wage.paidBy?.name || 'Not recorded'}</p>
                      {wage.paidBy?.email && (
                        <p><span className="font-medium text-foreground">Payer email:</span> {wage.paidBy.email}</p>
                      )}
                      <p><span className="font-medium text-foreground">Rate:</span> ₹{wage.hourlyRate}/hr</p>
                      {wage.paidAt && (
                        <p>
                          <span className="font-medium text-foreground">Paid on:</span>{' '}
                          {new Date(wage.paidAt).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      )}
                      <p><span className="font-medium text-foreground">Worked time:</span> {formatMinutes(wage.totalMinutesWorked)}</p>
                      <p>
                        <span className="font-medium text-foreground">Work period:</span>{' '}
                        {new Date(wage.periodFrom).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short'
                        })}
                        {' — '}
                        {new Date(wage.periodTo).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                      {formatLocationLabel(wage.location) && (
                        <p><span className="font-medium text-foreground">Location:</span> {formatLocationLabel(wage.location)}</p>
                      )}
                    </div>

                    {wage.bookingBreakdown.length > 0 && (
                      <div className="rounded-xl border border-blue-100 bg-slate-50/90 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 border-b border-blue-100 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">Booking / service breakdown</p>
                          <p className="text-[11px] text-muted-foreground">{wage.bookingBreakdown.length} item{wage.bookingBreakdown.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="divide-y divide-blue-100">
                          {visibleBookingBreakdown.map((booking) => (
                            <div key={`${wage._id}-${booking.bookingMongoId}`} className="grid grid-cols-1 gap-2 px-3 py-2 text-xs md:grid-cols-[minmax(0,1.5fr)_auto_auto] md:items-start md:gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground break-words">{getWageBookingDisplayId(booking)} · {booking.serviceName}</p>
                                <div className="mt-1 space-y-0.5 text-muted-foreground">
                                  {booking.bookingDate && (
                                    <p>
                                      Date:{' '}
                                      {new Date(booking.bookingDate).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                      })}
                                    </p>
                                  )}
                                  {formatLocationLabel(booking.location) && (
                                    <p className="break-words">Location: {formatLocationLabel(booking.location)}</p>
                                  )}
                                </div>
                              </div>
                              <div className="rounded-md bg-white px-2 py-1 text-left md:text-center">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Worked</p>
                                <p className="font-semibold text-foreground">{formatMinutes(booking.minutesWorked)}</p>
                              </div>
                              <div className="rounded-md bg-white px-2 py-1 text-left md:text-right">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Wage</p>
                                <p className="font-semibold text-blue-700">₹{booking.allocatedAmount.toLocaleString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {wage.bookingBreakdown.length > DEFAULT_VISIBLE_ITEMS && (
                          <div className="border-t border-blue-100 px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleWageBreakdown(wage._id)}
                              className="text-xs font-medium text-blue-700 hover:text-blue-800"
                            >
                              {isBreakdownExpanded
                                ? 'Show fewer breakdown items'
                                : `Show ${wage.bookingBreakdown.length - DEFAULT_VISIBLE_ITEMS} more item${wage.bookingBreakdown.length - DEFAULT_VISIBLE_ITEMS !== 1 ? 's' : ''}`}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )})}
              </div>
              {profitStats.wageDetails.length > DEFAULT_VISIBLE_ITEMS && (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowAllWages((current) => !current)}
                    className="text-sm font-medium text-blue-700 hover:text-blue-800"
                  >
                    {showAllWages
                      ? 'Show fewer wage payments'
                      : `Show ${profitStats.wageDetails.length - DEFAULT_VISIBLE_ITEMS} more wage payment${profitStats.wageDetails.length - DEFAULT_VISIBLE_ITEMS !== 1 ? 's' : ''}`}
                  </button>
                </div>
              )}
              </>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Operational Details</p>
              <p className="mt-2 text-2xl font-bold text-blue-800">₹{superAdminExpenseDetails.operationalTotal.toLocaleString()}</p>
              <p className="mt-1 text-sm text-blue-700">{superAdminExpenseDetails.operationalCount} operational expenses</p>
            </div>

            <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">Project Details</p>
              <p className="mt-2 text-2xl font-bold text-purple-800">₹{superAdminExpenseDetails.projectTotal.toLocaleString()}</p>
              <p className="mt-1 text-sm text-purple-700">{superAdminExpenseDetails.projectCount} booking-linked expenses</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Top Expense Category</p>
              <p className="mt-2 text-lg font-bold text-amber-800 break-words">
                {superAdminExpenseDetails.topCategoryEntry
                  ? formatCategoryLabel(superAdminExpenseDetails.topCategoryEntry[0])
                  : 'No category yet'}
              </p>
              <p className="mt-1 text-sm text-amber-700">
                {superAdminExpenseDetails.topCategoryEntry
                  ? `₹${superAdminExpenseDetails.topCategoryEntry[1].total.toLocaleString()} across ${superAdminExpenseDetails.topCategoryEntry[1].count} entries`
                  : 'Add expenses to see category insights'}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Largest Recorded Expense</p>
              <p className="mt-2 text-2xl font-bold text-emerald-800">
                ₹{superAdminExpenseDetails.highestExpense?.amount.toLocaleString() || 0}
              </p>
              <p className="mt-1 text-sm text-emerald-700 break-words">
                {superAdminExpenseDetails.highestExpense
                  ? `${superAdminExpenseDetails.highestExpense.title} · Avg ₹${Math.round(superAdminExpenseDetails.averageExpense).toLocaleString()}`
                  : 'No expense data yet'}
              </p>
            </div>
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
          {role === 'super_admin' && (
            <div className="flex items-center text-xs text-muted-foreground px-2">
              Viewing <span className="font-semibold text-foreground ml-1">{selectedLocationLabel}</span>
            </div>
          )}
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
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Linked Project</th>
                  {role === 'super_admin' && (
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Created By</th>
                  )}
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
                          {formatCategoryLabel(expense.category, expense.customCategory)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-foreground">{expense.title}</p>
                        {expense.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{expense.description}</p>
                        )}
                        {getExpenseProofs(expense).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {getExpenseProofs(expense).slice(0, 2).map((proof, index) => (
                              <a
                                key={`${proof.url}-${index}`}
                                href={getProofUrl(proof.url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
                              >
                                {proof.originalName || `Proof ${index + 1}`}
                              </a>
                            ))}
                            {getExpenseProofs(expense).length > 2 && (
                              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                +{getExpenseProofs(expense).length - 2} more proof{getExpenseProofs(expense).length - 2 !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
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
                        <div className="space-y-1">
                          <p className="font-medium text-sm text-foreground">{getBookingDisplayId(expense)}</p>
                          {expense.bookingId.service?.name && (
                            <p className="text-xs text-muted-foreground">Service: {expense.bookingId.service.name}</p>
                          )}
                          {expense.bookingId.customer?.name && (
                            <p className="text-xs text-muted-foreground">Customer: {expense.bookingId.customer.name}</p>
                          )}
                          {formatLocationLabel(expense.bookingId.location || expense.location) && (
                            <p className="text-xs text-muted-foreground">Location: {formatLocationLabel(expense.bookingId.location || expense.location)}</p>
                          )}
                          {expense.bookingId.bookingDate && (
                            <p className="text-xs text-muted-foreground">
                              Booking date: {new Date(expense.bookingId.bookingDate).toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>
                    {role === 'super_admin' && (
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">{expense.createdBy?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground break-all">{expense.createdBy?.email || '—'}</p>
                        </div>
                      </td>
                    )}
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
