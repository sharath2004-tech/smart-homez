/**
 * Migration: Reset reliabilityScore for existing workers from 100 to 75
 *
 * Workers were previously defaulted to 100 (20/20). The correct starting
 * baseline is 75 (15/20) so scores reflect actual performance.
 *
 * Run once: node backend/migrateReliabilityScore.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI not set in environment');
  process.exit(1);
}

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const result = await mongoose.connection.collection('users').updateMany(
      {
        role: 'worker',
        'workerProfile.reliabilityScore': 100
      },
      {
        $set: { 'workerProfile.reliabilityScore': 75 }
      }
    );

    console.log(`✅ Migration complete: ${result.modifiedCount} worker(s) updated from 100 → 75`);
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

migrate();
