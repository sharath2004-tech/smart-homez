import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Location from './models/Location.js';
import User from './models/User.js';

dotenv.config();

async function fixWorkerLocationIds() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all workers
    const workers = await User.find({ role: 'worker' });
    console.log(`📊 Found ${workers.length} workers\n`);

    let fixedCount = 0;
    let alreadyFixedCount = 0;

    for (const worker of workers) {
      console.log(`\n🔍 Processing worker: ${worker.name} (${worker.email})`);

      if (!worker.workerProfile?.assignedApartments || worker.workerProfile.assignedApartments.length === 0) {
        console.log('  ⚠️ No assigned apartments');
        continue;
      }

      let modified = false;

      for (let i = 0; i < worker.workerProfile.assignedApartments.length; i++) {
        const apartment = worker.workerProfile.assignedApartments[i];

        console.log(`  📍 Apartment: ${apartment.apartmentName || apartment.area} in ${apartment.city}`);

        // Check if locationId is already set
        if (apartment.locationId) {
          console.log(`    ✅ Already has locationId: ${apartment.locationId}`);
          alreadyFixedCount++;
          continue;
        }

        // Find matching location by city and area
        if (!apartment.city || !apartment.area) {
          console.log('    ⚠️ Missing city or area - cannot match');
          continue;
        }

        const location = await Location.findOne({
          city: new RegExp(`^${apartment.city.trim()}$`, 'i'),
          area: new RegExp(`^${apartment.area.trim()}$`, 'i')
        }).select('_id apartmentName city area');

        if (location) {
          console.log(`    ✅ Found matching location: ${location._id}`);
          worker.workerProfile.assignedApartments[i].locationId = location._id;
          modified = true;
          fixedCount++;
        } else {
          console.log(`    ❌ No matching location found for ${apartment.city} - ${apartment.area}`);
        }
      }

      if (modified) {
        await worker.save();
        console.log(`  💾 Saved updated worker: ${worker.name}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY:');
    console.log(`  ✅ Fixed: ${fixedCount} apartment assignments`);
    console.log(`  ℹ️  Already had locationId: ${alreadyFixedCount}`);
    console.log('='.repeat(60) + '\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing worker location IDs:', error);
    process.exit(1);
  }
}

fixWorkerLocationIds();
