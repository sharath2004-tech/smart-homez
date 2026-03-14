/**
 * Healthy Homez — Official Pricing Seed
 * Replaces all existing services with the official price list.
 *
 * Services:
 *   1. Washroom Cleaning Subscription Monthly Pack
 *   2. Daily Housekeeping Service Monthly Pack
 *   3. Ad Hoc Instant Help
 *   4. Deep Cleaning — Commercial & Residential (Custom Quote)
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Service from './models/Service.js';
import User from './models/User.js';

dotenv.config();

async function seedPricing() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected\n');

    const superAdmin = await User.findOne({ role: 'super_admin' });
    if (!superAdmin) {
      console.error('❌ No super_admin found. Run seedAdmins.js first.');
      process.exit(1);
    }
    const createdBy = superAdmin._id;

    // Clear all existing services
    const deleted = await Service.deleteMany({});
    console.log(`🗑️  Deleted ${deleted.deletedCount} existing services\n`);

    const services = [

      // ─────────────────────────────────────────────────
      // 1. WASHROOM CLEANING SUBSCRIPTION MONTHLY PACK
      //    1 Deep Cleaning + 3 Basic Cleanings / month
      // ─────────────────────────────────────────────────
      {
        name: 'Washroom Cleaning Monthly Pack',
        description: 'Monthly subscription — includes 1 Deep Cleaning + 3 Basic Cleanings per washroom. A dedicated worker visits on a fixed schedule every month.',
        category: 'cleaning',
        serviceType: 'fixed_washroom_deep',
        price: 1100,
        duration: 60,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionOptions: {
          enabled: true,
          minContractMonths: 1,
          maxContractMonths: 12,
          allowedFrequencies: ['custom'],
          autoRenewal: true,
          requiresSameWorker: true
        },
        sizeParameters: {
          enabled: true,
          sizeType: 'quantity',
          options: [
            { value: '1', label: '1 Washroom', price: 1100, duration: 60,  workersRequired: 1 },
            { value: '2', label: '2 Washrooms', price: 2000, duration: 120, workersRequired: 1 },
            { value: '3', label: '3 Washrooms', price: 3000, duration: 180, workersRequired: 1 }
          ]
        },
        subscriptionPlans: [
          {
            id: 'monthly',
            name: 'monthly',
            displayName: 'Monthly Pack',
            icon: '🗓️',
            description: '1 Deep Cleaning + 3 Basic Cleanings',
            price: 1100,
            discountPercentage: 0,
            isActive: true,
            requiresFixedWorker: true,
            allowDaySelection: false,
            sortOrder: 1
          }
        ],
        tags: ['washroom', 'bathroom', 'subscription', 'monthly', 'deep cleaning', 'basic cleaning'],
        requirements: ['Worker brings all cleaning supplies', 'Customer provides access to washrooms'],
        createdBy
      },

      // ─────────────────────────────────────────────────
      // 2. DAILY HOUSEKEEPING SERVICE MONTHLY PACK
      // ─────────────────────────────────────────────────
      {
        name: 'Daily Housekeeping Monthly Pack',
        description: 'Dedicated maid service every day for a full month. Choose your preferred hours. The same worker visits daily on a fixed schedule.',
        category: 'cleaning',
        serviceType: 'monthly_subscription',
        price: 4500,
        duration: 60,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionOptions: {
          enabled: true,
          minContractMonths: 1,
          maxContractMonths: 12,
          allowedFrequencies: ['daily'],
          autoRenewal: true,
          requiresSameWorker: true
        },
        durationOptions: [
          { hours: 1,   price: 4500,  isDefault: true, minimumHours: 1 },
          { hours: 1.5, price: 6750,  isDefault: false },
          { hours: 2,   price: 9000,  isDefault: false },
          { hours: 2.5, price: 10500, isDefault: false },
          { hours: 3,   price: 12150, isDefault: false },
          { hours: 3.5, price: 13650, isDefault: false }
        ],
        subscriptionPlans: [
          {
            id: 'monthly',
            name: 'monthly',
            displayName: 'Monthly Pack',
            icon: '🗓️',
            description: 'Daily service for the whole month',
            price: 4500,
            discountPercentage: 0,
            isActive: true,
            requiresFixedWorker: true,
            allowDaySelection: false,
            sortOrder: 1
          }
        ],
        tags: ['housekeeping', 'maid', 'daily', 'subscription', 'monthly'],
        requirements: ['Dedicated same worker daily', 'Customer provides access', 'Schedule fixed at booking'],
        createdBy
      },

      // ─────────────────────────────────────────────────
      // 3. AD HOC INSTANT HELP
      // ─────────────────────────────────────────────────
      {
        name: 'Ad Hoc Instant Help',
        description: 'On-demand instant help for your home — no subscription needed. Book for a few hours anytime. Pay only for the time you need.',
        category: 'cleaning',
        serviceType: 'instant_hourly',
        price: 200,
        duration: 60,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        durationOptions: [
          { hours: 1,   price: 200, isDefault: true, minimumHours: 1 },
          { hours: 1.5, price: 300, isDefault: false },
          { hours: 2,   price: 400, isDefault: false }
        ],
        subscriptionPlans: [
          {
            id: 'oneTime',
            name: 'oneTime',
            displayName: 'One-Time',
            icon: '⚡',
            description: 'Book instantly, pay per session',
            price: 200,
            discountPercentage: 0,
            isActive: true,
            requiresFixedWorker: false,
            allowDaySelection: false,
            sortOrder: 1
          }
        ],
        tags: ['instant', 'adhoc', 'on-demand', 'hourly', 'flexible'],
        requirements: ['No advance booking required', 'Subject to worker availability'],
        createdBy
      },

      // ─────────────────────────────────────────────────
      // 4. DEEP CLEANING — COMMERCIAL & RESIDENTIAL
      //    Custom quote — our team contacts customer
      // ─────────────────────────────────────────────────
      {
        name: 'Deep Cleaning — Commercial & Residential',
        description: 'Professional deep cleaning for villas, bungalows, restaurants, and corporate offices. Pricing is customised to your property. Submit your details and our team will call you with a quote.',
        category: 'cleaning',
        serviceType: 'deep_cleaning_commercial',
        price: 0,
        duration: 240,
        isActive: true,
        isQuoteService: true,
        availableInAllLocations: true,
        sizeParameters: {
          enabled: true,
          sizeType: 'quantity',
          options: [
            { value: 'villa',             label: 'Villa',             price: 0, duration: 480 },
            { value: 'bungalow',          label: 'Bungalow',          price: 0, duration: 360 },
            { value: 'restaurant',        label: 'Restaurant',        price: 0, duration: 480 },
            { value: 'corporate_office',  label: 'Corporate Office',  price: 0, duration: 480 }
          ]
        },
        subscriptionPlans: [],
        tags: ['deep cleaning', 'commercial', 'villa', 'bungalow', 'restaurant', 'corporate', 'custom quote', 'residential'],
        requirements: ['Site inspection may be required', 'Team of workers deployed', 'All equipment provided'],
        createdBy
      },

      // ─────────────────────────────────────────
      // 5–12. SPOT CLEAN MINI SERVICES
      //       Individual bookable add-on services
      // ─────────────────────────────────────────

      {
        name: 'Kitchen Deep Clean',
        description: 'Thorough cleaning of oven, fridge exterior, countertops, sink, stove, and cabinets. Grease-free finish guaranteed.',
        category: 'cleaning',
        serviceType: 'deep_cleaning_kitchen',
        price: 399,
        duration: 90,
        isActive: true,
        isQuoteService: false,
        subscriptionOptions: { enabled: false },
        subscriptionPlans: [],
        tags: ['mini-service', 'kitchen', 'spot-clean'],
        requirements: ['Kitchen must be accessible', 'Remove loose items from counters'],
        createdBy
      },

      {
        name: 'Bathroom Deep Clean',
        description: 'Deep scrub of tiles, toilet, basin, shower/tub, mirrors, and floor. Mould and stain removal included.',
        category: 'cleaning',
        serviceType: 'deep_cleaning_bathroom',
        price: 249,
        duration: 45,
        isActive: true,
        isQuoteService: false,
        subscriptionOptions: { enabled: false },
        subscriptionPlans: [],
        tags: ['mini-service', 'bathroom', 'spot-clean'],
        requirements: ['Per bathroom pricing', 'Water supply must be available'],
        createdBy
      },

      {
        name: 'Sofa Cleaning',
        description: 'Steam clean and sanitise fabric or leather sofas. Removes dust, allergens, stains, and odour.',
        category: 'cleaning',
        serviceType: 'fixed_sofa_cleaning',
        price: 499,
        duration: 60,
        isActive: true,
        isQuoteService: false,
        subscriptionOptions: { enabled: false },
        subscriptionPlans: [],
        tags: ['mini-service', 'sofa', 'spot-clean'],
        requirements: ['Per sofa pricing (2-seater/3-seater)', 'Drying time ~2 hours after service'],
        createdBy
      },

      {
        name: 'Carpet Cleaning',
        description: 'Vacuum and steam extraction for all carpet types. Removes deep-seated dirt, stains, and pet hair.',
        category: 'cleaning',
        serviceType: 'fixed_carpet_cleaning',
        price: 349,
        duration: 60,
        isActive: true,
        isQuoteService: false,
        subscriptionOptions: { enabled: false },
        subscriptionPlans: [],
        tags: ['mini-service', 'carpet', 'spot-clean'],
        requirements: ['Minimum 100 sq ft', 'Drying time ~3 hours after service'],
        createdBy
      },

      {
        name: 'Window Cleaning',
        description: 'Inside and outside glass cleaning. Removes dust, water marks, and smudges for a streak-free shine.',
        category: 'cleaning',
        serviceType: 'fixed_window_cleaning',
        price: 299,
        duration: 45,
        isActive: true,
        isQuoteService: false,
        subscriptionOptions: { enabled: false },
        subscriptionPlans: [],
        tags: ['mini-service', 'window', 'spot-clean'],
        requirements: ['Per set of windows', 'Outside access may require extra time'],
        createdBy
      },

      {
        name: 'Fan Cleaning',
        description: 'Dust removal and wipe-down of all ceiling fans. Includes blade, motor cover, and surrounding area.',
        category: 'cleaning',
        serviceType: 'fixed_fan_cleaning',
        price: 149,
        duration: 30,
        isActive: true,
        isQuoteService: false,
        subscriptionOptions: { enabled: false },
        subscriptionPlans: [],
        tags: ['mini-service', 'fan', 'spot-clean'],
        requirements: ['Per fan pricing', 'Step ladder provided by team'],
        createdBy
      },

      {
        name: 'Balcony Cleaning',
        description: 'Full sweep and scrub of balcony floor, grill/railing, ceiling corners, and drain clearing.',
        category: 'cleaning',
        serviceType: 'fixed_balcony_cleaning',
        price: 199,
        duration: 30,
        isActive: true,
        isQuoteService: false,
        subscriptionOptions: { enabled: false },
        subscriptionPlans: [],
        tags: ['mini-service', 'balcony', 'spot-clean'],
        requirements: ['Per balcony pricing', 'Move planters/furniture before service'],
        createdBy
      },

      {
        name: 'Fridge Deep Clean',
        description: 'Interior deep clean including shelves, drawers, door seals, and coil dust removal for energy efficiency.',
        category: 'cleaning',
        serviceType: 'fixed_fridge_cleaning',
        price: 249,
        duration: 45,
        isActive: true,
        isQuoteService: false,
        subscriptionOptions: { enabled: false },
        subscriptionPlans: [],
        tags: ['mini-service', 'fridge', 'spot-clean'],
        requirements: ['Empty fridge before service', 'Fridge turned off 1 hr prior'],
        createdBy
      }

    ];

    const created = await Service.insertMany(services);
    console.log(`✅ Created ${created.length} services:\n`);
    created.forEach((s, i) => console.log(`  ${i + 1}. ${s.name} (${s._id})`));

    console.log('\n' + '='.repeat(60));
    console.log('✅ Pricing seed complete!');
    console.log('='.repeat(60));

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seedPricing();
