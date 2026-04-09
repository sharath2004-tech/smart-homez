import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);
console.log('Connected');

const result = await mongoose.connection.collection('users').updateMany(
  { role: 'worker' },
  { $unset: { email: '' } }
);
console.log('Removed email from', result.modifiedCount, 'workers');

await mongoose.disconnect();
console.log('Done');
