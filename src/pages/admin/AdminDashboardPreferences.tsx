import AppLayout from "@/components/AppLayout";
import { toast } from "@/hooks/use-toast";
import { useAdminRole } from "@/hooks/useAdminRole";
import { dashboardPreferencesAPI, servicesAPI } from "@/lib/api";
import { AlertCircle, ArrowDown, ArrowUp, Eye, EyeOff, Plus, RotateCcw, Save, Settings2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface DashboardService {
  id: string;
  linkedServiceId?: string | null;
  icon: string;
  nameKey: string;
  subtitleKey: string;
  customName?: string;
  customSubtitle?: string;
  badge: string;
  path: string;
  isActive: boolean;
  sortOrder: number;
  isDefault?: boolean;
}

interface AvailableService {
  _id: string;
  name: string;
  description?: string;
  serviceType?: string;
  isQuoteService?: boolean;
  subscriptionOptions?: {
    enabled?: boolean;
  };
}

const getSuggestedIcon = (service: AvailableService) => {
  const haystack = `${service.name} ${service.serviceType || ''}`.toLowerCase();

  if (haystack.includes('kitchen')) return '🍽️';
  if (haystack.includes('washroom') || haystack.includes('bathroom')) return '🚿';
  if (haystack.includes('window')) return '🪟';
  if (haystack.includes('sofa')) return '🛋️';
  if (haystack.includes('fridge')) return '❄️';
  if (haystack.includes('fan')) return '🌀';
  if (haystack.includes('balcony')) return '🌿';
  if (haystack.includes('subscription')) return '📅';
  if (haystack.includes('deep')) return '✨';
  if (haystack.includes('insta') || haystack.includes('hourly')) return '⚡';

  return '🧹';
};

const getLinkedServicePath = (service: AvailableService) => {
  if (service.subscriptionOptions?.enabled) {
    return `/customer/subscribe/${service._id}`;
  }

  if (service.isQuoteService) {
    return '/customer/deep-cleaning';
  }

  return `/customer/book/${service._id}`;
};

const buildDashboardCardFromService = (service: AvailableService, sortOrder: number, isActive: boolean): DashboardService => ({
  id: `service_${service._id}`,
  linkedServiceId: service._id,
  icon: getSuggestedIcon(service),
  nameKey: service.name,
  subtitleKey: service.description || 'Book this service directly',
  customName: service.name,
  customSubtitle: service.description || 'Book this service directly',
  badge: service.subscriptionOptions?.enabled ? 'Subscription' : service.isQuoteService ? 'Quote' : 'Book now',
  path: getLinkedServicePath(service),
  isActive,
  sortOrder,
  isDefault: false,
});

const AdminDashboardPreferences = () => {
  const { role, name } = useAdminRole();
  const [services, setServices] = useState<DashboardService[]>([]);
  const [availableServices, setAvailableServices] = useState<AvailableService[]>([]);
  const [selectedCatalogServiceId, setSelectedCatalogServiceId] = useState('');
  const [maxServices, setMaxServices] = useState(6);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const [response, servicesResponse] = await Promise.all([
        dashboardPreferencesAPI.getAdminConfig(),
        servicesAPI.getAll({ isActive: true, limit: 200 }),
      ]);

      setServices(response.services || []);
      setAvailableServices(servicesResponse.services || []);
      setMaxServices(response.maxServices || 6);
    } catch (error) {
      console.error('Error fetching dashboard config:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard configuration",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const moveServiceUp = (index: number) => {
    if (index === 0) return;

    const newServices = [...services];
    [newServices[index - 1], newServices[index]] = [newServices[index], newServices[index - 1]];

    // Update sort orders
    const updatedServices = newServices.map((item, idx) => ({
      ...item,
      sortOrder: idx + 1
    }));

    setServices(updatedServices);
    setHasChanges(true);
  };

  const moveServiceDown = (index: number) => {
    if (index === services.length - 1) return;

    const newServices = [...services];
    [newServices[index], newServices[index + 1]] = [newServices[index + 1], newServices[index]];

    // Update sort orders
    const updatedServices = newServices.map((item, idx) => ({
      ...item,
      sortOrder: idx + 1
    }));

    setServices(updatedServices);
    setHasChanges(true);
  };

  const handleToggleActive = (serviceId: string) => {
    const updatedServices = services.map(service => {
      if (service.id === serviceId) {
        return { ...service, isActive: !service.isActive };
      }
      return service;
    });

    // Check constraints
    const activeCount = updatedServices.filter(s => s.isActive).length;

    if (activeCount === 0) {
      toast({
        title: "Error",
        description: "At least one service must be active",
        variant: "destructive"
      });
      return;
    }

    if (activeCount > maxServices) {
      toast({
        title: "Error",
        description: `Cannot activate more than ${maxServices} services`,
        variant: "destructive"
      });
      return;
    }

    setServices(updatedServices);
    setHasChanges(true);
  };

  const handleServiceFieldChange = (
    serviceId: string,
    field: keyof DashboardService,
    value: string
  ) => {
    setServices((prev) => prev.map((service) =>
      service.id === serviceId ? { ...service, [field]: value } : service
    ));
    setHasChanges(true);
  };

  const handleLinkedServiceChange = (dashboardServiceId: string, linkedServiceId: string) => {
    const selectedService = availableServices.find((service) => service._id === linkedServiceId);

    setServices((prev) => prev.map((service) => {
      if (service.id !== dashboardServiceId) return service;

      if (!selectedService) {
        return {
          ...service,
          linkedServiceId: null,
        };
      }

      return {
        ...service,
        linkedServiceId,
        path: getLinkedServicePath(selectedService),
        customName: service.customName?.trim() ? service.customName : selectedService.name,
        customSubtitle: service.customSubtitle?.trim() ? service.customSubtitle : (selectedService.description || 'Book this service directly'),
        icon: service.icon?.trim() ? service.icon : getSuggestedIcon(selectedService),
      };
    }));

    setHasChanges(true);
  };

  const handleAddServiceCard = () => {
    const selectedService = availableServices.find((service) => service._id === selectedCatalogServiceId);

    if (!selectedService) {
      toast({
        title: 'Pick a service',
        description: 'Choose a service to add to the customer dashboard.',
        variant: 'destructive'
      });
      return;
    }

    const alreadyLinked = services.some((service) => service.linkedServiceId === selectedService._id);
    if (alreadyLinked) {
      toast({
        title: 'Already added',
        description: `${selectedService.name} is already configured on the dashboard.`,
        variant: 'destructive'
      });
      return;
    }

    const hasActiveSlot = services.filter((service) => service.isActive).length < maxServices;

    setServices((prev) => ([
      ...prev,
      buildDashboardCardFromService(selectedService, prev.length + 1, hasActiveSlot)
    ]));
    setSelectedCatalogServiceId('');
    setHasChanges(true);

    if (!hasActiveSlot) {
      toast({
        title: 'Added as inactive',
        description: `You've already reached the ${maxServices}-card active limit. Activate it after disabling another card.`,
        variant: 'default'
      });
    }
  };

  const handleRemoveService = (serviceId: string) => {
    const target = services.find((service) => service.id === serviceId);
    if (!target || target.isDefault) {
      return;
    }

    const updatedServices = services
      .filter((service) => service.id !== serviceId)
      .map((service, index) => ({
        ...service,
        sortOrder: index + 1,
      }));

    setServices(updatedServices);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await dashboardPreferencesAPI.updateConfig(services, maxServices);

      toast({
        title: "Success",
        description: "Dashboard preferences saved successfully",
        variant: "default"
      });

      setHasChanges(false);
    } catch (error: unknown) {
      console.error('Error saving config:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save dashboard preferences",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    fetchConfig();
    setHasChanges(false);
  };

  const activeServicesCount = services.filter(s => s.isActive).length;

  if (loading) {
    return (
      <AppLayout userType={role} userName={name}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard configuration...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType={role} userName={name}>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Settings2 className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard Service Preferences</h1>
          </div>
          <p className="text-muted-foreground">
            Configure which services appear on the customer dashboard and their display order.
          </p>
        </div>

        <div className="bg-card border rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Configuration Settings</h2>
              <p className="text-sm text-muted-foreground">Global settings for dashboard services</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-muted/30 rounded-lg p-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Maximum Services
              </label>
              <select
                value={maxServices}
                onChange={(e) => {
                  const newMax = parseInt(e.target.value);
                  if (activeServicesCount <= newMax) {
                    setMaxServices(newMax);
                    setHasChanges(true);
                  } else {
                    toast({
                      title: "Cannot reduce limit",
                      description: `You have ${activeServicesCount} active services. Deactivate some first.`,
                      variant: "destructive"
                    });
                  }
                }}
                className="w-full p-3 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              >
                <option value={2}>2 Services</option>
                <option value={3}>3 Services</option>
                <option value={4}>4 Services</option>
                <option value={5}>5 Services</option>
                <option value={6}>6 Services</option>
                <option value={7}>7 Services</option>
                <option value={8}>8 Services</option>
              </select>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <div className="text-sm font-medium text-foreground mb-2">Current Status</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Services:</span>
                  <span className={`font-medium ${activeServicesCount <= maxServices ? 'text-green-600' : 'text-red-600'}`}>
                    {activeServicesCount} / {maxServices}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Services:</span>
                  <span className="font-medium text-foreground">{services.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-6">
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-foreground mb-2">Add any live service to the customer dashboard</label>
                <select
                  value={selectedCatalogServiceId}
                  onChange={(e) => setSelectedCatalogServiceId(e.target.value)}
                  className="w-full p-3 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                >
                  <option value="">Select a service</option>
                  {availableServices.map((service) => (
                    <option key={service._id} value={service._id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddServiceCard}
                className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
                type="button"
              >
                <Plus className="w-4 h-4" /> Add card
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Super admins can feature any active service here. Linked cards open the exact booking flow for that service.
            </p>
          </div>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Service Management</h2>
              <p className="text-sm text-muted-foreground">
                Use arrows to reorder • Toggle to activate/deactivate services
              </p>
            </div>

            <div className="flex gap-3">
              {hasChanges && (
                <>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                    disabled={saving}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {services.map((service, index) => (
              <div
                key={service.id}
                className={`border rounded-lg p-4 transition-all ${
                  service.isActive
                    ? 'border-border bg-background'
                    : 'border-muted bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveServiceUp(index)}
                      disabled={index === 0}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveServiceDown(index)}
                      disabled={index === services.length - 1}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-2xl">{service.icon}</div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground">{service.customName?.trim() || service.nameKey.split('.').pop()}</h3>
                      {service.isDefault && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{service.customSubtitle?.trim() || service.subtitleKey.split('.').pop()}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Icon</label>
                        <input
                          type="text"
                          value={service.icon}
                          onChange={(e) => handleServiceFieldChange(service.id, 'icon', e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                          placeholder="⚡"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Badge</label>
                        <input
                          type="text"
                          value={service.badge}
                          onChange={(e) => handleServiceFieldChange(service.id, 'badge', e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                          placeholder="On demand"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Title override</label>
                        <input
                          type="text"
                          value={service.customName || ''}
                          onChange={(e) => handleServiceFieldChange(service.id, 'customName', e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                          placeholder={service.nameKey.split('.').pop()}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Subtitle override</label>
                        <input
                          type="text"
                          value={service.customSubtitle || ''}
                          onChange={(e) => handleServiceFieldChange(service.id, 'customSubtitle', e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                          placeholder={service.subtitleKey.split('.').pop()}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Linked service</label>
                        <select
                          value={service.linkedServiceId || ''}
                          onChange={(e) => handleLinkedServiceChange(service.id, e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                        >
                          <option value="">Use manual path only</option>
                          {availableServices.map((availableService) => (
                            <option key={availableService._id} value={availableService._id}>
                              {availableService.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Path</label>
                        <input
                          type="text"
                          value={service.path}
                          onChange={(e) => handleServiceFieldChange(service.id, 'path', e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                          placeholder="/customer/services/insta"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
                      <span>Fallback title key: {service.nameKey}</span>
                      <span>Order: {service.sortOrder}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleActive(service.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      service.isActive
                        ? 'text-green-600 bg-green-50 hover:bg-green-100'
                        : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                    }`}
                    title={service.isActive ? 'Deactivate service' : 'Activate service'}
                  >
                    {service.isActive ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => handleRemoveService(service.id)}
                    className="p-2 rounded-lg transition-colors text-destructive bg-destructive/5 hover:bg-destructive/10"
                    title="Remove service card"
                    type="button"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {services.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Settings2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No services configured</p>
            </div>
          )}
        </div>

        {activeServicesCount > maxServices && (
          <div className="mt-4 bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Too many active services</span>
            </div>
            <p className="text-sm text-destructive/80 mt-1">
              You have {activeServicesCount} active services but the limit is {maxServices}.
              Please deactivate {activeServicesCount - maxServices} service(s) or increase the limit.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminDashboardPreferences;