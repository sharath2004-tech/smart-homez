import mongoose from 'mongoose';

const quoteRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
  },
  propertyType: {
    type: String,
    required: [true, 'Property type is required'],
    enum: ['villa', 'bungalow', 'restaurant', 'corporate_office', 'business', 'other']
  },
  propertyTypeCustom: {
    type: String,   // Filled when propertyType === 'other'
    trim: true,
    default: ''
  },
  placeSize: {
    type: String,   // e.g. "2000 sq ft", "3 floors", "1500 sq ft per floor"
    required: [true, 'Place size is required'],
    trim: true
  },
  city: {
    type: String,   // Used to route to regional admin
    trim: true,
    default: ''
  },
  message: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'closed'],
    default: 'new'
  }
}, { timestamps: true });

const QuoteRequest = mongoose.model('QuoteRequest', quoteRequestSchema);
export default QuoteRequest;
