import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import HomeConfig from '../models/HomeConfig.js';
import Service from '../models/Service.js';

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: { message: errors.array()[0].msg, status: 400 } });
  }
  return null;
}

/**
 * Resolve services for a section based on its filter config.
 * Returns a lightweight list ({ _id, name, serviceType, serviceCategory, price, isQuoteService, subscriptionOptions })
 */
async function resolveServicesForSection(section) {
  if (section.type === 'promo_banner') return [];

  const { serviceFilter, maxItems } = section;
  if (!serviceFilter) return [];

  const query = { isActive: true };
  const orClauses = [];

  if (serviceFilter.serviceTypes?.length) {
    orClauses.push({ serviceType: { $in: serviceFilter.serviceTypes } });
  }
  if (serviceFilter.serviceCategories?.length) {
    orClauses.push({ serviceCategory: { $in: serviceFilter.serviceCategories } });
  }
  if (serviceFilter.namePatterns?.length) {
    serviceFilter.namePatterns.forEach((p) => {
      const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      orClauses.push({ name: { $regex: escaped, $options: 'i' } });
    });
  }

  if (serviceFilter.showAll) {
    // no additional filter
  } else if (orClauses.length === 0) {
    return [];
  } else {
    query.$or = orClauses;
  }

  if (serviceFilter.excludeServiceTypes?.length) {
    query.serviceType = query.serviceType || {};
    query.serviceType = { $nin: serviceFilter.excludeServiceTypes };
  }

  const services = await Service.find(query)
    .select('_id name serviceType serviceCategory price isQuoteService subscriptionOptions displayOrder')
    .sort({ displayOrder: 1, createdAt: -1 })
    .limit(maxItems || 6);

  return services.map((s) => ({
    _id: s._id,
    name: s.name,
    serviceType: s.serviceType,
    serviceCategory: s.serviceCategory,
    price: s.price,
    isQuoteService: s.isQuoteService,
    hasSubscription: !!s.subscriptionOptions?.enabled
  }));
}

// ─── Public Routes ────────────────────────────────────────────────────────────

/**
 * GET /api/home-config
 * Returns active sections with resolved services for each.
 * Used by the customer home screen.
 */
router.get('/', async (req, res) => {
  try {
    const config = await HomeConfig.getSingleton();
    const activeSections = config.sections
      .filter((s) => s.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const sectionsWithServices = await Promise.all(
      activeSections.map(async (section) => {
        const services = await resolveServicesForSection(section);
        return {
          sectionId: section.sectionId,
          title: section.title,
          description: section.description,
          emoji: section.emoji,
          type: section.type,
          bannerConfig: section.bannerConfig,
          maxItems: section.maxItems,
          badgeText: section.badgeText,
          sortOrder: section.sortOrder,
          services
        };
      })
    );

    res.json({ success: true, sections: sectionsWithServices });
  } catch (error) {
    console.error('GET /home-config error:', error);
    res.status(500).json({ error: { message: 'Failed to fetch home config', status: 500 } });
  }
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────

/**
 * GET /api/home-config/admin
 * Returns full config including inactive sections.
 */
router.get('/admin', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const config = await HomeConfig.getSingleton();
    const sorted = [...config.sections].sort((a, b) => a.sortOrder - b.sortOrder);
    res.json({ success: true, sections: sorted, updatedAt: config.updatedAt });
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to fetch home config', status: 500 } });
  }
});

/**
 * POST /api/home-config/sections
 * Add a new section.
 */
router.post(
  '/sections',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    body('title').trim().notEmpty().withMessage('Section title is required'),
    body('type').isIn(['service_grid', 'promo_banner', 'featured_list', 'category_strip'])
      .withMessage('Invalid section type'),
    body('emoji').optional().trim(),
    body('description').optional().trim(),
    body('serviceFilter').optional().isObject(),
    body('bannerConfig').optional().isObject(),
    body('maxItems').optional().isInt({ min: 1, max: 20 }),
    body('badgeText').optional().trim(),
    body('sortOrder').optional().isInt({ min: 0 }),
    body('isActive').optional().isBoolean()
  ],
  async (req, res) => {
    const err = validationErrors(req, res);
    if (err) return;

    try {
      const config = await HomeConfig.getSingleton();
      const { title, type, emoji, description, serviceFilter, bannerConfig, maxItems, badgeText, sortOrder, isActive } = req.body;

      // Generate unique sectionId from title
      const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      let sectionId = base;
      let counter = 1;
      while (config.sections.some((s) => s.sectionId === sectionId)) {
        sectionId = `${base}_${counter++}`;
      }

      const maxOrder = config.sections.reduce((m, s) => Math.max(m, s.sortOrder ?? 0), -1);

      config.sections.push({
        sectionId,
        title,
        description: description || '',
        emoji: emoji || '🏠',
        type,
        serviceFilter: serviceFilter || { serviceTypes: [], serviceCategories: [], namePatterns: [], excludeServiceTypes: [], showAll: false },
        bannerConfig: bannerConfig || { link: '', gradient: 'from-teal-50 to-green-50', borderColor: 'border-teal-300', ctaText: 'Book Now' },
        maxItems: maxItems || 6,
        badgeText: badgeText || '',
        sortOrder: sortOrder !== undefined ? sortOrder : maxOrder + 1,
        isActive: isActive !== undefined ? isActive : true
      });

      config.updatedBy = req.user._id;
      await config.save();

      res.status(201).json({ success: true, message: 'Section created', sections: config.sections });
    } catch (error) {
      console.error('POST /home-config/sections error:', error);
      res.status(500).json({ error: { message: 'Failed to create section', status: 500 } });
    }
  }
);

