import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  gstAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  gstRate: {
    type: Number,
    default: 0.18
  },
  currency: {
    type: String,
    default: 'INR'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'cash', 'bank_transfer', 'wallet'],
    required: true
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  refundDate: {
    type: Date,
    default: null
  },
  metadata: {
    type: Map,
    of: String,
    default: {}
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

// Index for faster queries
paymentSchema.index({ customer: 1, paymentDate: -1 });
paymentSchema.index({ status: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
