import mongoose from 'mongoose';
import Service from './models/Service.js';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/healthyHomez';

async function checkServices() {
  try {
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    const totalCount = await Service.countDocuments();
    const activeCount = await Service.countDocuments({ isActive: true });
    const inactiveCount = await Service.countDocuments({ isActive: false });

    console.log(`\nService Statistics:`);
    console.log(`  Total services: ${totalCount}`);
    console.log(`  Active services: ${activeCount}`);
    console.log(`  Inactive services: ${inactiveCount}`);

    // Check for duplicates by name
    const cursor = await Service.collection.aggregate([
      { $group: { _id: '$name', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    const duplicates = await cursor.toArray();

    if (duplicates.length > 0) {
      console.log(`\n⚠️  Found ${duplicates.length} duplicate service names:`);
      duplicates.forEach(d => console.log(`  - "${d._id}": ${d.count} copies`));
    } else {
      console.log(`\n✓ No duplicate service names found`);
    }

    // Show all services summary
    const services = await Service.find().select('name category isActive serviceType createdAt').sort({ createdAt: -1 });
    console.log(`\nAll Services (${services.length}):`);
    services.forEach((s, i) => {
      const status = s.isActive ? '✓' : '✗';
      console.log(`  ${i + 1}. [${status}] ${s.name} (${s.serviceType})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkServices();
