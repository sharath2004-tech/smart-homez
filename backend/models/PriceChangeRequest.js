import mongoose from 'mongoose';

const priceChangeRequestSchema = new mongoose.Schema({
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, default: '' },
  // Snapshot of current pricing at time of request (for comparison in review UI)
  currentPricing: {
    price: Number,
    originalPrice: Number,
    pricingPlans: mongoose.Schema.Types.Mixed,
    subscriptionPlans: mongoose.Schema.Types.Mixed,
    durationOptions: mongoose.Schema.Types.Mixed,
    pricingTiers: mongoose.Schema.Types.Mixed,
    workerWage: {
      type: {
        type: String,
        enum: ['per_hour', 'per_session']
      },
      rate: Number
    }
  },
  // What the admin wants to change it to
  proposedPricing: {
    price: Number,
    originalPrice: Number,
    pricingPlans: mongoose.Schema.Types.Mixed,
    subscriptionPlans: mongoose.Schema.Types.Mixed,
    durationOptions: mongoose.Schema.Types.Mixed,
    pricingTiers: mongoose.Schema.Types.Mixed,
    workerWage: {
      type: {
        type: String,
        enum: ['per_hour', 'per_session']
      },
      rate: Number
    }
  },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  superAdminNote: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('PriceChangeRequest', priceChangeRequestSchema);
