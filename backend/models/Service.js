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
      'other'                     // Custom services
    ],
    default: 'other'
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
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
    price: Number,            // Total price for this duration
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
      enum: ['daily', 'weekly', 'biweekly', 'custom']
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

// Pre-save middleware to set defaults only for new documents
serviceSchema.pre('save', function(next) {
  // Only set defaults for new documents
  if (!this.isNew) {
    return next();
  }
  
  // Legacy pricing plans
  if (!this.pricingPlans || !this.pricingPlans.oneTime) {
    this.pricingPlans = {
      oneTime: this.price,
      daily: Math.round(this.price * 0.85),
      weekly: Math.round(this.price * 0.75 * 7),
      monthly: Math.round(this.price * 0.65 * 30)
    };
  }
  
  // New subscription plans - initialize defaults if empty (only for new docs)
  if (!this.subscriptionPlans || this.subscriptionPlans.length === 0) {
    this.subscriptionPlans = [
      {
        id: 'oneTime',
        name: 'oneTime',
        displayName: 'One-Time',
        icon: '📅',
        description: 'Single service',
        price: this.price,
        discountPercentage: 0,
        isActive: true,
        requiresFixedWorker: false,
        allowDaySelection: false,
        sortOrder: 1
      },
      {
        id: 'daily',
        name: 'daily',
        displayName: 'Daily',
        icon: '🌅',
        description: 'Every day',
        price: Math.round(this.price * 0.85),
        discountPercentage: 15,
        isActive: true,
        requiresFixedWorker: true,
        allowDaySelection: false,
        sortOrder: 2
      },
      {
        id: 'weekly',
        name: 'weekly',
        displayName: 'Weekly',
        icon: '📆',
        description: 'Select days',
        price: Math.round(this.price * 0.75),
        discountPercentage: 25,
        isActive: true,
        requiresFixedWorker: true,
        allowDaySelection: true,
        sortOrder: 3
      },
      {
        id: 'monthly',
        name: 'monthly',
        displayName: 'Monthly',
        icon: '🗓️',
        description: 'Once a month',
        price: Math.round(this.price * 0.65),
        discountPercentage: 35,
        isActive: true,
        requiresFixedWorker: true,
        allowDaySelection: false,
        sortOrder: 4
      }
    ];
  }
  
  next();
});

const Service = mongoose.model('Service', serviceSchema);

export default Service;
