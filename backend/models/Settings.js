import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  // Payment Settings
  payment: {
    upiId: {
      type: String,
      default: 'healthyhomez@upi',
      required: true
    },
    upiName: {
      type: String,
      default: 'Healthy Homez',
      required: true
    },
    qrCodeImage: {
      type: String, // Base64 or URL of uploaded QR code
      default: null
    }
  },
  
  // Company Settings
  company: {
    name: {
      type: String,
      default: 'Healthy Homez'
    },
    phone: {
      type: String,
      default: ''
    },
    email: {
      type: String,
      default: ''
    },
    address: {
      type: String,
      default: ''
    },
    defaultState: {
      type: String,
      default: 'Maharashtra'
    }
  },

  // Booking Settings
  booking: {
    overtimeRate: {
      type: Number,
      default: 2.5, // ₹2.5 per minute
      min: 0
    },
    cancellationHours: {
      type: Number,
      default: 24, // Hours before booking
      min: 0
    },
    serviceRadius: {
      type: Number,
      default: 500, // Default walking distance in meters
      min: 50
    }
  },

  // Earnings & Payout Settings
  earnings: {
    // Platform commission rate (0 = free, 0.15 = 15%)
    platformCommissionRate: {
      type: Number,
      default: 0, // FREE - Set to 0.15 for 15% commission
      min: 0,
      max: 1
    },
    // Convenience fee per booking (₹)
    bookingConvenienceFee: {
      type: Number,
      default: 0, // FREE - Set to 20 for ₹20 fee
      min: 0
    },
    // Minimum payout amount
    minPayoutAmount: {
      type: Number,
      default: 500, // ₹500 minimum
      min: 0
    },
    // Payout schedule
    payoutSchedule: {
      type: String,
      enum: ['instant', 'weekly', 'biweekly', 'monthly'],
      default: 'weekly'
    },
    // Instant payout fee (0 = free, 0.02 = 2%)
    instantPayoutFee: {
      type: Number,
      default: 0, // FREE - Set to 0.02 for 2% fee
      min: 0,
      max: 0.1
    },
    // Payout processing day (1 = Monday, 7 = Sunday)
    payoutDay: {
      type: Number,
      default: 1, // Monday
      min: 1,
      max: 7
    },
    // Enable auto-payouts
    autoPayoutEnabled: {
      type: Boolean,
      default: false // Manual payouts initially
    }
  },

  // Subscription Plans (Currently FREE)
  subscriptions: {
    workerPlans: {
      basic: {
        price: { type: Number, default: 0 }, // FREE
        commissionRate: { type: Number, default: 0 },
        features: [String]
      },
      pro: {
        price: { type: Number, default: 0 }, // FREE
        commissionRate: { type: Number, default: 0 },
        features: [String]
      },
      premium: {
        price: { type: Number, default: 0 }, // FREE
        commissionRate: { type: Number, default: 0 },
        features: [String]
      }
    },
    customerPlans: {
      basic: {
        price: { type: Number, default: 0 }, // FREE
        discountRate: { type: Number, default: 0 },
        features: [String]
      },
      premium: {
        price: { type: Number, default: 0 }, // FREE
        discountRate: { type: Number, default: 0 },
        features: [String]
      }
    }
  },

  // Cancellation Policy (REQ-C-010: Free cancellation up to 20 min before)
  cancellationPolicy: {
    // Minutes before booking start to get full refund (FREE cancellation)
    freeCancellationMinutes: {
      type: Number,
      default: 20 // 20 minutes before = FREE cancellation
    },
    // Legacy field kept for backward compatibility
    fullRefundHours: {
      type: Number,
      default: 1
    },
    // Refund percentage if cancelled < fullRefundHours
    partialRefundPercentage: {
      type: Number,
      default: 0, // No refund within 1 hour window
      min: 0,
      max: 100
    },
    // Hours before booking for partial refund
    partialRefundHours: {
      type: Number,
      default: 0.5 // 30 minutes before
    },
    // Cancellation charge (flat fee or percentage)
    cancellationCharge: {
      type: Number,
      default: 100 // ₹100 cancellation charge within 1-hour window
    },
    // No refund if cancelled within this many hours
    noRefundHours: {
      type: Number,
      default: 0 // No refund for ongoing/completed bookings
    }
  },

  // Overtime rate change requests (admin → super_admin approval flow)
  overtimeRateRequests: [{
    requestedRate: { type: Number, required: true, min: 0 },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requestedByName: { type: String, default: '' },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, default: '' },
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null }
  }],

  // Last updated info
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

settingsSchema.statics.updateSettings = async function(updates, userId) {
  let settings = await this.getSettings();
  
  if (updates.payment) {
    settings.payment = { ...settings.payment, ...updates.payment };
  }
  if (updates.company) {
    settings.company = { ...settings.company, ...updates.company };
  }
  if (updates.booking) {
    settings.booking = { ...settings.booking, ...updates.booking };
  }
  if (updates.earnings) {
    settings.earnings = { ...settings.earnings, ...updates.earnings };
  }
  if (updates.subscriptions) {
    settings.subscriptions = { ...settings.subscriptions, ...updates.subscriptions };
  }
  if (updates.cancellationPolicy) {
    settings.cancellationPolicy = { ...settings.cancellationPolicy, ...updates.cancellationPolicy };
  }
  
  settings.updatedBy = userId;
  settings.updatedAt = new Date();
  
  await settings.save();
  return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
