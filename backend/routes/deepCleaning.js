import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import Booking from '../models/Booking.js';
import DeepCleaningChangeRequest from '../models/DeepCleaningChangeRequest.js';
import DeepCleaningConfig from '../models/DeepCleaningConfig.js';
import Location from '../models/Location.js';
import Service from '../models/Service.js';
import User from '../models/User.js';
import { assignWorkersWithBackup } from '../utils/advancedWorkerAssignment.js';
import notificationService from '../utils/notificationService.js';
import { findWorkerWithPreferences } from '../utils/preferenceAssignment.js';

const router = express.Router();

// ─── seed / ensure config exists ───────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id: 'fullhouse', label: 'Full Home Deep Cleaning', emoji: '🏡', isActive: true, sortOrder: 1, description: 'Choose a home-size package for full-house professional deep cleaning.', highlights: ['Packages by home size', 'Advance scheduling', 'Team-based cleaning'], mode: 'package', headline: 'Full-home deep cleaning packages for apartments, villas and handover prep.', inclusionsTitle: 'Package includes', idealFor: ['Seasonal full-home reset', 'Festival or guest preparation', 'Homes needing a team visit'], howItWorksTitle: 'How this works', howItWorksSteps: ['Pick this category to understand what is covered.', 'Choose the package or continue to booking and enter your home details.', 'Review the amount and confirm your preferred slot.'], primaryActionLabel: 'Continue to packages', secondaryActionLabel: 'Prefer custom selection?' },
  { id: 'bathroom', label: 'Bathroom Cleaning', emoji: '🚿', isActive: true, sortOrder: 2, description: 'From basic washroom cleaning to intense descaling and sanitization.', highlights: ['Descaling', 'Sanitization', 'Tile & fixture cleaning'], mode: 'customize', headline: 'Bathroom-focused deep cleaning with flexible add-to-cart options.', inclusionsTitle: 'Popular bathroom tasks', idealFor: ['Hard-water stain removal', 'Tile and grout refresh', 'Washrooms needing hygienic sanitization'], howItWorksTitle: 'How this works', howItWorksSteps: ['Pick this category to understand what is covered.', 'Continue to booking, choose the tasks you want, and enter your home details.', 'Review the amount and confirm your slot.'], primaryActionLabel: 'Continue to booking', secondaryActionLabel: 'See full-home packages' },
  { id: 'kitchen', label: 'Kitchen Cleaning', emoji: '🍳', isActive: true, sortOrder: 3, description: 'Degreasing, appliance detailing, chimney cleaning and more.', highlights: ['Grease removal', 'Appliance detailing', 'Chimney options'], mode: 'customize', headline: 'Kitchen deep cleaning built around grease, appliances and high-touch areas.', inclusionsTitle: 'Popular kitchen tasks', idealFor: ['Heavy grease build-up', 'Appliance refresh before guests', 'Monthly kitchen maintenance'], howItWorksTitle: 'How this works', howItWorksSteps: ['Pick this category to see the active kitchen services.', 'Continue to booking and select the tasks or package that fit your kitchen.', 'Review the amount and confirm your preferred slot.'], primaryActionLabel: 'Continue to booking', secondaryActionLabel: 'See full-home packages' },
  { id: 'sofa_upholstery', label: 'Sofa & Upholstery', emoji: '🛋️', isActive: true, sortOrder: 4, description: 'Wet shampooing and upholstery refresh for sofas and seating.', highlights: ['Fabric refresh', 'Seat-wise pricing', 'Quick add-ons'], mode: 'customize', headline: 'Seat-wise upholstery cleaning for fabric and soft furniture.', inclusionsTitle: 'Popular upholstery tasks', idealFor: ['Sofa refresh', 'Dust and stain control', 'Living-room touch-ups'], howItWorksTitle: 'How this works', howItWorksSteps: ['Pick the service to see what is covered.', 'Continue to booking and choose the upholstery tasks you need.', 'Review the amount and confirm your slot.'] },
  { id: 'mattress', label: 'Mattress Cleaning', emoji: '🛏️', isActive: true, sortOrder: 5, description: 'Deep mattress cleaning and sanitization for healthier sleep spaces.', highlights: ['Sanitization', 'Dust removal', 'Spot treatment'], mode: 'customize', headline: 'Mattress and sleep-surface cleaning for a fresher bedroom setup.', inclusionsTitle: 'Popular mattress tasks', idealFor: ['Dust-sensitive homes', 'Spot treatment', 'Bedroom hygiene upgrades'], howItWorksTitle: 'How this works', howItWorksSteps: ['Open the category to see the active services.', 'Continue to booking and select the items you need.', 'Review the amount and confirm your slot.'] },
  { id: 'balcony_window', label: 'Balcony & Window', emoji: '🪟', isActive: true, sortOrder: 6, description: 'Window tracks, glass, balcony wash and utility-area detailing.', highlights: ['Glass cleaning', 'Utility detailing', 'Balcony wash'], mode: 'customize', headline: 'Exterior-adjacent cleaning for windows, tracks, balconies and utility edges.', inclusionsTitle: 'Popular balcony and window tasks', idealFor: ['Dusty balconies', 'Track and frame cleanup', 'Utility-area detailing'], howItWorksTitle: 'How this works', howItWorksSteps: ['See the active tasks in this category.', 'Continue to booking and choose the services you need.', 'Review the amount and confirm your slot.'] },
  { id: 'move_in_out', label: 'Move-in / Move-out', emoji: '📦', isActive: true, sortOrder: 7, description: 'Best for handovers, empty flats and pre-move/post-move home cleaning.', highlights: ['Area-based estimate', 'Vacant-home cleaning', 'Shift-ready service'], mode: 'customize', headline: 'Move-in and move-out cleaning with instant amount calculation after you enter your home area.', inclusionsTitle: 'Usually covered', idealFor: ['Tenant handover', 'Pre-possession cleanup', 'Move-in preparation before shifting'], howItWorksTitle: 'How this works', howItWorksSteps: ['Pick the right move-in or move-out option for your home.', 'Enter your home area and get the amount calculated for you.', 'Choose your slot and confirm the booking.'], primaryActionLabel: 'Continue to booking', secondaryActionLabel: 'Browse all deep-cleaning types' },
  { id: 'office', label: 'Office Deep Cleaning', emoji: '🏢', isActive: true, sortOrder: 8, description: 'Commercial and office deep-cleaning requests handled through custom quotes.', highlights: ['Office spaces', 'Commercial scope', 'Custom quote'], mode: 'quote', headline: 'Commercial deep-cleaning for offices and business spaces.', inclusionsTitle: 'Common office tasks', idealFor: ['Office refresh', 'Commercial scope planning', 'Custom team sizing'], howItWorksTitle: 'How this works', howItWorksSteps: ['Review the service scope and common office tasks.', 'Request a custom quote for your office or commercial property.', 'Our team will contact you with the next steps.'], primaryActionLabel: 'Request custom quote', secondaryActionLabel: 'Browse all deep-cleaning types' },
  { id: 'post_construction', label: 'Post-Construction Cleaning', emoji: '🏗️', isActive: true, sortOrder: 9, description: 'Dust, residue and post-worksite cleaning for newly finished spaces.', highlights: ['Post-renovation', 'Heavy dust cleanup', 'Custom quote'], mode: 'quote', headline: 'Post-construction cleanup for heavy dust, residue and finishing work.', inclusionsTitle: 'Typical post-worksite cleanup', idealFor: ['Newly renovated homes', 'Builder handover', 'Dust-heavy properties'], howItWorksTitle: 'How this works', howItWorksSteps: ['Review the cleanup scope for your property.', 'Request a quote for the site size and condition.', 'Our team will contact you with the next steps.'], primaryActionLabel: 'Request custom quote', secondaryActionLabel: 'Browse all deep-cleaning types' },
  { id: 'appliances', label: 'Appliances', emoji: '💨', isActive: true, sortOrder: 10, description: 'Single-purpose cleaning for fans, chimneys and appliance-focused tasks.', highlights: ['Fast booking', 'Appliance-only', 'Easy add-ons'], mode: 'customize', headline: 'Focused appliance cleaning without booking a full-room package.', inclusionsTitle: 'Popular appliance tasks', idealFor: ['Appliance-only visits', 'Chimney refresh', 'Quick maintenance cleaning'], howItWorksTitle: 'How this works', howItWorksSteps: ['Review the appliance tasks available.', 'Continue to booking and choose what you need.', 'Review the amount and confirm your slot.'] },
  { id: 'furniture', label: 'Furniture', emoji: '🪑', isActive: true, sortOrder: 11, description: 'Sofa sets, dining areas and fabric furniture cleaning with clear pricing.', highlights: ['Furniture care', 'Seat-based services', 'Add to cart'], mode: 'customize', headline: 'Furniture-focused cleaning that fits neatly into a custom builder flow.', inclusionsTitle: 'Popular furniture tasks', idealFor: ['Dining-area refresh', 'Furniture detailing', 'Living-space upkeep'], howItWorksTitle: 'How this works', howItWorksSteps: ['Review the furniture tasks available in this category.', 'Continue to booking and add the services you need.', 'Review the amount and confirm your slot.'] },
];

