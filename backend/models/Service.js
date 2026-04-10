import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Service name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['health', 'cleaning', 'maintenance', 'consultation', 'therapy', 'other']
  },
  // Broad service category for grouping in dashboards and filtering
  serviceCategory: {
    type: String,
    enum: [
      'instant_services',       // On-demand (Insta Maid)
      'subscription_services',  // Recurring/monthly plans
      'deep_cleaning',          // Full-house or move-in/out cleaning
      'spot_cleaning',          // Single-item or room spot cleans
      'kitchen_services',       // Kitchen appliances & fixtures
      'bathroom_services',      // Bathroom & washroom
      'furniture_services',     // Sofa, bed, cabinets
      'hvac_services',          // AC units
      'other'
    ],
    default: 'other'
  },
  // Radius (km) used when finding workers for this service
  // Smaller radius = faster on-demand; larger radius = scheduled/advance booking
  workerSearchRadiusKm: {
    type: Number,
    default: 10,
    min: 0.1,
    max: 100
  },
  // Used to control display order in customer-facing service lists
  displayOrder: {
    type: Number,
    default: 0
  },
  // Number of workers typically required for this service (set by super admin)
  defaultWorkerCount: {
    type: Number,
    default: 1,
    min: 1
  },
  // Worker wage configuration set by super admin
  workerWage: {
    type: {
      type: String,
      enum: ['per_hour', 'per_session'],
      default: 'per_hour'
    },
    rate: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  // Service type determines which parameters are applicable
  serviceType: {
    type: String,
    enum: [
      'instant_hourly',           // On-demand maid service
      'monthly_subscription',     // Recurring maid service
      'deep_cleaning_full_house', // Full house deep cleaning
      'deep_cleaning_room',       // Room-specific deep cleaning
      'deep_cleaning_kitchen',    // Kitchen deep cleaning
      'deep_cleaning_bathroom',   // Bathroom deep cleaning
      'fixed_washroom_basic',     // Basic washroom cleaning
      'fixed_washroom_deep',      // Washroom deep cleaning
      'fixed_fan_cleaning',       // Fan cleaning
      'fixed_window_cleaning',    // Window cleaning
      'fixed_sofa_cleaning',      // Sofa cleaning
      'fixed_carpet_cleaning',    // Carpet cleaning
      'fixed_balcony_cleaning',   // Balcony cleaning
      'fixed_fridge_cleaning',    // Fridge deep cleaning
      'deep_cleaning_commercial', // Commercial/residential deep cleaning (custom quote)
      // Kitchen appliances
      'fixed_microwave_cleaning', // Microwave cleaning
      'fixed_oven_cleaning',      // OTG/Oven cleaning
      'fixed_stove_cleaning',     // Gas stove cleaning
      'fixed_chimney_cleaning',   // Chimney cleaning
      'fixed_kitchen_platform_cleaning', // Kitchen platform & tiles
      'fixed_sink_cleaning',      // Sink cleaning
      'kitchen_appliances_package', // Complete kitchen package
      // Bathroom fixtures
      'fixed_washbasin_cleaning', // Washbasin/faucet cleaning
      'fixed_window_mesh_cleaning', // Window mesh cleaning
      // Furniture
      'fixed_dining_cleaning',    // Dining table & chairs
      'fixed_cabinet_cleaning',   // Showcase cabinet
      'fixed_utility_cleaning',   // Utility area
      'fixed_cupboard_cleaning',  // Cupboards
      // Bedroom
      'bedroom_package',          // Complete bedroom package
      'fixed_bed_cleaning',       // Bed cleaning
      'fixed_mirror_cleaning',    // Mirror cleaning
      // HVAC
      'fixed_ac_indoor_cleaning', // AC indoor unit
      'fixed_ac_outdoor_cleaning', // AC outdoor unit
      // Doors
      'fixed_door_cleaning',      // Glass door cleaning
      'other'                     // Custom services
    ],
    default: 'other'
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  // MRP / rack rate shown as strikethrough to customers (e.g. insta hourly MRP)
  originalPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  // Pricing plans for recurring bookings (legacy - kept for backward compatibility)
  pricingPlans: {
    oneTime: {
      type: Number
    },
    daily: {
      type: Number
    },
    weekly: {
      type: Number
    },
    monthly: {
      type: Number
    }
  },
  // New flexible subscription plans system
  subscriptionPlans: [{
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    displayName: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      default: '📅'
    },
    description: {
      type: String,
      default: ''
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    originalPrice: {
      type: Number,
      default: 0,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    requiresFixedWorker: {
      type: Boolean,
      default: false
    },
    allowDaySelection: {
      type: Boolean,
      default: false // For weekly plans
    },
    sessionsPerMonth: {
      type: Number,
      default: 1,
      min: 1
    },
    totalMonthlyPrice: {
      type: Number,
      default: 0,
      min: 0
    },
    sortOrder: {
      type: Number,
      default: 0
    }
  }],
  duration: {
    type: Number, // in minutes
    required: [true, 'Duration is required']
  },
  image: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isQuoteService: {
    type: Boolean,
    default: false   // If true, no fixed price — customer submits a quote request
  },
  tags: [String],
  requirements: [String],
  // Suggested services to cross-sell (admin can add related services customers might want)
  suggestedServices: [{
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true
    },
    displayText: {
      type: String,
      default: 'Customers also book'
    },
    sortOrder: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],

  // Service capabilities and restrictions
  dos: [String],        // What the service includes/does (e.g., "Dusting", "Floor cleaning")
  donts: [String],      // What the service doesn't include (e.g., "Bathroom cleaning", "High ceiling areas")
  // Editable task checklist for instant_hourly services (multi-select shown to customers)
  taskOptions: [{
    id: { type: String, required: true },
    label: { type: String, required: true },
    icon: { type: String, default: '🧹' },
    isActive: { type: Boolean, default: true }
  }],
  // Additional service options (e.g., for cleaning: carpet cleaning, window cleaning, etc.)
  additionalServiceOptions: [{
    value: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  // Location-based availability
  serviceLocations: [{
    city: String,
    area: String,
    apartmentNames: [String], // List of apartments where service is available
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  availableInAllLocations: {
    type: Boolean,
    default: false // If true, service available everywhere; if false, check serviceLocations
  },
  
  // ==================== NEW DYNAMIC PARAMETERS ====================
  
  // Size-based parameters (for deep cleaning, etc.)
  sizeParameters: {
    enabled: {
      type: Boolean,
      default: false
    },
    sizeType: {
      type: String,
      enum: ['house_size', 'room_size', 'area_sqft', 'quantity'],
      default: 'quantity'
    },
    options: [{
      value: String,          // e.g., '1BHK', 'Small', '100sqft'
      label: String,          // Display name
      price: Number,          // Price for this size
      duration: Number,       // Duration in minutes
      workersRequired: Number // Number of workers needed
    }]
  },
  
  // Duration options (for hourly services)
  durationOptions: [{
    hours: Number,            // e.g., 1, 2, 3, 4
    price: Number,            // Our discounted price (monthly total for subscriptions)
    originalPrice: Number,    // MRP / rack rate before discount
    isDefault: Boolean,
    minimumHours: Number      // Minimum booking hours
  }],
  
  // Subscription-specific options
  subscriptionOptions: {
    enabled: {
      type: Boolean,
      default: false
    },
    minContractMonths: {
      type: Number,
      default: 1
    },
    maxContractMonths: {
      type: Number,
      default: 12
    },
    allowedFrequencies: [{
      type: String,
      enum: ['daily', 'alt-days', '3-days', 'weekly', 'biweekly', 'monthly', 'custom']
    }],
    frequencyConfigs: [{
      id: {
        type: String,
        enum: ['daily', 'alt-days', '3-days', 'weekly']
      },
      label: {
        type: String,
        trim: true,
        default: ''
      },
      description: {
        type: String,
        trim: true,
        default: ''
      },
      visits: {
        type: Number,
        min: 0,
        default: 0
      },
      priceMultiplier: {
        type: Number,
        min: 0,
        default: 1
      },
      sortOrder: {
        type: Number,
        default: 0
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }],
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    autoRenewal: {
      type: Boolean,
      default: true
    },
    requiresSameWorker: {
      type: Boolean,
      default: true
    }
  },
  
  // Add-ons and extras
  addons: [{
    id: String,
    name: String,
    description: String,
    price: Number,
    duration: Number,          // Additional minutes
    optional: Boolean,
    category: String,          // e.g., 'equipment', 'additional_service', 'priority'
    icon: String,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  // Equipment requirements
  equipmentRequired: {
    providedBy: {
      type: String,
      enum: ['worker', 'customer', 'both', 'optional'],
      default: 'worker'
    },
    items: [{
      name: String,
      required: Boolean,
      providedBy: String
    }],
    notes: String
  },
  
  // Pricing tiers (for quantity-based services like fans, windows)
  pricingTiers: [{
    quantityFrom: Number,      // e.g., 1
    quantityTo: Number,        // e.g., 3
    pricePerUnit: Number,
    totalPrice: Number,
    duration: Number           // Total duration in minutes
  }],
  
  // Worker preferences
  workerPreferences: {
    genderPreference: {
      type: Boolean,
      default: true              // Allow customers to choose gender
    },
    languagePreference: {
      type: Boolean,
      default: true
    },
    ratingMinimum: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    experienceRequired: {
      type: Number,
      default: 0                 // Months of experience
    },
    certificationRequired: {
      type: Boolean,
      default: false
    }
  },
  
  // Service-specific fields
  serviceFields: [{
    fieldName: String,           // e.g., 'numberOfBathrooms', 'petAtHome'
    fieldLabel: String,          // Display label
    fieldType: {
      type: String,
      enum: ['text', 'number', 'select', 'multiselect', 'checkbox', 'radio', 'textarea'],
      default: 'text'
    },
    options: [String],           // For select/radio/multiselect
    required: Boolean,
    defaultValue: mongoose.Schema.Types.Mixed,
    placeholder: String,
    helpText: String,
    validation: {
      min: Number,
      max: Number,
      pattern: String
    },
    affectsPricing: Boolean,     // If true, value affects final price
    pricingMultiplier: Number    // Multiplier for price calculation
  }],
  
  // Time slot restrictions
  timeSlotRestrictions: {
    allowedTimeSlots: [{
      label: String,             // e.g., 'Morning', 'Afternoon'
      startTime: String,         // HH:MM format
      endTime: String,
      extraCharge: Number        // Additional cost for this slot
    }],
    bookingWindow: {
      minHoursAdvance: {
        type: Number,
        default: 2               // Minimum hours before service
      },
      maxDaysAdvance: {
        type: Number,
        default: 30              // Maximum days in advance
      }
    },
    sameDayBooking: {
      enabled: Boolean,
      extraCharge: Number
    }
  },
  
  // Cancellation policy
  cancellationPolicy: {
    allowCancellation: {
      type: Boolean,
      default: true
    },
    freeCancelHoursBeforeService: {
      type: Number,
      default: 24
    },
    cancellationChargePercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    refundPolicy: String
  },
  
  // Break request feature configuration — must be explicitly enabled per service
  allowBreakRequests: {
    type: Boolean,
    default: false
  },

  // Time-based pricing (e.g. peak-hours surcharge after 7 PM)
  timeBasedPricing: {
    enabled: { type: Boolean, default: false },
    startTime: { type: String, default: '19:00' },   // 24-hr "HH:mm"
    endTime:   { type: String, default: '23:59' },   // 24-hr "HH:mm"
    surchargeType:  { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    surchargeValue: { type: Number, default: 0, min: 0 },
    label: { type: String, default: 'Peak Hours' }   // shown to customer
  },

  // Special instructions template
  specialInstructionsTemplate: {
    enabled: Boolean,
    placeholder: String,
    maxLength: {
      type: Number,
      default: 500
    },
    suggestions: [String]        // Predefined instruction options
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Validation: Ensure subscription plan IDs are unique
serviceSchema.pre('validate', function(next) {
  if (this.subscriptionPlans && this.subscriptionPlans.length > 0) {
    const ids = this.subscriptionPlans.map(plan => plan.id);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      return next(new Error('Subscription plan IDs must be unique'));
    }
  }
  next();
});

// Session counts and discount rates per plan (Urban Company model)
// Higher frequency = higher commitment = better per-session discount
const PLAN_CONFIG = {
  daily:     { sessionsPerMonth: 30, discountPercentage: 30 }, // Daily plan = 30 visits/month
  'bi-weekly': { sessionsPerMonth: 8,  discountPercentage: 20 }, // 2 days/week × 4 weeks
  weekly:    { sessionsPerMonth: 4,  discountPercentage: 15 }, // 1 day/week × 4 weeks
  monthly:   { sessionsPerMonth: 1,  discountPercentage: 5  }  // single session
};

// Pre-save middleware to set defaults only for new documents
serviceSchema.pre('save', function(next) {
  if (!this.isNew) return next();

  const p = this.price;

  // Legacy pricingPlans — total monthly bundle cost per plan
  if (!this.pricingPlans || !this.pricingPlans.oneTime) {
    this.pricingPlans = {
      oneTime: p,
      daily:   Math.round(p * (1 - 0.30) * 30), // 30% off × 30 sessions
      weekly:  Math.round(p * (1 - 0.15) * 4),  // 15% off × 4 sessions
      monthly: Math.round(p * (1 - 0.05) * 1)   // 5% off × 1 session
    };
  }

  // No auto-generated subscription plans
  // Admin must explicitly configure subscription plans through the UI
  // This ensures only intentionally configured plans are displayed

  next();
});

const Service = mongoose.model('Service', serviceSchema);

export default Service;
