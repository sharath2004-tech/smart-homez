import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['customer', 'worker'], required: true },
  text: { type: String, required: true, maxlength: 1000 },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

const chatSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  messages: [messageSchema],
  lastActivity: { type: Date, default: Date.now }
}, { timestamps: true });

chatSchema.index({ booking: 1 });
chatSchema.index({ participants: 1 });

export default mongoose.model('Chat', chatSchema);
