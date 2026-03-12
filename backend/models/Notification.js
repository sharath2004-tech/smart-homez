import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['booking', 'payment', 'worker-assigned', 'delay', 'cancellation', 'review', 'sos', 'system', 'worker-registration', 'booking-confirmed', 'booking-rescheduled', 'worker-reassignment', 'worker-enroute', 'schedule-change', 'refund-processed', 'worker-unavailable'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: mongoose.Schema.Types.Mixed,
  isRead: { type: Boolean, default: false },
  readAt: Date,
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
