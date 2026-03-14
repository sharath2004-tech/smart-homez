import mongoose from 'mongoose';

const tierSchema = new mongoose.Schema({
  label: { type: String, required: true },
  price: { type: Number, required: true, min: 0 }
}, { _id: false });

const itemSchema = new mongoose.Schema({
  id:          { type: String, required: true },
  category:    {
    type: String,
    enum: [
      'bathroom', 'kitchen', 'furniture', 'appliances', 'fullhouse',
      'sofa_upholstery', 'mattress', 'balcony_window',
      'move_in_out', 'office', 'post_construction'
    ],
    required: true
  },
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
  id:       { type: String, required: true },
  label:    { type: String, required: true },
  emoji:    { type: String, default: '✨' },
  isActive: { type: Boolean, default: true },
  sortOrder:{ type: Number, default: 0 }
}, { _id: false });

const DEFAULT_CATEGORIES = [
  { id: 'fullhouse',        label: 'Full Home Deep Cleaning',    emoji: '🏡', isActive: true, sortOrder: 1 },
  { id: 'bathroom',         label: 'Bathroom Cleaning',          emoji: '🚿', isActive: true, sortOrder: 2 },
  { id: 'kitchen',          label: 'Kitchen Cleaning',           emoji: '🍳', isActive: true, sortOrder: 3 },
  { id: 'sofa_upholstery',  label: 'Sofa & Upholstery',         emoji: '🛋️', isActive: true, sortOrder: 4 },
  { id: 'mattress',         label: 'Mattress Cleaning',          emoji: '🛏️', isActive: true, sortOrder: 5 },
  { id: 'balcony_window',   label: 'Balcony & Window',           emoji: '🪟', isActive: true, sortOrder: 6 },
  { id: 'move_in_out',      label: 'Move-in / Move-out',         emoji: '📦', isActive: true, sortOrder: 7 },
  { id: 'office',           label: 'Office Deep Cleaning',       emoji: '🏢', isActive: true, sortOrder: 8 },
  { id: 'post_construction',label: 'Post-Construction Cleaning', emoji: '🏗️', isActive: true, sortOrder: 9 },
  { id: 'appliances',       label: 'Appliances',                 emoji: '💨', isActive: true, sortOrder: 10 },
  { id: 'furniture',        label: 'Furniture',                  emoji: '🪑', isActive: true, sortOrder: 11 },
];

const deepCleaningConfigSchema = new mongoose.Schema({
  minimumCartValue: { type: Number, default: 500 },
  categories:       { type: [categorySchema], default: DEFAULT_CATEGORIES },
  items:            [itemSchema],
  updatedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

const DeepCleaningConfig = mongoose.model('DeepCleaningConfig', deepCleaningConfigSchema);
export default DeepCleaningConfig;
