import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  overallRating: { type: Number, required: true, min: 1, max: 5 },
  categoryRatings: {
    quality: { type: Number, min: 1, max: 5 },
    timeliness: { type: Number, min: 1, max: 5 },
    professionalism: { type: Number, min: 1, max: 5 }
  },
  comment: { type: String, maxlength: 500 },
  photos: [{ url: String, uploadedAt: { type: Date, default: Date.now } }],
  isAnonymous: { type: Boolean, default: false },
  adminResponse: {
    comment: String,
    respondedAt: Date,
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
}, { timestamps: true });

reviewSchema.index({ worker: 1, createdAt: -1 });

export default mongoose.model('Review', reviewSchema);
