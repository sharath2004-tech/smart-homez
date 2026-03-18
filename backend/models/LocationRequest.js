import mongoose from 'mongoose';

const locationRequestSchema = new mongoose.Schema({
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  apartmentName: { type: String, required: true, trim: true },
  building: { type: String, trim: true },
  area: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  zipCode: { type: String, trim: true },
  reason: { type: String, maxlength: 500 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewNote: { type: String, maxlength: 500 },
  reviewedAt: { type: Date, default: null }
}, {
  timestamps: true
});

const LocationRequest = mongoose.model('LocationRequest', locationRequestSchema);
export default LocationRequest;
