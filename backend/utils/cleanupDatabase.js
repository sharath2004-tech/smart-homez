/**
 * Database Cleanup Utility
 * Run this script if you encounter "email already exists" errors after deleting users
 * This will rebuild the unique indexes on the User collection
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';

dotenv.config();

const cleanupDatabase = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🔍 Checking User collection indexes...');
    const indexes = await User.collection.getIndexes();
    console.log('Current indexes:', Object.keys(indexes).join(', '));

    // Drop the email index if it exists
    try {
      console.log('🗑️  Dropping email unique index...');
      await User.collection.dropIndex('email_1');
      console.log('✅ Email index dropped');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  Email index does not exist (already dropped or never created)');
      } else {
        console.log('⚠️  Could not drop email index:', error.message);
      }
    }

    // Rebuild indexes
    console.log('🔨 Rebuilding indexes...');
    await User.syncIndexes();
    console.log('✅ Indexes rebuilt successfully');

    // Verify unique emails
    console.log('🔍 Checking for duplicate emails...');
    const duplicates = await User.aggregate([
      {
        $group: {
          _id: '$email',
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    if (duplicates.length > 0) {
      console.log('⚠️  Found duplicate emails:');
      duplicates.forEach(dup => {
        console.log(`   - ${dup._id}: ${dup.count} occurrences (IDs: ${dup.ids.join(', ')})`);
      });
      console.log('⚠️  Please manually resolve these duplicates before continuing');
    } else {
      console.log('✅ No duplicate emails found');
    }

    console.log('🎉 Database cleanup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
};

cleanupDatabase();
