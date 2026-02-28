import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Location from './models/Location.js';

dotenv.config();

const checkAdminWorkerData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all admins
    const admins = await User.find({ role: 'admin' }).select('name email adminProfile');
    console.log('==================== ADMINS ====================');
    admins.forEach(admin => {
      console.log(`\n👤 Admin: ${admin.name} (${admin.email})`);
      console.log(`   ID: ${admin._id}`);
      console.log(`   Assigned Locations:`, admin.adminProfile?.assignedLocations || []);
      const locationIds = admin.adminProfile?.assignedLocations?.map(loc => loc.locationId.toString()) || [];
      console.log(`   Location IDs:`, locationIds);
    });

    // Get all locations
    const locations = await Location.find({}).select('apartmentName area city assignedAdmin');
    console.log('\n\n==================== LOCATIONS ====================');
    locations.forEach(loc => {
      console.log(`\n📍 Location: ${loc.apartmentName} - ${loc.area}, ${loc.city}`);
      console.log(`   ID: ${loc._id}`);
      console.log(`   Assigned Admin: ${loc.assignedAdmin || 'None'}`);
    });

    // Get all workers
    const workers = await User.find({ role: 'worker' }).select('name email workerProfile.assignedApartments isActive');
    console.log('\n\n==================== WORKERS ====================');
    workers.forEach(worker => {
      console.log(`\n👷 Worker: ${worker.name} (${worker.email})`);
      console.log(`   ID: ${worker._id}`);
      console.log(`   Active: ${worker.isActive}`);
      console.log(`   Assigned Apartments:`, worker.workerProfile?.assignedApartments || []);
      const workerLocationIds = worker.workerProfile?.assignedApartments?.map(apt => apt.locationId?.toString()).filter(Boolean) || [];
      console.log(`   Location IDs:`, workerLocationIds);
    });

    // Check visibility for each admin
    console.log('\n\n==================== VISIBILITY CHECK ====================');
    for (const admin of admins) {
      const adminLocationIds = admin.adminProfile?.assignedLocations?.map(loc => loc.locationId.toString()) || [];
      console.log(`\n👤 Admin: ${admin.name}`);
      console.log(`   Assigned to locations:`, adminLocationIds);
      
      const visibleWorkers = workers.filter(worker => {
        const workerLocationIds = worker.workerProfile?.assignedApartments?.map(apt => apt.locationId?.toString()).filter(Boolean) || [];
        return workerLocationIds.some(locId => adminLocationIds.includes(locId));
      });
      
      console.log(`   Can see ${visibleWorkers.length} workers:`);
      visibleWorkers.forEach(w => {
        console.log(`      - ${w.name} (${w.email})`);
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkAdminWorkerData();