const DEFAULT_PAGE_CONTENT = {
  heroBadge: 'Professional home care',
  heroTitle: 'Deep Cleaning Services',
  heroSubtitle: 'Choose the right deep cleaning service for your home, move-in, move-out, kitchen, bathroom and more.',
  categoriesTitle: 'Choose a deep cleaning service',
  categoriesSubtitle: 'Pick a category, enter your requirements and get the final amount based on your home details.',
  miniServicesTitle: 'Popular mini services',
  miniServicesSubtitle: 'Add-on services for specific areas and appliances.',
};

async function ensureConfig() {
  const existing = await DeepCleaningConfig.findOne();
  if (!existing) {
    return DeepCleaningConfig.create({ minimumCartValue: 500, categories: DEFAULT_CATEGORIES, pageContent: DEFAULT_PAGE_CONTENT, items: DEFAULT_ITEMS });
  }

  let dirty = false;

  // Migrate: add default categories if missing
  if (!existing.categories || existing.categories.length === 0) {
    existing.categories = DEFAULT_CATEGORIES;
    dirty = true;
  } else {
    const defaultsById = new Map(DEFAULT_CATEGORIES.map(category => [category.id, category]));
    const currentCategories = existing.categories.map(category => category.toObject?.() ?? category);
    const mergedCategories = currentCategories.map((category) => {
      const defaults = defaultsById.get(category.id);
      return defaults ? { ...defaults, ...category } : category;
    });

    if (JSON.stringify(currentCategories) !== JSON.stringify(mergedCategories)) {
      existing.categories = mergedCategories;
      dirty = true;
    }
  }

  if (!existing.pageContent) {
    existing.pageContent = DEFAULT_PAGE_CONTENT;
    dirty = true;
  }

  const existingItemIds = new Set((existing.items || []).map(item => item.id));
  const missingItems = DEFAULT_ITEMS.filter(item => !existingItemIds.has(item.id));
  if (missingItems.length > 0) {
    existing.items = [...(existing.items || []), ...missingItems];
    dirty = true;
  }

  if (dirty) await existing.save();
  return existing;
}

