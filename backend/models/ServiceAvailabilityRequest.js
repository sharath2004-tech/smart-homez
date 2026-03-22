import mongoose from 'mongoose';

const serviceAvailabilityRequestSchema = new mongoose.Schema({
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true,
    index: true,
  },
  serviceName: {
    type: String,
    required: true,
    trim: true,
  },
  serviceType: {
    type: String,
    default: '',
    trim: true,
  },
  category: {
    type: String,
    default: '',
    trim: true,
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  customerName: {
    type: String,
    default: '',
    trim: true,
  },
  customerEmail: {
    type: String,
    default: '',
    trim: true,
    lowercase: true,
  },
  customerPhone: {
    type: String,
    default: '',
    trim: true,
  },
  address: {
    type: String,
    default: '',
    trim: true,
  },
  area: {
    type: String,
    default: '',
    trim: true,
  },
  city: {
    type: String,
    default: '',
    trim: true,
  },
  state: {
    type: String,
    default: '',
    trim: true,
  },
  zipCode: {
    type: String,
    default: '',
    trim: true,
  },
  serviceAreaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null,
  },
  source: {
    type: String,
    enum: ['customer_service_unavailable'],
    default: 'customer_service_unavailable',
  },
  requestCount: {
    type: Number,
    default: 1,
    min: 1,
  },
  locationKey: {
    type: String,
    required: true,
    trim: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
      index: '2dsphere',
    },
  },
  lastRequestedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

serviceAvailabilityRequestSchema.index(
  { requestedBy: 1, service: 1, locationKey: 1 },
  { unique: true }
);

const ServiceAvailabilityRequest = mongoose.model('ServiceAvailabilityRequest', serviceAvailabilityRequestSchema);

export default ServiceAvailabilityRequest;