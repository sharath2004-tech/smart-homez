import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Location from './models/Location.js';

dotenv.config();

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check workers
    console.log('='.repeat(60));
    console.log('WORKERS:');
    console.log('='.repeat(60));
    const workers = await User.find({ role: 'worker' }).select('name email workerProfile.assignedApartments');

    for (const worker of workers) {
      console.log(`\n👤 ${worker.name} (${worker.email})`);
      if (worker.workerProfile?.assignedApartments) {
        worker.workerProfile.assignedApartments.forEach((apt, i) => {
          console.log(`  Apartment ${i + 1}:`);
          console.log(`    locationId: ${apt.locationId || 'MISSING'}`);
          console.log(`    apartmentName: ${apt.apartmentName || 'MISSING'}`);
          console.log(`    area: ${apt.area || 'MISSING'}`);
          console.log(`    city: ${apt.city || 'MISSING'}`);
        });
      } else {
        console.log('  No assigned apartments');
      }
    }

    // Check locations
    console.log('\n' + '='.repeat(60));
    console.log('LOCATIONS:');
    console.log('='.repeat(60));
    const locations = await Location.find().select('apartmentName area city state');

    for (const loc of locations) {
      console.log(`\n📍 ${loc.apartmentName || loc.area}`);
      console.log(`  _id: ${loc._id}`);
      console.log(`  apartmentName: ${loc.apartmentName || 'MISSING'}`);
      console.log(`  area: ${loc.area || 'MISSING'}`);
      console.log(`  city: ${loc.city || 'MISSING'}`);
      console.log(`  state: ${loc.state || 'MISSING'}`);
    }

    // Check admins
    console.log('\n' + '='.repeat(60));
    console.log('ADMINS:');
    console.log('='.repeat(60));
    const admins = await User.find({ role: 'admin' }).select('name email adminProfile.assignedLocations');

    for (const admin of admins) {
      console.log(`\n👨‍💼 ${admin.name} (${admin.email})`);
      if (admin.adminProfile?.assignedLocations) {
        admin.adminProfile.assignedLocations.forEach((loc, i) => {
          console.log(`  Location ${i + 1}:`);
          console.log(`    locationId: ${loc.locationId}`);
          console.log(`    apartmentName: ${loc.apartmentName || 'MISSING'}`);
          console.log(`    city: ${loc.city || 'MISSING'}`);
        });
      } else {
        console.log('  No assigned locations');
      }
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkData();
