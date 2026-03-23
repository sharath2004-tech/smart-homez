import DashboardPreferences from './models/DashboardPreferences.js';

/**
 * Initialize dashboard preferences with default services
 */
const initializeDashboardPreferences = async () => {
  try {
    console.log('🎨 Initializing dashboard preferences...');

    // Check if preferences already exist
    const existingPrefs = await DashboardPreferences.findOne();

    if (existingPrefs) {
      console.log('✅ Dashboard preferences already exist, skipping initialization');
      return;
    }

    // Create default configuration
    const defaultPrefs = await DashboardPreferences.create({
      services: [
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
          path: '/customer/deep-cleaning',
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
          path: '/customer/services/spot-clean',
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
          path: '/customer/services/spot-clean',
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
          path: '/customer/services/spot-clean',
          isActive: true,
          sortOrder: 6,
          isDefault: false
        }
      ],
      maxServices: 6
    });

    console.log('✅ Dashboard preferences created successfully!');
    console.log('📊 Services configured:');

    defaultPrefs.services.forEach((service, index) => {
      console.log(`   ${index + 1}. ${service.icon} ${service.nameKey.split('.').pop()} (${service.isActive ? 'ACTIVE' : 'INACTIVE'})`);
    });

  } catch (error) {
    console.error('❌ Error initializing dashboard preferences:', error);
    throw error;
  }
};

// Export for use in other scripts
export default initializeDashboardPreferences;

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  import('dotenv').then(dotenv => dotenv.config())
    .then(() => import('mongoose'))
    .then(async mongoose => {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/healthyhomez';
      await mongoose.default.connect(mongoUri);
      console.log('📀 Connected to MongoDB');

      await initializeDashboardPreferences();

      await mongoose.default.disconnect();
      console.log('📀 Disconnected from MongoDB');
      console.log('🎉 Dashboard preferences initialization completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}