import AppLayout from "@/components/AppLayout";
import { authAPI, servicesAPI, superAdminAPI } from "@/lib/api";
import { AlertTriangle, CheckCircle, Clock, Edit, Info, Plus, Save, Search, Sparkles, Trash2, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type DurationPriceMode = 'hour' | 'month';

interface ServiceDurationOption {
  hours: number;
  price: number;
  originalPrice?: number;
  isDefault?: boolean;
  _priceMode?: DurationPriceMode;
}

interface SuggestedServiceReference {
  _id: string;
  name: string;
  price: number;
}

interface SuggestedServiceOption {
  serviceId: string | SuggestedServiceReference;
  displayText?: string;
  sortOrder?: number;
  isActive?: boolean;
}

interface Service {
  _id?: string;
  name: string;
  description: string;
  category: string;
  serviceType?: string;
  price: number;
  originalPrice?: number;
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
  durationOptions?: ServiceDurationOption[];
  subscriptionOptions?: {
    enabled?: boolean;
    allowedFrequencies?: string[];
    requiresSameWorker?: boolean;
    minContractMonths?: number;
    autoRenewal?: boolean;
    frequencyConfigs?: Array<{
      id: SubscriptionFrequencyId;
      label: string;
      description: string;
      visits: number;
      priceMultiplier: number;
      sortOrder: number;
      isActive: boolean;
    }>;
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
  suggestedServices?: SuggestedServiceOption[];
  dos?: string[];
  donts?: string[];
  defaultWorkerCount?: number;
  workerWage?: {
    type: 'per_hour' | 'per_session';
    rate: number;
  };
  workerSearchRadiusKm?: number;
  serviceCategory?: string;
  displayOrder?: number;
  allowBreakRequests?: boolean;
  highlight?: string;
  perUnitLabel?: string;
  image?: string;
  slotSelectionType?: 'worker_availability' | 'standard_slots';
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

type SubscriptionFrequencyId = 'daily' | 'alt-days' | '3-days' | 'weekly';

type SubscriptionFrequencyConfig = {
  id: SubscriptionFrequencyId;
  label: string;
  description: string;
  visits: number;
  priceMultiplier: number;
  sortOrder: number;
  isActive: boolean;
};

const DEFAULT_ALLOWED_FREQUENCIES: SubscriptionFrequencyId[] = ['daily', 'alt-days', '3-days', 'weekly'];

const DEFAULT_SUBSCRIPTION_FREQUENCY_CONFIGS: SubscriptionFrequencyConfig[] = [
  { id: 'daily', label: 'Daily', description: 'Every day', visits: 30, priceMultiplier: 1, sortOrder: 0, isActive: true },
  { id: 'alt-days', label: 'Alt Days', description: 'Mon/Wed/Fri', visits: 13, priceMultiplier: 0.65, sortOrder: 1, isActive: true },
  { id: '3-days', label: '3× Week', description: 'Any 3 days', visits: 12, priceMultiplier: 0.6, sortOrder: 2, isActive: true },
  { id: 'weekly', label: 'Weekly', description: 'Once a week', visits: 4, priceMultiplier: 0.35, sortOrder: 3, isActive: true },
];

const SUBSCRIPTION_FREQUENCY_ICONS: Record<SubscriptionFrequencyId, string> = {
  daily: '📆',
  'alt-days': '📅',
  '3-days': '🗓️',
  weekly: '📋',
};

const createDefaultDurationTier = (): ServiceDurationOption => ({
  hours: 1,
  price: 0,
  originalPrice: 0,
  isDefault: false,
  _priceMode: 'hour',
});

const getSuggestedServiceId = (serviceId: SuggestedServiceOption['serviceId']) => (
  typeof serviceId === 'string' ? serviceId : serviceId._id
);

const getNormalizedFrequencyConfigs = (configs?: Service['subscriptionOptions'] extends { frequencyConfigs?: infer T } ? T : never): SubscriptionFrequencyConfig[] => (
  DEFAULT_SUBSCRIPTION_FREQUENCY_CONFIGS.map((defaultConfig) => {
    const existingConfig = configs?.find((config) => config.id === defaultConfig.id);

    return {
      ...defaultConfig,
      ...existingConfig,
      label: existingConfig?.label?.trim() || defaultConfig.label,
      description: existingConfig?.description?.trim() || defaultConfig.description,
      visits: existingConfig?.visits && existingConfig.visits > 0 ? existingConfig.visits : defaultConfig.visits,
      priceMultiplier: typeof existingConfig?.priceMultiplier === 'number' && existingConfig.priceMultiplier >= 0
        ? existingConfig.priceMultiplier
        : defaultConfig.priceMultiplier,
    };
  })
);

const getNormalizedSubscriptionOptions = (
  options?: Service['subscriptionOptions'],
  isSubscriptionService: boolean = true
) => ({
  enabled: isSubscriptionService,
  allowedFrequencies: isSubscriptionService
    ? ((options?.allowedFrequencies?.length ? options.allowedFrequencies : DEFAULT_ALLOWED_FREQUENCIES) as string[])
    : [],
  requiresSameWorker: options?.requiresSameWorker ?? true,
  minContractMonths: options?.minContractMonths,
  autoRenewal: options?.autoRenewal ?? true,
  frequencyConfigs: isSubscriptionService ? getNormalizedFrequencyConfigs(options?.frequencyConfigs) : [],
});

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
      workerSearchRadiusKm: 0.5,
      serviceCategory: 'instant_services',
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
      workerSearchRadiusKm: 30,
      serviceCategory: 'deep_cleaning',
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
      workerSearchRadiusKm: 2,
      serviceCategory: 'subscription_services',
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
      workerSearchRadiusKm: 5,
      serviceCategory: 'spot_cleaning',
    }
  }
];

