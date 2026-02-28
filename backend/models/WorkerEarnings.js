import mongoose from 'mongoose';

const workerEarningsSchema = new mongoose.Schema({
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  baseAmount: { type: Number, required: true },
  overtimeAmount: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 },
  incentive: { type: Number, default: 0 },
  totalEarning: { type: Number, required: true },
  platformCommission: { type: Number, required: true },
  netEarning: { type: Number, required: true },
  payoutStatus: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  payoutDate: Date,
  payoutMethod: { type: String, enum: ['bank', 'upi'] },
  payoutDetails: { accountNumber: String, ifsc: String, upiId: String },
  workDuration: { type: Number, required: true },
  date: { type: Date, required: true }
}, { timestamps: true });

workerEarningsSchema.index({ worker: 1, date: -1 });

export default mongoose.model('WorkerEarnings', workerEarningsSchema);
