import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Location from './models/Location.js';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const assignWorkersToLocations = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get workers without locations
    const workers = await User.find({ 
      role: 'worker',
      $or: [
        { 'workerProfile.assignedApartments': { $exists: false } },
        { 'workerProfile.assignedApartments': { $size: 0 } }
      ]
    }).select('name email');

    if (workers.length === 0) {
      console.log('✅ All workers already have location assignments!');
      await mongoose.disconnect();
      rl.close();
      return;
    }

    console.log(`Found ${workers.length} workers without location assignments:\n`);
    workers.forEach((w, i) => {
      console.log(`${i + 1}. ${w.name} (${w.email}) - ID: ${w._id}`);
    });

    // Get all locations
    const locations = await Location.find({}).select('apartmentName area city');
    console.log(`\n\nAvailable locations:\n`);
    locations.forEach((loc, i) => {
      console.log(`${i + 1}. ${loc.apartmentName} - ${loc.area}, ${loc.city} - ID: ${loc._id}`);
    });

    console.log('\n\n==================== ASSIGN WORKERS ====================\n');
    
    for (const worker of workers) {
      console.log(`\n👷 Worker: ${worker.name} (${worker.email})`);
      const answer = await question(`Enter location number(s) separated by commas (or 'skip'): `);
      
      if (answer.toLowerCase() === 'skip') {
        console.log('   Skipped');
        continue;
      }

      const locationIndices = answer.split(',').map(n => parseInt(n.trim()) - 1);
      const selectedLocations = locationIndices
        .filter(i => i >= 0 && i < locations.length)
        .map(i => locations[i]);

      if (selectedLocations.length === 0) {
        console.log('   ❌ No valid locations selected');
        continue;
      }

      // Update worker
      const assignedApartments = selectedLocations.map(loc => ({
        locationId: loc._id,
        apartmentName: loc.apartmentName,
        building: loc.building,
        area: loc.area,
        city: loc.city,
        location: loc.location,
        maxWalkingDistance: 500
      }));

      await User.findByIdAndUpdate(worker._id, {
        $set: { 'workerProfile.assignedApartments': assignedApartments }
      });

      // Update locations
      for (const loc of selectedLocations) {
        await Location.findByIdAndUpdate(loc._id, {
          $addToSet: { assignedWorkers: { worker: worker._id, assignedAt: new Date() } }
        });
      }

      console.log(`   ✅ Assigned to: ${selectedLocations.map(l => l.apartmentName).join(', ')}`);
    }

    console.log('\n\n✅ All workers processed!');
    await mongoose.disconnect();
    rl.close();
  } catch (error) {
    console.error('❌ Error:', error);
    rl.close();
    process.exit(1);
  }
};

assignWorkersToLocations();
