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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExpenseCategory',
    required: [true, 'Category is required']
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
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  },
  type: {
    type: String,
    enum: ['project_expense', 'operational_expense'],
    default: 'operational_expense'
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
