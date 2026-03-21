import mongoose from 'mongoose';

const dashboardPreferencesSchema = new mongoose.Schema({
  // Service configuration for customer dashboard
  services: [{
    id: {
      type: String,
      required: true,
      enum: ['insta_adhoc', 'move_in_out_cleaning', 'subscription', 'intense_washroom']
    },
    icon: { type: String, required: true },
    nameKey: { type: String, required: true }, // Translation key
    subtitleKey: { type: String, required: true }, // Translation key
    badge: { type: String, required: true },
    path: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, required: true },
    isDefault: { type: Boolean, default: false } // Cannot be deleted if true
  }],

  // Meta configuration
  maxServices: { type: Number, default: 4, min: 1, max: 8 },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastUpdatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'dashboard_preferences'
});

// Only one configuration document should exist
dashboardPreferencesSchema.index({}, { unique: true });

// Static method to get or create default configuration
dashboardPreferencesSchema.statics.getDefaultConfig = async function() {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({
      services: [
        {
          id: 'insta_adhoc',
          icon: '⚡',
          nameKey: 'customer.dashboard.instaAdhoc',
          subtitleKey: 'customer.dashboard.instantBooking',
          badge: 'On demand',
          path: '/customer/services/insta',
          isActive: true,
          sortOrder: 1,
          isDefault: true
        },
        {
          id: 'move_in_out_cleaning',
          icon: '✨',
          nameKey: 'customer.dashboard.deepCleaning',
          subtitleKey: 'customer.dashboard.fullHomeClean',
          badge: 'Best value',
          path: '/customer/services/deep-cleaning',
          isActive: true,
          sortOrder: 2,
          isDefault: true
        },
        {
          id: 'subscription',
          icon: '📅',
          nameKey: 'customer.dashboard.subscription',
          subtitleKey: 'customer.dashboard.recurringPlans',
          badge: 'Save 20%',
          path: '/customer/services/subscription',
          isActive: true,
          sortOrder: 3,
          isDefault: true
        },
        {
          id: 'intense_washroom',
          icon: '🚿',
          nameKey: 'customer.dashboard.intenseWashroom',
          subtitleKey: 'customer.dashboard.washroomDeepClean',
          badge: 'Sanitize',
          path: '/customer/services/washroom',
          isActive: true,
          sortOrder: 4,
          isDefault: false
        }
      ]
    });
  }
  return config;
};

const DashboardPreferences = mongoose.model('DashboardPreferences', dashboardPreferencesSchema);
export default DashboardPreferences;