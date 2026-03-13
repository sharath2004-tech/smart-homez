import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';

dotenv.config();

async function deleteOrphanedWorkers() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all workers with no locationId in their assigned apartments
    const workers = await User.find({ role: 'worker' });
    console.log(`📊 Total workers in database: ${workers.length}\n`);

    const orphanedWorkers = workers.filter(worker => {
      if (!worker.workerProfile?.assignedApartments || worker.workerProfile.assignedApartments.length === 0) {
        return true; // No apartments at all
      }
      // Check if ALL assigned apartments have no locationId
      return worker.workerProfile.assignedApartments.every(apt => !apt.locationId);
    });

    console.log(`🔍 Found ${orphanedWorkers.length} orphaned workers (no valid locationId):\n`);

    if (orphanedWorkers.length === 0) {
      console.log('✅ No orphaned workers found. Database is clean.\n');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Display orphaned workers
    orphanedWorkers.forEach((worker, index) => {
      console.log(`${index + 1}. ${worker.name} (${worker.email})`);
      if (worker.workerProfile?.assignedApartments?.length > 0) {
        worker.workerProfile.assignedApartments.forEach(apt => {
          console.log(`   - Area: ${apt.area || 'N/A'}, City: ${apt.city || 'N/A'}, locationId: ${apt.locationId || 'MISSING'}`);
        });
      } else {
        console.log(`   - No assigned apartments`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('⚠️  DELETING ORPHANED WORKERS...');
    console.log('='.repeat(60) + '\n');

    // Delete the orphaned workers
    const workerIds = orphanedWorkers.map(w => w._id);
    const result = await User.deleteMany({ _id: { $in: workerIds } });

    console.log(`✅ Deleted ${result.deletedCount} orphaned workers\n`);

    console.log('='.repeat(60));
    console.log('📊 CLEANUP SUMMARY:');
    console.log(`  ❌ Orphaned workers deleted: ${result.deletedCount}`);
    console.log('='.repeat(60) + '\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting orphaned workers:', error);
    process.exit(1);
  }
}

deleteOrphanedWorkers();
