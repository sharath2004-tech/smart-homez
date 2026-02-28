import mongoose from 'mongoose';

const sosAlertSchema = new mongoose.Schema({
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userType: { type: String, enum: ['customer', 'worker'], required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  address: String,
  status: { type: String, enum: ['active', 'resolved', 'false-alarm'], default: 'active' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'critical' },
  notes: String,
  respondedBy: [{ admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, respondedAt: Date, action: String }],
  resolvedAt: Date
}, { timestamps: true });

sosAlertSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('SOSAlert', sosAlertSchema);
