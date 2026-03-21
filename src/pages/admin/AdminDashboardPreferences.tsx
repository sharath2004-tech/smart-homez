import AppLayout from "@/components/AppLayout";
import { toast } from "@/hooks/use-toast";
import { useAdminRole } from "@/hooks/useAdminRole";
import { dashboardPreferencesAPI } from "@/lib/api";
import { AlertCircle, ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw, Save, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";

interface DashboardService {
  id: string;
  icon: string;
  nameKey: string;
  subtitleKey: string;
  badge: string;
  path: string;
  isActive: boolean;
  sortOrder: number;
  isDefault?: boolean;
}

const AdminDashboardPreferences = () => {
  const { role, name } = useAdminRole();
  const [services, setServices] = useState<DashboardService[]>([]);
  const [maxServices, setMaxServices] = useState(4);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await dashboardPreferencesAPI.getAdminConfig();
      setServices(response.services || []);
      setMaxServices(response.maxServices || 4);
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
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save dashboard preferences",
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
      <AppLayout>
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
    <AppLayout>
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
                      <h3 className="font-medium text-foreground">{service.nameKey.split('.').pop()}</h3>
                      {service.isDefault && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{service.subtitleKey.split('.').pop()}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Badge: {service.badge}</span>
                      <span>Path: {service.path}</span>
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