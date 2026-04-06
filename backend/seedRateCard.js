/**
 * Healthy Homez — Complete Rate Card Seed (April 2026)
 *
 * Seeds ALL services from the official rate card:
 *   1. Ad Hoc Instant Help (hourly tiers)
 *   2. Daily Housekeeping Monthly Subscription (hourly tiers)
 *   3. Washroom Cleaning Subscription Monthly Pack (quantity tiers)
 *   4. Washroom Cleaning Ad-hoc — Deep (quantity tiers)
 *   5. Washroom Cleaning Ad-hoc — Basic (quantity tiers)
 *   6. Deep Cleaning Commercial & Residential (quote)
 *   7–30. Mini Services (individual fixed-price items)
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Service from './models/Service.js';
import User from './models/User.js';

dotenv.config();

async function seedRateCard() {
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

      // ═══════════════════════════════════════════════════
      // 1. AD HOC INSTANT HELP
      // ═══════════════════════════════════════════════════
      {
        name: 'Ad Hoc Instant Help',
        description: 'On-demand instant help for your home — no subscription needed. Book for a few hours anytime. Pay only for the time you need.',
        category: 'cleaning',
        serviceCategory: 'instant_services',
        serviceType: 'instant_hourly',
        price: 200,
        duration: 60,
        displayOrder: 1,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        durationOptions: [
          { hours: 1,   price: 200, isDefault: true, minimumHours: 1 },
          { hours: 1.5, price: 300, isDefault: false },
          { hours: 2,   price: 400, isDefault: false },
          { hours: 2.5, price: 500, isDefault: false },
          { hours: 3,   price: 600, isDefault: false }
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

      // ═══════════════════════════════════════════════════
      // 2. DAILY HOUSEKEEPING MONTHLY SUBSCRIPTION
      //    30 days a month
      // ═══════════════════════════════════════════════════
      {
        name: 'Daily Housekeeping Monthly Pack',
        description: 'Dedicated maid service every day for a full month (30 days). Choose your preferred hours. The same worker visits daily on a fixed schedule.',
        category: 'cleaning',
        serviceCategory: 'subscription_services',
        serviceType: 'monthly_subscription',
        price: 4500,
        duration: 60,
        displayOrder: 2,
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
            description: 'Daily service for the whole month (30 days)',
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

      // ═══════════════════════════════════════════════════
      // 3. WASHROOM CLEANING SUBSCRIPTION MONTHLY PACK
      //    1 Deep Cleaning (45 min) + 3 Basic Cleanings (20 min) per month
      // ═══════════════════════════════════════════════════
      {
        name: 'Washroom Cleaning Monthly Pack',
        description: 'Monthly subscription — includes 1 Deep Cleaning (45 min) + 3 Basic Cleanings (20 min) per washroom. A dedicated worker visits on a fixed schedule every month.',
        category: 'cleaning',
        serviceCategory: 'subscription_services',
        serviceType: 'fixed_washroom_deep',
        price: 1100,
        duration: 45,
        displayOrder: 3,
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
            { value: '1', label: '1 Washroom', price: 1100, duration: 45,  workersRequired: 1 },
            { value: '2', label: '2 Washrooms', price: 2000, duration: 90,  workersRequired: 1 },
            { value: '3', label: '3 Washrooms', price: 3000, duration: 135, workersRequired: 1 }
          ]
        },
        subscriptionPlans: [
          {
            id: 'monthly',
            name: 'monthly',
            displayName: 'Monthly Pack',
            icon: '🗓️',
            description: '1 Deep Cleaning + 3 Basic Cleanings per month',
            price: 1100,
            sessionsPerMonth: 4,
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

      // ═══════════════════════════════════════════════════
      // 4. WASHROOM CLEANING AD-HOC — INTENSE DEEP CLEANING
      // ═══════════════════════════════════════════════════
      {
        name: 'Intense Washroom Deep Cleaning',
        description: 'One-time intense deep cleaning for washrooms. Covers walls & floor (machine scrub for hard floor), toilet seat, all taps & fixtures polishing, shower points, switch boards, exhaust fans, window, cob web removal, partition glasses, mirror & washbasin, tiles scrubbing.',
        category: 'cleaning',
        serviceCategory: 'bathroom_services',
        serviceType: 'deep_cleaning_bathroom',
        price: 600,
        duration: 60,
        displayOrder: 4,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        sizeParameters: {
          enabled: true,
          sizeType: 'quantity',
          options: [
            { value: '1', label: '1 Washroom', price: 600,  duration: 60,  workersRequired: 1 },
            { value: '2', label: '2 Washrooms', price: 1000, duration: 120, workersRequired: 1 },
            { value: '3', label: '3 Washrooms', price: 1500, duration: 180, workersRequired: 1 },
            { value: '4', label: '4 Washrooms', price: 2000, duration: 240, workersRequired: 1 }
          ]
        },
        subscriptionPlans: [],
        dos: [
          'Walls and Floor Cleaning (machine scrub for hard floor)',
          'Toilet seat',
          'All Taps and fixtures polishing',
          'Shower points',
          'Switch boards',
          'Exhaust fans',
          'Window',
          'Cob web removal (ceiling dusting)',
          'Partition glasses',
          'Mirror and washbasin',
          'Tiles scrubbing'
        ],
        tags: ['washroom', 'bathroom', 'deep cleaning', 'adhoc', 'intense'],
        requirements: ['Water supply must be available', 'Worker brings cleaning supplies'],
        createdBy
      },

      // ═══════════════════════════════════════════════════
      // 5. WASHROOM CLEANING AD-HOC — BASIC CLEANING
      // ═══════════════════════════════════════════════════
      {
        name: 'Basic Washroom Cleaning',
        description: 'Quick basic washroom cleaning. Covers floor cleaning, toilet seat, mirror, and washbasin.',
        category: 'cleaning',
        serviceCategory: 'bathroom_services',
        serviceType: 'fixed_washroom_basic',
        price: 250,
        duration: 20,
        displayOrder: 5,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        sizeParameters: {
          enabled: true,
          sizeType: 'quantity',
          options: [
            { value: '1', label: '1 Washroom', price: 250,  duration: 20, workersRequired: 1 },
            { value: '2', label: '2 Washrooms', price: 500,  duration: 40, workersRequired: 1 },
            { value: '3', label: '3 Washrooms', price: 750,  duration: 60, workersRequired: 1 },
            { value: '4', label: '4 Washrooms', price: 1000, duration: 80, workersRequired: 1 }
          ]
        },
        subscriptionPlans: [],
        dos: [
          'Floor cleaning',
          'Toilet seat',
          'Mirror',
          'Washbasin'
        ],
        tags: ['washroom', 'bathroom', 'basic cleaning', 'adhoc'],
        requirements: ['Water supply must be available'],
        createdBy
      },

      // ═══════════════════════════════════════════════════
      // 6. DEEP CLEANING — COMMERCIAL & RESIDENTIAL (QUOTE)
      //    Movie In/Out Deep Cleaning
      // ═══════════════════════════════════════════════════
      {
        name: 'Deep Cleaning — Commercial & Residential',
        description: 'Professional deep cleaning for villas, apartments, offices, and restaurants. Move in/out deep cleaning starting from ₹5499. Pricing is customised to your property. Submit your details and our team will call you with a quote.',
        category: 'cleaning',
        serviceCategory: 'deep_cleaning',
        serviceType: 'deep_cleaning_commercial',
        price: 5499,
        duration: 240,
        displayOrder: 6,
        isActive: true,
        isQuoteService: true,
        availableInAllLocations: true,
        sizeParameters: {
          enabled: true,
          sizeType: 'quantity',
          options: [
            { value: 'villa',             label: 'Villa',             price: 0, duration: 480 },
            { value: 'apartment',         label: 'Apartment',         price: 0, duration: 360 },
            { value: 'bungalow',          label: 'Bungalow',          price: 0, duration: 480 },
            { value: 'restaurant',        label: 'Restaurant',        price: 0, duration: 480 },
            { value: 'corporate_office',  label: 'Corporate Office',  price: 0, duration: 480 }
          ]
        },
        subscriptionPlans: [],
        tags: ['deep cleaning', 'commercial', 'residential', 'villa', 'apartment', 'bungalow', 'restaurant', 'corporate', 'move-in', 'move-out', 'new construction', 'custom quote'],
        requirements: ['Site inspection may be required', 'Team of workers deployed', 'All equipment provided', 'Custom pricing available'],
        createdBy
      },

      // ═══════════════════════════════════════════════════════════
      // MINI SERVICES — Individual fixed-price items
      // ═══════════════════════════════════════════════════════════

      // --- Washbasin / Faucet ---
      {
        name: 'Washbasin/Faucet Cleaning (without mirror)',
        description: 'Single washbasin and faucet cleaning without mirror.',
        category: 'cleaning',
        serviceCategory: 'bathroom_services',
        serviceType: 'fixed_washbasin_cleaning',
        price: 69,
        duration: 15,
        displayOrder: 10,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'washbasin', 'faucet'],
        createdBy
      },
      {
        name: 'Washbasin/Faucet Cleaning (with mirror)',
        description: 'Single washbasin and faucet cleaning with mirror polishing.',
        category: 'cleaning',
        serviceCategory: 'bathroom_services',
        serviceType: 'fixed_washbasin_cleaning',
        price: 89,
        duration: 20,
        displayOrder: 11,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'washbasin', 'faucet', 'mirror'],
        createdBy
      },

      // --- Sofa ---
      {
        name: 'Fabric Sofa Cleaning',
        description: 'Steam clean and sanitise fabric sofas. Removes dust, allergens, stains, and odour.',
        category: 'cleaning',
        serviceCategory: 'furniture_services',
        serviceType: 'fixed_sofa_cleaning',
        price: 499,
        duration: 60,
        displayOrder: 12,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'sofa', 'fabric', 'spot-clean'],
        requirements: ['Drying time ~2 hours after service'],
        createdBy
      },
      {
        name: 'Leather Sofa Cleaning',
        description: 'Professional cleaning and conditioning for leather sofas. Removes dust, stains, and restores shine.',
        category: 'cleaning',
        serviceCategory: 'furniture_services',
        serviceType: 'fixed_sofa_cleaning',
        price: 499,
        duration: 60,
        displayOrder: 13,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'sofa', 'leather', 'spot-clean'],
        requirements: ['Drying time ~2 hours after service'],
        createdBy
      },

      // --- Fan ---
      {
        name: 'Ceiling Fan Cleaning',
        description: 'Dust removal and wipe-down of ceiling fans. Includes blade, motor cover, and surrounding area.',
        category: 'cleaning',
        serviceCategory: 'spot_cleaning',
        serviceType: 'fixed_fan_cleaning',
        price: 100,
        duration: 20,
        displayOrder: 14,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'fan', 'ceiling fan', 'spot-clean'],
        requirements: ['Per fan pricing', 'Step ladder provided by team'],
        createdBy
      },

      // --- Carpet ---
      {
        name: 'Carpet Cleaning',
        description: 'Vacuum and steam extraction for all carpet types. Removes deep-seated dirt, stains, and pet hair.',
        category: 'cleaning',
        serviceCategory: 'furniture_services',
        serviceType: 'fixed_carpet_cleaning',
        price: 399,
        duration: 60,
        displayOrder: 15,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'carpet', 'spot-clean'],
        requirements: ['Starts from ₹399', 'Drying time ~3 hours after service'],
        createdBy
      },

      // --- Glass Door ---
      {
        name: 'Glass Door Cleaning',
        description: 'Professional glass door cleaning for a streak-free, crystal clear finish.',
        category: 'cleaning',
        serviceCategory: 'spot_cleaning',
        serviceType: 'fixed_door_cleaning',
        price: 349,
        duration: 30,
        displayOrder: 16,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'glass door', 'door', 'spot-clean'],
        createdBy
      },

      // --- Windows ---
      {
        name: 'Glass Window Cleaning (without grill)',
        description: 'Inside and outside glass window cleaning without grill. Streak-free shine.',
        category: 'cleaning',
        serviceCategory: 'spot_cleaning',
        serviceType: 'fixed_window_cleaning',
        price: 349,
        duration: 30,
        displayOrder: 17,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'window', 'glass', 'spot-clean'],
        createdBy
      },
      {
        name: 'Glass Window Cleaning (with grill)',
        description: 'Inside and outside glass window cleaning including grill cleaning. Streak-free shine.',
        category: 'cleaning',
        serviceCategory: 'spot_cleaning',
        serviceType: 'fixed_window_cleaning',
        price: 399,
        duration: 40,
        displayOrder: 18,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'window', 'glass', 'grill', 'spot-clean'],
        createdBy
      },
      {
        name: 'Small Window Cleaning',
        description: 'Cleaning for small windows.',
        category: 'cleaning',
        serviceCategory: 'spot_cleaning',
        serviceType: 'fixed_window_cleaning',
        price: 250,
        duration: 20,
        displayOrder: 19,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'window', 'small window', 'spot-clean'],
        createdBy
      },
      {
        name: 'Window Mesh Cleaning',
        description: 'Cleaning and dust removal for window meshes.',
        category: 'cleaning',
        serviceCategory: 'spot_cleaning',
        serviceType: 'fixed_window_mesh_cleaning',
        price: 100,
        duration: 15,
        displayOrder: 20,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'window', 'mesh', 'spot-clean'],
        createdBy
      },

      // --- French Door (Balcony) ---
      {
        name: 'French Door (Balcony) Cleaning',
        description: 'Professional cleaning for French/balcony doors. Price varies by size (₹450 to ₹900).',
        category: 'cleaning',
        serviceCategory: 'spot_cleaning',
        serviceType: 'fixed_door_cleaning',
        price: 450,
        originalPrice: 900,
        duration: 45,
        displayOrder: 21,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        pricingTiers: [
          { quantityFrom: 1, quantityTo: 1, pricePerUnit: 450, totalPrice: 450, duration: 30 },
          { quantityFrom: 2, quantityTo: 2, pricePerUnit: 675, totalPrice: 675, duration: 45 },
          { quantityFrom: 3, quantityTo: 3, pricePerUnit: 900, totalPrice: 900, duration: 60 }
        ],
        subscriptionPlans: [],
        tags: ['mini-service', 'french door', 'balcony door', 'spot-clean'],
        createdBy
      },

      // ═══════════════════════════════════════════════════
      // KITCHEN & KITCHEN APPLIANCES
      // ═══════════════════════════════════════════════════
      {
        name: 'Kitchen & Kitchen Appliances Cleaning Package',
        description: 'Complete kitchen deep cleaning package — cabinets, appliances, counters, tiles, chimney, and floors.',
        category: 'cleaning',
        serviceCategory: 'kitchen_services',
        serviceType: 'kitchen_appliances_package',
        price: 3199,
        duration: 180,
        displayOrder: 22,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'kitchen', 'package', 'deep-clean'],
        requirements: ['Covers all major kitchen appliances and surfaces'],
        createdBy
      },
      {
        name: 'Dining Table & Chairs Cleaning',
        description: 'Professional cleaning of dining table and chairs.',
        category: 'cleaning',
        serviceCategory: 'furniture_services',
        serviceType: 'fixed_dining_cleaning',
        price: 499,
        duration: 45,
        displayOrder: 23,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'dining', 'furniture', 'spot-clean'],
        createdBy
      },
      {
        name: 'Showcase Cabinet Cleaning',
        description: 'Clean and polish showcase cabinet inside and out.',
        category: 'cleaning',
        serviceCategory: 'furniture_services',
        serviceType: 'fixed_cabinet_cleaning',
        price: 299,
        duration: 30,
        displayOrder: 24,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'cabinet', 'showcase', 'furniture', 'spot-clean'],
        createdBy
      },
      {
        name: 'Microwave Cleaning',
        description: 'Interior and exterior deep clean for microwave ovens.',
        category: 'cleaning',
        serviceCategory: 'kitchen_services',
        serviceType: 'fixed_microwave_cleaning',
        price: 199,
        duration: 20,
        displayOrder: 25,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'microwave', 'kitchen', 'appliance'],
        createdBy
      },
      {
        name: 'OTG Cleaning',
        description: 'Deep cleaning for OTG/oven toaster grillers — interior scrub and exterior polish.',
        category: 'cleaning',
        serviceCategory: 'kitchen_services',
        serviceType: 'fixed_oven_cleaning',
        price: 399,
        duration: 30,
        displayOrder: 26,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'otg', 'oven', 'kitchen', 'appliance'],
        createdBy
      },
      {
        name: 'Gas Stove Cleaning',
        description: 'Thorough cleaning of gas stove — burners, grates, and surface.',
        category: 'cleaning',
        serviceCategory: 'kitchen_services',
        serviceType: 'fixed_stove_cleaning',
        price: 99,
        duration: 20,
        displayOrder: 27,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'gas stove', 'stove', 'kitchen', 'appliance'],
        createdBy
      },
      {
        name: 'Chimney Cleaning',
        description: 'Deep clean for kitchen chimney — filter, hood, and exterior.',
        category: 'cleaning',
        serviceCategory: 'kitchen_services',
        serviceType: 'fixed_chimney_cleaning',
        price: 499,
        duration: 45,
        displayOrder: 28,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'chimney', 'kitchen', 'appliance'],
        createdBy
      },
      {
        name: 'Fridge Deep Clean',
        description: 'Interior deep clean including shelves, drawers, door seals, and coil dust removal.',
        category: 'cleaning',
        serviceCategory: 'kitchen_services',
        serviceType: 'fixed_fridge_cleaning',
        price: 299,
        duration: 45,
        displayOrder: 29,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        pricingTiers: [
          { quantityFrom: 1, quantityTo: 1, pricePerUnit: 299, totalPrice: 299, duration: 30 },
          { quantityFrom: 2, quantityTo: 2, pricePerUnit: 599, totalPrice: 599, duration: 60 }
        ],
        subscriptionPlans: [],
        tags: ['mini-service', 'fridge', 'refrigerator', 'kitchen', 'appliance'],
        requirements: ['Empty fridge before service', 'Fridge turned off 1 hr prior'],
        createdBy
      },
      {
        name: 'Kitchen Platform & Tiles Cleaning',
        description: 'Scrub and polish kitchen platform surfaces and tiles.',
        category: 'cleaning',
        serviceCategory: 'kitchen_services',
        serviceType: 'fixed_kitchen_platform_cleaning',
        price: 399,
        duration: 45,
        displayOrder: 30,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'kitchen', 'platform', 'tiles'],
        createdBy
      },
      {
        name: 'Kitchen Exhaust Fan Cleaning',
        description: 'Deep clean for kitchen exhaust fan — blades, grille, and housing.',
        category: 'cleaning',
        serviceCategory: 'kitchen_services',
        serviceType: 'fixed_fan_cleaning',
        price: 149,
        duration: 20,
        displayOrder: 31,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'exhaust fan', 'kitchen', 'appliance'],
        createdBy
      },
      {
        name: 'Sink & Under the Sink Cleaning',
        description: 'Deep clean kitchen sink, faucet, and under-sink area.',
        category: 'cleaning',
        serviceCategory: 'kitchen_services',
        serviceType: 'fixed_sink_cleaning',
        price: 149,
        duration: 20,
        displayOrder: 32,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'sink', 'kitchen'],
        createdBy
      },
      {
        name: 'Utility Area Cleaning',
        description: 'Full cleaning of utility/laundry area including floor, shelves, and appliance exteriors.',
        category: 'cleaning',
        serviceCategory: 'spot_cleaning',
        serviceType: 'fixed_utility_cleaning',
        price: 499,
        duration: 45,
        displayOrder: 33,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'utility', 'balcony', 'spot-clean'],
        createdBy
      },

      // ═══════════════════════════════════════════════════
      // BEDROOM ESSENTIALS
      // ═══════════════════════════════════════════════════
      {
        name: 'Complete Bedroom Package',
        description: 'Full bedroom deep cleaning — bed, headboard, cupboards, windows, mirror, and all surfaces.',
        category: 'cleaning',
        serviceCategory: 'furniture_services',
        serviceType: 'bedroom_package',
        price: 1599,
        originalPrice: 2499,
        duration: 120,
        displayOrder: 40,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        pricingTiers: [
          { quantityFrom: 1, quantityTo: 1, pricePerUnit: 1599, totalPrice: 1599, duration: 90 },
          { quantityFrom: 2, quantityTo: 2, pricePerUnit: 2499, totalPrice: 2499, duration: 150 }
        ],
        subscriptionPlans: [],
        tags: ['mini-service', 'bedroom', 'package', 'deep-clean'],
        createdBy
      },
      {
        name: 'Cupboard Cleaning',
        description: 'Interior and exterior cleaning of cupboards/wardrobes.',
        category: 'cleaning',
        serviceCategory: 'furniture_services',
        serviceType: 'fixed_cupboard_cleaning',
        price: 299,
        duration: 30,
        displayOrder: 41,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'cupboard', 'wardrobe', 'furniture'],
        createdBy
      },
      {
        name: 'Bedroom Small Window Cleaning',
        description: 'Cleaning for small bedroom windows.',
        category: 'cleaning',
        serviceCategory: 'spot_cleaning',
        serviceType: 'fixed_window_cleaning',
        price: 150,
        duration: 15,
        displayOrder: 42,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'window', 'bedroom', 'small window'],
        createdBy
      },
      {
        name: 'Bed Cleaning (Only Bed)',
        description: 'Mattress and bed frame dust removal and sanitisation.',
        category: 'cleaning',
        serviceCategory: 'furniture_services',
        serviceType: 'fixed_bed_cleaning',
        price: 299,
        duration: 30,
        displayOrder: 43,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'bed', 'mattress', 'furniture'],
        createdBy
      },
      {
        name: 'Bed with Headboard Cleaning',
        description: 'Bed and headboard deep cleaning and sanitisation.',
        category: 'cleaning',
        serviceCategory: 'furniture_services',
        serviceType: 'fixed_bed_cleaning',
        price: 449,
        duration: 40,
        displayOrder: 44,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'bed', 'headboard', 'furniture'],
        createdBy
      },
      {
        name: 'Bed with Storage Cleaning',
        description: 'Bed, headboard, and under-bed storage area deep cleaning.',
        category: 'cleaning',
        serviceCategory: 'furniture_services',
        serviceType: 'fixed_bed_cleaning',
        price: 499,
        duration: 45,
        displayOrder: 45,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'bed', 'storage', 'furniture'],
        createdBy
      },
      {
        name: 'Bedroom Mirror Cleaning',
        description: 'Mirror polishing and cleaning for bedroom mirrors.',
        category: 'cleaning',
        serviceCategory: 'furniture_services',
        serviceType: 'fixed_mirror_cleaning',
        price: 79,
        duration: 10,
        displayOrder: 46,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'mirror', 'bedroom'],
        createdBy
      },

      // ═══════════════════════════════════════════════════
      // HVAC — AC UNITS
      // ═══════════════════════════════════════════════════
      {
        name: 'AC Indoor Unit Cleaning',
        description: 'Deep clean for AC indoor unit — filter wash, coil cleaning, and sanitisation.',
        category: 'cleaning',
        serviceCategory: 'hvac_services',
        serviceType: 'fixed_ac_indoor_cleaning',
        price: 400,
        duration: 45,
        displayOrder: 50,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'ac', 'air conditioner', 'indoor unit', 'hvac'],
        createdBy
      },
      {
        name: 'AC Outdoor Unit Cleaning',
        description: 'Deep clean for AC outdoor/condenser unit — coil wash, fin straightening, and debris removal.',
        category: 'cleaning',
        serviceCategory: 'hvac_services',
        serviceType: 'fixed_ac_outdoor_cleaning',
        price: 549,
        duration: 60,
        displayOrder: 51,
        isActive: true,
        isQuoteService: false,
        availableInAllLocations: true,
        subscriptionPlans: [],
        tags: ['mini-service', 'ac', 'air conditioner', 'outdoor unit', 'hvac'],
        createdBy
      }

    ];

    const created = await Service.insertMany(services);
    console.log(`✅ Created ${created.length} services:\n`);

    // Group by category for nice output
    const grouped = {};
    created.forEach((s) => {
      const cat = s.serviceCategory || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s);
    });

    for (const [cat, items] of Object.entries(grouped)) {
      console.log(`\n  📂 ${cat.toUpperCase()}`);
      items.forEach((s) => {
        const price = s.isQuoteService ? 'Quote' : `₹${s.price}`;
        console.log(`     • ${s.name} — ${price} (${s.duration} min)`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Rate card seed complete! ${created.length} services created.`);
    console.log('='.repeat(60));

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seedRateCard();
