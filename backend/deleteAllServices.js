import mongoose from 'mongoose';
import Service from './models/Service.js';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/healthyHomez';

async function deleteAllServices() {
  try {
    await mongoose.connect(mongoUri);
    const result = await Service.deleteMany({});
    console.log(`Deleted ${result.deletedCount} services.`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

deleteAllServices();
