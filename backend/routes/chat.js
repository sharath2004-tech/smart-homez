import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import Booking from '../models/Booking.js';
import Chat from '../models/Chat.js';

const router = express.Router();

// Helper: verify requester is the customer or worker on the booking
const verifyParticipant = async (bookingId, userId) => {
  const booking = await Booking.findById(bookingId).select('customer worker');
  if (!booking) return null;
  const isParticipant =
    booking.customer.toString() === userId.toString() ||
    (booking.worker && booking.worker.toString() === userId.toString());
  return isParticipant ? booking : null;
};

// GET /api/chat/booking/:bookingId
router.get('/booking/:bookingId', authenticate, async (req, res) => {
  try {
    const booking = await verifyParticipant(req.params.bookingId, req.user._id);
    if (!booking) return res.status(403).json({ error: { message: 'Access denied', status: 403 } });

    let chat = await Chat.findOne({ booking: req.params.bookingId })
      .populate('messages.sender', 'name role');

    if (!chat) {
      chat = await Chat.create({
        booking: req.params.bookingId,
        participants: [booking.customer, booking.worker].filter(Boolean),
        messages: []
      });
    }

    res.json({ chat });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// POST /api/chat/booking/:bookingId/messages
router.post('/booking/:bookingId/messages', authenticate, [
  body('text').trim().notEmpty().withMessage('Message text is required').isLength({ max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const booking = await verifyParticipant(req.params.bookingId, req.user._id);
    if (!booking) return res.status(403).json({ error: { message: 'Access denied', status: 403 } });

    const senderRole = booking.customer.toString() === req.user._id.toString() ? 'customer' : 'worker';

    let chat = await Chat.findOne({ booking: req.params.bookingId });
    if (!chat) {
      chat = await Chat.create({
        booking: req.params.bookingId,
        participants: [booking.customer, booking.worker].filter(Boolean),
        messages: []
      });
    }

    const message = {
      sender: req.user._id,
      senderRole,
      text: req.body.text.trim(),
      readBy: [req.user._id]
    };
    chat.messages.push(message);
    chat.lastActivity = new Date();
    await chat.save();

    await chat.populate('messages.sender', 'name role');
    const saved = chat.messages[chat.messages.length - 1];
    res.status(201).json({ message: saved });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// PATCH /api/chat/booking/:bookingId/read
router.patch('/booking/:bookingId/read', authenticate, async (req, res) => {
  try {
    const booking = await verifyParticipant(req.params.bookingId, req.user._id);
    if (!booking) return res.status(403).json({ error: { message: 'Access denied', status: 403 } });

    await Chat.updateOne(
      { booking: req.params.bookingId },
      { $addToSet: { 'messages.$[msg].readBy': req.user._id } },
      { arrayFilters: [{ 'msg.sender': { $ne: req.user._id } }] }
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;
