import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import HelpMessage from '../models/HelpMessage.js';

const router = express.Router();

// ────────────────────────────────────────────────────────────────────────────
// USER / PUBLIC routes
// ────────────────────────────────────────────────────────────────────────────

/**
 * Submit a help message
 * POST /api/help
 * Auth: required (customer or worker)
 */
router.post(
  '/',
  authenticate,
  [
    body('message')
      .trim()
      .notEmpty().withMessage('Message is required')
      .isLength({ max: 2000 }).withMessage('Message must be under 2000 characters'),
    body('subject')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('Subject must be under 200 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { message, subject } = req.body;

      const helpMsg = await HelpMessage.create({
        user: req.user._id,
        name: req.user.name,
        email: req.user.email,
        userType: req.user.role,
        subject: subject || 'General Enquiry',
        message,
        status: 'new'
      });

      res.status(201).json({
        success: true,
        message: 'Your message has been sent. We will get back to you shortly.',
        helpMessage: { _id: helpMsg._id, subject: helpMsg.subject, createdAt: helpMsg.createdAt }
      });
    } catch (error) {
      console.error('Submit help message error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

/**
 * Get my own help messages
 * GET /api/help/my
 * Auth: required (customer or worker)
 */
router.get('/my', authenticate, async (req, res) => {
  try {
    const messages = await HelpMessage.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Get my help messages error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// ADMIN routes
// ────────────────────────────────────────────────────────────────────────────

/**
 * List all help messages (with optional status filter)
 * GET /api/help/admin?status=new
 * Auth: admin / super_admin
 */
router.get(
  '/admin',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const { status } = req.query;
      const filter = {};
      if (status && ['new', 'read', 'resolved'].includes(status)) {
        filter.status = status;
      }

      const messages = await HelpMessage.find(filter)
        .sort({ createdAt: -1 })
        .populate('user', 'name email role')
        .populate('repliedBy', 'name')
        .lean();

      const counts = {
        total: await HelpMessage.countDocuments(),
        new: await HelpMessage.countDocuments({ status: 'new' }),
        read: await HelpMessage.countDocuments({ status: 'read' }),
        resolved: await HelpMessage.countDocuments({ status: 'resolved' })
      };

      res.json({ success: true, messages, counts });
    } catch (error) {
      console.error('Admin get help messages error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

/**
 * Mark a message as read
 * PATCH /api/help/:id/read
 * Auth: admin / super_admin
 */
router.patch(
  '/:id/read',
  authenticate,
  authorize('admin', 'super_admin'),
  [param('id').isMongoId().withMessage('Invalid message ID')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const msg = await HelpMessage.findById(req.params.id);
      if (!msg) return res.status(404).json({ error: { message: 'Message not found', status: 404 } });

      if (msg.status === 'new') {
        msg.status = 'read';
        await msg.save();
      }

      res.json({ success: true, message: 'Marked as read' });
    } catch (error) {
      console.error('Mark help message read error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

/**
 * Reply to a help message and mark as resolved
 * PATCH /api/help/:id/reply
 * Auth: admin / super_admin
 */
router.patch(
  '/:id/reply',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    param('id').isMongoId().withMessage('Invalid message ID'),
    body('reply')
      .trim()
      .notEmpty().withMessage('Reply is required')
      .isLength({ max: 2000 }).withMessage('Reply must be under 2000 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const msg = await HelpMessage.findById(req.params.id);
      if (!msg) return res.status(404).json({ error: { message: 'Message not found', status: 404 } });

      msg.adminReply = req.body.reply.trim();
      msg.repliedAt = new Date();
      msg.repliedBy = req.user._id;
      msg.status = 'resolved';
      await msg.save();

      res.json({ success: true, message: 'Reply saved and message resolved' });
    } catch (error) {
      console.error('Reply help message error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

/**
 * Delete a help message
 * DELETE /api/help/:id
 * Auth: admin / super_admin
 */
router.delete(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  [param('id').isMongoId().withMessage('Invalid message ID')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const msg = await HelpMessage.findByIdAndDelete(req.params.id);
      if (!msg) return res.status(404).json({ error: { message: 'Message not found', status: 404 } });

      res.json({ success: true, message: 'Message deleted' });
    } catch (error) {
      console.error('Delete help message error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

export default router;
