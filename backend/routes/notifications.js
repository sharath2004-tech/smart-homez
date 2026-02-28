import express from 'express';
import { authenticate } from '../middleware/auth.js';
import Notification from '../models/Notification.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ error: { message: 'Not found', status: 404 } });

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
    res.json({ notification });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

router.patch('/mark-all-read', authenticate, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;
