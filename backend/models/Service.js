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
  // Pricing plans for recurring bookings
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
  if (!this.pricingPlans || !this.pricingPlans.oneTime) {
    this.pricingPlans = {
      oneTime: this.price,
      daily: Math.round(this.price * 0.85),
      weekly: Math.round(this.price * 0.75 * 7),
      monthly: Math.round(this.price * 0.65 * 30)
    };
  }
  next();
});

const Service = mongoose.model('Service', serviceSchema);

export default Service;
