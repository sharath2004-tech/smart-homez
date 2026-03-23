import mongoose from 'mongoose';

const serviceRequestSchema = new mongoose.Schema({
  // Full service payload submitted by admin
  serviceData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  // Human-readable service type label
  serviceTypeName: {
    type: String,
    default: 'Custom Service'
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestedLocationIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  }],
  requestedRegions: [{
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location'
    },
    apartmentName: String,
    area: String,
    city: String
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  superAdminNote: {
    type: String,
    default: ''
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

const ServiceRequest = mongoose.model('ServiceRequest', serviceRequestSchema);
export default ServiceRequest;
