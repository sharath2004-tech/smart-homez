import AppLayout from "@/components/AppLayout";
import { authAPI, servicesAPI } from "@/lib/api";
import { Edit, Info, Plus, Save, Search, Trash2, X } from "lucide-react";
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
  subscriptionPlans?: Array<{
    id: string;
    name: string;
    displayName: string;
    icon: string;
    description: string;
    price: number;
    discountPercentage: number;
    isActive: boolean;
    requiresFixedWorker: boolean;
    allowDaySelection: boolean;
    sortOrder: number;
  }>;
  duration: number;
  isActive: boolean;
  additionalServiceOptions?: Array<{
    value: string;
    label: string;
    price: number;
  }>;
}

interface UserProfile {
  role: string;
  name: string;
  email: string;
  [key: string]: unknown;
}

const AdminServices = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
    subscriptionPlans: [
      {
        id: 'oneTime',
        name: 'oneTime',
        displayName: 'One-Time',
        icon: '📅',
        description: 'Single service',
        price: 500,
        discountPercentage: 0,
        isActive: true,
        requiresFixedWorker: false,
        allowDaySelection: false,
        sortOrder: 1
      },
      {
        id: 'daily',
        name: 'daily',
        displayName: 'Daily',
        icon: '🌅',
        description: 'Every day',
        price: 425,
        discountPercentage: 15,
        isActive: true,
        requiresFixedWorker: true,
        allowDaySelection: false,
        sortOrder: 2
      },
      {
        id: 'weekly',
        name: 'weekly',
        displayName: 'Weekly',
        icon: '📆',
        description: 'Select days',
        price: 375,
        discountPercentage: 25,
        isActive: true,
        requiresFixedWorker: true,
        allowDaySelection: true,
        sortOrder: 3
      },
      {
        id: 'monthly',
        name: 'monthly',
        displayName: 'Monthly',
        icon: '🗓️',
        description: 'Once a month',
        price: 325,
        discountPercentage: 35,
        isActive: true,
        requiresFixedWorker: true,
        allowDaySelection: false,
        sortOrder: 4
      }
    ],
    duration: 60,
    isActive: true,
    additionalServiceOptions: []
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
    <AppLayout userType={profile?.role === 'super_admin' ? 'super_admin' : 'admin'} userName={profile?.name || "Admin"}>
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

                    <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>Duration: {service.duration} minutes</span>
                      {service.subscriptionPlans && service.subscriptionPlans.filter(p => p.isActive).length > 0 && (
                        <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100 rounded text-xs font-medium">
                          {service.subscriptionPlans.filter(p => p.isActive).length} subscription plan{service.subscriptionPlans.filter(p => p.isActive).length > 1 ? 's' : ''}
                        </span>
                      )}
                      {service.additionalServiceOptions && service.additionalServiceOptions.length > 0 && (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded text-xs font-medium">
                          {service.additionalServiceOptions.length} additional option{service.additionalServiceOptions.length > 1 ? 's' : ''}
                        </span>
                      )}
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

                {/* Subscription Plans Section */}
                <div className="space-y-3 p-4 bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg border-2 border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-foreground">
                        Subscription Plans
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Create custom booking plans - Each service can have unique subscription options
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <select
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const template = JSON.parse(e.target.value);
                          const newPlan = {
                            ...template,
                            id: `${template.name}-${Date.now()}`,
                            sortOrder: (formData.subscriptionPlans?.length || 0) + 1
                          };
                          setFormData({
                            ...formData,
                            subscriptionPlans: [
                              ...(formData.subscriptionPlans || []),
                              newPlan
                            ]
                          });
                          e.target.value = ''; // Reset select
                        }}
                        className="text-xs px-3 py-1.5 bg-background border border-border rounded-lg hover:border-primary transition-colors"
                      >
                        <option value="">+ Add from Template</option>
                        <optgroup label="Basic Plans">
                          <option value={JSON.stringify({name: 'oneTime', displayName: 'One-Time', icon: '📅', description: 'Single service', price: formData.price, discountPercentage: 0, isActive: true, requiresFixedWorker: false, allowDaySelection: false})}>
                            One-Time Booking
                          </option>
                          <option value={JSON.stringify({name: 'daily', displayName: 'Daily', icon: '🌅', description: 'Every day', price: Math.round(formData.price * 0.85), discountPercentage: 15, isActive: true, requiresFixedWorker: true, allowDaySelection: false})}>
                            Daily (15% off)
                          </option>
                          <option value={JSON.stringify({name: 'weekly', displayName: 'Weekly', icon: '📆', description: 'Select days', price: Math.round(formData.price * 0.75), discountPercentage: 25, isActive: true, requiresFixedWorker: true, allowDaySelection: true})}>
                            Weekly (25% off)
                          </option>
                          <option value={JSON.stringify({name: 'monthly', displayName: 'Monthly', icon: '🗓️', description: 'Once a month', price: Math.round(formData.price * 0.65), discountPercentage: 35, isActive: true, requiresFixedWorker: true, allowDaySelection: false})}>
                            Monthly (35% off)
                          </option>
                        </optgroup>
                        <optgroup label="Flexible Plans">
                          <option value={JSON.stringify({name: 'biweekly', displayName: 'Bi-Weekly', icon: '📋', description: 'Every 2 weeks', price: Math.round(formData.price * 0.80), discountPercentage: 20, isActive: true, requiresFixedWorker: true, allowDaySelection: false})}>
                            Bi-Weekly (20% off)
                          </option>
                          <option value={JSON.stringify({name: 'weekend', displayName: 'Weekend Only', icon: '🎉', description: 'Sat & Sun', price: Math.round(formData.price * 0.85), discountPercentage: 15, isActive: true, requiresFixedWorker: true, allowDaySelection: true})}>
                            Weekend Only
                          </option>
                          <option value={JSON.stringify({name: 'weekday', displayName: 'Weekday Only', icon: '💼', description: 'Mon-Fri', price: Math.round(formData.price * 0.80), discountPercentage: 20, isActive: true, requiresFixedWorker: true, allowDaySelection: true})}>
                            Weekday Only
                          </option>
                        </optgroup>
                        <optgroup label="Premium Plans">
                          <option value={JSON.stringify({name: 'quarterly', displayName: 'Quarterly', icon: '🎯', description: 'Every 3 months', price: Math.round(formData.price * 0.55), discountPercentage: 45, isActive: true, requiresFixedWorker: true, allowDaySelection: false})}>
                            Quarterly (45% off)
                          </option>
                          <option value={JSON.stringify({name: 'annual', displayName: 'Annual', icon: '🏆', description: 'Yearly plan', price: Math.round(formData.price * 0.50), discountPercentage: 50, isActive: true, requiresFixedWorker: true, allowDaySelection: false})}>
                            Annual (50% off)
                          </option>
                          <option value={JSON.stringify({name: 'trial', displayName: 'Trial', icon: '🎁', description: '3-day trial', price: Math.round(formData.price * 0.50), discountPercentage: 50, isActive: true, requiresFixedWorker: false, allowDaySelection: false})}>
                            Trial (3 days)
                          </option>
                        </optgroup>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const newPlan = {
                            id: `custom-${Date.now()}`,
                            name: `custom-${Date.now()}`,
                            displayName: 'Custom Plan',
                            icon: '✨',
                            description: 'Custom subscription',
                            price: formData.price,
                            discountPercentage: 0,
                            isActive: true,
                            requiresFixedWorker: false,
                            allowDaySelection: false,
                            sortOrder: (formData.subscriptionPlans?.length || 0) + 1
                          };
                          setFormData({
                            ...formData,
                            subscriptionPlans: [
                              ...(formData.subscriptionPlans || []),
                              newPlan
                            ]
                          });
                        }}
                        className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1 whitespace-nowrap"
                      >
                        <Plus className="w-3 h-3" />
                        Custom Plan
                      </button>
                    </div>
                  </div>
                  
                  {/* Info Banner */}
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-blue-800 dark:text-blue-200">
                        <p className="font-medium mb-1">💡 Pro Tip: Customize plans per service</p>
                        <ul className="space-y-0.5 text-blue-700 dark:text-blue-300">
                          <li>• <strong>Cleaning services</strong> might offer Daily, Weekly, Bi-Weekly plans</li>
                          <li>• <strong>Health services</strong> could have Monthly check-up packages</li>
                          <li>• <strong>Maintenance</strong> might need Quarterly or Annual plans</li>
                          <li>• Set different prices for each plan - Not all services need the same discounts!</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  {formData.subscriptionPlans && formData.subscriptionPlans.length > 0 && (
                    <div className="space-y-3 mt-3">
                      {formData.subscriptionPlans.sort((a, b) => a.sortOrder - b.sortOrder).map((plan, index) => (
                        <div key={plan.id} className="p-4 bg-background rounded-lg border-2 border-border hover:border-primary/50 transition-colors">
                          <div className="grid gap-3">
                            {/* Row 1: Display Name, Icon, Active Status */}
                            <div className="grid grid-cols-12 gap-3">
                              <div className="col-span-5">
                                <label className="text-xs text-muted-foreground mb-1 block">Display Name</label>
                                <input
                                  type="text"
                                  placeholder="e.g., One-Time"
                                  value={plan.displayName}
                                  onChange={(e) => {
                                    const newPlans = [...(formData.subscriptionPlans || [])];
                                    newPlans[index] = { ...newPlans[index], displayName: e.target.value };
                                    setFormData({ ...formData, subscriptionPlans: newPlans });
                                  }}
                                  className="input-clean text-sm"
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="text-xs text-muted-foreground mb-1 block">Icon</label>
                                <input
                                  type="text"
                                  placeholder="📅"
                                  value={plan.icon}
                                  onChange={(e) => {
                                    const newPlans = [...(formData.subscriptionPlans || [])];
                                    newPlans[index] = { ...newPlans[index], icon: e.target.value };
                                    setFormData({ ...formData, subscriptionPlans: newPlans });
                                  }}
                                  className="input-clean text-sm text-center"
                                />
                              </div>
                              <div className="col-span-3">
                                <label className="text-xs text-muted-foreground mb-1 block">Price (₹)</label>
                                <input
                                  type="number"
                                  value={plan.price}
                                  onChange={(e) => {
                                    const newPlans = [...(formData.subscriptionPlans || [])];
                                    newPlans[index] = { ...newPlans[index], price: Number(e.target.value) };
                                    setFormData({ ...formData, subscriptionPlans: newPlans });
                                  }}
                                  className="input-clean text-sm"
                                  min="0"
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="text-xs text-muted-foreground mb-1 block">Discount %</label>
                                <input
                                  type="number"
                                  value={plan.discountPercentage}
                                  onChange={(e) => {
                                    const newPlans = [...(formData.subscriptionPlans || [])];
                                    newPlans[index] = { ...newPlans[index], discountPercentage: Number(e.target.value) };
                                    setFormData({ ...formData, subscriptionPlans: newPlans });
                                  }}
                                  className="input-clean text-sm"
                                  min="0"
                                  max="100"
                                />
                              </div>
                            </div>

                            {/* Row 2: Description */}
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                              <input
                                type="text"
                                placeholder="e.g., Single service"
                                value={plan.description}
                                onChange={(e) => {
                                  const newPlans = [...(formData.subscriptionPlans || [])];
                                  newPlans[index] = { ...newPlans[index], description: e.target.value };
                                  setFormData({ ...formData, subscriptionPlans: newPlans });
                                }}
                                className="input-clean text-sm"
                              />
                            </div>

                            {/* Row 3: Options */}
                            <div className="flex items-center gap-4 flex-wrap">
                              <label className="flex items-center gap-2 cursor-pointer text-sm">
                                <input
                                  type="checkbox"
                                  checked={plan.isActive}
                                  onChange={(e) => {
                                    const newPlans = [...(formData.subscriptionPlans || [])];
                                    newPlans[index] = { ...newPlans[index], isActive: e.target.checked };
                                    setFormData({ ...formData, subscriptionPlans: newPlans });
                                  }}
                                  className="w-3.5 h-3.5 accent-primary"
                                />
                                <span className="text-xs">Active</span>
                              </label>
                              
                              <label className="flex items-center gap-2 cursor-pointer text-sm">
                                <input
                                  type="checkbox"
                                  checked={plan.requiresFixedWorker}
                                  onChange={(e) => {
                                    const newPlans = [...(formData.subscriptionPlans || [])];
                                    newPlans[index] = { ...newPlans[index], requiresFixedWorker: e.target.checked };
                                    setFormData({ ...formData, subscriptionPlans: newPlans });
                                  }}
                                  className="w-3.5 h-3.5 accent-primary"
                                />
                                <span className="text-xs">Fixed Worker Required</span>
                              </label>
                              
                              <label className="flex items-center gap-2 cursor-pointer text-sm">
                                <input
                                  type="checkbox"
                                  checked={plan.allowDaySelection}
                                  onChange={(e) => {
                                    const newPlans = [...(formData.subscriptionPlans || [])];
                                    newPlans[index] = { ...newPlans[index], allowDaySelection: e.target.checked };
                                    setFormData({ ...formData, subscriptionPlans: newPlans });
                                  }}
                                  className="w-3.5 h-3.5 accent-primary"
                                />
                                <span className="text-xs">Allow Day Selection</span>
                              </label>

                              <div className="ml-auto flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newPlans = [...(formData.subscriptionPlans || [])];
                                    if (index > 0) {
                                      [newPlans[index - 1], newPlans[index]] = [newPlans[index], newPlans[index - 1]];
                                      newPlans[index - 1].sortOrder = index;
                                      newPlans[index].sortOrder = index + 1;
                                      setFormData({ ...formData, subscriptionPlans: newPlans });
                                    }
                                  }}
                                  className="p-1.5 text-xs hover:bg-muted rounded transition-colors"
                                  disabled={index === 0}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newPlans = [...(formData.subscriptionPlans || [])];
                                    if (index < newPlans.length - 1) {
                                      [newPlans[index], newPlans[index + 1]] = [newPlans[index + 1], newPlans[index]];
                                      newPlans[index].sortOrder = index + 1;
                                      newPlans[index + 1].sortOrder = index + 2;
                                      setFormData({ ...formData, subscriptionPlans: newPlans });
                                    }
                                  }}
                                  className="p-1.5 text-xs hover:bg-muted rounded transition-colors"
                                  disabled={index === (formData.subscriptionPlans?.length || 0) - 1}
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newPlans = formData.subscriptionPlans?.filter((_, i) => i !== index);
                                    setFormData({ ...formData, subscriptionPlans: newPlans });
                                  }}
                                  className="p-1.5 hover:bg-destructive/10 rounded transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Additional Services Section */}
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-foreground">
                      Additional Services (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          additionalServiceOptions: [
                            ...(formData.additionalServiceOptions || []),
                            { value: '', label: '', price: 0 }
                          ]
                        });
                      }}
                      className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Option
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Add extra service options customers can select (e.g., carpet cleaning, window cleaning)
                  </p>
                  
                  {formData.additionalServiceOptions && formData.additionalServiceOptions.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {formData.additionalServiceOptions.map((option, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 p-3 bg-background rounded-lg border border-border">
                          <div className="col-span-4">
                            <input
                              type="text"
                              placeholder="Value (e.g., carpet)"
                              value={option.value}
                              onChange={(e) => {
                                const newOptions = [...(formData.additionalServiceOptions || [])];
                                newOptions[index] = { ...newOptions[index], value: e.target.value };
                                setFormData({ ...formData, additionalServiceOptions: newOptions });
                              }}
                              className="input-clean text-sm"
                            />
                          </div>
                          <div className="col-span-5">
                            <input
                              type="text"
                              placeholder="Label (e.g., Carpet Cleaning)"
                              value={option.label}
                              onChange={(e) => {
                                const newOptions = [...(formData.additionalServiceOptions || [])];
                                newOptions[index] = { ...newOptions[index], label: e.target.value };
                                setFormData({ ...formData, additionalServiceOptions: newOptions });
                              }}
                              className="input-clean text-sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              placeholder="Price"
                              value={option.price}
                              onChange={(e) => {
                                const newOptions = [...(formData.additionalServiceOptions || [])];
                                newOptions[index] = { ...newOptions[index], price: Number(e.target.value) };
                                setFormData({ ...formData, additionalServiceOptions: newOptions });
                              }}
                              className="input-clean text-sm"
                              min="0"
                            />
                          </div>
                          <div className="col-span-1 flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => {
                                const newOptions = formData.additionalServiceOptions?.filter((_, i) => i !== index);
                                setFormData({ ...formData, additionalServiceOptions: newOptions });
                              }}
                              className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