const DEFAULT_ITEMS = [
  // ── BATHROOM ───────────────────────────────────────────────────────────────
  { id: 'washroom_basic', category: 'bathroom', name: 'Basic Washroom Clean',
    description: 'Floor, toilet seat, mirror & washbasin', pricingType: 'per_unit',
    price: 200, unit: 'bathroom', icon: '🚿', sortOrder: 1 },
  { id: 'washroom_deep', category: 'bathroom', name: 'Intense Washroom Deep Clean',
    description: 'Machine scrub walls & floors, taps & fixtures, shower, tiles, exhaust', pricingType: 'per_unit',
    price: 500, unit: 'bathroom', icon: '🧹', sortOrder: 2 },

  // ── KITCHEN ────────────────────────────────────────────────────────────────
  { id: 'kitchen_deep', category: 'kitchen', name: 'Kitchen Deep Cleaning',
    description: 'Full kitchen deep clean — price by home size', pricingType: 'tiered',
    tiers: [
      { label: '2 BHK', price: 2600 },
      { label: '3 BHK', price: 3200 },
      { label: '4 BHK', price: 4000 },
      { label: '5 BHK', price: 4500 }
    ], icon: '🍳', sortOrder: 3 },
  { id: 'kitchen_chimney', category: 'kitchen', name: 'Kitchen Chimney Cleaning',
    description: 'Deep clean chimney filters and hood', pricingType: 'per_unit',
    price: 500, unit: 'chimney', icon: '🏭', sortOrder: 4 },

  // ── FURNITURE ──────────────────────────────────────────────────────────────
  { id: 'sofa_34', category: 'furniture', name: 'Sofa Wet Shampoo 3/4 Seater',
    description: 'Fabric or leather — 3 to 4 seater', pricingType: 'per_unit',
    price: 449, unit: 'sofa', icon: '🛋️', sortOrder: 5 },
  { id: 'sofa_56', category: 'furniture', name: 'Sofa Wet Shampoo 5/6 Seater',
    description: 'Fabric or leather — 5 to 6 seater', pricingType: 'per_unit',
    price: 649, unit: 'sofa', icon: '🛋️', sortOrder: 6 },
  { id: 'sofa_7plus', category: 'furniture', name: 'Sofa Wet Shampoo 7+ Seater',
    description: 'Fabric or leather — 7 seater and above', pricingType: 'per_unit',
    price: 849, unit: 'sofa', icon: '🛋️', sortOrder: 7 },
  { id: 'dining_table', category: 'furniture', name: 'Dining Table Clean',
    description: 'Deep clean dining table and chairs', pricingType: 'fixed',
    price: 499, icon: '🍽️', sortOrder: 8 },

  // ── APPLIANCES ─────────────────────────────────────────────────────────────
  { id: 'fan_clean', category: 'appliances', name: 'Fan Cleaning',
    description: 'Per ceiling or wall fan', pricingType: 'per_unit',
    price: 100, unit: 'fan', maxQty: 20, icon: '💨', sortOrder: 9 },

  // ── FULL HOUSE ─────────────────────────────────────────────────────────────
  { id: 'fullhouse_bare', category: 'fullhouse', name: 'Full House Deep Clean — Bare Flat',
    description: 'Unfurnished / empty flat, charged per sq ft', pricingType: 'per_sqft',
    price: 8, unit: 'sqft', icon: '🏠', sortOrder: 10 },
  { id: 'fullhouse_furnished', category: 'fullhouse', name: 'Full House Deep Clean — Furnished',
    description: 'Fully furnished flat with all belongings, per sq ft', pricingType: 'per_sqft',
    price: 12, unit: 'sqft', icon: '🏡', sortOrder: 11 },
  { id: 'move_in_out_empty', category: 'move_in_out', name: 'Move-in Cleaning — Empty Home',
    description: 'For vacant homes before shifting in. Enter your home area and get the final amount instantly.', pricingType: 'per_sqft',
    price: 8, unit: 'sqft', icon: '📦', sortOrder: 12 },
  { id: 'move_in_out_furnished', category: 'move_in_out', name: 'Move-out Cleaning — Furnished Home',
    description: 'For occupied or recently vacated homes with furniture and belongings.', pricingType: 'per_sqft',
    price: 12, unit: 'sqft', icon: '🏠', sortOrder: 13 }
];

