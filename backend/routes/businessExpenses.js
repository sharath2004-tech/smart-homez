import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import { uploadToCloudinary } from '../middleware/cloudinary.js';
import { uploadExpenseProofs } from '../middleware/upload.js';
import Booking from '../models/Booking.js';
import BusinessExpense from '../models/BusinessExpense.js';

const router = express.Router();

const mapUploadedProofFiles = async (files = []) => {
  return Promise.all(files.map(async (file) => ({
    url: await uploadToCloudinary(file.buffer, 'smart-homez/expense-proofs'),
    originalName: file.originalname,
    mimeType: file.mimetype,
    uploadedAt: new Date()
  })));
};

/**
 * Create a business expense
 * POST /api/business-expenses
 */
router.post(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  uploadExpenseProofs.array('proofFiles', 5),
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('category').notEmpty().withMessage('Category is required'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('type').optional().isIn(['project_expense', 'operational_expense']).withMessage('Invalid expense type')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg } });
      }

      const { title, amount, category, customCategory, description, date, locationId, bookingId, type } = req.body;

      // Validate that project expenses have a booking ID
      if (type === 'project_expense' && !bookingId) {
        return res.status(400).json({ error: { message: 'Booking ID is required for project expenses' } });
      }

      let resolvedLocationId = locationId || null;
      if (bookingId && !resolvedLocationId) {
        const linkedBooking = await Booking.findById(bookingId).select('location.locationId');
        if (!linkedBooking) {
          return res.status(400).json({ error: { message: 'Linked booking not found' } });
        }
        resolvedLocationId = linkedBooking.location?.locationId || null;
      }

      const uploadedProofFiles = await mapUploadedProofFiles(req.files);

      const expense = new BusinessExpense({
        title,
        amount: Number(amount),
        category,
        customCategory: category === 'other' ? customCategory : undefined,
        description,
        date: new Date(date),
        location: resolvedLocationId,
        bookingId: bookingId || null,
        type: type || 'operational_expense',
        createdBy: req.user._id,
        createdByRole: req.user.role,
        proofFiles: uploadedProofFiles,
        receipt: uploadedProofFiles[0]?.url || null
      });

      await expense.save();
      await expense.populate('createdBy', 'name email');
      await expense.populate('location', 'apartmentName area city');
      await expense.populate({
        path: 'bookingId',
        select: 'bookingId customerId bookingDate status totalAmount location service customer',
        populate: [
          { path: 'service', select: 'name serviceType' },
          { path: 'customer', select: 'name email phone' }
        ]
      });

      res.status(201).json({ success: true, expense });
    } catch (error) {
      console.error('Create expense error:', error);
      res.status(500).json({ error: { message: 'Server error' } });
    }
  }
);

/**
 * Get business expenses (filtered by role)
 * GET /api/business-expenses
 * - Admin: only their own expenses (and for their locations)
 * - Super admin: all expenses, optionally filtered by locationId
 */
router.get(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const { locationId, category, from, to, page = 1, limit = 50, bookingId } = req.query;
      const filter = {};

      if (req.user.role === 'admin') {
        // Admin can only see their own expenses
        filter.createdBy = req.user._id;
      }

      if (locationId) {
        const bookingIdsForLocation = await Booking.find({ 'location.locationId': locationId }).distinct('_id');
        filter.$or = [
          { location: locationId },
          { bookingId: { $in: bookingIdsForLocation } }
        ];
      }
      if (category) filter.category = category;
      if (bookingId) filter.bookingId = bookingId;

      if (from || to) {
        filter.date = {};
        if (from) filter.date.$gte = new Date(from);
        if (to) filter.date.$lte = new Date(to);
      }

      const skip = (Number(page) - 1) * Number(limit);
      const total = await BusinessExpense.countDocuments(filter);
      const expenses = await BusinessExpense.find(filter)
        .populate('createdBy', 'name email role')
        .populate('location', 'apartmentName area city')
        .populate({
          path: 'bookingId',
          select: 'bookingId customerId bookingDate status totalAmount location service customer',
          populate: [
            { path: 'service', select: 'name serviceType' },
            { path: 'customer', select: 'name email phone' }
          ]
        })
        .sort({ date: -1 })
        .skip(skip)
        .limit(Number(limit));

      // Calculate summary
      const summary = await BusinessExpense.aggregate([
        { $match: filter },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]);

      const grandTotal = summary.reduce((sum, s) => sum + s.total, 0);

      res.json({
        success: true,
        expenses,
        summary,
        grandTotal,
        pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) }
      });
    } catch (error) {
      console.error('Get expenses error:', error);
      res.status(500).json({ error: { message: 'Server error' } });
    }
  }
);

