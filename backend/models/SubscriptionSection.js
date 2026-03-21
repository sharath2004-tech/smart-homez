import mongoose from 'mongoose';

const subscriptionSectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Section name is required'],
    trim: true,
    unique: true,
    index: true
  },
  description: {
    type: String,
    required: [true, 'Section description is required'],
    trim: true
  },
  emoji: {
    type: String,
    default: '📦'
  },
  icon: {
    type: String,
    enum: ['Users', 'Droplet', 'Home', 'Sparkles', 'Clock', 'Heart', 'Zap', 'Package', 'Wind'],
    default: 'Package'
  },
  color: {
    type: String,
    enum: ['blue', 'teal', 'green', 'purple', 'orange', 'red', 'pink', 'yellow'],
    default: 'blue'
  },
  // Filter logic: which subscriptions to show in this section
  filterConfig: {
    // Can filter by serviceType, name pattern, or custom function
    serviceTypeIncludes: [String], // e.g., ['monthly_subscription']
    serviceTypeExcludes: [String], // e.g., ['washroom']
    namePatternsInclude: [String], // e.g., ['maid', 'housekeeping']
    namePatternsExclude: [String]  // e.g., ['washroom']
  },
  sortOrder: {
    type: Number,
    default: 0,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for queries
subscriptionSectionSchema.index({ isActive: 1, sortOrder: 1 });

export default mongoose.model('SubscriptionSection', subscriptionSectionSchema);
