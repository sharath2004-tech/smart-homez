/**
 * Database Cleanup Script
 * Keeps only super_admin users — deletes everything else.
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

import Booking from './models/Booking.js';
import HelpMessage from './models/HelpMessage.js';
import Location from './models/Location.js';
import Notification from './models/Notification.js';
import Payment from './models/Payment.js';
import QRPayment from './models/QRPayment.js';
import Review from './models/Review.js';
import Service from './models/Service.js';
import ServiceArea from './models/ServiceArea.js';
import ServiceRequest from './models/ServiceRequest.js';
import SOSAlert from './models/SOSAlert.js';
import Subscription from './models/Subscription.js';
import User from './models/User.js';
import WorkerEarnings from './models/WorkerEarnings.js';
import WorkerSalaryRequest from './models/WorkerSalaryRequest.js';
import WorkerTracking from './models/WorkerTracking.js';

const run = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Show super admins that will be preserved
    const superAdmins = await User.find({ role: 'super_admin' }).select('name email');
    if (superAdmins.length === 0) {
      console.log('⚠️  No super_admin users found in database.');
    } else {
      console.log('🔒 Preserving super_admin accounts:');
      superAdmins.forEach(u => console.log(`   • ${u.name} (${u.email})`));
    }
    console.log('');

    // Delete all non-super_admin users
    const deletedUsers = await User.deleteMany({ role: { $ne: 'super_admin' } });
    console.log(`🗑️  Deleted ${deletedUsers.deletedCount} users (customers, workers, admins)`);

    // Delete all other collections
    const [
      bookings, payments, qrPayments, reviews, notifications,
      subscriptions, bookingRequests, workerEarnings, salaryRequests,
      tracking, sos, helpMessages, locations, serviceAreas, services
    ] = await Promise.all([
      Booking.deleteMany({}),
      Payment.deleteMany({}),
      QRPayment.deleteMany({}),
      Review.deleteMany({}),
      Notification.deleteMany({}),
      Subscription.deleteMany({}),
      ServiceRequest.deleteMany({}),
      WorkerEarnings.deleteMany({}),
      WorkerSalaryRequest.deleteMany({}),
      WorkerTracking.deleteMany({}),
      SOSAlert.deleteMany({}),
      HelpMessage.deleteMany({}),
      Location.deleteMany({}),
      ServiceArea.deleteMany({}),
      Service.deleteMany({})
    ]);

    console.log(`🗑️  Deleted ${bookings.deletedCount} bookings`);
    console.log(`🗑️  Deleted ${payments.deletedCount} payments`);
    console.log(`🗑️  Deleted ${qrPayments.deletedCount} QR payments`);
    console.log(`🗑️  Deleted ${reviews.deletedCount} reviews`);
    console.log(`🗑️  Deleted ${notifications.deletedCount} notifications`);
    console.log(`🗑️  Deleted ${subscriptions.deletedCount} subscriptions`);
    console.log(`🗑️  Deleted ${bookingRequests.deletedCount} service requests`);
    console.log(`🗑️  Deleted ${workerEarnings.deletedCount} worker earnings`);
    console.log(`🗑️  Deleted ${salaryRequests.deletedCount} salary requests`);
    console.log(`🗑️  Deleted ${tracking.deletedCount} tracking records`);
    console.log(`🗑️  Deleted ${sos.deletedCount} SOS alerts`);
    console.log(`🗑️  Deleted ${helpMessages.deletedCount} help messages`);
    console.log(`🗑️  Deleted ${locations.deletedCount} locations`);
    console.log(`🗑️  Deleted ${serviceAreas.deletedCount} service areas`);
    console.log(`🗑️  Deleted ${services.deletedCount} services`);

    console.log('\n✅ Done. Only super_admin accounts remain.');
    const remaining = await User.find({}).select('name email role');
    console.log(`\n📊 Remaining users (${remaining.length}):`);
    remaining.forEach(u => console.log(`   • [${u.role}] ${u.name} (${u.email})`));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

run();
