import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Service from './models/Service.js';

dotenv.config();

const seedServiceCapabilities = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/healthy-homez');
    console.log('✅ Connected to MongoDB');

    // Define service capabilities
    const serviceCapabilities = {
      'instant_hourly': {
        dos: [
          'General dusting and sweeping',
          'Floor cleaning and mopping',
          'Kitchen counter and sink cleaning',
          'Bathroom basic cleaning',
          'Arranging and organizing items',
          'Trash removal',
          'Quick spot cleaning'
        ],
        donts: [
          'Bathroom deep cleaning',
          'High ceiling or wall cleaning',
          'Window washing',
          'Heavy laundry work',
          'Ironing clothes',
          'Cooking',
          'Professional equipment cleaning (AC, refrigerator internals)'
        ]
      },
      'monthly_subscription': {
        dos: [
          'Regular dusting and vacuuming',
          'Floor sweeping and mopping',
          'Kitchen areas cleaning',
          'Bathroom regular maintenance',
          'Trash removal',
          'Weekly or bi-weekly deep cleaning (depends on plan)',
          'Consistent, reliable service with same worker'
        ],
        donts: [
          'Industrial or commercial space cleaning',
          'Professional equipment servicing',
          'Carpet shampooing',
          'High-pressure cleaning',
          'Specialized treatments'
        ]
      },
      'deep_cleaning_full_house': {
        dos: [
          'Complete house deep cleaning',
          'Kitchen appliance cleaning',
          'Bathroom deep cleaning',
          'Wall and window cleaning',
          'Floor deep cleaning with polishing',
          'Furniture upholstery cleaning',
          'Ceiling and fan cleaning',
          'Professional-grade cleaning'
        ],
        donts: [
          'Outside services (exterior walls, terrace cleaning)',
          'Swimming pool cleaning',
          'Septic tank cleaning',
          'Pest control',
          'Painting or repairs'
        ]
      },
      'deep_cleaning_kitchen': {
        dos: [
          'Kitchen counters and surfaces',
          'Stove and cooktop cleaning',
          'Sink and faucet cleaning',
          'Cabinet exterior and shelves',
          'Tiles and grout cleaning',
          'Basic appliance exterior cleaning',
          'Kitchen organization'
        ],
        donts: [
          'Refrigerator internal deep cleaning',
          'Dishwasher internal servicing',
          'Microwave internal heavy cleaning',
          'Electrical appliance repair',
          'Structural repairs'
        ]
      },
      'fixed_washroom_basic': {
        dos: [
          'Toilet bowl cleaning',
          'Sink and basin cleaning',
          'Mirror cleaning',
          'Floor cleaning',
          'Basic tile cleaning',
          'Trash removal',
          'Ventilation area cleaning'
        ],
        donts: [
          'Plumbing repairs',
          'Heavy mold treatment',
          'Waterproofing work',
          'Electrical fixture work',
          'Structural damage repair'
        ]
      },
      'fixed_washroom_deep': {
        dos: [
          'Complete bathroom deep clean',
          'Grout and tile deep cleaning',
          'Plumbing fixtures polishing',
          'Ceiling and vent cleaning',
          'Wall cleaning and deodorizing',
          'Floor waxing',
          'Professional-grade disinfection'
        ],
        donts: [
          'Plumbing system repairs',
          'Fixture replacement',
          'Tile replacement',
          'Electrical work',
          'Ventilation system repairs'
        ]
      }
    };

    let updatedCount = 0;

    for (const [serviceType, capabilities] of Object.entries(serviceCapabilities)) {
      const service = await Service.findOne({ serviceType });

      if (service) {
        service.dos = capabilities.dos;
        service.donts = capabilities.donts;
        await service.save();
        console.log(`✅ Updated ${service.name} with dos and don'ts`);
        updatedCount++;
      } else {
        console.log(`⚠️  Service type "${serviceType}" not found`);
      }
    }

    console.log(`\n🎉 Successfully updated ${updatedCount} services with capability information!`);

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding service capabilities:', error);
    process.exit(1);
  }
};

seedServiceCapabilities();
