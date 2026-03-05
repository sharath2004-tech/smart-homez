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

// Pre-save middleware to set pricingPlans defaults if not provided
serviceSchema.pre('save', function(next) {
  // Legacy pricing plans
  if (!this.pricingPlans || !this.pricingPlans.oneTime) {
    this.pricingPlans = {
      oneTime: this.price,
      daily: Math.round(this.price * 0.85),
      weekly: Math.round(this.price * 0.75 * 7),
      monthly: Math.round(this.price * 0.65 * 30)
    };
  }
  
  // New subscription plans - initialize defaults if empty
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
