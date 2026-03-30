import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import Service from '../models/Service.js';
import ServiceCatalog from '../models/ServiceCatalog.js';

const router = express.Router();

// @route   GET /api/service-catalog
// @desc    Get all catalog categories (with optional service counts)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const query = {};
    if (activeOnly === 'true') query.isActive = true;

    const categories = await ServiceCatalog.find(query)
      .populate('createdBy', 'name email')
      .sort({ sortOrder: 1, name: 1 });

    // Attach service counts per category
    const categoryIds = categories.map(c => c._id);
    const counts = await Service.aggregate([
      { $match: { catalogCategoryId: { $in: categoryIds }, isActive: true } },
      { $group: { _id: '$catalogCategoryId', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map(c => [c._id.toString(), c.count]));

    const result = categories.map(cat => ({
      ...cat.toObject(),
      serviceCount: countMap[cat._id.toString()] || 0,
    }));

    res.json({ categories: result });
  } catch (error) {
    console.error('Get service catalog error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/service-catalog/:idOrSlug
// @desc    Get single catalog category with its services
// @access  Public
router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const isObjectId = /^[a-f\d]{24}$/i.test(idOrSlug);
    const category = isObjectId
      ? await ServiceCatalog.findById(idOrSlug).populate('createdBy', 'name email')
      : await ServiceCatalog.findOne({ slug: idOrSlug }).populate('createdBy', 'name email');

    if (!category) {
      return res.status(404).json({ error: { message: 'Category not found', status: 404 } });
    }

    // Fetch services in this category
    const services = await Service.find({
      catalogCategoryId: category._id,
      isActive: true,
    }).sort({ displayOrder: 1, name: 1 });

    res.json({ category, services });
  } catch (error) {
    console.error('Get catalog category error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/service-catalog
// @desc    Create a new catalog category
// @access  Private/Admin+SuperAdmin
router.post('/',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    body('name').trim().notEmpty().withMessage('Category name is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        name, description, icon, image, color, isActive,
        sortOrder, pricingModel, pricingHint, subcategories, slug,
      } = req.body;

      const category = new ServiceCatalog({
        name,
        slug: slug || undefined,
        description,
        icon,
        image,
        color,
        isActive: isActive !== undefined ? isActive : true,
        sortOrder: sortOrder || 0,
        pricingModel,
        pricingHint,
        subcategories: subcategories || [],
        createdBy: req.user._id,
      });

      await category.save();

      res.status(201).json({ message: 'Catalog category created', category });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ error: { message: 'A category with this name/slug already exists', status: 409 } });
      }
      console.error('Create catalog category error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   PATCH /api/service-catalog/:id
// @desc    Update catalog category
// @access  Private/Admin+SuperAdmin
router.patch('/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const updateData = {};
      const allowedFields = [
        'name', 'slug', 'description', 'icon', 'image', 'color',
        'isActive', 'sortOrder', 'pricingModel', 'pricingHint', 'subcategories',
      ];

      for (const field of allowedFields) {
        if (field in req.body) updateData[field] = req.body[field];
      }

      const category = await ServiceCatalog.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { new: true, runValidators: true },
      );

      if (!category) {
        return res.status(404).json({ error: { message: 'Category not found', status: 404 } });
      }

      res.json({ message: 'Category updated', category });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ error: { message: 'A category with this name/slug already exists', status: 409 } });
      }
      console.error('Update catalog category error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   DELETE /api/service-catalog/:id
// @desc    Delete catalog category (unlinks services, doesn't delete them)
// @access  Private/SuperAdmin
router.delete('/:id',
  authenticate,
  authorize('super_admin'),
  async (req, res) => {
    try {
      const category = await ServiceCatalog.findById(req.params.id);
      if (!category) {
        return res.status(404).json({ error: { message: 'Category not found', status: 404 } });
      }

      // Unlink services from this category
      await Service.updateMany(
        { catalogCategoryId: category._id },
        { $set: { catalogCategoryId: null, catalogSubcategory: null } },
      );

      await ServiceCatalog.findByIdAndDelete(req.params.id);

      res.json({ message: 'Category deleted. Services have been unlinked.' });
    } catch (error) {
      console.error('Delete catalog category error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

export default router;
