import { Minus, Plus, Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// ==================== TYPESCRIPT INTERFACES ====================

interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  icon?: string;
  description?: string;
  price: number;
  discountPercentage?: number;
  isActive?: boolean;
  requiresFixedWorker?: boolean;
  allowDaySelection?: boolean;
  sortOrder?: number;
}

interface SizeParameter {
  value: string;
  label: string;
  price: number;
  duration?: number;
  workersRequired?: number;
}

interface DurationOption {
  hours: number;
  price: number;
  isDefault?: boolean;
  minimumHours?: number;
}

interface Addon {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration?: number;
  optional?: boolean;
  category?: string;
  icon?: string;
  isActive?: boolean;
}

interface ServiceField {
  fieldName: string;
  fieldLabel: string;
  fieldType: 'text' | 'number' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'textarea';
  options?: string[];
  required?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  helpText?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  affectsPricing?: boolean;
  pricingMultiplier?: number;
}

interface TimeSlot {
  label: string;
  startTime: string;
  endTime: string;
  extraCharge?: number;
}

// Specific ServiceData interface
interface ServiceData {
  name?: string;
  description?: string;
  category?: string;
  serviceType?: string;
  price?: number;
  duration?: number;
  image?: string | null;
  tags?: string[];
  requirements?: string[];
  isActive?: boolean;
  pricingPlans?: {
    oneTime?: number;
    daily?: number;
    weekly?: number;
    monthly?: number;
  };
  subscriptionPlans?: SubscriptionPlan[];
  sizeParameters?: {
    enabled?: boolean;
    sizeType?: 'house_size' | 'room_size' | 'area_sqft' | 'quantity';
    options?: SizeParameter[];
  };
  durationOptions?: DurationOption[];
  subscriptionOptions?: {
    enabled?: boolean;
    minContractMonths?: number;
    maxContractMonths?: number;
    allowedFrequencies?: string[];
    discountPercentage?: number;
    autoRenewal?: boolean;
    requiresSameWorker?: boolean;
  };
  addons?: Addon[];
  equipmentRequired?: {
    providedBy?: 'worker' | 'customer' | 'both' | 'optional';
    items?: Array<{
      name: string;
      required?: boolean;
      providedBy?: string;
    }>;
    notes?: string;
  };
  workerPreferences?: {
    genderPreference?: boolean;
    languagePreference?: boolean;
    ratingMinimum?: number;
    experienceRequired?: number;
    certificationRequired?: boolean;
  };
  serviceFields?: ServiceField[];
  timeSlotRestrictions?: {
    allowedTimeSlots?: TimeSlot[];
    bookingWindow?: {
      minHoursAdvance?: number;
      maxDaysAdvance?: number;
    };
    sameDayBooking?: {
      enabled?: boolean;
      extraCharge?: number;
    };
  };
  cancellationPolicy?: {
    allowCancellation?: boolean;
    freeCancelHoursBeforeService?: number;
    cancellationChargePercentage?: number;
    refundPolicy?: string;
  };
  specialInstructionsTemplate?: {
    enabled?: boolean;
    placeholder?: string;
    maxLength?: number;
    suggestions?: string[];
  };
}

interface ServiceParametersEditorProps {
  serviceData: ServiceData;
  onChange: (data: ServiceData) => void;
  onSave: () => void;
  onCancel: () => void;
}

// ==================== CONSTANTS ====================

const SERVICE_TYPES = [
  { value: 'instant_hourly', label: 'On-Demand Hourly Service' },
  { value: 'monthly_subscription', label: 'Monthly Subscription' },
  { value: 'deep_cleaning_full_house', label: 'Full House Deep Cleaning' },
  { value: 'deep_cleaning_room', label: 'Room-Specific Deep Cleaning' },
  { value: 'deep_cleaning_kitchen', label: 'Kitchen Deep Cleaning' },
  { value: 'deep_cleaning_bathroom', label: 'Bathroom Deep Cleaning' },
  { value: 'fixed_washroom_basic', label: 'Basic Washroom Cleaning' },
  { value: 'fixed_washroom_deep', label: 'Deep Washroom Cleaning' },
  { value: 'fixed_fan_cleaning', label: 'Fan Cleaning' },
  { value: 'fixed_window_cleaning', label: 'Window Cleaning' },
  { value: 'fixed_sofa_cleaning', label: 'Sofa Cleaning' },
  { value: 'fixed_carpet_cleaning', label: 'Carpet Cleaning' },
  { value: 'fixed_balcony_cleaning', label: 'Balcony Cleaning' },
  { value: 'other', label: 'Other/Custom' }
];

