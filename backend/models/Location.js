import mongoose from 'mongoose';

// Admin-managed service locations (apartments/buildings/areas)
const locationSchema = new mongoose.Schema({
  apartmentName: {
    type: String,
    required: [true, 'Apartment name is required'],
    trim: true
  },
  building: {
    type: String,
    trim: true
  },
  area: {
    type: String,
    required: [true, 'Area is required'],
    trim: true
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true
  },
  zipCode: {
    type: String,
    trim: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, 'Coordinates are required'],
      index: '2dsphere'
    }
  },
  // Service availability in this location
  isServiceAvailable: {
    type: Boolean,
    default: false // Will be set to true when workers are assigned
  },
  availableServices: [{
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  // Workers assigned to this location
  assignedWorkers: [{
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Admin assigned to manage this location
  assignedAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Must have role 'admin'
  },
  // Walking distance constraint
  maxServiceRadius: {
    type: Number,
    default: 500, // meters - workers can only serve within walking distance
    min: 100,
    max: 2000
  },
  // Admin notes
  notes: {
    type: String
  },
  // Payment QR Code for this location (admin-managed)
  paymentQR: {
    upiId: {
      type: String,
      default: null // Location-specific UPI ID
    },
    upiName: {
      type: String,
      default: null // Payee name for this location
    },
    qrCodeImage: {
      type: String, // Base64 or URL of uploaded QR code
      default: null
    },
    accountNumber: {
      type: String,
      default: null
    },
    ifscCode: {
      type: String,
      default: null
    },
    phoneNumber: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  isActive: {
    type: Boolean,
    default: true
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

// Create geospatial index for location-based queries
locationSchema.index({ location: '2dsphere' });
locationSchema.index({ city: 1, area: 1 });
locationSchema.index({ apartmentName: 1 });

const Location = mongoose.model('Location', locationSchema);

export default Location;
