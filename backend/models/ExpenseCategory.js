import mongoose from 'mongoose';

const expenseCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    unique: true
  },
  icon: {
    type: String,
    default: '⭐'
  },
  color: {
    type: String,
    default: '#6366f1' // indigo-500
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

const ExpenseCategory = mongoose.model('ExpenseCategory', expenseCategorySchema);
export default ExpenseCategory;