type TabId = 'basic' | 'pricing' | 'subscription' | 'addons' | 'advanced';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'basic', label: 'Basic Info', icon: '📋' },
  { id: 'pricing', label: 'Pricing & Size', icon: '💰' },
  { id: 'subscription', label: 'Subscription', icon: '📅' },
  { id: 'addons', label: 'Add-ons & Extras', icon: '➕' },
  { id: 'advanced', label: 'Advanced', icon: '⚙️' }
];

// ==================== UTILITY FUNCTIONS ====================

// Generate unique IDs using crypto.randomUUID() or fallback
const generateId = (prefix: string = ''): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}${crypto.randomUUID()}`;
  }
  // Fallback for older browsers
  return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ==================== MAIN COMPONENT ====================

const ServiceParametersEditor = ({ serviceData, onChange, onSave, onCancel }: ServiceParametersEditorProps) => {
  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Focus management
  useEffect(() => {
    // Focus the first element when dialog opens
    if (firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }

    // Trap focus within dialog
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const updateField = (path: string, value: unknown) => {
    const keys = path.split('.');
    const newData = { ...serviceData };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = newData;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    onChange(newData);
  };

  const addArrayItem = (path: string, defaultItem: unknown) => {
    const keys = path.split('.');
    const newData = { ...serviceData };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = newData;
    
    for (const key of keys.slice(0, -1)) {
      if (!current[key]) current[key] = {};
      current = current[key];
    }
    
    const lastKey = keys[keys.length - 1];
    if (!current[lastKey]) current[lastKey] = [];
    current[lastKey] = [...current[lastKey], defaultItem];
    
    onChange(newData);
  };

  const removeArrayItem = (path: string, index: number) => {
    const keys = path.split('.');
    const newData = { ...serviceData };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = newData;
    
    for (const key of keys.slice(0, -1)) {
      current = current[key];
    }
    
    const lastKey = keys[keys.length - 1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    current[lastKey] = current[lastKey].filter((_: any, i: number) => i !== index);
    
    onChange(newData);
  };

  const updateArrayItem = (path: string, index: number, field: string, value: unknown) => {
    const keys = path.split('.');
    const newData = { ...serviceData };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = newData;
    
    for (const key of keys.slice(0, -1)) {
      if (!current[key]) current[key] = {};
      current = current[key];
    }
    
    const lastKey = keys[keys.length - 1];
    if (!current[lastKey]) current[lastKey] = [];
    current[lastKey][index] = { ...current[lastKey][index], [field]: value };
    
    onChange(newData);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div 
        ref={dialogRef}
        className="bg-card rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/10 to-primary/5">
          <div>
            <h2 id="dialog-title" className="text-2xl font-bold text-foreground">Service Parameters Editor</h2>
            <p id="dialog-description" className="text-sm text-muted-foreground">Configure all service options and parameters</p>
          </div>
          <button
            ref={firstFocusableRef}
            onClick={onCancel}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs with ARIA tab pattern */}
        <div 
          role="tablist" 
          aria-label="Service parameter sections"
          className="flex gap-2 p-4 border-b border-border overflow-x-auto"
        >
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  const nextIndex = (index + 1) % TABS.length;
                  setActiveTab(TABS[nextIndex].id);
                } else if (e.key === 'ArrowLeft') {
                  const prevIndex = (index - 1 + TABS.length) % TABS.length;
                  setActiveTab(TABS[prevIndex].id);
                }
              }}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content with proper ARIA */}
        <div 
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className="flex-1 overflow-y-auto p-6"
        >
          {/* BASIC INFO TAB */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div>
                <label htmlFor="service-type" className="block text-sm font-medium text-foreground mb-2">
                  Service Type
                </label>
                <select
                  id="service-type"
                  value={serviceData.serviceType || 'other'}
                  onChange={(e) => updateField('serviceType', e.target.value)}
                  className="w-full p-3 border border-border rounded-lg bg-card"
                >
                  {SERVICE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="service-name" className="block text-sm font-medium text-foreground mb-2">
                  Service Name *
                </label>
                <input
                  type="text"
                  id="service-name"
                  value={serviceData.name || ''}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="w-full p-3 border border-border rounded-lg bg-card"
                  required
                />
              </div>

              <div>
                <label htmlFor="service-description" className="block text-sm font-medium text-foreground mb-2">
                  Description *
                </label>
                <textarea
                  id="service-description"
                  value={serviceData.description || ''}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={4}
                  className="w-full p-3 border border-border rounded-lg bg-card"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="service-price" className="block text-sm font-medium text-foreground mb-2">
                    Base Price (₹) *
                  </label>
                  <input
                    type="number"
                    id="service-price"
                    value={serviceData.price || 0}
                    onChange={(e) => updateField('price', Number(e.target.value))}
                    min="0"
                    step="0.01"
                    className="w-full p-3 border border-border rounded-lg bg-card"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="service-duration" className="block text-sm font-medium text-foreground mb-2">
                    Duration (minutes) *
                  </label>
                  <input
                    type="number"
                    id="service-duration"
                    value={serviceData.duration || 0}
                    onChange={(e) => updateField('duration', Number(e.target.value))}
                    min="0"
                    className="w-full p-3 border border-border rounded-lg bg-card"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="service-active" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    id="service-active"
                    checked={serviceData.isActive !== false}
                    onChange={(e) => updateField('isActive', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-foreground">Service is Active</span>
                </label>
              </div>
            </div>
          )}

          {/* PRICING TAB */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              {/* Size Parameters */}
              <div className="border border-border rounded-lg p-4">
                <h3 className="text-lg font-semibold text-foreground mb-4">Size-Based Pricing</h3>
                
                <label htmlFor="size-enabled" className="flex items-center gap-2 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    id="size-enabled"
                    checked={serviceData.sizeParameters?.enabled || false}
                    onChange={(e) => updateField('sizeParameters.enabled', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-foreground">Enable Size-Based Pricing</span>
                </label>

                {serviceData.sizeParameters?.enabled && (
                  <>
                    <div className="mb-4">
                      <label htmlFor="size-type" className="block text-sm font-medium text-foreground mb-2">
                        Size Type
                      </label>
                      <select
                        id="size-type"
                        value={serviceData.sizeParameters?.sizeType || 'quantity'}
                        onChange={(e) => updateField('sizeParameters.sizeType', e.target.value)}
                        className="w-full p-3 border border-border rounded-lg bg-card"
                      >
                        <option value="house_size">House Size (BHK)</option>
                        <option value="room_size">Room Size</option>
                        <option value="area_sqft">Area (sq ft)</option>
                        <option value="quantity">Quantity</option>
                      </select>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-foreground">Size Options</h4>
                        <button
                          onClick={() => addArrayItem('sizeParameters.options', {
                            value: '',
                            label: '',
                            price: 0,
                            duration: 0,
                            workersRequired: 1
                          })}
                          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                        >
                          <Plus className="w-4 h-4" /> Add Option
                        </button>
                      </div>

                      {serviceData.sizeParameters?.options?.map((option, index) => (
                        <div key={generateId(`size-opt-${index}-`)} className="border border-border rounded-lg p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label htmlFor={`size-value-${index}`} className="block text-xs font-medium text-muted-foreground mb-1">
                                Value
                              </label>
                              <input
                                type="text"
                                id={`size-value-${index}`}
                                value={option.value}
                                onChange={(e) => updateArrayItem('sizeParameters.options', index, 'value', e.target.value)}
                                className="w-full p-2 border border-border rounded bg-card text-sm"
                                placeholder="e.g., 1BHK, Small"
                              />
                            </div>
                            <div>
                              <label htmlFor={`size-label-${index}`} className="block text-xs font-medium text-muted-foreground mb-1">
                                Label
                              </label>
                              <input
                                type="text"
                                id={`size-label-${index}`}
                                value={option.label}
                                onChange={(e) => updateArrayItem('sizeParameters.options', index, 'label', e.target.value)}
                                className="w-full p-2 border border-border rounded bg-card text-sm"
                                placeholder="Display name"
                              />
                            </div>
                            <div>
                              <label htmlFor={`size-price-${index}`} className="block text-xs font-medium text-muted-foreground mb-1">
                                Price (₹)
                              </label>
                              <input
                                type="number"
                                id={`size-price-${index}`}
                                value={option.price}
                                onChange={(e) => updateArrayItem('sizeParameters.options', index, 'price', Number(e.target.value))}
                                className="w-full p-2 border border-border rounded bg-card text-sm"
                                min="0"
                              />
                            </div>
                            <div>
                              <label htmlFor={`size-duration-${index}`} className="block text-xs font-medium text-muted-foreground mb-1">
                                Duration (min)
                              </label>
                              <input
                                type="number"
                                id={`size-duration-${index}`}
                                value={option.duration || 0}
                                onChange={(e) => updateArrayItem('sizeParameters.options', index, 'duration', Number(e.target.value))}
                                className="w-full p-2 border border-border rounded bg-card text-sm"
                                min="0"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => removeArrayItem('sizeParameters.options', index)}
                            className="flex items-center gap-2 px-3 py-1 text-sm text-destructive hover:bg-destructive/10 rounded transition-colors"
                          >
                            <Minus className="w-4 h-4" /> Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* SUBSCRIPTION TAB */}
          {activeTab === 'subscription' && (
            <div className="space-y-6">
              <div className="border border-border rounded-lg p-4">
                <h3 className="text-lg font-semibold text-foreground mb-4">Subscription Plans</h3>
                
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">Configure recurring subscription options</p>
                  <button
                    onClick={() => addArrayItem('subscriptionPlans', {
                      id: generateId('plan-'),
                      name: '',
                      displayName: '',
                      icon: '📅',
                      description: '',
                      price: 0,
                      discountPercentage: 0,
                      isActive: true,
                      requiresFixedWorker: false,
                      allowDaySelection: false,
                      sortOrder: (serviceData.subscriptionPlans?.length || 0) + 1
                    })}
                    className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Plan
                  </button>
                </div>

                {serviceData.subscriptionPlans?.map((plan, index) => (
                  <div key={plan.id || generateId(`plan-${index}-`)} className="border border-border rounded-lg p-4 mb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor={`plan-name-${index}`} className="block text-xs font-medium text-muted-foreground mb-1">
                          Plan Name *
                        </label>
                        <input
                          type="text"
                          id={`plan-name-${index}`}
                          value={plan.name}
                          onChange={(e) => updateArrayItem('subscriptionPlans', index, 'name', e.target.value)}
                          className="w-full p-2 border border-border rounded bg-card text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor={`plan-display-${index}`} className="block text-xs font-medium text-muted-foreground mb-1">
                          Display Name *
                        </label>
                        <input
                          type="text"
                          id={`plan-display-${index}`}
                          value={plan.displayName}
                          onChange={(e) => updateArrayItem('subscriptionPlans', index, 'displayName', e.target.value)}
                          className="w-full p-2 border border-border rounded bg-card text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor={`plan-price-${index}`} className="block text-xs font-medium text-muted-foreground mb-1">
                          Price (₹) *
                        </label>
                        <input
                          type="number"
                          id={`plan-price-${index}`}
                          value={plan.price}
                          onChange={(e) => updateArrayItem('subscriptionPlans', index, 'price', Number(e.target.value))}
                          className="w-full p-2 border border-border rounded bg-card text-sm"
                          min="0"
                        />
                      </div>
                      <div>
                        <label htmlFor={`plan-discount-${index}`} className="block text-xs font-medium text-muted-foreground mb-1">
                          Discount %
                        </label>
                        <input
                          type="number"
                          id={`plan-discount-${index}`}
                          value={plan.discountPercentage || 0}
                          onChange={(e) => updateArrayItem('subscriptionPlans', index, 'discountPercentage', Number(e.target.value))}
                          className="w-full p-2 border border-border rounded bg-card text-sm"
                          min="0"
                          max="100"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <label htmlFor={`plan-active-${index}`} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          id={`plan-active-${index}`}
                          checked={plan.isActive !== false}
                          onChange={(e) => updateArrayItem('subscriptionPlans', index, 'isActive', e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-xs font-medium">Active</span>
                      </label>

                      <label htmlFor={`plan-fixed-worker-${index}`} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          id={`plan-fixed-worker-${index}`}
                          checked={plan.requiresFixedWorker || false}
                          onChange={(e) => updateArrayItem('subscriptionPlans', index, 'requiresFixedWorker', e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-xs font-medium">Fixed Worker</span>
                      </label>
                    </div>

                    <button
                      onClick={() => removeArrayItem('subscriptionPlans', index)}
                      className="flex items-center gap-2 px-3 py-1 text-sm text-destructive hover:bg-destructive/10 rounded transition-colors"
                    >
                      <Minus className="w-4 h-4" /> Remove Plan
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ADDONS TAB */}
          {activeTab === 'addons' && (
            <div className="space-y-6">
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Service Add-ons</h3>
                  <button
                    onClick={() => addArrayItem('addons', {
                      id: generateId('addon-'),
                      name: '',
                      description: '',
                      price: 0,
                      duration: 0,
                      optional: true,
                      category: '',
                      icon: '➕',
                      isActive: true
                    })}
                    className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add-on
                  </button>
                </div>

                {serviceData.addons?.map((addon, index) => (
                  <div key={addon.id || generateId(`addon-${index}-`)} className="border border-border rounded-lg p-4 mb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor={`addon-name-${index}`} className="block text-xs font-medium text-muted-foreground mb-1">
                          Add-on Name *
                        </label>
                        <input
                          type="text"
                          id={`addon-name-${index}`}
                          value={addon.name}
                          onChange={(e) => updateArrayItem('addons', index, 'name', e.target.value)}
                          className="w-full p-2 border border-border rounded bg-card text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor={`addon-price-${index}`} className="block text-xs font-medium text-muted-foreground mb-1">
                          Price (₹) *
                        </label>
                        <input
                          type="number"
                          id={`addon-price-${index}`}
                          value={addon.price}
                          onChange={(e) => updateArrayItem('addons', index, 'price', Number(e.target.value))}
                          className="w-full p-2 border border-border rounded bg-card text-sm"
                          min="0"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor={`addon-description-${index}`} className="block text-xs font-medium text-muted-foreground mb-1">
                        Description
                      </label>
                      <textarea
                        id={`addon-description-${index}`}
                        value={addon.description || ''}
                        onChange={(e) => updateArrayItem('addons', index, 'description', e.target.value)}
                        rows={2}
                        className="w-full p-2 border border-border rounded bg-card text-sm"
                      />
                    </div>

                    <label htmlFor={`addon-optional-${index}`} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        id={`addon-optional-${index}`}
                        checked={addon.optional !== false}
                        onChange={(e) => updateArrayItem('addons', index, 'optional', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-xs font-medium">Optional</span>
                    </label>

                    <button
                      onClick={() => removeArrayItem('addons', index)}
                      className="flex items-center gap-2 px-3 py-1 text-sm text-destructive hover:bg-destructive/10 rounded transition-colors"
                    >
                      <Minus className="w-4 h-4" /> Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ADVANCED TAB */}
          {activeTab === 'advanced' && (
            <div className="space-y-6">
              <div className="border border-border rounded-lg p-4">
                <h3 className="text-lg font-semibold text-foreground mb-4">Cancellation Policy</h3>
                
                <div className="space-y-4">
                  <label htmlFor="allow-cancellation" className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      id="allow-cancellation"
                      checked={serviceData.cancellationPolicy?.allowCancellation !== false}
                      onChange={(e) => updateField('cancellationPolicy.allowCancellation', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-foreground">Allow Cancellation</span>
                  </label>

                  {serviceData.cancellationPolicy?.allowCancellation !== false && (
                    <>
                      <div>
                        <label htmlFor="free-cancel-hours" className="block text-sm font-medium text-foreground mb-2">
                          Free Cancellation Hours Before Service
                        </label>
                        <input
                          type="number"
                          id="free-cancel-hours"
                          value={serviceData.cancellationPolicy?.freeCancelHoursBeforeService || 24}
                          onChange={(e) => updateField('cancellationPolicy.freeCancelHoursBeforeService', Number(e.target.value))}
                          className="w-full p-3 border border-border rounded-lg bg-card"
                          min="0"
                        />
                      </div>

                      <div>
                        <label htmlFor="cancel-charge-pct" className="block text-sm font-medium text-foreground mb-2">
                          Cancellation Charge Percentage
                        </label>
                        <input
                          type="number"
                          id="cancel-charge-pct"
                          value={serviceData.cancellationPolicy?.cancellationChargePercentage || 0}
                          onChange={(e) => updateField('cancellationPolicy.cancellationChargePercentage', Number(e.target.value))}
                          className="w-full p-3 border border-border rounded-lg bg-card"
                          min="0"
                          max="100"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Applied if cancelled within the free cancellation window</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h3 className="text-lg font-semibold text-foreground mb-4">Worker Preferences</h3>
                
                <div className="space-y-3">
                  <label htmlFor="gender-pref" className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      id="gender-pref"
                      checked={serviceData.workerPreferences?.genderPreference !== false}
                      onChange={(e) => updateField('workerPreferences.genderPreference', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">Allow Gender Preference</span>
                  </label>

                  <label htmlFor="lang-pref" className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      id="lang-pref"
                      checked={serviceData.workerPreferences?.languagePreference !== false}
                      onChange={(e) => updateField('workerPreferences.languagePreference', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">Allow Language Preference</span>
                  </label>

                  <div>
                    <label htmlFor="rating-min" className="block text-sm font-medium text-foreground mb-2">
                      Minimum Worker Rating
                    </label>
                    <input
                      type="number"
                      id="rating-min"
                      value={serviceData.workerPreferences?.ratingMinimum || 0}
                      onChange={(e) => updateField('workerPreferences.ratingMinimum', Number(e.target.value))}
                      className="w-full p-3 border border-border rounded-lg bg-card"
                      min="0"
                      max="5"
                      step="0.1"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Save and Cancel */}
        <div className="p-6 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-3 border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Save className="w-4 h-4" /> Save Parameters
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceParametersEditor;
