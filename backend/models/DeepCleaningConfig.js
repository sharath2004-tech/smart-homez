import mongoose from 'mongoose';

const tierSchema = new mongoose.Schema({
  label: { type: String, required: true },
  price: { type: Number, required: true, min: 0 }
}, { _id: false });

const itemSchema = new mongoose.Schema({
  id:          { type: String, required: true },
  category:    { type: String, enum: ['bathroom', 'kitchen', 'furniture', 'appliances', 'fullhouse'], required: true },
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  pricingType: { type: String, enum: ['fixed', 'per_unit', 'per_sqft', 'tiered'], required: true },
  price:       { type: Number, default: 0, min: 0 },   // used for fixed / per_unit / per_sqft
  tiers:       [tierSchema],                            // used for tiered
  maxQty:      { type: Number, default: 20 },
  unit:        { type: String, default: 'unit' },
  icon:        { type: String, default: '✨' },
  isActive:    { type: Boolean, default: true },
  sortOrder:   { type: Number, default: 0 }
}, { _id: false });

const deepCleaningConfigSchema = new mongoose.Schema({
  minimumCartValue: { type: Number, default: 500 },
  items:            [itemSchema],
  updatedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

const DeepCleaningConfig = mongoose.model('DeepCleaningConfig', deepCleaningConfigSchema);
export default DeepCleaningConfig;