const buildDeepCleaningSnapshot = (source = {}) => ({
  items: source.items || [],
  categories: source.categories || [],
  pageContent: { ...DEFAULT_PAGE_CONTENT, ...(source.pageContent || {}) },
  minimumCartValue: Number(source.minimumCartValue ?? 0),
});

const buildVerifiedCartItems = (cartItems, config) => {
  let calculatedTotal = 0;

  const verifiedCartItems = (cartItems || []).map(item => {
    const configItem = config.items.find(i => i.id === item.itemId);
    if (!configItem) return null;

    let totalPrice = 0;
    const qty = Math.max(1, Number(item.qty) || 1);
    const areaValue = item.areaValue != null ? Math.max(0, Number(item.areaValue) || 0) : null;

    if (configItem.pricingType === 'per_sqft') {
      totalPrice = configItem.price * (areaValue || 0);
    } else if (configItem.pricingType === 'tiered') {
      const tier = configItem.tiers?.find(t => t.label === item.selectedTier);
      totalPrice = tier ? tier.price * qty : 0;
    } else {
      totalPrice = configItem.price * qty;
    }

    calculatedTotal += totalPrice;

    return {
      itemId: configItem.id,
      name: configItem.pricingType === 'per_sqft' && areaValue
        ? `${configItem.name} (${areaValue} ${configItem.unit || 'sqft'})`
        : configItem.name,
      category: configItem.category,
      qty,
      unitPrice: configItem.price,
      totalPrice,
      selectedTier: configItem.pricingType === 'tiered'
        ? (item.selectedTier || null)
        : configItem.pricingType === 'per_sqft' && areaValue
          ? `${areaValue} ${configItem.unit || 'sqft'}`
          : item.selectedTier || null,
      areaValue,
    };
  }).filter(Boolean);

  return { verifiedCartItems, calculatedTotal };
};

