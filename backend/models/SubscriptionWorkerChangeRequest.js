import mongoose from 'mongoose';

const subscriptionWorkerChangeRequestSchema = new mongoose.Schema({
  subscriptionBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    default: null
  },
  currentWorker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  requestedWorker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  visitCountAtRequest: {
    type: Number,
    default: 0,
    min: 0
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewNote: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500
  }
}, { timestamps: true });

subscriptionWorkerChangeRequestSchema.index({ subscriptionBooking: 1, status: 1, createdAt: -1 });

export default mongoose.model('SubscriptionWorkerChangeRequest', subscriptionWorkerChangeRequestSchema);