const AdminServices = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string | null>(null); // Filter by service type
  const [groupByCategory, setGroupByCategory] = useState(false); // Group services by category
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
    subscriptionOptions: getNormalizedSubscriptionOptions(),
    sizeParameters: { enabled: false, sizeType: 'quantity', options: [] },
    suggestedServices: [],
    dos: [],
    donts: [],
    defaultWorkerCount: 1,
    workerWage: { type: 'per_hour', rate: 0 },
    workerSearchRadiusKm: 10,
    serviceCategory: 'other',
    displayOrder: 0,
    slotSelectionType: 'worker_availability',
  });
  const isSuperAdmin = profile?.role === 'super_admin';
  const deepCleaningConfigPath = isSuperAdmin ? '/super-admin/deep-cleaning-config' : '/admin/deep-cleaning-config';

  const hasChanged = (nextValue: unknown, previousValue: unknown) =>
    JSON.stringify(nextValue ?? null) !== JSON.stringify(previousValue ?? null);

  const isSubscriptionServiceType = formData.serviceType === 'monthly_subscription';

  const buildServicePayload = (serviceData: Service) => {
    const isSubscriptionService = serviceData.serviceType === 'monthly_subscription';
    const normalizedSubscriptionOptions = getNormalizedSubscriptionOptions(serviceData.subscriptionOptions, isSubscriptionService);

    // Auto-derive price & originalPrice from the cheapest duration tier if tiers exist,
    // or from the cheapest quantity tier if no duration tiers are configured.
    const sortedTiers = [...(serviceData.durationOptions || [])].sort((a, b) => a.hours - b.hours);
    const cheapestTier = sortedTiers[0];
    const hasQtyTiers = serviceData.sizeParameters?.enabled && (serviceData.sizeParameters?.options?.length ?? 0) > 0;
    const cheapestQtyTier = hasQtyTiers
      ? [...(serviceData.sizeParameters!.options)].sort((a, b) => a.price - b.price)[0]
      : null;
    const derivedPrice = cheapestTier ? cheapestTier.price : (cheapestQtyTier ? cheapestQtyTier.price : serviceData.price);
    const derivedOriginalPrice = cheapestTier?.originalPrice ?? serviceData.originalPrice ?? 0;

    return {
      ...serviceData,
      price: derivedPrice,
      originalPrice: derivedOriginalPrice,
      serviceType: serviceData.serviceType || 'other',
      subscriptionPlans: isSubscriptionService ? [] : (serviceData.subscriptionPlans || []),
      subscriptionOptions: normalizedSubscriptionOptions,
      durationOptions: (serviceData.durationOptions || []).map((tier) => {
        const { _priceMode, ...cleanTier } = tier as Record<string, unknown>;
        return cleanTier;
      }),
    };
  };

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

  // Opens the create form pre-set to a service type (from the Coverage Checklist)
  // No values are auto-filled — super admin configures everything manually
  const handleTypeSelect = (typeId: string) => {
    resetForm();
    setFormData(prev => ({ ...prev, serviceType: typeId }));
    setEditingId(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name || !formData.description || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Duration tiers required only when size/quantity tiers are NOT used
    const hasQuantityTiers = formData.sizeParameters?.enabled && (formData.sizeParameters?.options?.length ?? 0) > 0;
    if (!hasQuantityTiers && (!formData.durationOptions || formData.durationOptions.length === 0)) {
      toast.error('Please add at least one duration tier with a price');
      return;
    }

    if (!hasQuantityTiers && formData.duration <= 0) {
      toast.error('Duration must be greater than 0');
      return;
    }
    
    try {
      if (editingId) {
        const payload = buildServicePayload(formData);

        if (isSuperAdmin) {
          await servicesAPI.update(editingId, payload as unknown as Record<string, unknown>);
          toast.success('Service updated!');
          fetchData();
        } else {
          const originalService = services.find(service => service._id === editingId);
          if (!originalService) {
            throw new Error('Original service details could not be loaded. Please refresh and try again.');
          }

          const payloadRecord = payload as Record<string, unknown>;
          const originalServiceRecord = originalService as unknown as Record<string, unknown>;

          const approvalPayload: Record<string, unknown> = {};
          if (hasChanged(payload.price, originalService.price)) approvalPayload.price = payload.price;
          if (hasChanged(payload.originalPrice, originalService.originalPrice)) approvalPayload.originalPrice = payload.originalPrice;
          if (hasChanged(payload.pricingPlans, originalService.pricingPlans)) approvalPayload.pricingPlans = payload.pricingPlans;
          if (hasChanged(payload.subscriptionPlans, originalService.subscriptionPlans)) approvalPayload.subscriptionPlans = payload.subscriptionPlans;
          if (hasChanged(payload.durationOptions, originalService.durationOptions)) approvalPayload.durationOptions = payload.durationOptions;
          if (hasChanged(payloadRecord.pricingTiers, originalServiceRecord.pricingTiers)) approvalPayload.pricingTiers = payloadRecord.pricingTiers;
          if (hasChanged(payload.workerWage, originalService.workerWage)) approvalPayload.workerWage = payload.workerWage;

          const {
            price: _price,
            originalPrice: _originalPrice,
            pricingPlans: _pricingPlans,
            subscriptionPlans: _subscriptionPlans,
            durationOptions: _durationOptions,
            pricingTiers: _pricingTiers,
            workerWage: _workerWage,
            ...directPayload
          } = payloadRecord;

          const hasDirectChanges = Object.entries(directPayload).some(([key, value]) =>
            hasChanged(value, originalServiceRecord[key])
          );
          const hasApprovalChanges = Object.keys(approvalPayload).length > 0;

          if (!hasDirectChanges && !hasApprovalChanges) {
            toast.info('No changes to save');
            return;
          }

          const successMessages: string[] = [];
          if (hasDirectChanges) {
            await servicesAPI.update(editingId, directPayload);
            successMessages.push('service details updated');
          }
          if (hasApprovalChanges) {
            await servicesAPI.requestPriceChange(editingId, {
              ...approvalPayload,
              reason: 'Submitted from admin service editor',
            });
            successMessages.push('price/wage change sent for super-admin approval');
          }

          toast.success(successMessages.join(' and '));
          fetchData();
        }
      } else {
        const serviceType = formData.serviceType || 'other';
        const payload = buildServicePayload(formData);
        const res = await servicesAPI.create({
          ...payload,
          serviceType,
          serviceTypeName: SERVICE_TYPE_CARDS.find(c => c.id === serviceType)?.label || formData.name,
          ...(MINI_SERVICE_IDS.has(serviceType) && {
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
      subscriptionOptions: getNormalizedSubscriptionOptions(service.subscriptionOptions, service.serviceType === 'monthly_subscription'),
      sizeParameters: service.sizeParameters || { enabled: false, sizeType: 'quantity', options: [] },
      originalPrice: service.originalPrice || 0,
      taskOptions: service.taskOptions || [],
      suggestedServices: service.suggestedServices || [],
      dos: service.dos || [],
      donts: service.donts || [],
      defaultWorkerCount: service.defaultWorkerCount ?? 1,
      workerWage: service.workerWage || { type: 'per_hour', rate: 0 },
      workerSearchRadiusKm: service.workerSearchRadiusKm ?? 10,
      serviceCategory: service.serviceCategory ?? 'other',
      displayOrder: service.displayOrder ?? 0,
      allowBreakRequests: service.allowBreakRequests === true,
      highlight: service.highlight || '',
      perUnitLabel: service.perUnitLabel || '',
      image: service.image || '',
      slotSelectionType: service.slotSelectionType || 'worker_availability',
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
      subscriptionOptions: getNormalizedSubscriptionOptions(),
      sizeParameters: { enabled: false, sizeType: 'quantity', options: [] },
      originalPrice: 0,
      taskOptions: [],
      suggestedServices: [],
      subscriptionPlans: [],
      dos: [],
      donts: [],
      defaultWorkerCount: 1,
      workerWage: { type: 'per_hour', rate: 0 },
      workerSearchRadiusKm: 10,
      serviceCategory: 'other',
      displayOrder: 0,
      allowBreakRequests: false,
      highlight: '',
      perUnitLabel: '',
      image: '',
      slotSelectionType: 'worker_availability',
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

  const isDeepCleaningService = (service?: Service | null) => Boolean(
    service?.serviceType?.startsWith('deep_cleaning') || service?.isQuoteService
  );

  const handleOpenDeepCleaningConfig = () => {
    navigate(deepCleaningConfigPath);
  };

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
            {service.workerSearchRadiusKm != null && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-800 font-medium">
                📍 {service.workerSearchRadiusKm < 1
                  ? `${Math.round(service.workerSearchRadiusKm * 1000)}m`
                  : `${service.workerSearchRadiusKm}km`} radius
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
                  {service.durationOptions.map((d, i) => (
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
          ) : service.sizeParameters?.enabled && (service.sizeParameters?.options?.length ?? 0) > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Size / Quantity tiers:</p>
              <div className="flex flex-wrap gap-1.5">
                {service.sizeParameters.options.map((opt, i) => (
                  <div key={i} className="px-2.5 py-1.5 bg-green-50 border border-green-200 rounded-lg text-center">
                    <div className="text-xs font-medium text-green-700">{opt.label}</div>
                    <div className="text-xs font-bold text-green-800">₹{opt.price.toLocaleString('en-IN')}</div>
                  </div>
                ))}
              </div>
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
          {isDeepCleaningService(service) && (
            <button
              onClick={handleOpenDeepCleaningConfig}
              className="p-1.5 hover:bg-muted rounded-lg transition-colors"
              title="Open deep-cleaning customer page content"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
            </button>
          )}
          <button
            onClick={() => isDeepCleaningService(service) ? handleOpenDeepCleaningConfig() : handleEdit(service)}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
            title={isDeepCleaningService(service) ? 'Open deep-cleaning config' : 'Edit service'}
          >
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
                setShowForm(true);
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
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            Click the Deep Cleaning card to open the deep-cleaning config directly.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {coverageItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'deep_cleaning_full_house') {
                    handleOpenDeepCleaningConfig();
                    return;
                  }

                  if (item.service) {
                    handleEdit(item.service);
                    return;
                  }

                  handleTypeSelect(item.id);
                }}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  item.isConfigured
                    ? 'border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900'
                    : 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900'
                } ${item.id === 'deep_cleaning_full_house' ? 'ring-1 ring-emerald-300 hover:bg-emerald-50' : 'hover:bg-muted/40'} text-left transition-colors`}
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
                <div className="flex shrink-0 flex-col gap-1">
                  <span className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-medium shrink-0 ${
                    item.id === 'deep_cleaning_full_house'
                      ? 'border border-emerald-300 bg-white text-emerald-700'
                      : item.service
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-amber-600 text-white'
                  }`}>
                    {item.id === 'deep_cleaning_full_house' ? (
                      <>
                        <Sparkles className="h-3.5 w-3.5" /> Open Config
                      </>
                    ) : item.service ? 'Edit' : 'Setup'}
                  </span>
                </div>
              </button>
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

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-card border-b border-border p-3 sm:p-4 md:p-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {editingId ? 'Edit Service' : 'Create Service'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {editingId ? 'Update all service settings below' : 'Configure all settings — nothing is pre-filled'}
                  </p>
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

                {/* Highlight + Per-Unit Label */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Key Highlight
                      <span className="ml-1 text-xs font-normal text-muted-foreground">shown on card below name (optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.highlight || ''}
                      onChange={(e) => setFormData({ ...formData, highlight: e.target.value })}
                      className="input-clean"
                      maxLength={120}
                      placeholder="e.g. Scrub machine used for tiles"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Per-Unit Label
                      <span className="ml-1 text-xs font-normal text-muted-foreground">shown beside price (optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.perUnitLabel || ''}
                      onChange={(e) => setFormData({ ...formData, perUnitLabel: e.target.value })}
                      className="input-clean"
                      maxLength={40}
                      placeholder="e.g. per bathroom, per seat"
                    />
                  </div>
                </div>

                {/* Service Image */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Service Image
                    <span className="ml-1 text-xs font-normal text-muted-foreground">thumbnail shown on service cards (optional)</span>
                  </label>

                  {/* File upload button */}
                  <div className="flex items-center gap-3 mb-2">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted text-sm hover:bg-muted/80 transition-colors">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          // local preview immediately
                          const localUrl = URL.createObjectURL(file);
                          setFormData(prev => ({ ...prev, image: localUrl, _imageUploading: true as unknown as string }));
                          try {
                            const { url } = await servicesAPI.uploadImage(file);
                            setFormData(prev => ({ ...prev, image: url, _imageUploading: false as unknown as string }));
                            toast.success('Image uploaded');
                          } catch (err: unknown) {
                            setFormData(prev => ({ ...prev, image: '', _imageUploading: false as unknown as string }));
                            toast.error((err as Error).message || 'Image upload failed');
                          } finally {
                            URL.revokeObjectURL(localUrl);
                          }
                        }}
                      />
                      📁 Upload from device
                    </label>
                    {(formData as Record<string, unknown>)._imageUploading && (
                      <span className="text-xs text-muted-foreground animate-pulse">Uploading…</span>
                    )}
                  </div>

                  {/* OR paste URL */}
                  <input
                    type="url"
                    value={formData.image?.startsWith('blob:') ? '' : (formData.image || '')}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    className="input-clean"
                    placeholder="Or paste an image URL (https://...)"
                  />

                  {/* Preview */}
                  {formData.image && !formData.image.startsWith('blob:') && (
                    <div className="mt-2 flex items-center gap-3">
                      <img
                        src={formData.image}
                        alt="Preview"
                        className="w-14 h-14 rounded-xl object-cover border border-border"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div>
                        <p className="text-xs text-muted-foreground">Preview</p>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, image: '' })}
                          className="text-xs text-destructive hover:underline mt-0.5"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Service Type — full dropdown, admin picks manually */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Service Type *
                    <span className="ml-2 text-xs font-normal text-muted-foreground">determines pricing model & worker matching</span>
                  </label>
                  <select
                    value={formData.serviceType || 'other'}
                    onChange={(e) => {
                      const nextServiceType = e.target.value;
                      const isSubscription = nextServiceType === 'monthly_subscription';
                      setFormData(prev => ({
                        ...prev,
                        serviceType: nextServiceType,
                        subscriptionOptions: getNormalizedSubscriptionOptions(prev.subscriptionOptions, isSubscription),
                        subscriptionPlans: isSubscription ? (prev.subscriptionPlans || []) : [],
                      }));
                    }}
                    className="input-clean"
                    required
                  >
                    <optgroup label="⚡ Instant / On-Demand">
                      <option value="instant_hourly">Insta Maid — Hourly on-demand</option>
                    </optgroup>
                    <optgroup label="🔄 Subscription">
                      <option value="monthly_subscription">Monthly Subscription — Recurring visits</option>
                    </optgroup>
                    <optgroup label="🏠 Deep Cleaning">
                      <option value="deep_cleaning_full_house">Full House Deep Clean</option>
                      <option value="deep_cleaning_room">Room Deep Clean</option>
                      <option value="deep_cleaning_kitchen">Kitchen Deep Clean</option>
                      <option value="deep_cleaning_bathroom">Bathroom Deep Clean</option>
                      <option value="deep_cleaning_commercial">Commercial / Office Deep Clean</option>
                    </optgroup>
                    <optgroup label="🧽 Spot / Single-Item Clean">
                      <option value="fixed_sofa_cleaning">Sofa Cleaning</option>
                      <option value="fixed_carpet_cleaning">Carpet Cleaning</option>
                      <option value="fixed_window_cleaning">Window Cleaning</option>
                      <option value="fixed_fan_cleaning">Fan Cleaning</option>
                      <option value="fixed_balcony_cleaning">Balcony Cleaning</option>
                      <option value="fixed_door_cleaning">Glass Door Cleaning</option>
                    </optgroup>
                    <optgroup label="🚿 Bathroom / Washroom">
                      <option value="fixed_washroom_basic">Washroom Basic Clean</option>
                      <option value="fixed_washroom_deep">Washroom Deep Clean</option>
                      <option value="fixed_washbasin_cleaning">Washbasin Cleaning</option>
                    </optgroup>
                    <optgroup label="🍳 Kitchen Appliances">
                      <option value="fixed_fridge_cleaning">Fridge Deep Clean</option>
                      <option value="fixed_microwave_cleaning">Microwave Cleaning</option>
                      <option value="fixed_oven_cleaning">OTG / Oven Cleaning</option>
                      <option value="fixed_stove_cleaning">Gas Stove Cleaning</option>
                      <option value="fixed_chimney_cleaning">Chimney Cleaning</option>
                      <option value="fixed_kitchen_platform_cleaning">Kitchen Platform & Tiles</option>
                      <option value="fixed_sink_cleaning">Sink Cleaning</option>
                      <option value="kitchen_appliances_package">Kitchen Package (Full)</option>
                    </optgroup>
                    <optgroup label="🛋️ Furniture">
                      <option value="fixed_dining_cleaning">Dining Table & Chairs</option>
                      <option value="fixed_cabinet_cleaning">Showcase Cabinet</option>
                      <option value="fixed_cupboard_cleaning">Cupboards</option>
                      <option value="fixed_utility_cleaning">Utility Area</option>
                      <option value="fixed_bed_cleaning">Bed Cleaning</option>
                      <option value="fixed_mirror_cleaning">Mirror Cleaning</option>
                      <option value="bedroom_package">Bedroom Package (Full)</option>
                    </optgroup>
                    <optgroup label="❄️ HVAC / AC">
                      <option value="fixed_ac_indoor_cleaning">AC Indoor Unit</option>
                      <option value="fixed_ac_outdoor_cleaning">AC Outdoor Unit</option>
                    </optgroup>
                    <optgroup label="🪟 Windows">
                      <option value="fixed_window_mesh_cleaning">Window Mesh Cleaning</option>
                    </optgroup>
                    <optgroup label="📦 Other">
                      <option value="other">Other / Custom</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Slot Selection Display
                    <span className="ml-2 text-xs font-normal text-muted-foreground">controls how time slots appear to customers</span>
                  </label>
                  <select
                    value={formData.slotSelectionType || 'worker_availability'}
                    onChange={(e) => setFormData({ ...formData, slotSelectionType: e.target.value as Service['slotSelectionType'] })}
                    className="input-clean"
                  >
                    <option value="worker_availability">Worker availability (show available workers)</option>
                    <option value="standard_slots">Standard slots (no worker counts)</option>
                  </select>
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

                {/* Subscription Plans Section */}
                {isSubscriptionServiceType ? (
                <div className="space-y-3 p-4 bg-purple-50 border border-purple-300 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-foreground">📦 Subscription Frequency Packs</label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Customer subscription cards use <strong>Duration Tiers</strong> for daily base pricing and the <strong>Subscription Booking Options</strong> section below for frequency titles, descriptions, visits and pricing behavior.
                    </p>
                  </div>
                  <div className="text-xs text-purple-700 bg-white border border-purple-200 rounded-lg p-3">
                    For monthly subscription services, the old generic subscription plan editor is not used. Configure the actual customer-facing Daily / Alt Days / 3× Week / Weekly packs below.
                  </div>
                </div>
                ) : (
                <div className="space-y-2 p-4 rounded-lg border border-dashed border-border bg-muted/30">
                  <label className="block text-sm font-medium text-foreground">Subscription plans</label>
                  <p className="text-xs text-muted-foreground">
                    Select <strong>Monthly Subscription</strong> as the service type to configure subscription plans and customer booking frequencies.
                  </p>
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

                {/* ── Duration / Time Tiers: hourly pricing for any service ── */}
                <div className="space-y-3 p-4 rounded-lg border bg-blue-50/50 border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-foreground">
                        ⏱ Duration Tiers (Time-Based Pricing)
                      </label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        e.g. 1 hr → ₹60/hr · 2 hr → ₹110 · For subscription: use /mo mode
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, durationOptions: [...(formData.durationOptions || []), createDefaultDurationTier()] })}
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
                          const mode = tier._priceMode || 'hour';
                          const originalPrice = tier.originalPrice || 0;
                          const savingsPct = originalPrice > tier.price && originalPrice > 0
                            ? Math.round((1 - tier.price / originalPrice) * 100)
                            : 0;
                          const displayOurPrice = tier.price;
                          const displayMrp = originalPrice;
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
                                      className={`flex-1 py-0.5 text-center transition-colors ${mode === 'hour' ? 'bg-blue-600 text-white' : 'bg-white text-muted-foreground'}`}
                                      onClick={() => {
                                        const updated = [...(formData.durationOptions || [])];
                                        updated[index] = { ...updated[index], _priceMode: 'hour' };
                                        setFormData({ ...formData, durationOptions: updated });
                                      }}
                                    >/hr</button>
                                    <button type="button"
                                      className={`flex-1 py-0.5 text-center transition-colors ${mode === 'month' ? 'bg-blue-600 text-white' : 'bg-white text-muted-foreground'}`}
                                      onClick={() => {
                                        const updated = [...(formData.durationOptions || [])];
                                        updated[index] = { ...updated[index], _priceMode: 'month' };
                                        setFormData({ ...formData, durationOptions: updated });
                                      }}
                                    >/mo</button>
                                  </div>
                                  <input
                                    type="number" min="0" step="any" value={displayOurPrice}
                                    onChange={e => {
                                      const updated = [...(formData.durationOptions || [])];
                                      updated[index] = { ...updated[index], price: Number(e.target.value) };
                                      setFormData({ ...formData, durationOptions: updated });
                                    }}
                                    className="input-clean text-sm" placeholder={mode === 'hour' ? '60' : '13000'}
                                  />
                                  <p className="text-[10px] text-muted-foreground">
                                    {mode === 'hour'
                                      ? `₹${tier.price.toLocaleString('en-IN')} per hour`
                                      : `₹${tier.price.toLocaleString('en-IN')} per month`}
                                  </p>
                                </div>
                                <div className="col-span-3 space-y-1">
                                  <input
                                    type="number" min="0" step="any" value={displayMrp}
                                    onChange={e => {
                                      const updated = [...(formData.durationOptions || [])];
                                      updated[index] = { ...updated[index], originalPrice: Number(e.target.value) };
                                      setFormData({ ...formData, durationOptions: updated });
                                    }}
                                    className="input-clean text-sm" placeholder={mode === 'hour' ? '80' : '18200'}
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

                {/* ── Subscription Booking Options ── */}
                {isSubscriptionServiceType && (
                <div className="space-y-3 p-4 bg-purple-50/60 border border-purple-300 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-foreground">🔄 Subscription Booking Options</label>
                      <p className="text-xs text-muted-foreground mt-0.5">Controls which frequencies & settings customers can choose on the booking page</p>
                    </div>

                    {(() => {
                      const sortedDurationTiers = [...(formData.durationOptions || [])].sort((a, b) => a.hours - b.hours);
                      const previewTier = sortedDurationTiers[0];
                      const previewBaseMonthlyPrice = previewTier?.price || formData.price || 0;
                      const previewBaseLabel = previewTier ? `${previewTier.hours}h/day tier` : 'base price';
                      const frequencyConfigs = getNormalizedFrequencyConfigs(formData.subscriptionOptions?.frequencyConfigs);

                      return (
                        <>

                    {/* Allowed Frequencies */}
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-2">Allowed Frequencies</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {frequencyConfigs.map((freq) => {
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
                                <p className="text-xs font-semibold text-foreground">{SUBSCRIPTION_FREQUENCY_ICONS[freq.id]} {freq.label}</p>
                                <p className="text-xs text-muted-foreground">{freq.description} · ~{freq.visits} visits/mo</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1">Editable Frequency Cards</p>
                        <p className="text-xs text-muted-foreground">
                          Preview totals below are based on the <strong>{previewBaseLabel}</strong> (₹{previewBaseMonthlyPrice.toLocaleString('en-IN')}/month).
                        </p>
                      </div>

                      <div className="space-y-3">
                        {frequencyConfigs.map((config, index) => {
                          const previewMonthlyTotal = Math.round(previewBaseMonthlyPrice * config.priceMultiplier);
                          const previewPerVisit = config.visits > 0 ? Math.round(previewMonthlyTotal / config.visits) : 0;

                          return (
                            <div key={config.id} className="rounded-lg border border-purple-200 bg-white p-3 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-foreground capitalize">{config.id.replace(/-/g, ' ')}</p>
                                  <p className="text-xs text-muted-foreground">Customer-facing content for this frequency card</p>
                                </div>
                                <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${(formData.subscriptionOptions?.allowedFrequencies || []).includes(config.id) ? 'bg-purple-100 text-purple-700' : 'bg-muted text-muted-foreground'}`}>
                                  {(formData.subscriptionOptions?.allowedFrequencies || []).includes(config.id) ? 'Visible to customer' : 'Hidden from customer'}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-muted-foreground mb-1">Title</label>
                                  <input
                                    type="text"
                                    value={config.label}
                                    onChange={(e) => {
                                      const nextConfigs = [...frequencyConfigs];
                                      nextConfigs[index] = { ...nextConfigs[index], label: e.target.value };
                                      setFormData({ ...formData, subscriptionOptions: { ...formData.subscriptionOptions, frequencyConfigs: nextConfigs } });
                                    }}
                                    className="input-clean text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-muted-foreground mb-1">Visits per month</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={config.visits}
                                    onChange={(e) => {
                                      const nextConfigs = [...frequencyConfigs];
                                      nextConfigs[index] = { ...nextConfigs[index], visits: Math.max(1, Number(e.target.value) || 1) };
                                      setFormData({ ...formData, subscriptionOptions: { ...formData.subscriptionOptions, frequencyConfigs: nextConfigs } });
                                    }}
                                    className="input-clean text-sm"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">Description</label>
                                <input
                                  type="text"
                                  value={config.description}
                                  onChange={(e) => {
                                    const nextConfigs = [...frequencyConfigs];
                                    nextConfigs[index] = { ...nextConfigs[index], description: e.target.value };
                                    setFormData({ ...formData, subscriptionOptions: { ...formData.subscriptionOptions, frequencyConfigs: nextConfigs } });
                                  }}
                                  className="input-clean text-sm"
                                  placeholder="e.g. Mon/Wed/Fri"
                                />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-muted-foreground mb-1">Per visit price preview (₹)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={previewPerVisit}
                                    onChange={(e) => {
                                      const nextPerVisit = Math.max(0, Number(e.target.value) || 0);
                                      const nextMultiplier = previewBaseMonthlyPrice > 0
                                        ? Number(((nextPerVisit * config.visits) / previewBaseMonthlyPrice).toFixed(4))
                                        : config.priceMultiplier;
                                      const nextConfigs = [...frequencyConfigs];
                                      nextConfigs[index] = { ...nextConfigs[index], priceMultiplier: nextMultiplier };
                                      setFormData({ ...formData, subscriptionOptions: { ...formData.subscriptionOptions, frequencyConfigs: nextConfigs } });
                                    }}
                                    className="input-clean text-sm"
                                  />
                                  <p className="text-[11px] text-muted-foreground mt-1">Editable for the preview tier; other duration tiers scale with the same ratio.</p>
                                </div>
                                <div>
                                  <label className="block text-xs text-muted-foreground mb-1">Monthly price factor</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={config.priceMultiplier}
                                    onChange={(e) => {
                                      const nextConfigs = [...frequencyConfigs];
                                      nextConfigs[index] = { ...nextConfigs[index], priceMultiplier: Math.max(0, Number(e.target.value) || 0) };
                                      setFormData({ ...formData, subscriptionOptions: { ...formData.subscriptionOptions, frequencyConfigs: nextConfigs } });
                                    }}
                                    className="input-clean text-sm"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                <div className="rounded-lg bg-purple-50 border border-purple-100 px-3 py-2">
                                  <p className="text-muted-foreground">Preview monthly</p>
                                  <p className="font-bold text-purple-700">₹{previewMonthlyTotal.toLocaleString('en-IN')}</p>
                                </div>
                                <div className="rounded-lg bg-purple-50 border border-purple-100 px-3 py-2">
                                  <p className="text-muted-foreground">Per visit</p>
                                  <p className="font-bold text-purple-700">₹{previewPerVisit.toLocaleString('en-IN')}</p>
                                </div>
                                <div className="rounded-lg bg-purple-50 border border-purple-100 px-3 py-2">
                                  <p className="text-muted-foreground">Visits</p>
                                  <p className="font-bold text-purple-700">~{config.visits}</p>
                                </div>
                                <div className="rounded-lg bg-purple-50 border border-purple-100 px-3 py-2">
                                  <p className="text-muted-foreground">Factor</p>
                                  <p className="font-bold text-purple-700">{config.priceMultiplier.toFixed(2)}×</p>
                                </div>
                              </div>
                            </div>
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
                        </>
                      );
                    })()}
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
                          <span className="col-span-6 text-xs text-muted-foreground font-medium">Price (₹)</span>
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
                                step="any"
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

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="allowBreakRequests"
                    checked={formData.allowBreakRequests === true}
                    onChange={(e) => setFormData({ ...formData, allowBreakRequests: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <div>
                    <label htmlFor="allowBreakRequests" className="text-sm font-medium text-foreground cursor-pointer">
                      Allow Break Requests ☕
                    </label>
                    <p className="text-xs text-muted-foreground">Workers can request breaks during in-progress bookings for this service.</p>
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
                                value={getSuggestedServiceId(suggestion.serviceId)}
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

                {/* Service Category & Worker Radius Section */}
                <div className="space-y-4 p-4 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-foreground">📍 Location & Category Settings</label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Control how far workers are searched and how this service is grouped
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Service Category */}
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Service Category</label>
                      <select
                        value={formData.serviceCategory ?? 'other'}
                        onChange={(e) => setFormData({ ...formData, serviceCategory: e.target.value })}
                        className="input-clean text-sm w-full"
                      >
                        <option value="instant_services">⚡ Instant Services (On-Demand)</option>
                        <option value="subscription_services">🔄 Subscription Services</option>
                        <option value="deep_cleaning">🏠 Deep Cleaning</option>
                        <option value="spot_cleaning">🧽 Spot / Mini Cleaning</option>
                        <option value="kitchen_services">🍳 Kitchen Services</option>
                        <option value="bathroom_services">🚿 Bathroom Services</option>
                        <option value="furniture_services">🛋️ Furniture Services</option>
                        <option value="hvac_services">❄️ HVAC / AC Services</option>
                        <option value="other">📦 Other</option>
                      </select>
                    </div>
                    {/* Display Order */}
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Display Order</label>
                      <input
                        type="number"
                        min={0}
                        value={formData.displayOrder ?? 0}
                        onChange={(e) => setFormData({ ...formData, displayOrder: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="input-clean text-sm w-full"
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Lower number = shown first</p>
                    </div>
                  </div>
                  {/* Worker Search Radius Slider */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-2">
                      Worker Search Radius:&nbsp;
                      <span className="text-orange-700 font-bold">
                        {(formData.workerSearchRadiusKm ?? 10) < 1
                          ? `${Math.round((formData.workerSearchRadiusKm ?? 10) * 1000)} m`
                          : `${formData.workerSearchRadiusKm ?? 10} km`}
                      </span>
                    </label>
                    <input
                      type="range"
                      min={0.1}
                      max={50}
                      step={0.1}
                      value={formData.workerSearchRadiusKm ?? 10}
                      onChange={(e) => setFormData({ ...formData, workerSearchRadiusKm: parseFloat(e.target.value) })}
                      className="w-full accent-orange-500"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>100 m</span>
                      <span>5 km</span>
                      <span>10 km</span>
                      <span>30 km</span>
                      <span>50 km</span>
                    </div>
                    {/* Quick presets */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[
                        { label: '⚡ Insta (500m)', value: 0.5 },
                        { label: '🔄 Subscription (2km)', value: 2 },
                        { label: '🧽 Spot Clean (5km)', value: 5 },
                        { label: '🏠 Deep Clean (30km)', value: 30 },
                      ].map(preset => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, workerSearchRadiusKm: preset.value })}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            formData.workerSearchRadiusKm === preset.value
                              ? 'bg-orange-500 text-white border-orange-500'
                              : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-50'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Workers within this radius will be considered for this service when a booking is placed.
                    </p>
                  </div>
                </div>

                {/* Workforce & Wages Section */}
                <div className="space-y-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-foreground">👥 Workforce & Wages</label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Set the default number of workers needed and how they are paid for this service
                    </p>
                  </div>
                  {!isSuperAdmin && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Wage edits do not apply immediately for admins. They are sent as a service price-change request for super-admin approval.
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Workers Needed</label>
                      <input
                        type="number"
                        min={1}
                        value={formData.defaultWorkerCount ?? 1}
                        onChange={(e) => setFormData({ ...formData, defaultWorkerCount: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="input-clean text-sm w-full"
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Wage Type</label>
                      <select
                        value={formData.workerWage?.type ?? 'per_hour'}
                        onChange={(e) => setFormData({ ...formData, workerWage: { ...(formData.workerWage || { rate: 0 }), type: e.target.value as 'per_hour' | 'per_session' } })}
                        className="input-clean text-sm w-full"
                      >
                        <option value="per_hour">Per Hour (₹/hr)</option>
                        <option value="per_session">Per Session (₹/session)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Wage Rate (₹ {formData.workerWage?.type === 'per_session' ? 'per session' : 'per hour'})
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={formData.workerWage?.rate ?? 0}
                        onChange={(e) => setFormData({ ...formData, workerWage: { ...(formData.workerWage || { type: 'per_hour' }), rate: Math.max(0, parseFloat(e.target.value) || 0) } })}
                        className="input-clean text-sm w-full"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {(formData.workerWage?.rate ?? 0) > 0 && (
                    <p className="text-xs text-blue-700 bg-blue-100 rounded px-3 py-2">
                      💡 Example: {formData.defaultWorkerCount ?? 1} worker{(formData.defaultWorkerCount ?? 1) > 1 ? 's' : ''} ×{' '}
                      {formData.workerWage?.type === 'per_hour'
                        ? `₹${formData.workerWage.rate}/hr for a 2-hour job = ₹${((formData.defaultWorkerCount ?? 1) * (formData.workerWage?.rate ?? 0) * 2).toFixed(0)} total wage`
                        : `₹${formData.workerWage?.rate ?? 0}/session = ₹${((formData.defaultWorkerCount ?? 1) * (formData.workerWage?.rate ?? 0)).toFixed(0)} total wage`}
                    </p>
                  )}
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