const getDeepCleaningService = async () => {
  const directMatch = await Service.findOne({
    serviceCategory: 'deep_cleaning',
    isActive: true,
  })
    .select('_id name serviceType workerSearchRadiusKm')
    .sort({ displayOrder: 1, createdAt: 1 })
    .lean();

  if (directMatch) {
    return directMatch;
  }

  return Service.findOne({
    isActive: true,
    $or: [
      { serviceType: { $regex: '^deep_cleaning', $options: 'i' } },
      { name: { $regex: 'deep cleaning|move in|move out', $options: 'i' } },
    ],
  })
    .select('_id name serviceType workerSearchRadiusKm')
    .sort({ createdAt: 1 })
    .lean();
};

const getCustomerAddressContext = (customer) => {
  const defaultAddress = customer?.addresses?.find(a => a.isDefault)
    || customer?.addresses?.[0]
    || null;

  return {
    defaultAddress,
    savedCoordinates: defaultAddress?.location?.coordinates || customer?.currentLocation?.coordinates || null,
  };
};

const normalizeCustomerLocationInput = (customerLocation = {}) => {
  const latitude = Number(customerLocation?.lat ?? customerLocation?.latitude);
  const longitude = Number(customerLocation?.lng ?? customerLocation?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    address: customerLocation?.address || '',
    area: customerLocation?.area || '',
    city: customerLocation?.city || '',
    state: customerLocation?.state || '',
    zipCode: customerLocation?.zipCode || '',
    serviceAreaId: customerLocation?.serviceAreaId || null,
  };
};

const findCoveringLocation = async ({ longitude, latitude, maxDistance }) => {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }

  return Location.findOne({
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
        $maxDistance: maxDistance,
      },
    },
    isActive: true,
  }).lean();
};

// ─── GET /api/deep-cleaning/config  (public — customers & admins) ───────────
router.get('/config', async (req, res) => {
  try {
    const config = await ensureConfig();
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: { message: err.message, status: 500 } });
  }
});

// ─── PUT /api/deep-cleaning/config  (super admin only) ───────────────────────
router.put('/config', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { items, minimumCartValue, categories, pageContent } = req.body;
    let config = await DeepCleaningConfig.findOne();
    if (!config) config = new DeepCleaningConfig();

    if (items !== undefined) config.items = items;
    if (minimumCartValue !== undefined) config.minimumCartValue = Number(minimumCartValue);
    if (categories !== undefined) config.categories = categories;
    if (pageContent !== undefined) config.pageContent = { ...DEFAULT_PAGE_CONTENT, ...pageContent };
    config.updatedBy = req.user._id;

    await config.save();
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: { message: err.message, status: 500 } });
  }
});

// ─── GET /api/deep-cleaning/change-requests  (admin own, super admin all) ───
router.get('/change-requests', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    const query = {};

    if (status !== 'all') query.status = status;
    if (req.user.role === 'admin') query.requestedBy = req.user._id;

    const requests = await DeepCleaningChangeRequest.find(query)
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name role')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ error: { message: err.message, status: 500 } });
  }
});