/**
 * Update a business expense (only creator or super_admin)
 * PATCH /api/business-expenses/:id
 */
router.patch(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  uploadExpenseProofs.array('proofFiles', 5),
  [param('id').isMongoId().withMessage('Valid expense ID is required')],
  async (req, res) => {
    try {
      const expense = await BusinessExpense.findById(req.params.id);
      if (!expense) return res.status(404).json({ error: { message: 'Expense not found' } });

      // Only the creator or a super_admin can update
      if (req.user.role !== 'super_admin' && expense.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: { message: 'Not authorized to update this expense' } });
      }

      const uploadedProofFiles = await mapUploadedProofFiles(req.files);

      const { title, amount, category, customCategory, description, date, locationId, bookingId, type } = req.body;

      // Validate that project expenses have a booking ID
      if (type === 'project_expense' && !bookingId) {
        return res.status(400).json({ error: { message: 'Booking ID is required for project expenses' } });
      }

      let resolvedLocationId = locationId;
      if (bookingId !== undefined && bookingId) {
        const linkedBooking = await Booking.findById(bookingId).select('location.locationId');
        if (!linkedBooking) {
          return res.status(400).json({ error: { message: 'Linked booking not found' } });
        }
        resolvedLocationId = locationId !== undefined ? locationId : linkedBooking.location?.locationId || null;
      }

      // Update fields if provided
      if (title) expense.title = title;
      if (amount !== undefined) expense.amount = Number(amount);
      if (category) expense.category = category;
      if (customCategory !== undefined) expense.customCategory = category === 'other' ? customCategory : undefined;
      if (description !== undefined) expense.description = description;
      if (date) expense.date = new Date(date);
      if (locationId !== undefined || bookingId !== undefined) expense.location = resolvedLocationId || null;
      if (bookingId !== undefined) expense.bookingId = bookingId || null;
      if (type) expense.type = type;
      if (uploadedProofFiles.length > 0) {
        expense.proofFiles = [...(expense.proofFiles || []), ...uploadedProofFiles];
        if (!expense.receipt) {
          expense.receipt = uploadedProofFiles[0].url;
        }
      }

      await expense.save();
      await expense.populate('createdBy', 'name email');
      await expense.populate('location', 'apartmentName area city');
      await expense.populate({
        path: 'bookingId',
        select: 'bookingId customerId bookingDate status totalAmount location service customer',
        populate: [
          { path: 'service', select: 'name serviceType' },
          { path: 'customer', select: 'name email phone' }
        ]
      });

      res.json({ success: true, expense });
    } catch (error) {
      console.error('Update expense error:', error);
      res.status(500).json({ error: { message: 'Server error' } });
    }
  }
);

/**
 * Delete a business expense (only creator or super_admin)
 * DELETE /api/business-expenses/:id
 */
router.delete(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  [param('id').isMongoId().withMessage('Valid expense ID is required')],
  async (req, res) => {
    try {
      const expense = await BusinessExpense.findById(req.params.id);
      if (!expense) return res.status(404).json({ error: { message: 'Expense not found' } });

      // Only the creator or a super_admin can delete
      if (req.user.role !== 'super_admin' && expense.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: { message: 'Not authorized to delete this expense' } });
      }

      await expense.deleteOne();
      res.json({ success: true, message: 'Expense deleted successfully' });
    } catch (error) {
      console.error('Delete expense error:', error);
      res.status(500).json({ error: { message: 'Server error' } });
    }
  }
);

export default router;
