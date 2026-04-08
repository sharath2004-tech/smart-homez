/**
 * One-time migration: drop the non-sparse email_1 index from users collection
 * and let Mongoose recreate it as sparse (as defined in the User schema).
 *
 * Run once on the server:
 *   node backend/scripts/fix-email-index.js
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

  const collection = mongoose.connection.collection('users');
  const indexes = await collection.indexes();
  const emailIndex = indexes.find(i => i.name === 'email_1');

  if (!emailIndex) {
    console.log('ℹ️  email_1 index not found — nothing to do');
  } else if (emailIndex.sparse) {
    console.log('ℹ️  email_1 index is already sparse — nothing to do');
  } else {
    await collection.dropIndex('email_1');
    console.log('✅  Dropped non-sparse email_1 index');
    // Mongoose will recreate it as sparse on next server start (autoIndex: true)
    console.log('✅  Restart the backend server to recreate it as sparse');
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
