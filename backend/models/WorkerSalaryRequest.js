import mongoose from 'mongoose';

const workerSalaryRequestSchema = new mongoose.Schema({
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null
  },
  periodFrom: {
    type: Date,
    required: true
  },
  periodTo: {
    type: Date,
    required: true
  },
  totalMinutesWorked: {
    type: Number,
    required: true,
    min: 0
  },
  totalTasksCompleted: {
    type: Number,
    required: true,
    min: 0
  },
  wageType: {
    type: String,
    enum: ['hourly', 'daily', 'monthly'],
    default: 'hourly'
  },
  hourlyRate: {
    type: Number,
    required: true,
    min: 0
  },
  dailyWage: {
    type: Number,
    default: null,
    min: 0
  },
  monthlyWage: {
    type: Number,
    default: null,
    min: 0
  },
  rateAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  payUnitsWorked: {
    type: Number,
    default: 0,
    min: 0
  },
  payUnitLabel: {
    type: String,
    enum: ['hour', 'day', 'month'],
    default: 'hour'
  },
  requestedAmount: {
    type: Number,
    required: true,
    min: 0
  },
  netAmount: {
    type: Number,
    default: null,
    min: 0
  },
  totalPenaltyAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  penaltyTreatment: {
    type: String,
    enum: ['included', 'excluded'],
    default: 'excluded'
  },
  penaltyBreakdown: [{
    leaveDate: {
      type: Date,
      required: true
    },
    requestedAt: {
      type: Date,
      default: null
    },
    reason: {
      type: String,
      maxlength: 200,
      default: ''
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    leaveStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
  }],
  penaltyDecidedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  penaltyDecidedAt: {
    type: Date,
    default: null
  },
  bookings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'paid'],
    default: 'pending'
  },
  approvedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rejectedAt: Date,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rejectionReason: {
    type: String,
    maxlength: 500,
    default: null
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  paidAt: Date,
  adminNotes: {
    type: String,
    maxlength: 500,
    default: null
  }
}, { timestamps: true });

workerSalaryRequestSchema.index({ worker: 1, createdAt: -1 });
workerSalaryRequestSchema.index({ status: 1 });

export default mongoose.model('WorkerSalaryRequest', workerSalaryRequestSchema);