// ─── POST /api/deep-cleaning/change-requests  (admin only) ─────────────────
router.post('/change-requests', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { title, requestNote = '', proposedConfig } = req.body || {};

    if (!title?.trim()) {
      return res.status(400).json({ error: { message: 'Title is required', status: 400 } });
    }

    if (!proposedConfig || !Array.isArray(proposedConfig.items) || !Array.isArray(proposedConfig.categories)) {
      return res.status(400).json({ error: { message: 'A valid proposed config is required', status: 400 } });
    }

    const request = await DeepCleaningChangeRequest.create({
      title: title.trim(),
      requestNote,
      proposedConfig: buildDeepCleaningSnapshot(proposedConfig),
      requestedBy: req.user._id,
    });

    const hydratedRequest = await DeepCleaningChangeRequest.findById(request._id)
      .populate('requestedBy', 'name email role')
      .lean();

    res.status(201).json({ success: true, request: hydratedRequest });
  } catch (err) {
    res.status(500).json({ error: { message: err.message, status: 500 } });
  }
});

// ─── POST /api/deep-cleaning/change-requests/:id/review (super admin only) ─
router.post('/change-requests/:id/review', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNote = '' } = req.body || {};

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: { message: 'Status must be approved or rejected', status: 400 } });
    }

    const request = await DeepCleaningChangeRequest.findById(id);
    if (!request) {
      return res.status(404).json({ error: { message: 'Change request not found', status: 404 } });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: { message: 'Only pending requests can be reviewed', status: 400 } });
    }

    let config = null;

    if (status === 'approved') {
      config = await DeepCleaningConfig.findOne();
      if (!config) config = new DeepCleaningConfig();

      config.items = request.proposedConfig.items;
      config.categories = request.proposedConfig.categories;
      config.pageContent = { ...DEFAULT_PAGE_CONTENT, ...(request.proposedConfig.pageContent || {}) };
      config.minimumCartValue = Number(request.proposedConfig.minimumCartValue ?? 0);
      config.updatedBy = req.user._id;
      await config.save();
    }

    request.status = status;
    request.reviewNote = reviewNote;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    const hydratedRequest = await DeepCleaningChangeRequest.findById(request._id)
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name role')
      .lean();

    res.json({ success: true, request: hydratedRequest, config });
  } catch (err) {
    res.status(500).json({ error: { message: err.message, status: 500 } });
  }
});

// ─── POST /api/deep-cleaning/estimate  (customers only) ─────────────────────
router.post('/estimate', authenticate, authorize('customer'), async (req, res) => {
  try {
    const { cartItems } = req.body;

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: { message: 'Cart items are required', status: 400 } });
    }

    const config = await ensureConfig();
    const { verifiedCartItems, calculatedTotal } = buildVerifiedCartItems(cartItems, config);

    if (verifiedCartItems.length === 0) {
      return res.status(400).json({ error: { message: 'No valid items in cart', status: 400 } });
    }

    res.json({
      success: true,
      verifiedCartItems,
      totalAmount: calculatedTotal,
      minimumCartValue: config.minimumCartValue,
    });
  } catch (err) {
    console.error('Deep cleaning estimate error:', err);
    res.status(500).json({ error: { message: err.message, status: 500 } });
  }
});

