import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import Booking from './models/Booking.js';

dotenv.config();

const deactivateWorker = async (email) => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-homez';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');

    if (!email) {
      console.log('❌ Please provide an email address');
      console.log('Usage: node deactivateWorker.js <email>');
      await mongoose.disconnect();
      return;
    }

    // Find worker by email
    const worker = await User.findOne({ 
      email: email.toLowerCase(),
      role: 'worker'
    });

    if (!worker) {
      console.log(`❌ Worker not found with email: ${email}`);
      await mongoose.disconnect();
      return;
    }

    // Check current status
    console.log('📋 Worker Information:');
    console.log(`   Name: ${worker.name}`);
    console.log(`   Email: ${worker.email}`);
    console.log(`   Role: ${worker.role}`);
    console.log(`   Current Status: ${worker.isActive ? '✅ Active' : '❌ Deactivated'}`);
    console.log('');

    if (!worker.isActive) {
      console.log('ℹ️  Worker is already deactivated!');
      await mongoose.disconnect();
      return;
    }

    // Check for active bookings
    const activeBookings = await Booking.find({
      worker: worker._id,
      status: { $in: ['pending', 'confirmed', 'in-progress'] }
    })
      .populate('service', 'name')
      .populate('customer', 'name email');

    console.log('📊 Active Bookings Check:');
    console.log(`   Total Active Bookings: ${activeBookings.length}`);
    console.log('');

    if (activeBookings.length > 0) {
      console.log('⚠️  WARNING: This worker has active bookings!');
      console.log('─'.repeat(80));
      
      activeBookings.forEach((booking, index) => {
        const date = new Date(booking.bookingDate).toLocaleDateString();
        console.log(`${index + 1}. ${booking.service?.name || 'Service'}`);
        console.log(`   Customer: ${booking.customer?.name || 'N/A'} (${booking.customer?.email || 'N/A'})`);
        console.log(`   Date: ${date} ${booking.startTime} - ${booking.endTime}`);
        console.log(`   Status: ${booking.status}`);
        console.log('');
      });

      console.log('─'.repeat(80));
      console.log('');
      console.log('⚠️  RECOMMENDED ACTIONS:');
      console.log('1. Reassign these bookings to other workers');
      console.log('2. Notify customers about the change');
      console.log('3. Then deactivate the worker');
      console.log('');
      console.log('💡 To force deactivation anyway, run:');
      console.log(`   node deactivateWorker.js ${email} --force`);
      console.log('');
    }

    // Check if --force flag is provided
    const forceDeactivation = process.argv.includes('--force');

    if (activeBookings.length > 0 && !forceDeactivation) {
      console.log('❌ Deactivation CANCELLED (use --force to override)');
      await mongoose.disconnect();
      return;
    }

    // Deactivate worker
    worker.isActive = false;
    worker.workerProfile.availability = false; // Also mark as unavailable
    await worker.save();

    console.log('✅ Worker has been DEACTIVATED!');
    console.log('');
    console.log('📌 What happens now:');
    console.log('   ❌ Worker cannot receive new task assignments');
    console.log('   ❌ Worker excluded from automatic assignment');
    console.log('   ❌ Worker cannot be manually assigned to bookings');
    console.log('   ✅ Worker can still complete existing bookings (until reassigned)');
    console.log('   ✅ Worker data and history preserved');
    console.log('');

    if (activeBookings.length > 0) {
      console.log('⚠️  IMPORTANT: Active bookings still assigned!');
      console.log('   Please reassign them using:');
      console.log('   POST /api/bookings/:bookingId/reassign-worker');
      console.log('');
    }

    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
};

// Get email from command line argument
const email = process.argv[2];
deactivateWorker(email);
