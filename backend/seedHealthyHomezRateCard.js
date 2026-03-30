/**
 * Healthy Homez Complete Rate Card Seed
 * ──────────────────────────────────────
 * Seeds:
 *   1. ServiceCatalog categories & subcategories
 *   2. Services linked to those categories with full pricing
 *
 * Rate card categories:
 *   • Insta Help (₹200/hr ad-hoc)
 *   • Subscription Monthly (Washroom + Housekeeping)
 *   • Washroom Cleaning Ad-hoc
 *   • Deep Cleaning Commercial & Residential (quote)
 *   • Mini Service Cleaning List (all items)
 *
 * Usage:  node seedHealthyHomezRateCard.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Service from './models/Service.js';
import ServiceCatalog from './models/ServiceCatalog.js';
import User from './models/User.js';

dotenv.config();

const seed = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected\n');

    const superAdmin = await User.findOne({ role: 'super_admin' });
    if (!superAdmin) {
      console.error('❌ No super_admin found. Run seedAdmins.js first.');
      process.exit(1);
    }

    const createdBy = superAdmin._id;

    // ─── 1. Seed Catalog Categories ────────────────────────────────────

    console.log('📂 Seeding catalog categories...');
    await ServiceCatalog.deleteMany({});

    const catalogDefs = [
      {
        name: 'Insta Help',
        slug: 'insta-help',
        description: 'On-demand instant home help billed by the hour',
        icon: '⚡',
        color: 'amber',
        pricingModel: 'hourly',
        pricingHint: '₹200/hr',
        sortOrder: 1,
        subcategories: [
          { name: 'Ad Hoc Instant Help', slug: 'ad-hoc-instant', icon: '🏃', pricingHint: '₹200 – ₹600', sortOrder: 0, isActive: true, description: 'Book instantly for 1–3 hours' },
        ],
      },
      {
        name: 'Subscription Monthly',
        slug: 'subscription-monthly',
        description: 'Recurring monthly cleaning plans with per-visit pricing',
        icon: '📅',
        color: 'purple',
        pricingModel: 'subscription',
        pricingHint: 'From ₹1,100/mo',
        sortOrder: 2,
        subcategories: [
          { name: 'Washroom Cleaning Subscription', slug: 'washroom-subscription', icon: '🚿', pricingHint: '₹1,100 – ₹3,000', sortOrder: 0, isActive: true, description: '4 visits/month (1 deep + 3 basic)' },
          { name: 'Daily Housekeeping Subscription', slug: 'daily-housekeeping', icon: '🏠', pricingHint: '₹4,500 – ₹13,650', sortOrder: 1, isActive: true, description: 'Daily visits, flexible hours' },
        ],
      },
      {
        name: 'Washroom Cleaning Ad-hoc',
        slug: 'washroom-adhoc',
        description: 'One-time washroom cleaning — basic or deep, priced per washroom',
        icon: '🚿',
        color: 'cyan',
        pricingModel: 'per_unit',
        pricingHint: 'From ₹250',
        sortOrder: 3,
        subcategories: [
          { name: 'Intense Bathroom Deep Cleaning', slug: 'intense-deep', icon: '🧴', pricingHint: '₹600 – ₹2,000', sortOrder: 0, isActive: true, description: 'Heavy descaling & sanitization' },
          { name: 'Basic Washroom Cleaning', slug: 'basic-washroom', icon: '🧹', pricingHint: '₹250 – ₹1,000', sortOrder: 1, isActive: true, description: 'Quick floor, toilet & sink clean' },
        ],
      },
      {
        name: 'Deep Cleaning',
        slug: 'deep-cleaning',
        description: 'Professional full-property deep cleaning for homes & offices',
        icon: '✨',
        color: 'green',
        pricingModel: 'quote',
        pricingHint: 'Get a Quote',
        sortOrder: 4,
        subcategories: [
          { name: 'Full House Deep Clean', slug: 'full-house', icon: '🏡', pricingHint: 'Get Quote', sortOrder: 0, isActive: true, description: 'Complete home deep cleaning packages' },
          { name: 'Room Deep Clean', slug: 'room', icon: '🚪', pricingHint: 'Get Quote', sortOrder: 1, isActive: true, description: '' },
          { name: 'Kitchen Deep Clean', slug: 'kitchen', icon: '🍳', pricingHint: 'Get Quote', sortOrder: 2, isActive: true, description: '' },
          { name: 'Bathroom Deep Clean', slug: 'bathroom', icon: '🚿', pricingHint: 'Get Quote', sortOrder: 3, isActive: true, description: '' },
          { name: 'Commercial / Office Deep Clean', slug: 'commercial', icon: '🏢', pricingHint: 'Get Quote', sortOrder: 4, isActive: true, description: '' },
          { name: 'New Construction Deep Cleaning', slug: 'post-construction', icon: '🏗️', pricingHint: 'Get Quote', sortOrder: 5, isActive: true, description: '' },
          { name: 'Villas', slug: 'villas', icon: '🏘️', pricingHint: 'Get Quote', sortOrder: 6, isActive: true, description: '' },
          { name: 'Bungalows', slug: 'bungalows', icon: '🏠', pricingHint: 'Get Quote', sortOrder: 7, isActive: true, description: '' },
          { name: 'Restaurant', slug: 'restaurant', icon: '🍽️', pricingHint: 'Get Quote', sortOrder: 8, isActive: true, description: '' },
          { name: 'Corporate Office', slug: 'corporate', icon: '🏢', pricingHint: 'Get Quote', sortOrder: 9, isActive: true, description: '' },
        ],
      },
      {
        name: 'Spot / Single-Item Clean',
        slug: 'spot-clean',
        description: 'Individual item or area cleaning — sofa, carpet, window, fan & more',
        icon: '🧽',
        color: 'blue',
        pricingModel: 'fixed',
        pricingHint: 'From ₹100',
        sortOrder: 5,
        subcategories: [
          { name: 'Sofa Cleaning', slug: 'sofa', icon: '🛋️', pricingHint: 'Starts ₹499', sortOrder: 0, isActive: true, description: 'Fabric & leather' },
          { name: 'Carpet Cleaning', slug: 'carpet', icon: '🧶', pricingHint: 'Starts ₹399', sortOrder: 1, isActive: true, description: '' },
          { name: 'Window Cleaning', slug: 'window', icon: '🪟', pricingHint: '₹250 – ₹399', sortOrder: 2, isActive: true, description: 'With or without grill' },
          { name: 'Fan Cleaning', slug: 'fan', icon: '💨', pricingHint: '₹100', sortOrder: 3, isActive: true, description: '' },
          { name: 'Balcony Cleaning', slug: 'balcony', icon: '🏗️', pricingHint: '₹450 – ₹900', sortOrder: 4, isActive: true, description: '' },
          { name: 'Glass Door Cleaning', slug: 'glass-door', icon: '🚪', pricingHint: '₹349', sortOrder: 5, isActive: true, description: '' },
        ],
      },
      {
        name: 'Bathroom / Washroom',
        slug: 'bathroom-washroom',
        description: 'Washroom-specific services — basic clean, deep clean & subscriptions',
        icon: '🚿',
        color: 'indigo',
        pricingModel: 'mixed',
        pricingHint: 'From ₹250',
        sortOrder: 6,
        subcategories: [
          { name: 'Washroom Basic Clean', slug: 'basic', icon: '🧹', pricingHint: '₹250+', sortOrder: 0, isActive: true, description: '' },
          { name: 'Washroom Deep Clean', slug: 'deep', icon: '🧴', pricingHint: '₹600+', sortOrder: 1, isActive: true, description: '' },
        ],
      },
      {
        name: 'Kitchen & Appliances',
        slug: 'kitchen-appliances',
        description: 'Kitchen platform, chimney, stove, fridge & full kitchen packages',
        icon: '🍳',
        color: 'orange',
        pricingModel: 'fixed',
        pricingHint: 'From ₹99',
        sortOrder: 7,
        subcategories: [
          { name: 'Full Kitchen Package', slug: 'kitchen-package', icon: '📦', pricingHint: '₹3,199', sortOrder: 0, isActive: true, description: '' },
          { name: 'Individual Appliances', slug: 'appliances', icon: '🔌', pricingHint: '₹99 – ₹599', sortOrder: 1, isActive: true, description: '' },
        ],
      },
      {
        name: 'Bedroom Essentials',
        slug: 'bedroom',
        description: 'Bed, cupboard, AC & mirror cleaning for bedrooms',
        icon: '🛏️',
        color: 'rose',
        pricingModel: 'fixed',
        pricingHint: 'From ₹79',
        sortOrder: 8,
        subcategories: [
          { name: 'Complete Bedroom Package', slug: 'bedroom-package', icon: '📦', pricingHint: '₹1,599 – ₹2,499', sortOrder: 0, isActive: true, description: '' },
          { name: 'Individual Items', slug: 'bedroom-items', icon: '🪑', pricingHint: '₹79 – ₹549', sortOrder: 1, isActive: true, description: '' },
        ],
      },
      {
        name: 'Furniture Cleaning',
        slug: 'furniture',
        description: 'Dining, cabinets, utility area & more',
        icon: '🪑',
        color: 'emerald',
        pricingModel: 'fixed',
        pricingHint: 'From ₹299',
        sortOrder: 9,
        subcategories: [],
      },
    ];

    const createdCatalogs = [];
    for (const def of catalogDefs) {
      const cat = new ServiceCatalog({ ...def, createdBy });
      await cat.save();
      createdCatalogs.push(cat);
      console.log(`  ✅ ${cat.icon} ${cat.name} (${cat.subcategories.length} subs)`);
    }

    // Helper to find catalog ID by slug
    const catId = (slug) => createdCatalogs.find(c => c.slug === slug)?._id || null;

    // ─── 2. Seed Services ──────────────────────────────────────────────

    console.log('\n🧹 Seeding services...');
    // Don't wipe existing services — upsert by name for safety
    // (If you want a clean slate, uncomment: await Service.deleteMany({});)

    const serviceDefs = [
      // ═══════ INSTA HELP ═══════
      {
        name: 'Insta Help – 1 Hour',
        description: 'On-demand ad-hoc instant home help for 1 hour',
        category: 'cleaning',
        serviceType: 'instant_hourly',
        serviceCategory: 'instant_services',
        price: 200,
        duration: 60,
        catalogCategoryId: catId('insta-help'),
        catalogSubcategory: 'ad-hoc-instant',
        durationOptions: [
          { hours: 1, price: 200, originalPrice: 250, isDefault: true },
          { hours: 1.5, price: 300, originalPrice: 375 },
          { hours: 2, price: 400, originalPrice: 500 },
          { hours: 2.5, price: 500, originalPrice: 625 },
          { hours: 3, price: 600, originalPrice: 750 },
        ],
        tags: ['insta', 'hourly', 'ad-hoc', 'instant'],
        availableInAllLocations: true,
        workerSearchRadiusKm: 2,
        dos: ['Sweeping & mopping', 'Dusting', 'Utensil washing', 'Basic bathroom clean'],
        donts: ['Heavy lifting', 'Pet cleaning', 'Laundry'],
      },

      // ═══════ SUBSCRIPTION MONTHLY — Washroom ═══════
      {
        name: 'Washroom Cleaning Subscription – 1 Washroom',
        description: 'Monthly subscription: 1 Deep Cleaning (45 min) + 3 Basic Cleanings (20 min) for 1 washroom',
        category: 'cleaning',
        serviceType: 'monthly_subscription',
        serviceCategory: 'subscription_services',
        price: 1100,
        duration: 45,
        catalogCategoryId: catId('subscription-monthly'),
        catalogSubcategory: 'washroom-subscription',
        subscriptionPlans: [
          { id: 'washroom-1', name: '1_washroom', displayName: '1 Washroom', icon: '🚿', description: '1 deep + 3 basic per month', price: 1100, discountPercentage: 0, originalPrice: 1350, isActive: true, requiresFixedWorker: false, allowDaySelection: false, sessionsPerMonth: 4, totalMonthlyPrice: 1100, sortOrder: 0 },
          { id: 'washroom-2', name: '2_washrooms', displayName: '2 Washrooms', icon: '🚿', description: '1 deep + 3 basic per month', price: 2000, discountPercentage: 0, originalPrice: 2500, isActive: true, requiresFixedWorker: false, allowDaySelection: false, sessionsPerMonth: 4, totalMonthlyPrice: 2000, sortOrder: 1 },
          { id: 'washroom-3', name: '3_washrooms', displayName: '3 Washrooms', icon: '🚿', description: '1 deep + 3 basic per month', price: 3000, discountPercentage: 0, originalPrice: 3750, isActive: true, requiresFixedWorker: false, allowDaySelection: false, sessionsPerMonth: 4, totalMonthlyPrice: 3000, sortOrder: 2 },
        ],
        subscriptionOptions: { enabled: true, minContractMonths: 1, maxContractMonths: 12, allowedFrequencies: ['weekly'], requiresSameWorker: true, autoRenewal: true },
        tags: ['subscription', 'washroom', 'monthly'],
        availableInAllLocations: true,
      },

      // ═══════ SUBSCRIPTION MONTHLY — Daily Housekeeping ═══════
      {
        name: 'Daily Housekeeping Service',
        description: 'Monthly subscription for daily housekeeping. Choose your preferred hours.',
        category: 'cleaning',
        serviceType: 'monthly_subscription',
        serviceCategory: 'subscription_services',
        price: 4500,
        duration: 60,
        catalogCategoryId: catId('subscription-monthly'),
        catalogSubcategory: 'daily-housekeeping',
        durationOptions: [
          { hours: 1, price: 4500, originalPrice: 5000 },
          { hours: 1.5, price: 6750, originalPrice: 7500 },
          { hours: 2, price: 9000, originalPrice: 10000 },
          { hours: 2.5, price: 10500, originalPrice: 12500 },
          { hours: 3, price: 12150, originalPrice: 13500 },
          { hours: 3.5, price: 13650, originalPrice: 15750 },
        ],
        subscriptionOptions: { enabled: true, minContractMonths: 1, maxContractMonths: 12, allowedFrequencies: ['daily'], requiresSameWorker: true, autoRenewal: true },
        tags: ['subscription', 'daily', 'housekeeping', 'monthly'],
        availableInAllLocations: true,
        dos: ['Sweeping & mopping', 'Dusting', 'Utensil washing', 'Bed making', 'Bathroom clean'],
        donts: ['Heavy deep cleaning', 'Wall washing', 'Pet cleaning'],
      },

      // ═══════ WASHROOM AD-HOC — Intense Deep ═══════
      {
        name: 'Intense Bathroom Deep Cleaning',
        description: 'Thorough deep cleaning with descaling, sanitization & tile scrubbing',
        category: 'cleaning',
        serviceType: 'fixed_washroom_deep',
        serviceCategory: 'bathroom_services',
        price: 600,
        duration: 60,
        catalogCategoryId: catId('washroom-adhoc'),
        catalogSubcategory: 'intense-deep',
        pricingTiers: [
          { quantityFrom: 1, quantityTo: 1, pricePerUnit: 600, totalPrice: 600, duration: 60 },
          { quantityFrom: 2, quantityTo: 2, pricePerUnit: 500, totalPrice: 1000, duration: 100 },
          { quantityFrom: 3, quantityTo: 3, pricePerUnit: 500, totalPrice: 1500, duration: 150 },
          { quantityFrom: 4, quantityTo: 4, pricePerUnit: 500, totalPrice: 2000, duration: 200 },
        ],
        tags: ['washroom', 'deep', 'ad-hoc', 'descaling'],
        availableInAllLocations: true,
      },

      // ═══════ WASHROOM AD-HOC — Basic ═══════
      {
        name: 'Basic Washroom Cleaning',
        description: 'Quick but effective washroom cleaning — floor, toilet, sink & mirror',
        category: 'cleaning',
        serviceType: 'fixed_washroom_basic',
        serviceCategory: 'bathroom_services',
        price: 250,
        duration: 20,
        catalogCategoryId: catId('washroom-adhoc'),
        catalogSubcategory: 'basic-washroom',
        pricingTiers: [
          { quantityFrom: 1, quantityTo: 1, pricePerUnit: 250, totalPrice: 250, duration: 20 },
          { quantityFrom: 2, quantityTo: 2, pricePerUnit: 250, totalPrice: 500, duration: 40 },
          { quantityFrom: 3, quantityTo: 3, pricePerUnit: 250, totalPrice: 750, duration: 60 },
          { quantityFrom: 4, quantityTo: 4, pricePerUnit: 250, totalPrice: 1000, duration: 80 },
        ],
        tags: ['washroom', 'basic', 'ad-hoc'],
        availableInAllLocations: true,
      },

      // ═══════ DEEP CLEANING — COMMERCIAL / QUOTE ═══════
      {
        name: 'New Construction Deep Cleaning',
        description: 'Post-construction deep cleaning for newly built or renovated properties',
        category: 'cleaning',
        serviceType: 'deep_cleaning_commercial',
        serviceCategory: 'deep_cleaning',
        price: 0,
        duration: 480,
        isQuoteService: true,
        catalogCategoryId: catId('deep-cleaning'),
        catalogSubcategory: 'post-construction',
        tags: ['deep-cleaning', 'commercial', 'construction', 'quote'],
        availableInAllLocations: true,
      },
      {
        name: 'Villa Deep Cleaning',
        description: 'Comprehensive deep cleaning for villas — all rooms, balconies, outdoor areas',
        category: 'cleaning',
        serviceType: 'deep_cleaning_commercial',
        serviceCategory: 'deep_cleaning',
        price: 0,
        duration: 480,
        isQuoteService: true,
        catalogCategoryId: catId('deep-cleaning'),
        catalogSubcategory: 'villas',
        tags: ['deep-cleaning', 'villa', 'quote'],
        availableInAllLocations: true,
      },
      {
        name: 'Bungalow Deep Cleaning',
        description: 'Full bungalow deep cleaning service with team-based approach',
        category: 'cleaning',
        serviceType: 'deep_cleaning_commercial',
        serviceCategory: 'deep_cleaning',
        price: 0,
        duration: 480,
        isQuoteService: true,
        catalogCategoryId: catId('deep-cleaning'),
        catalogSubcategory: 'bungalows',
        tags: ['deep-cleaning', 'bungalow', 'quote'],
        availableInAllLocations: true,
      },
      {
        name: 'Restaurant Deep Cleaning',
        description: 'Commercial-grade deep cleaning for restaurants & food establishments',
        category: 'cleaning',
        serviceType: 'deep_cleaning_commercial',
        serviceCategory: 'deep_cleaning',
        price: 0,
        duration: 480,
        isQuoteService: true,
        catalogCategoryId: catId('deep-cleaning'),
        catalogSubcategory: 'restaurant',
        tags: ['deep-cleaning', 'restaurant', 'commercial', 'quote'],
        availableInAllLocations: true,
      },
      {
        name: 'Corporate Office Deep Cleaning',
        description: 'Professional office deep cleaning — workstations, meeting rooms, pantry, washrooms',
        category: 'cleaning',
        serviceType: 'deep_cleaning_commercial',
        serviceCategory: 'deep_cleaning',
        price: 0,
        duration: 480,
        isQuoteService: true,
        catalogCategoryId: catId('deep-cleaning'),
        catalogSubcategory: 'corporate',
        tags: ['deep-cleaning', 'corporate', 'office', 'quote'],
        availableInAllLocations: true,
      },

      // ═══════ SPOT / SINGLE-ITEM CLEAN ═══════
      {
        name: 'Sofa Cleaning – Fabric',
        description: 'Professional fabric sofa deep cleaning with stain treatment',
        category: 'cleaning',
        serviceType: 'fixed_sofa_cleaning',
        serviceCategory: 'furniture_services',
        price: 499,
        duration: 60,
        catalogCategoryId: catId('spot-clean'),
        catalogSubcategory: 'sofa',
        tags: ['sofa', 'fabric', 'spot-clean'],
        availableInAllLocations: true,
      },
      {
        name: 'Sofa Cleaning – Leather',
        description: 'Professional leather sofa cleaning and conditioning',
        category: 'cleaning',
        serviceType: 'fixed_sofa_cleaning',
        serviceCategory: 'furniture_services',
        price: 499,
        duration: 60,
        catalogCategoryId: catId('spot-clean'),
        catalogSubcategory: 'sofa',
        tags: ['sofa', 'leather', 'spot-clean'],
        availableInAllLocations: true,
      },
      {
        name: 'Carpet Cleaning',
        description: 'Deep carpet cleaning and stain removal with professional equipment',
        category: 'cleaning',
        serviceType: 'fixed_carpet_cleaning',
        serviceCategory: 'spot_cleaning',
        price: 399,
        duration: 90,
        catalogCategoryId: catId('spot-clean'),
        catalogSubcategory: 'carpet',
        tags: ['carpet', 'spot-clean'],
        availableInAllLocations: true,
      },
      {
        name: 'Glass Window Cleaning (without grill)',
        description: 'Glass pane + frame cleaning, inside & outside',
        category: 'cleaning',
        serviceType: 'fixed_window_cleaning',
        serviceCategory: 'spot_cleaning',
        price: 349,
        duration: 30,
        catalogCategoryId: catId('spot-clean'),
        catalogSubcategory: 'window',
        tags: ['window', 'glass', 'spot-clean'],
        availableInAllLocations: true,
      },
      {
        name: 'Glass Window Cleaning (with grill)',
        description: 'Glass pane, grill & frame cleaning, inside & outside',
        category: 'cleaning',
        serviceType: 'fixed_window_cleaning',
        serviceCategory: 'spot_cleaning',
        price: 399,
        duration: 40,
        catalogCategoryId: catId('spot-clean'),
        catalogSubcategory: 'window',
        tags: ['window', 'glass', 'grill', 'spot-clean'],
        availableInAllLocations: true,
      },
      {
        name: 'Small Window Cleaning',
        description: 'Cleaning of small-size windows',
        category: 'cleaning',
        serviceType: 'fixed_window_cleaning',
        serviceCategory: 'spot_cleaning',
        price: 250,
        duration: 20,
        catalogCategoryId: catId('spot-clean'),
        catalogSubcategory: 'window',
        tags: ['window', 'small', 'spot-clean'],
        availableInAllLocations: true,
      },
      {
        name: 'Window Mesh Cleaning',
        description: 'Thorough cleaning of window mesh / mosquito net',
        category: 'cleaning',
        serviceType: 'fixed_window_mesh_cleaning',
        serviceCategory: 'spot_cleaning',
        price: 100,
        duration: 15,
        catalogCategoryId: catId('spot-clean'),
        catalogSubcategory: 'window',
        tags: ['window', 'mesh', 'spot-clean'],
        availableInAllLocations: true,
      },
      {
        name: 'Ceiling Fan Cleaning',
        description: 'Complete ceiling fan cleaning — blades, motor housing, mounting',
        category: 'cleaning',
        serviceType: 'fixed_fan_cleaning',
        serviceCategory: 'spot_cleaning',
        price: 100,
        duration: 15,
        catalogCategoryId: catId('spot-clean'),
        catalogSubcategory: 'fan',
        tags: ['fan', 'ceiling-fan', 'spot-clean'],
        availableInAllLocations: true,
      },
      {
        name: 'French Door / Balcony Door Cleaning',
        description: 'Full balcony or French door deep cleaning (₹450 – ₹900 depending on size)',
        category: 'cleaning',
        serviceType: 'fixed_door_cleaning',
        serviceCategory: 'spot_cleaning',
        price: 450,
        originalPrice: 900,
        duration: 45,
        catalogCategoryId: catId('spot-clean'),
        catalogSubcategory: 'balcony',
        tags: ['balcony', 'french-door', 'spot-clean'],
        availableInAllLocations: true,
      },
      {
        name: 'Glass Door Cleaning',
        description: 'Professional glass door cleaning both sides',
        category: 'cleaning',
        serviceType: 'fixed_door_cleaning',
        serviceCategory: 'spot_cleaning',
        price: 349,
        duration: 30,
        catalogCategoryId: catId('spot-clean'),
        catalogSubcategory: 'glass-door',
        tags: ['glass-door', 'spot-clean'],
        availableInAllLocations: true,
      },

      // ═══════ KITCHEN & APPLIANCES ═══════
      {
        name: 'Kitchen & Kitchen Appliances Cleaning Package',
        description: 'Complete kitchen deep clean including all appliances, platform, tiles, chimney & more',
        category: 'cleaning',
        serviceType: 'kitchen_appliances_package',
        serviceCategory: 'kitchen_services',
        price: 3199,
        duration: 180,
        catalogCategoryId: catId('kitchen-appliances'),
        catalogSubcategory: 'kitchen-package',
        tags: ['kitchen', 'package', 'comprehensive'],
        availableInAllLocations: true,
      },
      {
        name: 'Washbasin / Faucet Cleaning (without mirror)',
        description: 'Single washbasin and faucet cleaning',
        category: 'cleaning',
        serviceType: 'fixed_washbasin_cleaning',
        serviceCategory: 'bathroom_services',
        price: 69,
        duration: 10,
        catalogCategoryId: catId('kitchen-appliances'),
        catalogSubcategory: 'appliances',
        tags: ['washbasin', 'faucet', 'mini'],
        availableInAllLocations: true,
      },
      {
        name: 'Washbasin / Faucet Cleaning (with mirror)',
        description: 'Single washbasin, faucet & mirror cleaning',
        category: 'cleaning',
        serviceType: 'fixed_washbasin_cleaning',
        serviceCategory: 'bathroom_services',
        price: 89,
        duration: 15,
        catalogCategoryId: catId('kitchen-appliances'),
        catalogSubcategory: 'appliances',
        tags: ['washbasin', 'faucet', 'mirror', 'mini'],
        availableInAllLocations: true,
      },
      {
        name: 'Dining Table & Chairs Cleaning',
        description: 'Deep cleaning of dining table surface and all chair seats',
        category: 'cleaning',
        serviceType: 'fixed_dining_cleaning',
        serviceCategory: 'furniture_services',
        price: 499,
        duration: 45,
        catalogCategoryId: catId('furniture'),
        tags: ['dining', 'furniture'],
        availableInAllLocations: true,
      },
      {
        name: 'Showcase Cabinet Cleaning',
        description: 'Complete showcase/display cabinet cleaning inside and out',
        category: 'cleaning',
        serviceType: 'fixed_cabinet_cleaning',
        serviceCategory: 'furniture_services',
        price: 299,
        duration: 30,
        catalogCategoryId: catId('furniture'),
        tags: ['cabinet', 'showcase', 'furniture'],
        availableInAllLocations: true,
      },
      {
        name: 'Microwave Cleaning',
        description: 'Interior and exterior microwave deep clean',
        category: 'cleaning',
        serviceType: 'fixed_microwave_cleaning',
        serviceCategory: 'kitchen_services',
        price: 199,
        duration: 20,
        catalogCategoryId: catId('kitchen-appliances'),
        catalogSubcategory: 'appliances',
        tags: ['microwave', 'kitchen', 'appliance'],
        availableInAllLocations: true,
      },
      {
        name: 'OTG Cleaning',
        description: 'Oven toaster grill deep cleaning',
        category: 'cleaning',
        serviceType: 'fixed_oven_cleaning',
        serviceCategory: 'kitchen_services',
        price: 399,
        duration: 30,
        catalogCategoryId: catId('kitchen-appliances'),
        catalogSubcategory: 'appliances',
        tags: ['otg', 'oven', 'kitchen', 'appliance'],
        availableInAllLocations: true,
      },
      {
        name: 'Gas Stove Cleaning',
        description: 'Burner degreasing and stove body cleaning',
        category: 'cleaning',
        serviceType: 'fixed_stove_cleaning',
        serviceCategory: 'kitchen_services',
        price: 99,
        duration: 15,
        catalogCategoryId: catId('kitchen-appliances'),
        catalogSubcategory: 'appliances',
        tags: ['stove', 'gas', 'kitchen', 'appliance'],
        availableInAllLocations: true,
      },
      {
        name: 'Chimney Cleaning',
        description: 'Full chimney cleaning with filter degreasing',
        category: 'cleaning',
        serviceType: 'fixed_chimney_cleaning',
        serviceCategory: 'kitchen_services',
        price: 499,
        duration: 45,
        catalogCategoryId: catId('kitchen-appliances'),
        catalogSubcategory: 'appliances',
        tags: ['chimney', 'kitchen', 'appliance'],
        availableInAllLocations: true,
      },
      {
        name: 'Fridge Cleaning',
        description: 'Full fridge interior & exterior cleaning (₹299 – ₹599 based on size)',
        category: 'cleaning',
        serviceType: 'fixed_fridge_cleaning',
        serviceCategory: 'kitchen_services',
        price: 299,
        originalPrice: 599,
        duration: 40,
        catalogCategoryId: catId('kitchen-appliances'),
        catalogSubcategory: 'appliances',
        tags: ['fridge', 'kitchen', 'appliance'],
        availableInAllLocations: true,
      },
      {
        name: 'Kitchen Platform & Tiles Cleaning',
        description: 'Kitchen countertop, platform, backsplash & tile scrubbing',
        category: 'cleaning',
        serviceType: 'fixed_kitchen_platform_cleaning',
        serviceCategory: 'kitchen_services',
        price: 399,
        duration: 45,
        catalogCategoryId: catId('kitchen-appliances'),
        catalogSubcategory: 'appliances',
        tags: ['platform', 'tiles', 'kitchen'],
        availableInAllLocations: true,
      },
      {
        name: 'Kitchen Exhaust Fan Cleaning',
        description: 'Kitchen exhaust fan dismantling and deep clean',
        category: 'cleaning',
        serviceType: 'fixed_fan_cleaning',
        serviceCategory: 'kitchen_services',
        price: 149,
        duration: 20,
        catalogCategoryId: catId('kitchen-appliances'),
        catalogSubcategory: 'appliances',
        tags: ['exhaust', 'fan', 'kitchen'],
        availableInAllLocations: true,
      },
      {
        name: 'Sink & Under-the-Sink Cleaning',
        description: 'Kitchen sink, drain & under-sink cabinet deep clean',
        category: 'cleaning',
        serviceType: 'fixed_sink_cleaning',
        serviceCategory: 'kitchen_services',
        price: 149,
        duration: 20,
        catalogCategoryId: catId('kitchen-appliances'),
        catalogSubcategory: 'appliances',
        tags: ['sink', 'kitchen'],
        availableInAllLocations: true,
      },
      {
        name: 'Utility Area Cleaning',
        description: 'Complete utility / laundry area cleaning',
        category: 'cleaning',
        serviceType: 'fixed_utility_cleaning',
        serviceCategory: 'other',
        price: 499,
        duration: 45,
        catalogCategoryId: catId('kitchen-appliances'),
        catalogSubcategory: 'appliances',
        tags: ['utility', 'laundry'],
        availableInAllLocations: true,
      },

      // ═══════ BEDROOM ESSENTIALS ═══════
      {
        name: 'Complete Bedroom Package',
        description: 'Full bedroom deep clean — bed, cupboard, AC, mirror, windows (₹1,599 – ₹2,499)',
        category: 'cleaning',
        serviceType: 'bedroom_package',
        serviceCategory: 'other',
        price: 1599,
        originalPrice: 2499,
        duration: 120,
        catalogCategoryId: catId('bedroom'),
        catalogSubcategory: 'bedroom-package',
        tags: ['bedroom', 'package'],
        availableInAllLocations: true,
      },
      {
        name: 'Cupboard Cleaning',
        description: 'Interior & exterior cupboard / wardrobe cleaning',
        category: 'cleaning',
        serviceType: 'fixed_cupboard_cleaning',
        serviceCategory: 'furniture_services',
        price: 299,
        duration: 30,
        catalogCategoryId: catId('bedroom'),
        catalogSubcategory: 'bedroom-items',
        tags: ['cupboard', 'bedroom', 'furniture'],
        availableInAllLocations: true,
      },
      {
        name: 'Bedroom Small Window Cleaning',
        description: 'Small bedroom window cleaning',
        category: 'cleaning',
        serviceType: 'fixed_window_cleaning',
        serviceCategory: 'spot_cleaning',
        price: 150,
        duration: 15,
        catalogCategoryId: catId('bedroom'),
        catalogSubcategory: 'bedroom-items',
        tags: ['window', 'bedroom', 'small'],
        availableInAllLocations: true,
      },
      {
        name: 'Bed Cleaning (Only Bed)',
        description: 'Mattress surface, frame & headboard-area cleaning',
        category: 'cleaning',
        serviceType: 'fixed_bed_cleaning',
        serviceCategory: 'furniture_services',
        price: 299,
        duration: 30,
        catalogCategoryId: catId('bedroom'),
        catalogSubcategory: 'bedroom-items',
        tags: ['bed', 'bedroom'],
        availableInAllLocations: true,
      },
      {
        name: 'Bed with Headboard Cleaning',
        description: 'Bed frame + headboard deep cleaning',
        category: 'cleaning',
        serviceType: 'fixed_bed_cleaning',
        serviceCategory: 'furniture_services',
        price: 449,
        duration: 40,
        catalogCategoryId: catId('bedroom'),
        catalogSubcategory: 'bedroom-items',
        tags: ['bed', 'headboard', 'bedroom'],
        availableInAllLocations: true,
      },
      {
        name: 'Bed with Storage Cleaning',
        description: 'Bed frame + storage compartment deep cleaning',
        category: 'cleaning',
        serviceType: 'fixed_bed_cleaning',
        serviceCategory: 'furniture_services',
        price: 499,
        duration: 50,
        catalogCategoryId: catId('bedroom'),
        catalogSubcategory: 'bedroom-items',
        tags: ['bed', 'storage', 'bedroom'],
        availableInAllLocations: true,
      },
      {
        name: 'Bedroom Mirror Cleaning',
        description: 'Full-size bedroom mirror cleaning & polishing',
        category: 'cleaning',
        serviceType: 'fixed_mirror_cleaning',
        serviceCategory: 'other',
        price: 79,
        duration: 10,
        catalogCategoryId: catId('bedroom'),
        catalogSubcategory: 'bedroom-items',
        tags: ['mirror', 'bedroom'],
        availableInAllLocations: true,
      },
      {
        name: 'AC Indoor Unit Cleaning',
        description: 'Split AC indoor unit filter, coil & body cleaning',
        category: 'cleaning',
        serviceType: 'fixed_ac_indoor_cleaning',
        serviceCategory: 'hvac_services',
        price: 400,
        duration: 45,
        catalogCategoryId: catId('bedroom'),
        catalogSubcategory: 'bedroom-items',
        tags: ['ac', 'indoor', 'hvac', 'bedroom'],
        availableInAllLocations: true,
      },
      {
        name: 'AC Outdoor Unit Cleaning',
        description: 'Split AC outdoor unit condenser & body cleaning',
        category: 'cleaning',
        serviceType: 'fixed_ac_outdoor_cleaning',
        serviceCategory: 'hvac_services',
        price: 549,
        duration: 60,
        catalogCategoryId: catId('bedroom'),
        catalogSubcategory: 'bedroom-items',
        tags: ['ac', 'outdoor', 'hvac'],
        availableInAllLocations: true,
      },
    ];

    let created = 0;
    let updated = 0;
    for (const def of serviceDefs) {
      const existing = await Service.findOne({ name: def.name });
      if (existing) {
        await Service.updateOne({ _id: existing._id }, { $set: def });
        updated++;
      } else {
        await Service.create({ ...def, createdBy, isActive: true });
        created++;
      }
    }

    console.log(`\n✅ Services: ${created} created, ${updated} updated`);

    // ─── Summary ───────────────────────────────────────────────────────

    console.log('\n═══════ RATE CARD SUMMARY ═══════');
    for (const cat of createdCatalogs) {
      const count = await Service.countDocuments({ catalogCategoryId: cat._id });
      console.log(`${cat.icon} ${cat.name}: ${count} services`);
      for (const sub of cat.subcategories) {
        const subCount = await Service.countDocuments({ catalogCategoryId: cat._id, catalogSubcategory: sub.slug });
        if (subCount > 0) console.log(`   └─ ${sub.icon} ${sub.name}: ${subCount}`);
      }
    }

    console.log('\n✅ Healthy Homez rate card seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seed();