/**
 * PATCH /api/home-config/sections/:sectionId
 * Update a section (partial update).
 */
router.patch(
  '/sections/:sectionId',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    param('sectionId').trim().notEmpty(),
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
    body('type').optional().isIn(['service_grid', 'promo_banner', 'featured_list', 'category_strip']),
    body('maxItems').optional().isInt({ min: 1, max: 20 }),
    body('sortOrder').optional().isInt({ min: 0 }),
    body('isActive').optional().isBoolean()
  ],
  async (req, res) => {
    const err = validationErrors(req, res);
    if (err) return;

    try {
      const config = await HomeConfig.getSingleton();
      const section = config.sections.find((s) => s.sectionId === req.params.sectionId);

      if (!section) {
        return res.status(404).json({ error: { message: 'Section not found', status: 404 } });
      }

      const allowed = ['title', 'description', 'emoji', 'type', 'serviceFilter', 'bannerConfig', 'maxItems', 'badgeText', 'sortOrder', 'isActive'];
      allowed.forEach((field) => {
        if (req.body[field] !== undefined) {
          section[field] = req.body[field];
        }
      });

      config.updatedBy = req.user._id;
      await config.save();

      res.json({ success: true, message: 'Section updated', sections: config.sections });
    } catch (error) {
      console.error('PATCH /home-config/sections/:id error:', error);
      res.status(500).json({ error: { message: 'Failed to update section', status: 500 } });
    }
  }
);

/**
 * PUT /api/home-config/sections/reorder
 * Update order of all sections at once.
 * Body: { order: [{ sectionId, sortOrder }] }
 */
router.put(
  '/sections/reorder',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    body('order').isArray({ min: 1 }).withMessage('order must be a non-empty array'),
    body('order.*.sectionId').notEmpty().withMessage('sectionId is required in each order entry'),
    body('order.*.sortOrder').isInt({ min: 0 }).withMessage('sortOrder must be a non-negative integer')
  ],
  async (req, res) => {
    const err = validationErrors(req, res);
    if (err) return;

    try {
      const config = await HomeConfig.getSingleton();
      const { order } = req.body;

      order.forEach(({ sectionId, sortOrder }) => {
        const section = config.sections.find((s) => s.sectionId === sectionId);
        if (section) section.sortOrder = sortOrder;
      });

      config.updatedBy = req.user._id;
      await config.save();

      res.json({ success: true, message: 'Sections reordered', sections: config.sections });
    } catch (error) {
      res.status(500).json({ error: { message: 'Failed to reorder sections', status: 500 } });
    }
  }
);

/**
 * DELETE /api/home-config/sections/:sectionId
 * Remove a section.
 */
router.delete(
  '/sections/:sectionId',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const config = await HomeConfig.getSingleton();
      const idx = config.sections.findIndex((s) => s.sectionId === req.params.sectionId);

      if (idx === -1) {
        return res.status(404).json({ error: { message: 'Section not found', status: 404 } });
      }

      config.sections.splice(idx, 1);
      config.updatedBy = req.user._id;
      await config.save();

      res.json({ success: true, message: 'Section deleted', sections: config.sections });
    } catch (error) {
      res.status(500).json({ error: { message: 'Failed to delete section', status: 500 } });
    }
  }
);

/**
 * PUT /api/home-config
 * Replace ALL sections at once (bulk save from admin panel).
 */
router.put(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    body('sections').isArray({ min: 0 }).withMessage('sections must be an array')
  ],
  async (req, res) => {
    const err = validationErrors(req, res);
    if (err) return;

    try {
      const config = await HomeConfig.getSingleton();
      config.sections = req.body.sections;
      config.updatedBy = req.user._id;
      await config.save();

      res.json({ success: true, message: 'Home config saved', sections: config.sections });
    } catch (error) {
      console.error('PUT /home-config error:', error);
      res.status(500).json({ error: { message: 'Failed to save home config', status: 500 } });
    }
  }
);

export default router;
