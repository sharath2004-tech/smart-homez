import AppLayout from "@/components/AppLayout";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useConfirm } from "@/hooks/useConfirm";
import { api } from "@/lib/api";
import { AlertTriangle, Edit, Eye, EyeOff, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface SubscriptionSection {
  _id: string;
  name: string;
  description: string;
  emoji: string;
  icon: string;
  color: string;
  filterConfig: {
    serviceTypeIncludes: string[];
    serviceTypeExcludes: string[];
    namePatternsInclude: string[];
    namePatternsExclude: string[];
  };
  sortOrder: number;
  isActive: boolean;
  createdBy: { name: string; email: string };
  createdAt: string;
}

const ICONS = ['Users', 'Droplet', 'Home', 'Sparkles', 'Clock', 'Heart', 'Zap', 'Package', 'Wind'];
const COLORS = ['blue', 'teal', 'green', 'purple', 'orange', 'red', 'pink', 'yellow'];

const AdminSubscriptionSections = () => {
  const { role, name } = useAdminRole();
  const confirm = useConfirm();
  const [sections, setSections] = useState<SubscriptionSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    emoji: "📦",
    icon: "Package",
    color: "blue",
    sortOrder: 0,
    filterConfig: {
      serviceTypeIncludes: [],
      serviceTypeExcludes: [],
      namePatternsInclude: [],
      namePatternsExclude: []
    }
  });

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    try {
      setLoading(true);
      const response = await api.get('/subscription-sections/admin/all');
      setSections(response.sections || []);
    } catch (error) {
      toast.error("Failed to load subscription sections");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setSubmitting(true);

      if (editingId) {
        await api.patch(`/subscription-sections/${editingId}`, formData);
        toast.success("Subscription section updated successfully!");
      } else {
        await api.post('/subscription-sections', formData);
        toast.success("Subscription section created successfully!");
      }

      resetForm();
      fetchSections();
      setShowForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save section");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (section: SubscriptionSection) => {
    setFormData({
      name: section.name,
      description: section.description,
      emoji: section.emoji,
      icon: section.icon,
      color: section.color,
      sortOrder: section.sortOrder,
      filterConfig: section.filterConfig
    });
    setEditingId(section._id);
    setShowForm(true);
  };

  const handleToggle = async (id: string) => {
    try {
      await api.patch(`/subscription-sections/${id}/toggle`);
      toast.success("Section status updated!");
      fetchSections();
    } catch (error) {
      toast.error("Failed to toggle section");
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm("Are you sure you want to delete this section? This cannot be undone.")) return;

    try {
      await api.delete(`/subscription-sections/${id}`);
      toast.success("Section deleted successfully!");
      fetchSections();
    } catch (error) {
      toast.error("Failed to delete section");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      emoji: "📦",
      icon: "Package",
      color: "blue",
      sortOrder: 0,
      filterConfig: {
        serviceTypeIncludes: [],
        serviceTypeExcludes: [],
        namePatternsInclude: [],
        namePatternsExclude: []
      }
    });
    setEditingId(null);
  };

  const filteredSections = sections.filter(
    (s) =>
      s.name.toLowerCase().includes(searching.toLowerCase()) ||
      s.description.toLowerCase().includes(searching.toLowerCase())
  );

  const getColorBg = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: "from-blue-50 to-blue-100",
      teal: "from-teal-50 to-teal-100",
      green: "from-green-50 to-green-100",
      purple: "from-purple-50 to-purple-100",
      orange: "from-orange-50 to-orange-100",
      red: "from-red-50 to-red-100",
      pink: "from-pink-50 to-pink-100",
      yellow: "from-yellow-50 to-yellow-100"
    };
    return colorMap[color] || "from-gray-50 to-gray-100";
  };

  return (
    <AppLayout userType={role} userName={name}>
      <div className="px-4 py-6 sm:px-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              📑 Subscription Sections
            </h1>
            <p className="text-muted-foreground">
              Create and manage subscription categories that customers see
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="btn-brand flex items-center gap-2 px-4 py-2 rounded-lg"
          >
            <Plus className="h-5 w-5" />
            New Section
          </button>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">💡 How it works:</p>
            <ul className="space-y-1 text-xs">
              <li>✅ Create sections to organize subscriptions (e.g., "Maid Services", "Washroom Cleaning")</li>
              <li>✅ Use filters to automatically group related services</li>
              <li>✅ Customers will see these sections on their subscriptions page</li>
              <li>✅ Toggle sections on/off without deleting them</li>
            </ul>
          </div>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-foreground">
                  {editingId ? "✏️ Edit Section" : "➕ New Section"}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="p-1 hover:bg-muted rounded-lg"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name & Sort Order */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Section Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input-clean w-full"
                      placeholder="e.g., Maid Services"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                      className="input-clean w-full"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-clean w-full resize-none"
                    rows={3}
                    placeholder="Brief description shown to customers"
                    required
                  />
                </div>

                {/* Emoji & Icon & Color */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Emoji
                    </label>
                    <input
                      type="text"
                      value={formData.emoji}
                      onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                      className="input-clean w-full text-center text-2xl"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Icon
                    </label>
                    <select
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className="input-clean w-full"
                    >
                      {ICONS.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Color
                    </label>
                    <select
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="input-clean w-full"
                    >
                      {COLORS.map((color) => (
                        <option key={color} value={color}>
                          {color.charAt(0).toUpperCase() + color.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Filter Config Info */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-semibold text-amber-900 mb-2">🔧 Advanced Filtering:</p>
                  <p className="text-xs text-amber-800">
                    Use patterns to automatically group subscriptions. Example: name patterns
                    "maid" will show subscriptions with "maid" in the name.
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-brand flex-1 flex items-center justify-center gap-2"
                  >
                    {submitting ? "Saving..." : editingId ? "Update Section" : "Create Section"}
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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="🔍 Search sections..."
            value={searching}
            onChange={(e) => setSearching(e.target.value)}
            className="input-clean w-full pl-10"
          />
        </div>

        {/* Sections Grid */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading sections...</p>
          </div>
        ) : filteredSections.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <p className="text-lg font-semibold text-foreground mb-2">📭 No Sections Found</p>
            <p className="text-muted-foreground mb-4">Create your first subscription section to get started</p>
            <button
              onClick={() => setShowForm(true)}
              className="btn-brand inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Section
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredSections.map((section) => (
              <div
                key={section._id}
                className={`card-elevated p-6 bg-gradient-to-br ${getColorBg(section.color)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left */}
                  <div className="flex-1">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="text-4xl">{section.emoji}</div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-foreground">{section.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-4">
                      <div className="bg-white/50 rounded px-3 py-2">
                        <p className="text-muted-foreground">Icon</p>
                        <p className="font-semibold text-foreground">{section.icon}</p>
                      </div>
                      <div className="bg-white/50 rounded px-3 py-2">
                        <p className="text-muted-foreground">Color</p>
                        <p className="font-semibold text-foreground capitalize">{section.color}</p>
                      </div>
                      <div className="bg-white/50 rounded px-3 py-2">
                        <p className="text-muted-foreground">Order</p>
                        <p className="font-semibold text-foreground">{section.sortOrder}</p>
                      </div>
                      <div className="bg-white/50 rounded px-3 py-2">
                        <p className="text-muted-foreground">Status</p>
                        <p className={`font-semibold ${section.isActive ? 'text-green-600' : 'text-red-600'}`}>
                          {section.isActive ? "Active" : "Inactive"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleToggle(section._id)}
                      className={`p-2 rounded-lg transition-colors ${
                        section.isActive
                          ? "hover:bg-amber-100 text-amber-600"
                          : "hover:bg-green-100 text-green-600"
                      }`}
                      title={section.isActive ? "Deactivate" : "Activate"}
                    >
                      {section.isActive ? (
                        <Eye className="h-5 w-5" />
                      ) : (
                        <EyeOff className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(section)}
                      className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors"
                      title="Edit"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(section._id)}
                      className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminSubscriptionSections;
