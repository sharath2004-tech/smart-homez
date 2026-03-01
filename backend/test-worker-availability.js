import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Booking from './models/Booking.js';
import Location from './models/Location.js';
import User from './models/User.js';

dotenv.config();

async function testWorkerAvailability() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔗 Connected to MongoDB');

    // Test 1: Check current workers and their availability
    console.log('\n📋 Test 1: Current Workers and Availability Status');
    console.log('='.repeat(60));
    
    const workers = await User.find({ role: 'worker' })
      .select('name email workerProfile')
      .lean();
    
    console.log(`Found ${workers.length} workers:\n`);
    workers.forEach((worker, index) => {
      console.log(`${index + 1}. ${worker.name} (${worker.email})`);
      console.log(`   Status: ${worker.workerProfile?.availability ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
      console.log(`   Rating: ${worker.workerProfile?.rating || 'N/A'}`);
      console.log(`   Completed Services: ${worker.workerProfile?.completedServices || 0}`);
      console.log(`   Assigned Locations: ${worker.workerProfile?.assignedLocations?.length || 0}`);
      console.log('');
    });

    // Test 2: Toggle a worker offline
    if (workers.length > 0) {
      const testWorker = workers[0];
      console.log('\n📋 Test 2: Toggle Worker Availability');
      console.log('='.repeat(60));
      console.log(`Testing with: ${testWorker.name}`);
      console.log(`Current status: ${testWorker.workerProfile?.availability ? 'ONLINE' : 'OFFLINE'}`);
      
      // Toggle to offline
      await User.findByIdAndUpdate(testWorker._id, {
        'workerProfile.availability': false
      });
      console.log('✅ Updated worker to OFFLINE');
      
      // Verify update
      const updatedWorker = await User.findById(testWorker._id).select('name workerProfile');
      console.log(`New status: ${updatedWorker.workerProfile?.availability ? 'ONLINE' : 'OFFLINE'}`);
      
      // Toggle back to online
      await User.findByIdAndUpdate(testWorker._id, {
        'workerProfile.availability': true
      });
      console.log('✅ Updated worker to ONLINE');
      
      const revertedWorker = await User.findById(testWorker._id).select('name workerProfile');
      console.log(`Final status: ${revertedWorker.workerProfile?.availability ? 'ONLINE' : 'OFFLINE'}`);
    }

    // Test 3: Check location-based worker assignment with availability
    console.log('\n📋 Test 3: Location-Based Worker Assignment');
    console.log('='.repeat(60));
    
    const locations = await Location.find()
      .populate('assignedWorkers', 'name email workerProfile')
      .limit(5)
      .lean();
    
    console.log(`Checking ${locations.length} locations:\n`);
    locations.forEach((location, index) => {
      console.log(`${index + 1}. ${location.apartmentName || 'Unknown'} - ${location.city}`);
      console.log(`   Coordinates: [${location.location.coordinates[0]}, ${location.location.coordinates[1]}]`);
      console.log(`   Assigned Workers: ${location.assignedWorkers?.length || 0}`);
      
      if (location.assignedWorkers && location.assignedWorkers.length > 0) {
        location.assignedWorkers.forEach(worker => {
          const status = worker.workerProfile?.availability ? '🟢 ONLINE' : '🔴 OFFLINE';
          console.log(`     - ${worker.name} (${status})`);
        });
      } else {
        console.log('     No workers assigned');
      }
      console.log('');
    });

    // Test 4: Count online vs offline workers by location
    console.log('\n📋 Test 4: Online vs Offline Workers Summary');
    console.log('='.repeat(60));
    
    const onlineWorkers = await User.countDocuments({ 
      role: 'worker', 
      'workerProfile.availability': true 
    });
    
    const offlineWorkers = await User.countDocuments({ 
      role: 'worker', 
      'workerProfile.availability': { $ne: true } 
    });
    
    console.log(`🟢 Online Workers: ${onlineWorkers}`);
    console.log(`🔴 Offline Workers: ${offlineWorkers}`);
    console.log(`📊 Total Workers: ${workers.length}`);
    
    // Test 5: Check if there are any bookings assigned to offline workers
    console.log('\n📋 Test 5: Bookings with Offline Workers');
    console.log('='.repeat(60));
    
    const offlineWorkerIds = workers
      .filter(w => !w.workerProfile?.availability)
      .map(w => w._id);
    
    if (offlineWorkerIds.length > 0) {
      const bookings = await Booking.find({
        assignedWorkers: { $in: offlineWorkerIds },
        status: { $in: ['pending', 'confirmed'] }
      })
        .populate('assignedWorkers', 'name workerProfile')
        .populate('customer', 'name')
        .populate('service', 'name')
        .limit(10)
        .lean();
      
      if (bookings.length > 0) {
        console.log(`⚠️  Found ${bookings.length} pending/confirmed bookings with offline workers:\n`);
        bookings.forEach((booking, index) => {
          console.log(`${index + 1}. Booking ID: ${booking._id}`);
          console.log(`   Customer: ${booking.customer?.name}`);
          console.log(`   Service: ${booking.service?.name}`);
          console.log(`   Status: ${booking.status}`);
          console.log(`   Workers:`);
          booking.assignedWorkers.forEach(worker => {
            const status = worker.workerProfile?.availability ? '🟢 ONLINE' : '🔴 OFFLINE';
            console.log(`     - ${worker.name} (${status})`);
          });
          console.log('');
        });
      } else {
        console.log('✅ No pending/confirmed bookings assigned to offline workers');
      }
    } else {
      console.log('✅ All workers are currently online');
    }

    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testWorkerAvailability();
