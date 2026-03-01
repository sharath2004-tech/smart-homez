import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Booking from './models/Booking.js';

dotenv.config();

async function cleanupTestBookings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Delete bookings with invalid coordinates
    const result = await Booking.deleteMany({
      $or: [
        { 'location.coordinates': { $exists: false } },
        { 'location.coordinates': null },
        { 'location.coordinates': [] },
        { 'location.coordinates.0': null },
        { 'location.coordinates.1': null },
        { 'location.coordinates.0': { $gt: 180 } },
        { 'location.coordinates.0': { $lt: -180 } },
        { 'location.coordinates.1': { $gt: 90 } },
        { 'location.coordinates.1': { $lt: -90 } }
      ]
    });

    console.log(`🗑️  Deleted ${result.deletedCount} bookings with invalid coordinates\n`);

    // Show remaining bookings stats
    const totalBookings = await Booking.countDocuments({});
    const validBookings = await Booking.countDocuments({
      'location.coordinates': { $exists: true, $ne: null },
      'location.coordinates.0': { $gte: -180, $lte: 180 },
      'location.coordinates.1': { $gte: -90, $lte: 90 }
    });

    console.log('📊 Database Summary:');
    console.log(`   Total bookings: ${totalBookings}`);
    console.log(`   Valid bookings: ${validBookings}`);
    console.log(`   Invalid bookings: ${totalBookings - validBookings}\n`);

    console.log('✅ Cleanup complete!\n');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

console.log('\n🧹 Cleaning up test bookings with invalid coordinates...\n');
cleanupTestBookings();
