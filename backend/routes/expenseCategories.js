import express from 'express';
import ExpenseCategory from '../models/ExpenseCategory.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/expense-categories
// @desc    Get all active expense categories
// @access  Private (admin/super_admin)
router.get('/', authenticate, authorize(['admin', 'super_admin']), async (req, res) => {
  try {
    const categories = await ExpenseCategory.find({ isActive: true })
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching expense categories:', error);
    res.status(500).json({ error: { message: 'Failed to fetch categories' } });
  }
});

// @route   POST /api/expense-categories
// @desc    Create new expense category
// @access  Private (super_admin only)
router.post('/', authenticate, authorize(['super_admin']), async (req, res) => {
  try {
    const { name, icon, color } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: { message: 'Category name is required' } });
    }

    // Check if category already exists
    const existing = await ExpenseCategory.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ error: { message: 'Category with this name already exists' } });
    }

    const category = await ExpenseCategory.create({
      name: name.trim(),
      icon: icon || '⭐',
      color: color || '#6366f1',
      createdBy: req.user._id
    });

    res.status(201).json({ success: true, category });
  } catch (error) {
    console.error('Error creating expense category:', error);
    res.status(500).json({ error: { message: 'Failed to create category' } });
  }
});

// @route   PATCH /api/expense-categories/:id
// @desc    Update expense category
// @access  Private (super_admin only)
router.patch('/:id', authenticate, authorize(['super_admin']), async (req, res) => {
  try {
    const { name, icon, color, isActive } = req.body;
    const category = await ExpenseCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ error: { message: 'Category not found' } });
    }

    // Check for duplicate name if name is being changed
    if (name && name.trim() !== category.name) {
      const existing = await ExpenseCategory.findOne({ name: name.trim(), _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ error: { message: 'Category with this name already exists' } });
      }
      category.name = name.trim();
    }

    if (icon !== undefined) category.icon = icon;
    if (color !== undefined) category.color = color;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();
    res.json({ success: true, category });
  } catch (error) {
    console.error('Error updating expense category:', error);
    res.status(500).json({ error: { message: 'Failed to update category' } });
  }
});

// @route   DELETE /api/expense-categories/:id
// @desc    Delete expense category (soft delete)
// @access  Private (super_admin only)
router.delete('/:id', authenticate, authorize(['super_admin']), async (req, res) => {
  try {
    const category = await ExpenseCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ error: { message: 'Category not found' } });
    }

    // Soft delete - just deactivate
    category.isActive = false;
    await category.save();

    res.json({ success: true, message: 'Category deactivated successfully' });
  } catch (error) {
    console.error('Error deleting expense category:', error);
    res.status(500).json({ error: { message: 'Failed to delete category' } });
  }
});

export default router;
