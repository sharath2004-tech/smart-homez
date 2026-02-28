import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  plan: { type: String, enum: ['daily', 'weekly', 'bi-weekly', 'monthly'], required: true },
  status: { type: String, enum: ['active', 'paused', 'cancelled', 'expired'], default: 'active' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  autoRenewal: { type: Boolean, default: true },
  preferredTimeSlots: [{ day: String, time: String }],
  pauseHistory: [{ pausedAt: Date, resumedAt: Date, reason: String }],
  totalAmount: { type: Number, required: true },
  discountApplied: { type: Number, default: 0 },
  nextBillingDate: Date,
  bookingsGenerated: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }]
}, { timestamps: true });

export default mongoose.model('Subscription', subscriptionSchema);
