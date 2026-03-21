import AppLayout from "@/components/AppLayout";
import { authAPI, servicesAPI, superAdminAPI } from "@/lib/api";
import { AlertTriangle, CheckCircle, ChevronRight, Clock, Edit, Info, Plus, Save, Search, Trash2, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Service {
  _id?: string;
  name: string;
  description: string;
  category: string;
  serviceType?: string;
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
  isQuoteService?: boolean;
  additionalServiceOptions?: Array<{
    value: string;
    label: string;
    price: number;
  }>;
  durationOptions?: Array<{
    hours: number;
    price: number;
    isDefault?: boolean;
  }>;
  subscriptionOptions?: {
    allowedFrequencies?: string[];
    requiresSameWorker?: boolean;
    minContractMonths?: number;
    autoRenewal?: boolean;
  };
  sizeParameters?: {
    enabled: boolean;
    sizeType: string;
    options: Array<{
      value: string;
      label: string;
      price: number;
      duration?: number;
      workersRequired?: number;
    }>;
  };
  tags?: string[];
  taskOptions?: Array<{ id: string; label: string; icon: string; isActive: boolean }>;
  suggestedServices?: Array<{
    serviceId: string | { _id: string; name: string; price: number };
    displayText?: string;
    sortOrder?: number;
    isActive?: boolean;
  }>;
  dos?: string[];
  donts?: string[];
}

interface UserProfile {
  role: string;
  name: string;
  email: string;
  [key: string]: unknown;
}

interface ServiceRequest {
  _id: string;
  serviceTypeName: string;
  serviceData: { name: string; description: string; price: number; duration: number; category: string };
  requestedBy: { _id: string; name: string; email: string };
  status: 'pending' | 'approved' | 'rejected';
  superAdminNote: string;
  createdAt: string;
}

const MINI_SERVICE_TYPES = [
  // Existing
  { id: 'deep_cleaning_kitchen',  label: 'Kitchen Deep Clean',  price: 399, duration: 45 },
  { id: 'deep_cleaning_bathroom', label: 'Bathroom Deep Clean', price: 249, duration: 30 },
  { id: 'fixed_sofa_cleaning',    label: 'Sofa Cleaning',       price: 499, duration: 60 },
  { id: 'fixed_carpet_cleaning',  label: 'Carpet Cleaning',     price: 349, duration: 45 },
  { id: 'fixed_window_cleaning',  label: 'Window Cleaning',     price: 299, duration: 30 },
  { id: 'fixed_fan_cleaning',     label: 'Fan Cleaning',        price: 149, duration: 20 },
  { id: 'fixed_balcony_cleaning', label: 'Balcony Cleaning',    price: 199, duration: 25 },
  { id: 'fixed_fridge_cleaning',  label: 'Fridge Deep Clean',   price: 249, duration: 40 },
  // Kitchen Appliances (NEW)
  { id: 'fixed_microwave_cleaning', label: 'Microwave Cleaning', price: 199, duration: 30 },
  { id: 'fixed_oven_cleaning', label: 'OTG/Oven Cleaning', price: 399, duration: 40 },
  { id: 'fixed_stove_cleaning', label: 'Gas Stove Cleaning', price: 99, duration: 15 },
  { id: 'fixed_chimney_cleaning', label: 'Chimney Cleaning', price: 499, duration: 60 },
  { id: 'fixed_kitchen_platform_cleaning', label: 'Kitchen Platform & Tiles', price: 399, duration: 45 },
  { id: 'fixed_sink_cleaning', label: 'Sink Cleaning', price: 149, duration: 20 },
  { id: 'kitchen_appliances_package', label: 'Kitchen Package (Complete)', price: 3199, duration: 180 },
  // Bathroom Fixtures (NEW)
  { id: 'fixed_washbasin_cleaning', label: 'Washbasin Cleaning', price: 69, duration: 15 },
  { id: 'fixed_window_mesh_cleaning', label: 'Window Mesh Cleaning', price: 100, duration: 20 },
  { id: 'fixed_washroom_basic', label: 'Basic Washroom Cleaning', price: 250, duration: 30 },
  { id: 'fixed_washroom_deep', label: 'Deep Washroom Cleaning', price: 600, duration: 60 },
  // Furniture (NEW)
  { id: 'fixed_dining_cleaning', label: 'Dining Table & Chairs', price: 499, duration: 45 },
  { id: 'fixed_cabinet_cleaning', label: 'Showcase Cabinet', price: 299, duration: 30 },
  { id: 'fixed_utility_cleaning', label: 'Utility Area', price: 499, duration: 50 },
  { id: 'fixed_cupboard_cleaning', label: 'Cupboards', price: 299, duration: 40 },
  // Bedroom (NEW)
  { id: 'bedroom_package', label: 'Complete Bedroom Package', price: 1599, duration: 120 },
  { id: 'fixed_bed_cleaning', label: 'Bed Cleaning', price: 299, duration: 30 },
  { id: 'fixed_mirror_cleaning', label: 'Mirror Cleaning', price: 79, duration: 10 },
  // HVAC (NEW)
  { id: 'fixed_ac_indoor_cleaning', label: 'AC Indoor Unit', price: 400, duration: 45 },
  { id: 'fixed_ac_outdoor_cleaning', label: 'AC Outdoor Unit', price: 549, duration: 60 },
  // Doors (NEW)
  { id: 'fixed_door_cleaning', label: 'Glass Door', price: 349, duration: 30 },
];
const MINI_SERVICE_IDS = new Set(MINI_SERVICE_TYPES.map(t => t.id));

const SERVICE_TYPE_CARDS = [
  {
    id: 'instant_hourly',
    label: 'Insta Maid',
    emoji: '🧹',
    tagline: 'On-demand hourly maid service',
    description: 'Flexible hourly booking. Customer chooses duration (1–8 hrs). Billed per hour.',
    color: 'from-blue-500/10 to-cyan-500/10 border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    defaults: {
      name: 'Insta Maid',
      description: 'On-demand professional maid service available by the hour. Perfect for quick cleaning tasks.',
      category: 'cleaning',
      price: 149,
      duration: 60,
    }
  },
  {
    id: 'deep_cleaning_full_house',
    label: 'Deep Cleaning',
    emoji: '🏠',
    tagline: 'Professional full-home deep clean',
    description: 'Thorough cleaning of entire home including kitchen, bathrooms, fans, windows & more.',
    color: 'from-green-500/10 to-emerald-500/10 border-green-200',
    badge: 'bg-green-100 text-green-700',
    defaults: {
      name: 'Deep Cleaning',
      description: 'Comprehensive deep cleaning service for your entire home. Includes kitchen, bathrooms, fans, windows and all surfaces.',
      category: 'cleaning',
      price: 2999,
      duration: 240,
      isQuoteService: true,
    }
  },
  {
    id: 'monthly_subscription',
    label: 'Subscription Service',
    emoji: '🔄',
    tagline: 'Recurring plans with discounts',
    description: 'Daily, weekly or monthly maid visits. Fixed worker, flexible frequency.',
    color: 'from-purple-500/10 to-violet-500/10 border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
    defaults: {
      name: 'Regular Maid Service',
      description: 'Recurring maid service with flexible subscription plans. Choose daily, weekly or monthly visits with a dedicated worker.',
      category: 'cleaning',
      price: 499,
      duration: 60,
    }
  },
  {
    id: 'deep_cleaning_kitchen',
    label: 'Spot Clean / Mini Service',
    emoji: '🧽',
    tagline: 'Individual spot-clean tasks (kitchen, bathroom, sofa…)',
    description: 'Bookable single-task cleaning services. Customer picks exactly what they need — kitchen, bathroom, sofa, fan, window or more.',
    color: 'from-cyan-500/10 to-teal-500/10 border-cyan-200',
    badge: 'bg-cyan-100 text-cyan-700',
    defaults: {
      name: 'Kitchen Deep Clean',
      description: 'Professional deep cleaning of your kitchen including stove, sink, tiles, and surfaces.',
      category: 'cleaning',
      price: 399,
      duration: 45,
    }
  }
];

