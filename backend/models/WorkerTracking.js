import mongoose from 'mongoose';

const workerTrackingSchema = new mongoose.Schema({
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  currentLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  destination: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number]
  },
  eta: Date,
  distance: Number,
  status: { type: String, enum: ['en-route', 'arrived', 'in-service', 'completed'], default: 'en-route' },
  route: [{ coordinates: [Number], timestamp: Date }],
  delayMinutes: { type: Number, default: 0 },
  trafficCondition: { type: String, enum: ['light', 'moderate', 'heavy'] }
}, { timestamps: true });

workerTrackingSchema.index({ currentLocation: '2dsphere' });

export default mongoose.model('WorkerTracking', workerTrackingSchema);
