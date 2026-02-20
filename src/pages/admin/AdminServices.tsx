import AppLayout from "@/components/AppLayout";
import { authAPI, servicesAPI } from "@/lib/api";
import { Edit, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Service {
  _id?: string;
  name: string;
  description: string;
  category: string;
  price: number;
  pricingPlans: {
    oneTime: number;
    daily: number;
    weekly: number;
    monthly: number;
  };
  duration: number;
  isActive: boolean;
}

const AdminServices = () => {
  const [profile, setProfile] = useState<any>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Service>({
    name: '',
    description: '',
    category: 'cleaning',
    price: 500,
    pricingPlans: {
      oneTime: 500,
      daily: 425,
      weekly: 2625,
      monthly: 9750
    },
    duration: 60,
    isActive: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profileData, servicesData] = await Promise.all([
        authAPI.getProfile(),
        servicesAPI.getAll({}) // Get all services (no filter)
      ]);
      setProfile(profileData.user || profileData);
      setServices(servicesData.services || []);
      console.log('Loaded services:', servicesData.services?.length || 0);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name || !formData.description || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    if (formData.price <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }
    
    if (formData.duration <= 0) {
      toast.error('Duration must be greater than 0');
      return;
    }
    
    try {
      console.log('Submitting service data:', formData);
      
      if (editingId) {
        await servicesAPI.update(editingId, formData);
      } else {
        await servicesAPI.create(formData);
      }

      toast.success(editingId ? 'Service updated!' : 'Service created!');
      setShowForm(false);
      setEditingId(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save service');
    }
  };

  const handleEdit = (service: Service) => {
    setFormData({
      name: service.name,
      description: service.description,
      category: service.category,
      price: service.price,
      pricingPlans: service.pricingPlans || {
        oneTime: service.price,
        daily: Math.round(service.price * 0.85),
        weekly: Math.round(service.price * 0.75 * 7),
        monthly: Math.round(service.price * 0.65 * 30)
      },
      duration: service.duration,
      isActive: service.isActive
    });
    setEditingId(service._id!);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;

    try {
      await servicesAPI.delete(id);
      toast.success('Service deleted!');
      fetchData();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('Failed to delete service');
    }
  };

  const resetForm = () => {
    const defaultPrice = 500;
    setFormData({
      name: '',
      description: '',
      category: 'cleaning',
      price: defaultPrice,
      pricingPlans: {
        oneTime: defaultPrice,
        daily: Math.round(defaultPrice * 0.85),
        weekly: Math.round(defaultPrice * 0.75 * 7),
        monthly: Math.round(defaultPrice * 0.65 * 30)
      },
      duration: 60,
      isActive: true
    });
  };

  const handlePriceChange = (price: number) => {
    setFormData({
      ...formData,
      price,
      pricingPlans: {
        oneTime: price,
        daily: Math.round(price * 0.85),
        weekly: Math.round(price * 0.75 * 7),
        monthly: Math.round(price * 0.65 * 30)
      }
    });
  };

  const filteredServices = services.filter(service => 
    service.name.toLowerCase().includes(search.toLowerCase()) ||
    service.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout userType="admin" userName={profile?.name || "Admin"}>
      <div className="space-y-6 pb-20 md:pb-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Services Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage services, pricing plans, and availability
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingId(null);
              setShowForm(true);
            }}
            className="btn-brand flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services..."
            className="input-clean pl-10"
          />
        </div>

        {/* Services List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-sm text-muted-foreground">Loading services...</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredServices.map((service) => (
              <div key={service._id} className="card-elevated p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-foreground">{service.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        service.isActive 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                      }`}>
                        {service.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 capitalize">
                        {service.category}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{service.description}</p>
                    
                    {/* Pricing */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">One Time</div>
                        <div className="text-lg font-bold text-foreground">
                          ₹{service.pricingPlans?.oneTime || service.price}
                        </div>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">Daily</div>
                        <div className="text-lg font-bold text-foreground">
                          ₹{service.pricingPlans?.daily || Math.round(service.price * 0.85)}
                        </div>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">Weekly</div>
                        <div className="text-lg font-bold text-foreground">
                          ₹{service.pricingPlans?.weekly || Math.round(service.price * 0.75 * 7)}
                        </div>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">Monthly</div>
                        <div className="text-lg font-bold text-foreground">
                          ₹{service.pricingPlans?.monthly || Math.round(service.price * 0.65 * 30)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-muted-foreground">
                      Duration: {service.duration} minutes
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(service)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4 text-primary" />
                    </button>
                    <button
                      onClick={() => handleDelete(service._id!)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-card border-b border-border p-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">
                  {editingId ? 'Edit Service' : 'Add New Service'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    resetForm();
                  }}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Service Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-clean"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-clean resize-none"
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="input-clean"
                      required
                    >
                      <option value="cleaning">Cleaning</option>
                      <option value="health">Health</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="consultation">Consultation</option>
                      <option value="therapy">Therapy</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Duration (minutes) *
                    </label>
                    <input
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                      className="input-clean"
                      min="15"
                      step="15"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Base Price (₹) *
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => handlePriceChange(Number(e.target.value))}
                    className="input-clean"
                    min="0"
                    step="10"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Pricing plans will be calculated automatically
                  </p>
                </div>

                {/* Pricing Plans */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-foreground">
                    Pricing Plans
                  </label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted rounded-lg">
                      <label className="block text-xs text-muted-foreground mb-1">One Time</label>
                      <input
                        type="number"
                        value={formData.pricingPlans.oneTime}
                        onChange={(e) => setFormData({
                          ...formData,
                          pricingPlans: { ...formData.pricingPlans, oneTime: Number(e.target.value) }
                        })}
                        className="input-clean"
                        min="0"
                      />
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <label className="block text-xs text-muted-foreground mb-1">Daily</label>
                      <input
                        type="number"
                        value={formData.pricingPlans.daily}
                        onChange={(e) => setFormData({
                          ...formData,
                          pricingPlans: { ...formData.pricingPlans, daily: Number(e.target.value) }
                        })}
                        className="input-clean"
                        min="0"
                      />
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <label className="block text-xs text-muted-foreground mb-1">Weekly</label>
                      <input
                        type="number"
                        value={formData.pricingPlans.weekly}
                        onChange={(e) => setFormData({
                          ...formData,
                          pricingPlans: { ...formData.pricingPlans, weekly: Number(e.target.value) }
                        })}
                        className="input-clean"
                        min="0"
                      />
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <label className="block text-xs text-muted-foreground mb-1">Monthly</label>
                      <input
                        type="number"
                        value={formData.pricingPlans.monthly}
                        onChange={(e) => setFormData({
                          ...formData,
                          pricingPlans: { ...formData.pricingPlans, monthly: Number(e.target.value) }
                        })}
                        className="input-clean"
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-foreground">
                    Service is active
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                      resetForm();
                    }}
                    className="flex-1 py-3 border-2 border-border rounded-xl font-semibold hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 btn-brand flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {editingId ? 'Update' : 'Create'} Service
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

export default AdminServices;
