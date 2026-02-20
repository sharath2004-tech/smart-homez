/**
 * Clear Database Script
 * Removes all data from all collections in the database
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Booking from './models/Booking.js';
import Location from './models/Location.js';
import Payment from './models/Payment.js';
import QRPayment from './models/QRPayment.js';
import Service from './models/Service.js';
import User from './models/User.js';

dotenv.config();

const clearDatabase = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('🗑️  Clearing all collections...');

    // Clear all collections
    await Promise.all([
      User.deleteMany({}),
      Service.deleteMany({}),
      Booking.deleteMany({}),
      Location.deleteMany({}),
      Payment.deleteMany({}),
      QRPayment.deleteMany({})
    ]);

    console.log('✅ All collections cleared!');
    console.log('📊 Database is now empty and ready for fresh data.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  }
};

clearDatabase();
