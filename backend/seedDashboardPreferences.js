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
      ],
      maxServices: 4
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