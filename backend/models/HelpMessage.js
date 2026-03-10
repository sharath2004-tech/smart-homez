import mongoose from 'mongoose';

const helpMessageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200
    },
    userType: {
      type: String,
      enum: ['customer', 'worker', 'guest'],
      default: 'guest'
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 200,
      default: 'General Enquiry'
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    status: {
      type: String,
      enum: ['new', 'read', 'resolved'],
      default: 'new'
    },
    adminReply: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null
    },
    repliedAt: {
      type: Date,
      default: null
    },
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

helpMessageSchema.index({ status: 1, createdAt: -1 });
helpMessageSchema.index({ user: 1 });

export default mongoose.model('HelpMessage', helpMessageSchema);
