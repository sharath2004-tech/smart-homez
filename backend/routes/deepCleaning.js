import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import Booking from '../models/Booking.js';
import DeepCleaningConfig from '../models/DeepCleaningConfig.js';
import Location from '../models/Location.js';
import User from '../models/User.js';
import { assignWorkersWithBackup } from '../utils/advancedWorkerAssignment.js';
import notificationService from '../utils/notificationService.js';
import { findWorkerWithPreferences } from '../utils/preferenceAssignment.js';

const router = express.Router();

// ─── seed / ensure config exists ───────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id: 'fullhouse',        label: 'Full Home Deep Cleaning',    emoji: '🏡', isActive: true, sortOrder: 1 },
  { id: 'bathroom',         label: 'Bathroom Cleaning',          emoji: '🚿', isActive: true, sortOrder: 2 },
  { id: 'kitchen',          label: 'Kitchen Cleaning',           emoji: '🍳', isActive: true, sortOrder: 3 },
  { id: 'sofa_upholstery',  label: 'Sofa & Upholstery',         emoji: '🛋️', isActive: true, sortOrder: 4 },
  { id: 'mattress',         label: 'Mattress Cleaning',          emoji: '🛏️', isActive: true, sortOrder: 5 },
  { id: 'balcony_window',   label: 'Balcony & Window',           emoji: '🪟', isActive: true, sortOrder: 6 },
  { id: 'move_in_out',      label: 'Move-in / Move-out',         emoji: '📦', isActive: true, sortOrder: 7 },
  { id: 'office',           label: 'Office Deep Cleaning',       emoji: '🏢', isActive: true, sortOrder: 8 },
  { id: 'post_construction',label: 'Post-Construction Cleaning', emoji: '🏗️', isActive: true, sortOrder: 9 },
  { id: 'appliances',       label: 'Appliances',                 emoji: '💨', isActive: true, sortOrder: 10 },
  { id: 'furniture',        label: 'Furniture',                  emoji: '🪑', isActive: true, sortOrder: 11 },
];

async function ensureConfig() {
  const existing = await DeepCleaningConfig.findOne();
  if (!existing) {
    return DeepCleaningConfig.create({ minimumCartValue: 500, categories: DEFAULT_CATEGORIES, items: DEFAULT_ITEMS });
  }

  let dirty = false;

  // Migrate: add default categories if missing
  if (!existing.categories || existing.categories.length === 0) {
    existing.categories = DEFAULT_CATEGORIES;
    dirty = true;
  }

  // Auto-migrate stale prices for per_sqft items
  const priceUpdates = { fullhouse_bare: 8, fullhouse_furnished: 12 };
  existing.items = existing.items.map(item => {
    if (priceUpdates[item.id] !== undefined && item.pricingType === 'per_sqft' && item.price !== priceUpdates[item.id]) {
      dirty = true;
      return { ...item.toObject?.() ?? item, price: priceUpdates[item.id] };
    }
    return item;
  });
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
    price: 12, unit: 'sqft', icon: '🏡', sortOrder: 11 }
];

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
    const { items, minimumCartValue, categories } = req.body;
    let config = await DeepCleaningConfig.findOne();
    if (!config) config = new DeepCleaningConfig();

    if (items !== undefined) config.items = items;
    if (minimumCartValue !== undefined) config.minimumCartValue = Number(minimumCartValue);
    if (categories !== undefined) config.categories = categories;
    config.updatedBy = req.user._id;

    await config.save();
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: { message: err.message, status: 500 } });
  }
});

// ─── POST /api/deep-cleaning/booking  (customers only) ───────────────────────
router.post('/booking', authenticate, authorize('customer'), async (req, res) => {
  try {
    const { cartItems, bookingDate, startTime, address } = req.body;

    if (!cartItems?.length) {
      return res.status(400).json({ error: { message: 'Cart is empty', status: 400 } });
    }

    if (!bookingDate || !startTime) {
      return res.status(400).json({ error: { message: 'Booking date and time are required', status: 400 } });
    }

    const config = await ensureConfig();

    // ── Server-side price recalculation (never trust client amounts) ──────────
    let calculatedTotal = 0;
    const verifiedCartItems = cartItems.map(item => {
      const configItem = config.items.find(i => i.id === item.itemId);
      if (!configItem) return null; // skip unknown items

      let totalPrice = 0;
      const qty = Math.max(1, Number(item.qty) || 1);

      if (configItem.pricingType === 'per_sqft') {
        const sqft = Math.max(0, Number(item.selectedTier) || 0);
        totalPrice = configItem.price * sqft;
      } else if (configItem.pricingType === 'tiered') {
        const tier = configItem.tiers?.find(t => t.label === item.selectedTier);
        totalPrice = tier ? tier.price * qty : 0;
      } else {
        // per_unit or fixed
        totalPrice = configItem.price * qty;
      }

      calculatedTotal += totalPrice;
      return {
        itemId:       item.itemId,
        name:         configItem.name,
        category:     configItem.category,
        qty,
        unitPrice:    configItem.price,
        totalPrice,
        selectedTier: item.selectedTier || null
      };
    }).filter(Boolean);

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

    const defaultAddress = customer?.addresses?.find(a => a.isDefault)
      || customer?.addresses?.[0];

    // Resolve coordinates from saved address or current location
    const coords = defaultAddress?.location?.coordinates || customer?.currentLocation?.coordinates;
    const [customerLng, customerLat] = coords || [null, null];

    // $near lookup to resolve the Location doc (needed for admin region filter + worker assignment)
    let nearbyLocation = null;
    if (customerLng != null && customerLat != null) {
      nearbyLocation = await Location.findOne({
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [customerLng, customerLat] },
            $maxDistance: 5000
          }
        },
        isActive: true
      });
    }

    const locationData = address || {
      locationId:    nearbyLocation?._id || null,
      apartmentName: defaultAddress?.apartment  || nearbyLocation?.apartmentName || '',
      area:          defaultAddress?.area        || nearbyLocation?.area || '',
      city:          defaultAddress?.city        || nearbyLocation?.city || '',
      address:       defaultAddress?.street      || ''
    };

    const notesSummary = verifiedCartItems
      .map(i => `${i.name} x${i.qty} = ₹${i.totalPrice}`)
      .join(', ');

    const booking = await Booking.create({
      customer:     req.user._id,
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
          radius:      5000
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
