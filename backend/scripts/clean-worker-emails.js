/**
 * One-time cleanup: remove empty/null email fields from worker accounts so the
 * sparse unique index does not cause E11000 conflicts when creating new workers.
 *
 * Run:  node backend/scripts/clean-worker-emails.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌  MONGODB_URI / MONGO_URI env var not set');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected to MongoDB');

  const users = mongoose.connection.collection('users');

  // 1. Remove empty-string email from ALL users (not just workers)
  const emptyResult = await users.updateMany(
    { email: '' },
    { $unset: { email: '' } }
  );
  console.log(`🔧  Removed empty-string email from ${emptyResult.modifiedCount} user(s)`);

  // 2. Remove null email from ALL users
  const nullResult = await users.updateMany(
    { email: null },
    { $unset: { email: '' } }
  );
  console.log(`🔧  Removed null email from ${nullResult.modifiedCount} user(s)`);

  // 3. Show current worker email status
  const workersTotal = await users.countDocuments({ role: 'worker' });
  const workersWithEmail = await users.countDocuments({ role: 'worker', email: { $exists: true, $ne: null, $ne: '' } });
  const workersNoEmail = workersTotal - workersWithEmail;
  console.log(`\n📊  Workers: ${workersTotal} total | ${workersWithEmail} with email | ${workersNoEmail} without email`);

  await mongoose.disconnect();
  console.log('\n✅  Done');
}

run().catch((err) => {
  console.error('❌  Error:', err.message);
  process.exit(1);
});
