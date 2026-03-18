import mongoose from 'mongoose';

const businessExpenseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: 0
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'deep_cleaning_material',
      'equipment',
      'utilities',
      'salary',
      'rent',
      'marketing',
      'transport',
      'training',
      'maintenance',
      'other'
    ]
  },
  customCategory: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    maxlength: 500
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdByRole: {
    type: String,
    enum: ['admin', 'super_admin'],
    required: true
  },
  receipt: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

const BusinessExpense = mongoose.model('BusinessExpense', businessExpenseSchema);
export default BusinessExpense;