// ─── POST /api/deep-cleaning/availability  (customers only) ─────────────────
router.post('/availability', authenticate, authorize('customer'), async (req, res) => {
  try {
    const deepCleaningService = await getDeepCleaningService();

    if (!deepCleaningService) {
      return res.status(404).json({ error: { message: 'Deep cleaning service is not configured', status: 404 } });
    }

    const customer = await User.findById(req.user._id)
      .select('addresses currentLocation name')
      .lean();

    const providedLocation = normalizeCustomerLocationInput(req.body?.customerLocation || req.body);
    const { defaultAddress, savedCoordinates } = getCustomerAddressContext(customer);

    const latitude = providedLocation?.latitude ?? (savedCoordinates ? Number(savedCoordinates[1]) : null);
    const longitude = providedLocation?.longitude ?? (savedCoordinates ? Number(savedCoordinates[0]) : null);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({
        error: {
          message: 'Select your location before checking deep-cleaning availability',
          status: 400,
        },
      });
    }

    const serviceRadiusKm = Number(deepCleaningService.workerSearchRadiusKm || 50);
    const coveringLocation = await findCoveringLocation({
      longitude,
      latitude,
      maxDistance: serviceRadiusKm * 1000,
    });

    res.json({
      success: true,
      serviceId: deepCleaningService._id,
      serviceName: deepCleaningService.name,
      available: Boolean(coveringLocation),
      radiusKm: serviceRadiusKm,
      location: {
        lat: latitude,
        lng: longitude,
        address: providedLocation?.address || defaultAddress?.street || '',
        area: providedLocation?.area || defaultAddress?.area || '',
        city: providedLocation?.city || defaultAddress?.city || '',
        state: providedLocation?.state || defaultAddress?.state || '',
        zipCode: providedLocation?.zipCode || defaultAddress?.zipCode || '',
        serviceAreaId: providedLocation?.serviceAreaId || coveringLocation?._id || null,
      },
      serviceLocation: coveringLocation
        ? {
            id: coveringLocation._id,
            name: coveringLocation.apartmentName,
            area: coveringLocation.area,
            city: coveringLocation.city,
          }
        : null,
      message: coveringLocation
        ? 'Deep cleaning is available in your selected area.'
        : 'Deep cleaning is not available in your selected area yet. You can request service for this location.',
    });
  } catch (err) {
    console.error('Deep cleaning availability error:', err);
    res.status(500).json({ error: { message: err.message, status: 500 } });
  }
});

