import mongoose from 'mongoose';

const tierSchema = new mongoose.Schema({
  label: { type: String, required: true },
  price: { type: Number, required: true, min: 0 }
}, { _id: false });

const itemSchema = new mongoose.Schema({
  id:          { type: String, required: true },
  category:    { type: String, required: true },
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  pricingType: { type: String, enum: ['fixed', 'per_unit', 'per_sqft', 'tiered'], required: true },
  price:       { type: Number, default: 0, min: 0 },
  tiers:       [tierSchema],
  maxQty:      { type: Number, default: 20 },
  unit:        { type: String, default: 'unit' },
  icon:        { type: String, default: '✨' },
  isActive:    { type: Boolean, default: true },
  sortOrder:   { type: Number, default: 0 }
}, { _id: false });

const categorySchema = new mongoose.Schema({
  id:        { type: String, required: true },
  label:     { type: String, required: true },
  emoji:     { type: String, default: '✨' },
  isActive:  { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { _id: false });

const deepCleaningChangeRequestSchema = new mongoose.Schema({
  title:        { type: String, required: true, trim: true },
  requestNote:  { type: String, default: '', trim: true },
  status:       { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  proposedConfig: {
    minimumCartValue: { type: Number, required: true, min: 0 },
    categories:       { type: [categorySchema], default: [] },
    items:            { type: [itemSchema], default: [] }
  },
  requestedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reviewedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewNote:   { type: String, default: '', trim: true },
  submittedAt:  { type: Date, default: Date.now },
  reviewedAt:   { type: Date, default: null }
}, { timestamps: true });

const DeepCleaningChangeRequest = mongoose.model('DeepCleaningChangeRequest', deepCleaningChangeRequestSchema);
export default DeepCleaningChangeRequest;