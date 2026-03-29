import mongoose from 'mongoose';

const homeSectionSchema = new mongoose.Schema({
  sectionId: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  emoji: {
    type: String,
    default: '🏠'
  },
  // Type determines how the section renders on the customer home screen
  type: {
    type: String,
    enum: ['service_grid', 'promo_banner', 'featured_list', 'category_strip'],
    default: 'service_grid'
  },
  // For service_grid / featured_list: which services to show
  serviceFilter: {
    serviceTypes: [String],          // e.g. ['instant_hourly', 'monthly_subscription']
    serviceCategories: [String],     // e.g. ['instant_services', 'subscription_services']
    namePatterns: [String],          // e.g. ['maid', 'cleaning']
    excludeServiceTypes: [String],
    showAll: { type: Boolean, default: false }
  },
  // For promo_banner: link and visual config
  bannerConfig: {
    link: { type: String, default: '' },
    gradient: { type: String, default: 'from-teal-50 to-green-50' },
    borderColor: { type: String, default: 'border-teal-300' },
    ctaText: { type: String, default: 'Book Now' }
  },
  maxItems: {
    type: Number,
    default: 6,
    min: 1,
    max: 20
  },
  badgeText: {
    type: String,
    default: ''
  },
  sortOrder: {
    type: Number,
    default: 0,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, { _id: false });

const homeConfigSchema = new mongoose.Schema({
  // Singleton document — always use HomeConfig.getSingleton()
  sections: [homeSectionSchema],
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'homeconfigs'
});

// Singleton accessor
homeConfigSchema.statics.getSingleton = async function () {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({ sections: getDefaultSections() });
  }
  return config;
};

function getDefaultSections() {
  return [
    {
      sectionId: 'quick_book',
      title: 'Quick Book',
      description: 'Most popular services, instantly bookable',
      emoji: '⚡',
      type: 'service_grid',
      serviceFilter: {
        serviceTypes: ['instant_hourly'],
        serviceCategories: ['instant_services'],
        namePatterns: [],
        excludeServiceTypes: [],
        showAll: false
      },
      bannerConfig: { link: '', gradient: '', borderColor: '', ctaText: '' },
      maxItems: 6,
      badgeText: 'Popular',
      sortOrder: 0,
      isActive: true
    },
    {
      sectionId: 'subscription_plans',
      title: 'Subscription Plans',
      description: 'Save more with monthly packages',
      emoji: '📅',
      type: 'service_grid',
      serviceFilter: {
        serviceTypes: ['monthly_subscription'],
        serviceCategories: ['subscription_services'],
        namePatterns: [],
        excludeServiceTypes: [],
        showAll: false
      },
      bannerConfig: { link: '', gradient: '', borderColor: '', ctaText: '' },
      maxItems: 6,
      badgeText: 'Best Value',
      sortOrder: 1,
      isActive: true
    },
    {
      sectionId: 'deep_cleaning',
      title: 'Deep Cleaning',
      description: 'Thorough professional cleaning for your home',
      emoji: '✨',
      type: 'service_grid',
      serviceFilter: {
        serviceTypes: ['deep_cleaning_full_house', 'deep_cleaning_kitchen', 'deep_cleaning_bathroom'],
        serviceCategories: ['deep_cleaning'],
        namePatterns: [],
        excludeServiceTypes: [],
        showAll: false
      },
      bannerConfig: { link: '', gradient: '', borderColor: '', ctaText: '' },
      maxItems: 6,
      badgeText: '',
      sortOrder: 2,
      isActive: true
    },
    {
      sectionId: 'spot_clean',
      title: 'Spot Cleaning',
      description: 'Individual item cleaning at fixed prices',
      emoji: '🧹',
      type: 'service_grid',
      serviceFilter: {
        serviceTypes: [],
        serviceCategories: ['spot_cleaning', 'kitchen_services', 'bathroom_services'],
        namePatterns: [],
        excludeServiceTypes: [],
        showAll: false
      },
      bannerConfig: { link: '', gradient: '', borderColor: '', ctaText: '' },
      maxItems: 8,
      badgeText: 'Fixed Price',
      sortOrder: 3,
      isActive: true
    }
  ];
}

export default mongoose.model('HomeConfig', homeConfigSchema);