// ─── POST /api/deep-cleaning/booking  (customers only) ───────────────────────
router.post('/booking', authenticate, authorize('customer'), async (req, res) => {
  try {
    const { cartItems, bookingDate, startTime, address, customerLocation } = req.body;

    if (!cartItems?.length) {
      return res.status(400).json({ error: { message: 'Cart is empty', status: 400 } });
    }

    if (!bookingDate || !startTime) {
      return res.status(400).json({ error: { message: 'Booking date and time are required', status: 400 } });
    }

    const config = await ensureConfig();

    // ── Server-side price recalculation (never trust client amounts) ──────────
    const { verifiedCartItems, calculatedTotal } = buildVerifiedCartItems(cartItems, config);

    if (verifiedCartItems.length === 0) {
      return res.status(400).json({ error: { message: 'No valid items in cart', status: 400 } });
    }

    if (calculatedTotal < config.minimumCartValue) {
      return res.status(400).json({
        error: { message: `Minimum cart value is ₹${config.minimumCartValue}`, status: 400 }
      });
    }

    // Build endTime: deep cleaning sessions default to 3 hours
    const [h, m] = startTime.split(':').map(Number);
    const endH = (h + 3) % 24;
    const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    // Get customer location
    const customer = await User.findById(req.user._id)
      .select('addresses currentLocation name')
      .lean();

    const { defaultAddress, savedCoordinates } = getCustomerAddressContext(customer);
    const requestedLocation = normalizeCustomerLocationInput(customerLocation);

    // Fetch deep cleaning service radius configured by admin (serviceCategory: deep_cleaning)
    const deepCleanServiceDoc = await getDeepCleaningService();
    const deepCleanRadiusMeters = (deepCleanServiceDoc?.workerSearchRadiusKm || 50) * 1000;

    const customerLng = requestedLocation?.longitude ?? (savedCoordinates ? Number(savedCoordinates[0]) : null);
    const customerLat = requestedLocation?.latitude ?? (savedCoordinates ? Number(savedCoordinates[1]) : null);

    if (!Number.isFinite(customerLng) || !Number.isFinite(customerLat)) {
      return res.status(400).json({
        error: {
          message: 'Select your location before booking deep cleaning',
          status: 400,
        },
      });
    }

    // $near lookup to resolve the Location doc (needed for admin region filter + worker assignment)
    const nearbyLocation = await findCoveringLocation({
      longitude: customerLng,
      latitude: customerLat,
      maxDistance: deepCleanRadiusMeters,
    });

    if (!nearbyLocation) {
      return res.status(403).json({
        error: {
          message: 'Deep cleaning is not available in your selected location. Please request service for this area.',
          status: 403,
        },
        serviceUnavailable: true,
        serviceId: deepCleanServiceDoc?._id || null,
      });
    }

    const locationData = address || {
      locationId:    requestedLocation?.serviceAreaId || nearbyLocation?._id || null,
      apartmentName: defaultAddress?.apartment  || nearbyLocation?.apartmentName || '',
      area:          requestedLocation?.area     || defaultAddress?.area || nearbyLocation?.area || '',
      city:          requestedLocation?.city     || defaultAddress?.city || nearbyLocation?.city || '',
      address:       requestedLocation?.address  || defaultAddress?.street || ''
    };

    const notesSummary = verifiedCartItems
      .map(i => `${i.name} x${i.qty} = ₹${i.totalPrice}`)
      .join(', ');

    const booking = await Booking.create({
      customer:     req.user._id,
      service:      deepCleanServiceDoc?._id,
      bookingType:  'deep-cleaning-cart',
      bookingDate:  new Date(bookingDate),
      startTime,
      endTime,
      totalAmount:  calculatedTotal,
      cartItems:    verifiedCartItems,
      location:     locationData,
      notes:        `Deep Cleaning Cart: ${notesSummary}`,
      status:       'pending'
    });

    // Notify admins
    try {
      const superAdmins = await User.find({ role: 'super_admin', isActive: true }).select('_id').lean();
      for (const sa of superAdmins) {
        await notificationService.sendNotification({
          userId:  sa._id,
          type:    'booking',
          title:   'New Deep Cleaning Booking',
          message: `New cart booking of ₹${calculatedTotal} from ${customer.name || 'customer'}`,
          data:    { bookingId: booking._id }
        });
      }
    } catch (notifErr) {
      console.error('Notification error (non-fatal):', notifErr.message);
    }

    // Auto-assign a worker (same pattern as standard bookings)
    try {
      const assignmentResult = await assignWorkersWithBackup({
        customerId:  req.user._id,
        bookingDate: booking.bookingDate,
        startTime:   booking.startTime,
        endTime:     booking.endTime,
        location:    locationData,
        bookingType: 'deep-cleaning-cart'
      });

      if (assignmentResult.success) {
        booking.worker           = assignmentResult.primaryWorker;
        booking.backupWorkers    = assignmentResult.backupWorkers || [];
        booking.assignmentMethod = assignmentResult.assignmentMethod;
        booking.assignedAt       = new Date();
        booking.status           = 'confirmed';
        booking.confirmedAt      = new Date();
        await booking.save();
        // Notify assigned worker
        notificationService.sendTemplatedNotification(assignmentResult.primaryWorker, 'WORKER_ASSIGNED', {
          bookingId: booking._id,
          workerName: 'Worker',
          serviceName: '✨ Deep Cleaning',
          date: bookingDate,
          time: startTime
        }).catch(() => {});
      } else {
        // Fallback to preference-based assignment
        const fallbackResult = await findWorkerWithPreferences({
          customerId: req.user._id,
          bookingDate: booking.bookingDate,
          startTime:   booking.startTime,
          endTime:     booking.endTime,
          location:    locationData,
          radius:      deepCleanRadiusMeters
        }, Booking);
        if (fallbackResult.success) {
          booking.worker           = fallbackResult.worker._id;
          booking.assignmentMethod = fallbackResult.assignmentMethod;
          booking.assignedAt       = new Date();
          booking.status           = 'confirmed';
          booking.confirmedAt      = new Date();
          await booking.save();
          // Notify assigned worker
          notificationService.sendTemplatedNotification(fallbackResult.worker._id, 'WORKER_ASSIGNED', {
            bookingId: booking._id,
            workerName: fallbackResult.worker.name || 'Worker',
            serviceName: '✨ Deep Cleaning',
            date: bookingDate,
            time: startTime
          }).catch(() => {});
        }
      }
    } catch (assignErr) {
      console.error('Worker assignment error (non-fatal):', assignErr.message);
    }

    const finalBooking = await Booking.findById(booking._id).populate('worker', 'name phone workerProfile').lean();
    res.status(201).json({ success: true, booking: finalBooking, totalAmount: calculatedTotal });
  } catch (err) {
    console.error('Deep cleaning booking error:', err);
    res.status(500).json({ error: { message: err.message, status: 500 } });
  }
});

export default router;
