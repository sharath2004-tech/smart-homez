import mongoose from 'mongoose';

const dashboardPreferencesSchema = new mongoose.Schema({
  // Service configuration for customer dashboard
  services: [{
    id: {
      type: String,
      required: true
    },
    linkedServiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      default: null
    },
    icon: { type: String, required: true },
    nameKey: { type: String, required: true }, // Translation key
    subtitleKey: { type: String, required: true }, // Translation key
    customName: { type: String, default: '' },
    customSubtitle: { type: String, default: '' },
    badge: { type: String, required: true },
    path: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, required: true },
    isDefault: { type: Boolean, default: false } // Cannot be deleted if true
  }],

  // Meta configuration
  maxServices: { type: Number, default: 6, min: 1, max: 8 },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastUpdatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'dashboard_preferences'
});

// Only one configuration document should exist
dashboardPreferencesSchema.index({}, { unique: true });

const DEFAULT_SERVICES = [
  {
    id: 'insta_adhoc',
    linkedServiceId: null,
    icon: '⚡',
    nameKey: 'customer.dashboard.instaAdhoc',
    subtitleKey: 'customer.dashboard.instantBooking',
    customName: '',
    customSubtitle: '',
    badge: 'On demand',
    path: '/customer/services/insta',
    isActive: true,
    sortOrder: 1,
    isDefault: true
  },
  {
    id: 'move_in_out_cleaning',
    linkedServiceId: null,
    icon: '✨',
    nameKey: 'customer.dashboard.deepCleaning',
    subtitleKey: 'customer.dashboard.fullHomeClean',
    customName: '',
    customSubtitle: '',
    badge: 'Best value',
    path: '/customer/services/deep-cleaning',
    isActive: true,
    sortOrder: 2,
    isDefault: true
  },
  {
    id: 'subscription',
    linkedServiceId: null,
    icon: '📅',
    nameKey: 'customer.dashboard.subscription',
    subtitleKey: 'customer.dashboard.recurringPlans',
    customName: '',
    customSubtitle: '',
    badge: 'Save 20%',
    path: '/customer/services/subscription',
    isActive: true,
    sortOrder: 3,
    isDefault: true
  },
  {
    id: 'intense_washroom',
    linkedServiceId: null,
    icon: '🚿',
    nameKey: 'customer.dashboard.intenseWashroom',
    subtitleKey: 'customer.dashboard.washroomDeepClean',
    customName: '',
    customSubtitle: '',
    badge: 'Sanitize',
    path: '/customer/services/intense-washroom-cleaning',
    isActive: true,
    sortOrder: 4,
    isDefault: false
  },
  {
    id: 'kitchen_deep_clean',
    linkedServiceId: null,
    icon: '🍽️',
    nameKey: 'customer.dashboard.kitchenDeepClean',
    subtitleKey: 'customer.dashboard.kitchenDeepCleanSubtitle',
    customName: 'Kitchen Deep Clean',
    customSubtitle: 'Grease · Appliances · Tiles',
    badge: 'Popular',
    path: '/customer/services/kitchen-deep-clean',
    isActive: true,
    sortOrder: 5,
    isDefault: false
  },
  {
    id: 'window_deep_clean',
    linkedServiceId: null,
    icon: '🪟',
    nameKey: 'customer.dashboard.windowDeepClean',
    subtitleKey: 'customer.dashboard.windowDeepCleanSubtitle',
    customName: 'Window Deep Cleaning',
    customSubtitle: 'Glass · Frames · Tracks',
    badge: 'Spot clean',
    path: '/customer/services/window-deep-cleaning',
    isActive: true,
    sortOrder: 6,
    isDefault: false
  }
];

// Static method to get or create default configuration
dashboardPreferencesSchema.statics.getDefaultConfig = async function() {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({
      services: DEFAULT_SERVICES,
      maxServices: 6,
    });
  } else {
    let hasChanges = false;

    DEFAULT_SERVICES.forEach((defaultService) => {
      const existingService = config.services.find((service) => service.id === defaultService.id);

      if (!existingService) {
        config.services.push(defaultService);
        hasChanges = true;
        return;
      }

      if (typeof existingService.customName !== 'string') {
        existingService.customName = '';
        hasChanges = true;
      }

      if (typeof existingService.linkedServiceId === 'undefined') {
        existingService.linkedServiceId = null;
        hasChanges = true;
      }

      if (typeof existingService.customSubtitle !== 'string') {
        existingService.customSubtitle = '';
        hasChanges = true;
      }

      if (!existingService.path) {
        existingService.path = defaultService.path;
        hasChanges = true;
      }
    });

    if ((config.maxServices || 0) < 6) {
      config.maxServices = 6;
      hasChanges = true;
    }

    config.services = [...config.services].sort((a, b) => a.sortOrder - b.sortOrder);

    if (hasChanges) {
      await config.save();
    }
  }
  return config;
};

const DashboardPreferences = mongoose.model('DashboardPreferences', dashboardPreferencesSchema);
export default DashboardPreferences;