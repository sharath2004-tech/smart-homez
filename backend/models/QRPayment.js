import mongoose from 'mongoose';

const qrPaymentSchema = new mongoose.Schema({
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
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  // QR Code details
  qrCodeData: {
    type: String,
    required: true
  },
  qrCodeImageUrl: {
    type: String,
    default: null
  },
  // Payment details
  upiId: {
    type: String,
    default: 'healthyhomez@upi' // Default company UPI ID
  },
  transactionId: {
    type: String,
    default: null
  },
  transactionScreenshot: {
    type: String, // URL or base64 of uploaded screenshot
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['upi', 'cash', 'card', 'other'],
    default: 'upi'
  },
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'worker-confirmed', 'admin-verified', 'completed', 'rejected', 'disputed'],
    default: 'pending'
  },
  // Worker confirmation
  workerConfirmedAt: {
    type: Date,
    default: null
  },
  workerConfirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  workerNotes: {
    type: String,
    default: ''
  },
  // Admin verification
  adminVerifiedAt: {
    type: Date,
    default: null
  },
  adminVerifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  adminNotes: {
    type: String,
    default: ''
  },
  rejectionReason: {
    type: String,
    default: null
  },
  // Timestamps
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

// Indexes for faster queries
qrPaymentSchema.index({ booking: 1 });
qrPaymentSchema.index({ customer: 1, createdAt: -1 });
qrPaymentSchema.index({ worker: 1, status: 1 });
qrPaymentSchema.index({ status: 1, createdAt: -1 });
qrPaymentSchema.index({ transactionId: 1 });

// Generate QR code data
qrPaymentSchema.methods.generateQRData = function() {
  // UPI payment format
  return `upi://pay?pa=${this.upiId}&pn=Healthy Homez&am=${this.amount}&cu=INR&tn=Booking ${this.booking}`;
};

const QRPayment = mongoose.model('QRPayment', qrPaymentSchema);

export default QRPayment;
