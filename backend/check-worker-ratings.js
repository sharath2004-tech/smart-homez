import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

// Import models
import Booking from './models/Booking.js';
import User from './models/User.js';
import { getWorkerPerformance } from './utils/updateWorkerStats.js';

const checkWorkerRatings = async () => {
  try {
    // Connect to database
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-homez';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');

    // Find all workers
    const workers = await User.find({ role: 'worker' })
      .select('name email workerProfile')
      .limit(20);

    if (workers.length === 0) {
      console.log('❌ No workers found in database');
      await mongoose.disconnect();
      return;
    }

    console.log('📊 WORKER PERFORMANCE REPORT');
    console.log('='.repeat(100));
    console.log('');

    for (const worker of workers) {
      const performance = await getWorkerPerformance(worker._id);
      
      if (!performance) continue;

      console.log(`👤 ${performance.name} (${worker.email})`);
      console.log(`   ID: ${worker._id}`);
      console.log(`   ⭐ Rating: ${performance.profileRating.toFixed(2)}/5.0 (${performance.totalReviews} reviews)`);
      console.log(`   ✅ Completion Rate: ${performance.completionRate.toFixed(1)}%`);
      console.log(`   ⏰ On-Time Rate: ${performance.onTimeArrivalRate.toFixed(1)}%`);
      console.log(`   📋 Total Bookings: ${performance.completedBookings}/${performance.totalBookings} completed`);
      console.log(`   💬 Rated Bookings: ${performance.ratedBookings}`);
      
      if (performance.avgRatingFromBookings > 0) {
        console.log(`   📈 Average from Bookings: ${performance.avgRatingFromBookings.toFixed(2)}/5.0`);
      }
      
      console.log('');
    }

    console.log('='.repeat(100));
    console.log('\n📊 SUMMARY STATISTICS\n');

    // Overall statistics
    const allWorkers = await User.countDocuments({ role: 'worker' });
    const workersWithRatings = await User.countDocuments({ 
      role: 'worker',
      'workerProfile.totalReviews': { $gt: 0 }
    });
    
    const totalBookings = await Booking.countDocuments();
    const completedBookings = await Booking.countDocuments({ status: 'completed' });
    const ratedBookings = await Booking.countDocuments({ 
      rating: { $exists: true, $ne: null } 
    });

    console.log(`Total Workers: ${allWorkers}`);
    console.log(`Workers with Ratings: ${workersWithRatings}`);
    console.log(`Total Bookings: ${totalBookings}`);
    console.log(`Completed Bookings: ${completedBookings}`);
    console.log(`Rated Bookings: ${ratedBookings}`);
    
    if (completedBookings > 0) {
      console.log(`Rating Coverage: ${((ratedBookings/completedBookings)*100).toFixed(1)}%`);
    }

    console.log('\n='.repeat(100));

    // Show recent rated bookings
    console.log('\n📝 RECENT RATED BOOKINGS\n');
    
    const recentRatings = await Booking.find({ 
      rating: { $exists: true, $ne: null } 
    })
      .populate('worker', 'name')
      .populate('customer', 'name')
      .populate('service', 'name')
      .sort({ updatedAt: -1 })
      .limit(10);

    if (recentRatings.length === 0) {
      console.log('❌ No rated bookings found');
    } else {
      recentRatings.forEach((booking, index) => {
        console.log(`${index + 1}. ${booking.service?.name || 'Service'}`);
        console.log(`   Worker: ${booking.worker?.name || 'N/A'}`);
        console.log(`   Customer: ${booking.customer?.name || 'N/A'}`);
        console.log(`   Rating: ${'⭐'.repeat(booking.rating)} (${booking.rating}/5)`);
        if (booking.review) {
          console.log(`   Review: "${booking.review}"`);
        }
        console.log(`   Date: ${new Date(booking.bookingDate).toLocaleDateString()}`);
        console.log('');
      });
    }

    console.log('='.repeat(100));
    console.log('\n✅ Check complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
};

// Run the check
checkWorkerRatings();
