import mongoose from 'mongoose';

const reliabilityScoreSchema = new mongoose.Schema({
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  month: {
    type: Number,
    required: true,
    min: 0,
    max: 11 // 0-11 representing January to December
  },
  year: {
    type: Number,
    required: true,
    min: 2024
  },
  scoreBreakdown: {
    baseScore: {
      type: Number,
      default: 15,
      min: 0,
      max: 20
    },
    leaveBonus: {
      type: Number,
      default: 0,
      min: 0,
      max: 2
    },
    leavePenalties: {
      type: Number,
      default: 0,
      min: 0
    },
    finalScore: {
      type: Number,
      default: 15,
      min: 0,
      max: 20
    }
  },
  leaveData: {
    totalLeaves: {
      type: Number,
      default: 0,
      min: 0
    },
    uninformedLeaves: {
      type: Number,
      default: 0,
      min: 0
    },
    informedLeaves: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
reliabilityScoreSchema.index({ worker: 1, year: 1, month: 1 }, { unique: true });
reliabilityScoreSchema.index({ year: 1, month: 1 });

// Virtual to get normalized score (0-100 scale for compatibility)
reliabilityScoreSchema.virtual('normalizedScore').get(function() {
  return Math.round((this.scoreBreakdown.finalScore / 20) * 100);
});

// Static method to get current month/year
reliabilityScoreSchema.statics.getCurrentPeriod = function() {
  const now = new Date();
  return {
    month: now.getMonth(),
    year: now.getFullYear()
  };
};

// Static method to get previous month/year
reliabilityScoreSchema.statics.getPreviousPeriod = function() {
  const now = new Date();
  const prevMonth = now.getMonth() - 1;
  const year = prevMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = prevMonth < 0 ? 11 : prevMonth;
  return { month, year };
};

const ReliabilityScore = mongoose.model('ReliabilityScore', reliabilityScoreSchema);

export default ReliabilityScore;