const AdminServices = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string | null>(null); // Filter by service type
  const [groupByCategory, setGroupByCategory] = useState(false); // Group services by category
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<ServiceRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [formData, setFormData] = useState<Service>({
    name: '',
    description: '',
    category: 'cleaning',
    serviceType: undefined,
    price: 500,
    pricingPlans: {
      oneTime: 500,
      daily: 425,
      weekly: 2625,
      monthly: 9750
    },
    subscriptionPlans: [],
    duration: 60,
    isActive: true,
    isQuoteService: false,
    additionalServiceOptions: [],
    durationOptions: [],
    subscriptionOptions: { allowedFrequencies: ['daily', 'alt-days', '3-days', 'weekly'], requiresSameWorker: true, autoRenewal: true },
    sizeParameters: { enabled: false, sizeType: 'quantity', options: [] },
    suggestedServices: [],
    dos: [],
    donts: []
  });  const isSuperAdmin = profile?.role === 'super_admin';

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (isSuperAdmin) fetchPendingRequests();
  }, [isSuperAdmin]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profileData, servicesData] = await Promise.all([
        authAPI.getProfile(),
        servicesAPI.getAll({})
      ]);
      setProfile(profileData.user || profileData);
      setServices(servicesData.services || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      setRequestsLoading(true);
      const res = await superAdminAPI.getServiceRequests('pending');
      setPendingRequests(res.requests || []);
    } catch (error) {
      console.error('Error fetching service requests:', error);
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleApproveRequest = async (id: string) => {
    try {
      await superAdminAPI.approveServiceRequest(id);
      toast.success('Service approved and is now live for all users!');
      fetchPendingRequests();
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve');
    }
  };

  const handleRejectRequest = async () => {
    if (!rejectModalId) return;
    try {
      await superAdminAPI.rejectServiceRequest(rejectModalId, rejectReason);
      toast.success('Service request rejected.');
      setRejectModalId(null);
      setRejectReason('');
      fetchPendingRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject');
    }
  };

  const handleTypeSelect = (typeCard: typeof SERVICE_TYPE_CARDS[0]) => {
    const p = typeCard.defaults;
    const basePrice = p.price;
    setSelectedServiceType(typeCard.id);
    setFormData(prev => ({
      ...prev,
      name: p.name,
      description: p.description,
      category: p.category,
      price: basePrice,
      duration: p.duration,
      pricingPlans: {
        oneTime: basePrice,
        daily: Math.round(basePrice * 0.85),
        weekly: Math.round(basePrice * 0.75 * 7),
        monthly: Math.round(basePrice * 0.65 * 30)
      },
      // For subscription type, keep existing default plans; otherwise clear
      subscriptionPlans: typeCard.id === 'monthly_subscription' ? prev.subscriptionPlans : [],
      isQuoteService: (p as typeof p & { isQuoteService?: boolean }).isQuoteService ?? false,
    }));
    setShowTypeSelector(false);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name || !formData.description || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    if (formData.price < 0) {
      toast.error('Price cannot be negative');
      return;
    }
    
    if (formData.duration <= 0) {
      toast.error('Duration must be greater than 0');
      return;
    }
    
    try {
      if (editingId) {
        // Strip UI-only _priceMode field before sending to backend
        const payload = {
          ...formData,
          serviceType: selectedServiceType || formData.serviceType || 'other', // CRITICAL: Preserve serviceType on edit!
          durationOptions: (formData.durationOptions || []).map((tier: any) => {
            const { _priceMode, ...cleanTier } = tier;
            return cleanTier;
          }),
        };
        await servicesAPI.update(editingId, payload as unknown as Record<string, unknown>);
        toast.success('Service updated!');
        fetchData();
      } else {
        const res = await servicesAPI.create({
          ...formData,
          serviceType: selectedServiceType || 'other',
          serviceTypeName: SERVICE_TYPE_CARDS.find(c => c.id === selectedServiceType)?.label || formData.name,
          ...(MINI_SERVICE_IDS.has(selectedServiceType ?? '') && {
            tags: ['mini-service', 'spot-clean']
          })
        });
        if (res.requestSubmitted) {
          toast.success('Request sent to Super Admin for approval!', { duration: 5000 });
        } else {
          toast.success('Service created and is now live!');
          fetchData();
        }
      }

      setShowForm(false);
      setEditingId(null);
      setSelectedServiceType(null);
      resetForm();
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
      serviceType: service.serviceType, // Preserve serviceType
      price: service.price,
      pricingPlans: service.pricingPlans || {
        oneTime: service.price,
        daily: Math.round(service.price * 0.85),
        weekly: Math.round(service.price * 0.75 * 7),
        monthly: Math.round(service.price * 0.65 * 30)
      },
      duration: service.duration,
      isActive: service.isActive,
      isQuoteService: service.isQuoteService ?? false,
      subscriptionPlans: service.subscriptionPlans || [],
      additionalServiceOptions: service.additionalServiceOptions,
      durationOptions: service.durationOptions || [],
      subscriptionOptions: service.subscriptionOptions || { allowedFrequencies: ['daily', 'alt-days', '3-days', 'weekly'], requiresSameWorker: true, autoRenewal: true },
      sizeParameters: service.sizeParameters || { enabled: false, sizeType: 'quantity', options: [] },
      originalPrice: (service as any).originalPrice || 0,
      taskOptions: (service as any).taskOptions || [],
      suggestedServices: service.suggestedServices || [],
      dos: (service as any).dos || [],
      donts: (service as any).donts || [],
    });
    setSelectedServiceType(service.serviceType || null);
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
      serviceType: undefined, // Reset serviceType
      price: defaultPrice,
      pricingPlans: {
        oneTime: defaultPrice,
        daily: Math.round(defaultPrice * 0.85),
        weekly: Math.round(defaultPrice * 0.75 * 7),
        monthly: Math.round(defaultPrice * 0.65 * 30)
      },
      duration: 60,
      isActive: true,
      isQuoteService: false,
      durationOptions: [],
      subscriptionOptions: { allowedFrequencies: ['daily', 'alt-days', '3-days', 'weekly'], requiresSameWorker: true, autoRenewal: true },
      sizeParameters: { enabled: false, sizeType: 'quantity', options: [] },
      originalPrice: 0,
      taskOptions: [],
      suggestedServices: [],
      subscriptionPlans: [],
      dos: [],
      donts: [],
    });
  };

  const handlePriceChange = (price: number) => {
    setFormData(prev => ({
      ...prev,
      price,
      pricingPlans: {
        oneTime: price,
        daily: Math.round(price * 0.85),
        weekly: Math.round(price * 0.75 * 7),
        monthly: Math.round(price * 0.65 * 30)
      },
      // Auto-recalculate each existing plan price from its stored discount %
      subscriptionPlans: (prev.subscriptionPlans || []).map(plan => ({
        ...plan,
        price: Math.round(price * (1 - (plan.discountPercentage ?? 0) / 100))
      }))
    }));
  };

  const filteredServices = services.filter(service => {
    // Search filter
    const matchesSearch = service.name.toLowerCase().includes(search.toLowerCase()) ||
                         service.category.toLowerCase().includes(search.toLowerCase());

    // Service type filter
    const matchesType = !serviceTypeFilter || service.serviceType === serviceTypeFilter;

    return matchesSearch && matchesType;
  });

  // Detect which core service types are already configured
  const configuredTypes = new Set(services.map(s => s.serviceType).filter(Boolean));
  const coverageItems = SERVICE_TYPE_CARDS.map(card => ({
    ...card,
    isConfigured: configuredTypes.has(card.id),
    // Find active service first; fall back to any service of this type (so Edit shows even if inactive)
    service: services.find(s => s.serviceType === card.id && s.isActive)
           || services.find(s => s.serviceType === card.id),
  }));
  const missingCount = coverageItems.filter(c => !c.isConfigured).length;

  // Service Card Component
  const ServiceCard = ({ service, handleEdit, handleDelete }: { service: Service; handleEdit: (service: Service) => void; handleDelete: (id: string) => void }) => {
    const activeSubscriptionPlans = (service.subscriptionPlans || [])
      .filter(p => p.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return (
    <div className="card-elevated p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="text-base font-bold text-foreground">{service.name}</h3>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              service.isActive
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
            }`}>
              {service.isActive ? 'Active' : 'Inactive'}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 capitalize">
              {service.category}
            </span>
            {service.serviceType && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                service.serviceType === 'monthly_subscription' ? 'bg-purple-100 text-purple-800' :
                service.serviceType === 'instant_hourly' ? 'bg-blue-100 text-blue-800' :
                service.serviceType?.startsWith('deep_cleaning') ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-600'
              }`}>
                {SERVICE_TYPE_CARDS.find(c => c.id === service.serviceType)?.label || service.serviceType.replace(/_/g, ' ')}
              </span>
            )}
            {service.isQuoteService && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 font-semibold">
                ✨ Deep Cleaning Cart
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{service.description}</p>

          {/* Pricing */}
          {service.serviceType === 'monthly_subscription' ? (
            service.durationOptions && service.durationOptions.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Monthly price per daily session hours:</p>
                <div className="flex flex-wrap gap-1.5">
                  {service.durationOptions.map((d: any, i) => (
                    <div key={i} className="p-1.5 bg-purple-50 border border-purple-200 rounded-lg text-center min-w-[50px]">
                      <div className="text-xs text-purple-600 font-medium">{d.hours}h/day</div>
                      <div className="text-xs font-bold text-purple-800">₹{d.price}</div>
                      <div className="text-xs text-purple-500">/mo</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-xs text-purple-700 font-medium">⚠️ No hourly pricing tiers set</p>
              </div>
            )
          ) : activeSubscriptionPlans.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {activeSubscriptionPlans.slice(0, 4).map((plan) => (
                <div key={plan.id} className="p-2 bg-muted rounded-lg">
                  <div className="text-xs text-muted-foreground mb-0.5">{plan.displayName || plan.name}</div>
                  <div className="text-sm font-bold text-foreground">₹{plan.price}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-0.5">Base Price</div>
              <div className="text-sm font-bold text-foreground">₹{service.price}</div>
            </div>
          )}

          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>Duration: {service.duration} min</span>
            {activeSubscriptionPlans.length > 0 && (
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                {activeSubscriptionPlans.length} plan{activeSubscriptionPlans.length > 1 ? 's' : ''}
              </span>
            )}
            {service.additionalServiceOptions && service.additionalServiceOptions.length > 0 && (
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                {service.additionalServiceOptions.length} option{service.additionalServiceOptions.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          <button onClick={() => handleEdit(service)} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
            <Edit className="w-4 h-4 text-primary" />
          </button>
          <button onClick={() => handleDelete(service._id!)} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
            <Trash2 className="w-4 h-4 text-destructive" />
          </button>
        </div>
      </div>
    </div>
  );
  };

  return (
    <AppLayout userType={isSuperAdmin ? 'super_admin' : 'admin'} userName={profile?.name || 'Admin'}>
      <div className="space-y-6 pb-20 md:pb-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Services Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isSuperAdmin ? 'Create services and review admin requests' : 'Request new services — super admin approval required'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                resetForm();
                setEditingId(null);
                setSelectedServiceType('instant_hourly'); // Pre-select Quick Book
                setShowTypeSelector(false);
                setShowForm(true);
              }}
              className="btn-secondary flex items-center gap-2"
              title="Quickly add a Quick Book service"
            >
              <Plus className="w-4 h-4" />
              🧹 Quick Book Service
            </button>
            <button
              onClick={() => {
                resetForm();
                setEditingId(null);
                setSelectedServiceType(null);
                setShowTypeSelector(true);
              }}
              className="btn-brand flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {isSuperAdmin ? 'Create Service' : 'Request Service'}
            </button>
          </div>
        </div>

        {/* Service Coverage */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              {missingCount > 0
                ? <AlertTriangle className="w-4 h-4 text-amber-500" />
                : <CheckCircle className="w-4 h-4 text-green-500" />}
              Service Coverage
            </h2>
            {missingCount > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {missingCount} not configured
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {coverageItems.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  item.isConfigured
                    ? 'border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900'
                    : 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900'
                }`}
              >
                <span className="text-2xl shrink-0">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground line-clamp-2 break-words">{item.label}</p>
                  {item.isConfigured ? (
                    <p className="text-xs text-green-700 dark:text-green-400">
                      ✓ {item.service ? (
                        item.id === 'monthly_subscription'
                          ? `₹${item.service.price}/mo · ${item.service.isActive ? 'Active' : 'Inactive'}`
                          : `₹${item.service.price} · ${item.service.isActive ? 'Active' : 'Inactive'}`
                      ) : 'Configured'}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700 dark:text-amber-400">Not configured</p>
                  )}
                </div>
                {item.service ? (
                  <button
                    onClick={() => handleEdit(item.service!)}
                    className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground shrink-0"
                  >
                    Edit
                  </button>
                ) : (
                  <button
                    onClick={() => handleTypeSelect(item)}
                    className="text-xs px-2 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-medium shrink-0"
                  >
                    Setup
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Super Admin: Pending Requests */}
        {isSuperAdmin && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Pending Service Requests
                {pendingRequests.length > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{pendingRequests.length}</span>
                )}
              </h2>
            </div>
            {requestsLoading ? (
              <p className="text-sm text-muted-foreground">Loading requests...</p>
            ) : pendingRequests.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-4 text-center text-sm text-muted-foreground">No pending requests</div>
            ) : (
              <div className="grid gap-3">
                {pendingRequests.map((req) => (
                  <div key={req._id} className="card-elevated p-4 border-l-4 border-amber-400">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-foreground">{req.serviceData.name}</span>
                          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">{req.serviceTypeName}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{req.serviceData.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span>💰 ₹{req.serviceData.price} · ⏱ {req.serviceData.duration} min</span>
                          <span>👤 Requested by: <strong className="text-foreground">{req.requestedBy?.name}</strong></span>
                          <span>📅 {new Date(req.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleApproveRequest(req._id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => { setRejectModalId(req._id); setRejectReason(''); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive text-xs font-medium rounded-lg hover:bg-destructive/20 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

        {/* Filter Tabs - Quick Book & Others */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setServiceTypeFilter(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !serviceTypeFilter
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            All Services ({services.length})
          </button>
          <button
            onClick={() => setServiceTypeFilter('instant_hourly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              serviceTypeFilter === 'instant_hourly'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            🧹 Quick Book ({services.filter(s => s.serviceType === 'instant_hourly').length})
          </button>
          <button
            onClick={() => setServiceTypeFilter('monthly_subscription')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              serviceTypeFilter === 'monthly_subscription'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
            }`}
          >
            📆 Monthly Subscription ({services.filter(s => s.serviceType === 'monthly_subscription').length})
          </button>
          <button
            onClick={() => setServiceTypeFilter('deep_cleaning_full_house')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              serviceTypeFilter === 'deep_cleaning_full_house'
                ? 'bg-green-600 text-white'
                : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
            }`}
          >
            🏠 Deep Cleaning ({services.filter(s => s.serviceType?.startsWith('deep_cleaning')).length})
          </button>
          <button
            onClick={() => setServiceTypeFilter('other')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              serviceTypeFilter === 'other'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Other ({services.filter(s => !s.serviceType || s.serviceType === 'other').length})
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setGroupByCategory(!groupByCategory)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                groupByCategory
                  ? 'bg-indigo-600 text-white'
                  : 'bg-background border border-border text-foreground hover:bg-muted'
              }`}
              title="Group services by category (sections)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              {groupByCategory ? 'Ungroup' : 'Group by Section'}
            </button>
          </div>
        </div>

        {/* Services List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-sm text-muted-foreground">Loading services...</p>
          </div>
        ) : groupByCategory ? (
          /* Grouped by Category (Sections) */
          <div className="space-y-6">
            {['cleaning', 'health', 'maintenance', 'consultation', 'therapy', 'other'].map((category) => {
              const categoryServices = filteredServices.filter(s => s.category === category);
              if (categoryServices.length === 0) return null;

              const categoryIcons: Record<string, string> = {
                cleaning: '🧹',
                health: '🏥',
                maintenance: '🔧',
                consultation: '💬',
                therapy: '🧘',
                other: '📦'
              };

              return (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-3 border-b border-border pb-2">
                    <span className="text-2xl">{categoryIcons[category]}</span>
                    <h3 className="text-lg font-bold text-foreground capitalize">{category}</h3>
                    <span className="text-sm text-muted-foreground">({categoryServices.length} service{categoryServices.length !== 1 ? 's' : ''})</span>
                  </div>
                  <div className="grid gap-4">
                    {categoryServices.map((service) => (
                      <ServiceCard key={service._id} service={service} handleEdit={handleEdit} handleDelete={handleDelete} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredServices.map((service) => (
              <ServiceCard key={service._id} service={service} handleEdit={handleEdit} handleDelete={handleDelete} />
            ))}
          </div>
        )}

        {/* Service Type Selector Modal */}
        {showTypeSelector && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-2xl max-w-2xl w-full shadow-2xl">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Choose Service Type</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Select the type of service you want to {isSuperAdmin ? 'create' : 'request'}</p>
                </div>
                <button onClick={() => setShowTypeSelector(false)} className="p-2 hover:bg-muted rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 grid gap-4">
                {SERVICE_TYPE_CARDS.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => handleTypeSelect(card)}
                    className={`w-full text-left p-5 rounded-xl border-2 bg-gradient-to-r ${card.color} hover:scale-[1.01] transition-all group`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-4xl">{card.emoji}</span>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-foreground text-lg">{card.label}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${card.badge}`}>{card.id.replace('_', ' ')}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground/80">{card.tagline}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{card.description}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
              {!isSuperAdmin && (
                <div className="px-6 pb-6">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-sm text-amber-800">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>Your service request will be sent to the <strong>Super Admin</strong> for approval before going live.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-card border-b border-border p-3 sm:p-4 md:p-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {editingId ? 'Edit Service' : SERVICE_TYPE_CARDS.find(c => c.id === selectedServiceType)?.label || 'New Service'}
                  </h2>
                  {!editingId && selectedServiceType && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {SERVICE_TYPE_CARDS.find(c => c.id === selectedServiceType)?.tagline}
                    </p>
                  )}
                </div>
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
              {/* Admin approval notice */}
              {!editingId && !isSuperAdmin && (
                <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-sm text-amber-800">
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>This service will be sent to <strong>Super Admin</strong> for review before it goes live for customers.</span>
                </div>
              )}

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

                {/* Mini-service subtype selector */}
                {MINI_SERVICE_IDS.has(selectedServiceType ?? '') && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Service Sub-type *
                    </label>
                    <select
                      value={selectedServiceType ?? ''}
                      onChange={(e) => {
                        const chosen = MINI_SERVICE_TYPES.find(t => t.id === e.target.value);
                        if (!chosen) return;
                        setSelectedServiceType(chosen.id);
                        setFormData(prev => ({
                          ...prev,
                          price: chosen.price,
                          duration: chosen.duration,
                          pricingPlans: {
                            oneTime: chosen.price,
                            daily: Math.round(chosen.price * 0.85),
                            weekly: Math.round(chosen.price * 0.75 * 7),
                            monthly: Math.round(chosen.price * 0.65 * 30)
                          }
                        }));
                      }}
                      className="input-clean"
                    >
                      {MINI_SERVICE_TYPES.map(t => (
                        <option key={t.id} value={t.id}>{t.label} — ₹{t.price}</option>
                      ))}
                    </select>
                  </div>
                )}

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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    {selectedServiceType === 'instant_hourly' && (
                      <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">per hour — shown to customers</span>
                    )}
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
                    This is the base price used for calculations. Changing it will auto-recalculate all plan prices below.
                  </p>
                </div>

                {/* MRP / Original Price — for Insta service only */}
                {selectedServiceType === 'instant_hourly' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      MRP / Original Price (₹)
                      <span className="ml-2 text-xs font-normal text-muted-foreground">shown as strikethrough</span>
                    </label>
                    <input
                      type="number"
                      value={(formData as any).originalPrice || ''}
                      onChange={(e) => setFormData({ ...formData, originalPrice: Number(e.target.value) } as any)}
                      className="input-clean"
                      min="0"
                      step="10"
                      placeholder="e.g. 190"
                    />
                    {(formData as any).originalPrice > formData.price && (
                      <p className="text-xs text-green-600 mt-1 font-medium">
                        {Math.round((1 - formData.price / (formData as any).originalPrice) * 100)}% discount shown to customers
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">Leave 0 to hide the strikethrough price.</p>
                  </div>
                )}

                {/* Subscription Plans Section — hidden for monthly_subscription (uses Duration Tiers instead) */}
                {selectedServiceType === 'monthly_subscription' ? (
                  <div className="p-4 bg-purple-50 border border-purple-300 rounded-lg space-y-1">
                    <p className="text-sm font-semibold text-purple-900">📅 Pricing for Subscription Plans</p>
                    <p className="text-xs text-purple-700">
                      For subscription services, customer-facing pricing is set via <strong>Session Hours Pricing (Duration Tiers)</strong> below — e.g. 1h/day → ₹3500/mo, 2h/day → ₹5500/mo.
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      The "Subscription Plans" frequency tiers (Daily/Weekly/Monthly) are not used on the subscription booking page.
                    </p>
                  </div>
                ) : (
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
                  
                  {selectedServiceType !== 'monthly_subscription' && formData.subscriptionPlans && formData.subscriptionPlans.length > 0 && (
                    <div className="space-y-3 mt-3">
                      {[...(formData.subscriptionPlans || [])].sort((a, b) => a.sortOrder - b.sortOrder).map((plan, index) => (
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
                                    const discount = Number(e.target.value);
                                    const newPlans = [...(formData.subscriptionPlans || [])];
                                    newPlans[index] = {
                                      ...newPlans[index],
                                      discountPercentage: discount,
                                      price: Math.round(formData.price * (1 - discount / 100))
                                    };
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
                                    const newPlans = formData.subscriptionPlans?.filter((_, i) => i !== index) || [];
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
                )}

                {/* Task Options — editable checklist shown on Insta Maid booking page */}
                {selectedServiceType === 'instant_hourly' && (
                  <div className="space-y-3 p-4 bg-amber-50/60 border border-amber-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-foreground">Task Options</label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Tasks customers can select on the Insta Maid booking page
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newTask = { id: `task-${Date.now()}`, label: '', icon: '🧹', isActive: true };
                          setFormData({ ...formData, taskOptions: [...((formData as any).taskOptions || []), newTask] } as any);
                        }}
                        className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Task
                      </button>
                    </div>

                    {((formData as any).taskOptions || []).length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No tasks configured — customers will see the default built-in list.</p>
                    )}

                    {((formData as any).taskOptions || []).length > 0 && (
                      <div className="space-y-2">
                        {((formData as any).taskOptions as Array<{ id: string; label: string; icon: string; isActive: boolean }>).map((task, index) => (
                          <div key={task.id} className="grid grid-cols-12 gap-2 p-2 bg-white rounded-lg border border-amber-100 items-center">
                            {/* Icon */}
                            <div className="col-span-2">
                              <input
                                type="text"
                                value={task.icon}
                                onChange={(e) => {
                                  const updated = [...(formData as any).taskOptions];
                                  updated[index] = { ...updated[index], icon: e.target.value };
                                  setFormData({ ...formData, taskOptions: updated } as any);
                                }}
                                className="input-clean text-center text-lg"
                                placeholder="🧹"
                                maxLength={2}
                              />
                            </div>
                            {/* Label */}
                            <div className="col-span-7">
                              <input
                                type="text"
                                value={task.label}
                                onChange={(e) => {
                                  const updated = [...(formData as any).taskOptions];
                                  updated[index] = { ...updated[index], label: e.target.value };
                                  setFormData({ ...formData, taskOptions: updated } as any);
                                }}
                                className="input-clean"
                                placeholder="e.g. Sweeping & Mopping"
                              />
                            </div>
                            {/* Active toggle */}
                            <div className="col-span-2 flex justify-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...(formData as any).taskOptions];
                                  updated[index] = { ...updated[index], isActive: !updated[index].isActive };
                                  setFormData({ ...formData, taskOptions: updated } as any);
                                }}
                                className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${task.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                              >
                                {task.isActive ? 'ON' : 'OFF'}
                              </button>
                            </div>
                            {/* Delete */}
                            <div className="col-span-1 flex justify-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = (formData as any).taskOptions.filter((_: unknown, i: number) => i !== index);
                                  setFormData({ ...formData, taskOptions: updated } as any);
                                }}
                                className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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

                {/* ── Duration Tiers: required for subscription, optional for others ── */}
                {(isSuperAdmin || selectedServiceType === 'monthly_subscription') && (
                  <div className={`space-y-3 p-4 rounded-lg border ${
                    selectedServiceType === 'monthly_subscription'
                      ? 'bg-purple-50/60 border-purple-300'
                      : 'bg-blue-50/50 border-blue-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-foreground">
                          {selectedServiceType === 'monthly_subscription'
                            ? '📅 Session Hours Pricing (required for subscription)'
                            : 'Duration Tiers (Hourly Pricing)'}
                        </label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {selectedServiceType === 'monthly_subscription'
                            ? 'Set monthly price for each daily session length — e.g. 1h → ₹3500/mo, 1.5h → ₹4500/mo'
                            : 'e.g. 1 hr → ₹200, 1.5 hr → ₹300, 2 hr → ₹400'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, durationOptions: [...(formData.durationOptions || []), { hours: 1, price: 0, originalPrice: 0, isDefault: false, _priceMode: 'month' } as any] })}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Tier
                      </button>
                    </div>

                    {(formData.durationOptions || []).length > 0 && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-2 px-1">
                          <span className="col-span-3 text-xs text-muted-foreground font-medium">Hours</span>
                          <span className="col-span-4 text-xs text-muted-foreground font-medium">Our Price</span>
                          <span className="col-span-3 text-xs text-muted-foreground font-medium">MRP (Original)</span>
                          <span className="col-span-2" />
                        </div>
                        {(formData.durationOptions || []).map((tier, index) => {
                          const mode = (tier as any)._priceMode || 'month';
                          const DAILY_SESSIONS = 26;
                          const originalPrice = (tier as any).originalPrice || 0;
                          const savingsPct = originalPrice > tier.price && originalPrice > 0
                            ? Math.round((1 - tier.price / originalPrice) * 100)
                            : 0;
                          const displayOurPrice = mode === 'session' ? Math.round(tier.price / DAILY_SESSIONS) : tier.price;
                          const displayMrp = mode === 'session' ? Math.round(originalPrice / DAILY_SESSIONS) : originalPrice;
                          return (
                            <div key={index} className="space-y-1 bg-white rounded-lg border border-blue-100 p-2">
                              <div className="grid grid-cols-12 gap-2 items-start">
                                <div className="col-span-3">
                                  <input
                                    type="number" step="0.5" min="0.5" value={tier.hours}
                                    onChange={e => {
                                      const updated = [...(formData.durationOptions || [])];
                                      updated[index] = { ...updated[index], hours: Number(e.target.value) };
                                      setFormData({ ...formData, durationOptions: updated });
                                    }}
                                    className="input-clean text-sm" placeholder="1.5"
                                  />
                                </div>
                                <div className="col-span-4 space-y-1">
                                  <div className="flex rounded overflow-hidden border border-blue-200 text-[10px]">
                                    <button type="button"
                                      className={`flex-1 py-0.5 text-center transition-colors ${mode === 'month' ? 'bg-blue-600 text-white' : 'bg-white text-muted-foreground'}`}
                                      onClick={() => {
                                        const updated = [...(formData.durationOptions || [])];
                                        updated[index] = { ...updated[index], _priceMode: 'month' } as any;
                                        setFormData({ ...formData, durationOptions: updated });
                                      }}
                                    >/mo</button>
                                    <button type="button"
                                      className={`flex-1 py-0.5 text-center transition-colors ${mode === 'session' ? 'bg-blue-600 text-white' : 'bg-white text-muted-foreground'}`}
                                      onClick={() => {
                                        const updated = [...(formData.durationOptions || [])];
                                        updated[index] = { ...updated[index], _priceMode: 'session' } as any;
                                        setFormData({ ...formData, durationOptions: updated });
                                      }}
                                    >/session</button>
                                  </div>
                                  <input
                                    type="number" min="0" step={mode === 'session' ? '10' : '50'} value={displayOurPrice}
                                    onChange={e => {
                                      const entered = Number(e.target.value);
                                      const monthly = mode === 'session' ? Math.round(entered * DAILY_SESSIONS) : entered;
                                      const updated = [...(formData.durationOptions || [])];
                                      updated[index] = { ...updated[index], price: monthly };
                                      setFormData({ ...formData, durationOptions: updated });
                                    }}
                                    className="input-clean text-sm" placeholder={mode === 'session' ? '500' : '13000'}
                                  />
                                  <p className="text-[10px] text-muted-foreground">
                                    {mode === 'session'
                                      ? `≈ ₹${tier.price.toLocaleString('en-IN')}/mo`
                                      : `≈ ₹${Math.round(tier.price / DAILY_SESSIONS).toLocaleString('en-IN')}/visit`}
                                  </p>
                                </div>
                                <div className="col-span-3 space-y-1">
                                  <input
                                    type="number" min="0" step={mode === 'session' ? '10' : '50'} value={displayMrp}
                                    onChange={e => {
                                      const entered = Number(e.target.value);
                                      const monthly = mode === 'session' ? Math.round(entered * DAILY_SESSIONS) : entered;
                                      const updated = [...(formData.durationOptions || [])];
                                      updated[index] = { ...updated[index], originalPrice: monthly } as any;
                                      setFormData({ ...formData, durationOptions: updated });
                                    }}
                                    className="input-clean text-sm" placeholder={mode === 'session' ? '700' : '18200'}
                                  />
                                  {savingsPct > 0 && (
                                    <p className="text-[10px] font-medium text-green-600">{savingsPct}% off</p>
                                  )}
                                </div>
                                <div className="col-span-2 flex justify-end">
                                  <button type="button"
                                    onClick={() => setFormData({ ...formData, durationOptions: (formData.durationOptions || []).filter((_, i) => i !== index) })}
                                    className="p-1.5 hover:bg-red-50 rounded transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Subscription Booking Options (super admin + monthly_subscription) ── */}
                {selectedServiceType === 'monthly_subscription' && (
                  <div className="space-y-3 p-4 bg-purple-50/60 border border-purple-300 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-foreground">🔄 Subscription Booking Options</label>
                      <p className="text-xs text-muted-foreground mt-0.5">Controls which frequencies & settings customers can choose on the booking page</p>
                    </div>

                    {/* Allowed Frequencies */}
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-2">Allowed Frequencies</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { id: 'daily',    label: '📆 Daily',      desc: 'Mon–Sat · 26 visits/mo' },
                          { id: 'alt-days', label: '📅 Alt Days',   desc: 'Mon/Wed/Fri · 13 visits/mo' },
                          { id: '3-days',   label: '🗓️ 3× Week',   desc: 'Any 3 days · ~12 visits/mo' },
                          { id: 'weekly',   label: '📋 Weekly',     desc: 'Once a week · 4 visits/mo' },
                        ].map(freq => {
                          const allowed = formData.subscriptionOptions?.allowedFrequencies || [];
                          const isChecked = allowed.includes(freq.id);
                          return (
                            <label key={freq.id} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${isChecked ? 'border-purple-400 bg-purple-50' : 'border-border bg-white'}`}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const freqs = e.target.checked
                                    ? [...allowed, freq.id]
                                    : allowed.filter(f => f !== freq.id);
                                  setFormData({ ...formData, subscriptionOptions: { ...formData.subscriptionOptions, allowedFrequencies: freqs } });
                                }}
                                className="mt-0.5 w-3.5 h-3.5 accent-purple-600"
                              />
                              <div>
                                <p className="text-xs font-semibold text-foreground">{freq.label}</p>
                                <p className="text-xs text-muted-foreground">{freq.desc}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="flex items-center justify-between p-3 rounded-lg bg-white border border-border cursor-pointer">
                        <div>
                          <p className="text-xs font-semibold text-foreground">Same Worker Required</p>
                          <p className="text-xs text-muted-foreground">Fix one maid per household</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.subscriptionOptions?.requiresSameWorker ?? true}
                          onChange={(e) => setFormData({ ...formData, subscriptionOptions: { ...formData.subscriptionOptions, requiresSameWorker: e.target.checked } })}
                          className="w-4 h-4 accent-purple-600 ml-2"
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 rounded-lg bg-white border border-border cursor-pointer">
                        <div>
                          <p className="text-xs font-semibold text-foreground">Auto-Renewal Default</p>
                          <p className="text-xs text-muted-foreground">Pre-check auto-renew for customers</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.subscriptionOptions?.autoRenewal ?? true}
                          onChange={(e) => setFormData({ ...formData, subscriptionOptions: { ...formData.subscriptionOptions, autoRenewal: e.target.checked } })}
                          className="w-4 h-4 accent-purple-600 ml-2"
                        />
                      </label>
                    </div>
                  </div>
                )}


                {isSuperAdmin && (
                  <div className="space-y-3 p-4 bg-green-50/50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-foreground">Size / Quantity Tiers</label>
                        <p className="text-xs text-muted-foreground mt-0.5">e.g. 1 Washroom → ₹1100, 2 Washrooms → ₹2000</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          sizeParameters: {
                            ...(formData.sizeParameters || { enabled: true, sizeType: 'quantity' }),
                            enabled: true,
                            options: [...(formData.sizeParameters?.options || []), { value: '', label: '', price: 0 }]
                          }
                        })}
                        className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Tier
                      </button>
                    </div>

                    {(formData.sizeParameters?.options || []).length > 0 && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-2 px-1">
                          <span className="col-span-4 text-xs text-muted-foreground font-medium">Label</span>
                          <span className="col-span-6 text-xs text-muted-foreground font-medium">Price (₹/month)</span>
                          <span className="col-span-2" />
                        </div>
                        {(formData.sizeParameters?.options || []).map((opt, index) => (
                          <div key={index} className="grid grid-cols-12 gap-2 items-center bg-white rounded-lg border border-green-100 p-2">
                            <div className="col-span-4">
                              <input
                                type="text"
                                value={opt.label}
                                onChange={e => {
                                  const opts = [...(formData.sizeParameters?.options || [])];
                                  opts[index] = { ...opts[index], label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') };
                                  setFormData({ ...formData, sizeParameters: { ...(formData.sizeParameters!), options: opts } });
                                }}
                                className="input-clean text-sm"
                                placeholder="1 Washroom"
                              />
                            </div>
                            <div className="col-span-6">
                              <input
                                type="number"
                                min="0"
                                step="50"
                                value={opt.price}
                                onChange={e => {
                                  const opts = [...(formData.sizeParameters?.options || [])];
                                  opts[index] = { ...opts[index], price: Number(e.target.value) };
                                  setFormData({ ...formData, sizeParameters: { ...(formData.sizeParameters!), options: opts } });
                                }}
                                className="input-clean text-sm"
                                placeholder="1100"
                              />
                            </div>
                            <div className="col-span-2 flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  const opts = (formData.sizeParameters?.options || []).filter((_, i) => i !== index);
                                  setFormData({ ...formData, sizeParameters: { ...(formData.sizeParameters!), enabled: opts.length > 0, options: opts } });
                                }}
                                className="p-1.5 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isQuoteService"
                    checked={!!formData.isQuoteService}
                    onChange={(e) => setFormData({ ...formData, isQuoteService: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <div>
                    <label htmlFor="isQuoteService" className="text-sm font-medium text-foreground cursor-pointer">
                      Deep Cleaning Cart Service ✨
                    </label>
                    <p className="text-xs text-muted-foreground">Customers will be taken to the cart-based deep cleaning booking instead of a fixed price.</p>
                  </div>
                </div>

                {/* Suggested Services Section */}
                {editingId && (
                  <div className="space-y-3 p-4 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-foreground">🎯 Suggested Services</label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Recommend related services to customers (cross-selling)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            suggestedServices: [
                              ...(formData.suggestedServices || []),
                              { serviceId: '', displayText: 'Customers also book', sortOrder: (formData.suggestedServices?.length || 0), isActive: true }
                            ]
                          });
                        }}
                        className="text-xs px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Suggestion
                      </button>
                    </div>

                    {(formData.suggestedServices || []).length > 0 && (
                      <div className="space-y-2">
                        {(formData.suggestedServices || []).map((suggestion, index) => (
                          <div key={index} className="grid grid-cols-12 gap-2 items-center bg-white rounded-lg border border-orange-100 p-2">
                            <div className="col-span-10">
                              <select
                                value={typeof suggestion.serviceId === 'string' ? suggestion.serviceId : (suggestion.serviceId as any)?._id || ''}
                                onChange={(e) => {
                                  const suggestions = [...(formData.suggestedServices || [])];
                                  suggestions[index] = { ...suggestions[index], serviceId: e.target.value };
                                  setFormData({ ...formData, suggestedServices: suggestions });
                                }}
                                className="input-clean text-sm"
                              >
                                <option value="">Select a service...</option>
                                {services
                                  .filter(s => s._id !== editingId)
                                  .map(service => (
                                    <option key={service._id} value={service._id}>
                                      {service.name} — ₹{service.price}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div className="col-span-2 flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  const suggestions = (formData.suggestedServices || []).filter((_, i) => i !== index);
                                  setFormData({ ...formData, suggestedServices: suggestions });
                                }}
                                className="p-1.5 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {(formData.suggestedServices || []).length === 0 && (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        No suggested services yet. Click "Add Suggestion" to recommend related services.
                      </div>
                    )}
                  </div>
                )}

                {/* Service Dos & Don'ts Section */}
                <div className="space-y-3 p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-foreground">✅ What This Service DOES Include</label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      List what customers can expect from this service (e.g., "Dusting", "Sweeping", "Floor cleaning")
                    </p>
                  </div>
                  <div className="space-y-2">
                    {(formData.dos || []).map((item, index) => (
                      <div key={index} className="flex gap-2 items-center bg-white rounded-lg border border-green-100 p-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => {
                            const dos = [...(formData.dos || [])];
                            dos[index] = e.target.value;
                            setFormData({ ...formData, dos });
                          }}
                          className="input-clean text-sm flex-1"
                          placeholder="e.g., Dusting, Sweeping"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const dos = (formData.dos || []).filter((_, i) => i !== index);
                            setFormData({ ...formData, dos });
                          }}
                          className="p-1.5 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        dos: [...(formData.dos || []), '']
                      });
                    }}
                    className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Do Item
                  </button>
                </div>

                {/* Don'ts Section */}
                <div className="space-y-3 p-4 bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-foreground">❌ What This Service DOESN'T Include</label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      List what this service excludes (e.g., "Bathroom cleaning", "High ceilings", "Washing clothes")
                    </p>
                  </div>
                  <div className="space-y-2">
                    {(formData.donts || []).map((item, index) => (
                      <div key={index} className="flex gap-2 items-center bg-white rounded-lg border border-red-100 p-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => {
                            const donts = [...(formData.donts || [])];
                            donts[index] = e.target.value;
                            setFormData({ ...formData, donts });
                          }}
                          className="input-clean text-sm flex-1"
                          placeholder="e.g., Bathroom cleaning, High ceilings"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const donts = (formData.donts || []).filter((_, i) => i !== index);
                            setFormData({ ...formData, donts });
                          }}
                          className="p-1.5 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        donts: [...(formData.donts || []), '']
                      });
                    }}
                    className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Don't Item
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                      resetForm();
                    }}
                    className="w-full sm:flex-1 py-3 border-2 border-border rounded-xl font-semibold hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:flex-1 btn-brand flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {editingId ? 'Update Service' : isSuperAdmin ? 'Create Service' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Reject Reason Modal */}
      {rejectModalId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground">Reject Service Request</h3>
            <p className="text-sm text-muted-foreground">Provide a reason so the admin knows what to fix.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Pricing too low for this region. Please revise."
              className="input-clean resize-none w-full"
              rows={4}
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => { setRejectModalId(null); setRejectReason(''); }}
                className="w-full sm:flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted"
              >Cancel</button>
              <button
                onClick={handleRejectRequest}
                className="w-full sm:flex-1 py-2.5 bg-destructive text-white rounded-xl text-sm font-medium hover:bg-destructive/90"
              >Reject Request</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default AdminServices;
