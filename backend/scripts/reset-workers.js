/**
 * Deletes all worker accounts and recreates the email index as sparse.
 * Run: node scripts/reset-workers.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) { console.error('MONGODB_URI not set'); process.exit(1); }

await mongoose.connect(MONGO_URI);
console.log('✅ Connected');

const col = mongoose.connection.collection('users');

// Step 1: Drop the non-sparse email_1 index so we can safely delete workers with duplicate nulls
const indexes = await col.indexes();
const emailIdx = indexes.find(i => i.name === 'email_1');
if (emailIdx && !emailIdx.sparse) {
  await col.dropIndex('email_1');
  console.log('🗑️  Dropped non-sparse email_1 index');
} else {
  console.log('ℹ️  email_1 index already sparse or absent');
}

// Step 2: Delete all worker accounts
const result = await col.deleteMany({ role: 'worker' });
console.log(`🗑️  Deleted ${result.deletedCount} worker account(s)`);

// Step 3: Recreate email index as sparse+unique (Mongoose will also do this on next server start)
await col.createIndex({ email: 1 }, { unique: true, sparse: true, name: 'email_1' });
console.log('✅ Recreated email_1 index as sparse+unique');

await mongoose.disconnect();
console.log('✅ Done — all workers removed, index fixed');
