/**
 * Database Cleanup Script
 * Keeps only super_admin users — deletes everything else.
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

import User from './models/User.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const run = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI (or MONGO_URI) is required');
    }

    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Show super admins that will be preserved
    const superAdmins = await User.find({ role: 'super_admin' }).select('name email');
    if (superAdmins.length === 0) {
      throw new Error('No super_admin users found. Aborting to avoid deleting every user account.');
    }

    console.log('🔒 Preserving super_admin accounts:');
    superAdmins.forEach(u => console.log(`   • ${u.name} (${u.email})`));
    console.log('');

    // Delete all non-super_admin users
    const deletedUsers = await User.deleteMany({ role: { $ne: 'super_admin' } });
    console.log(`🗑️  Deleted ${deletedUsers.deletedCount} users (customers, workers, admins)`);

    // Delete everything else from every non-users collection in the database.
    const collections = await mongoose.connection.db.listCollections().toArray();
    const purgeTargets = collections
      .map((collection) => collection.name)
      .filter((name) => name !== 'users' && !name.startsWith('system.'))
      .sort((a, b) => a.localeCompare(b));

    for (const collectionName of purgeTargets) {
      const result = await mongoose.connection.db.collection(collectionName).deleteMany({});
      console.log(`🗑️  Deleted ${result.deletedCount} documents from ${collectionName}`);
    }

    console.log('\n✅ Done. Only super_admin accounts remain.');
    const remaining = await User.find({}).select('name email role');
    console.log(`\n📊 Remaining users (${remaining.length}):`);
    remaining.forEach(u => console.log(`   • [${u.role}] ${u.name} (${u.email})`));

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

run();
