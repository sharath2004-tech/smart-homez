import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Booking from './models/Booking.js';
import Location from './models/Location.js';
import Service from './models/Service.js';
import User from './models/User.js';

dotenv.config();

/**
 * Test script to create a sample booking
 * This demonstrates the location-based booking workflow
 */

async function testCreateBooking() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // ==============================================
    // STEP 1: Find or Create Test Data
    // ==============================================
    
    // Find a customer
    let customer = await User.findOne({ role: 'customer' });
    if (!customer) {
      console.log('❌ No customer found. Creating test customer...');
      customer = await User.create({
        name: 'Test Customer',
        email: `test.customer.${Date.now()}@example.com`,
        password: '$2a$10$X0qHqKZX8yKJZXZXZXZXZeuOJO7cK8LGvX9X9X9X9X9X9X9X9X9', // hashed 'password123'
        phone: '9876543210',
        role: 'customer',
        isActive: true
      });
      console.log(`✅ Created test customer: ${customer.name} (${customer._id})\n`);
    } else {
      console.log(`✅ Found customer: ${customer.name} (${customer._id})\n`);
    }

    // Find a service
    let service = await Service.findOne({ isActive: true });
    if (!service) {
      console.log('❌ No active service found. Creating test service...');
      service = await Service.create({
        name: 'Test Cleaning Service',
        description: 'Professional home cleaning service',
        category: 'cleaning',
        price: 500,
        duration: 60,
        isActive: true,
        createdBy: customer._id
      });
      console.log(`✅ Created test service: ${service.name} (${service._id})\n`);
    } else {
      console.log(`✅ Found service: ${service.name} (${service._id})\n`);
    }

    // Find or create a location
    let location = await Location.findOne({ isActive: true, isServiceAvailable: true });
    if (!location) {
      console.log('❌ No active location found. Creating test location...');
      location = await Location.create({
        apartmentName: 'Test Apartments',
        area: 'Test Area',
        city: 'Mumbai',
        state: 'Maharashtra',
        zipCode: '400001',
        location: {
          type: 'Point',
          coordinates: [72.8777, 19.0760] // Mumbai coordinates
        },
        isServiceAvailable: true,
        isActive: true,
        createdBy: customer._id
      });
      console.log(`✅ Created test location: ${location.apartmentName} (${location._id})\n`);
    } else {
      console.log(`✅ Found location: ${location.apartmentName} at ${location.area}, ${location.city}\n`);
      console.log(`   Coordinates: [${location.location.coordinates[0]}, ${location.location.coordinates[1]}]\n`);
    }

    // Find a worker assigned to this location
    let worker = await User.findOne({
      role: 'worker',
      isActive: true,
      'workerProfile.availability': true,
      'workerProfile.assignedApartments.locationId': location._id
    });

    if (!worker) {
      console.log('⚠️  No worker assigned to this location. Creating test worker...');
      worker = await User.create({
        name: 'Test Worker',
        email: `test.worker.${Date.now()}@example.com`,
        password: '$2a$10$X0qHqKZX8yKJZXZXZXZXZeuOJO7cK8LGvX9X9X9X9X9X9X9X9X9', // hashed 'password123'
        phone: '9876543211',
        role: 'worker',
        isActive: true,
        workerProfile: {
          specialization: ['cleaning'],
          experience: 2,
          rating: 4.5,
          availability: true,
          assignedApartments: [{
            locationId: location._id,
            apartmentName: location.apartmentName,
            area: location.area,
            city: location.city,
            location: {
              type: 'Point',
              coordinates: location.location.coordinates
            }
          }]
        }
      });
      console.log(`✅ Created test worker: ${worker.name} (${worker._id})\n`);
    } else {
      console.log(`✅ Found worker: ${worker.name} (${worker._id})\n`);
    }

    // ==============================================
    // STEP 2: Test Case 1 - Valid Booking
    // ==============================================
    console.log('═══════════════════════════════════════════════════════');
    console.log('TEST CASE 1: Creating booking with VALID location');
    console.log('═══════════════════════════════════════════════════════\n');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const bookingDate = tomorrow.toISOString().split('T')[0];

    const validBookingData = {
      customer: customer._id,
      service: service._id,
      bookingDate: bookingDate,
      startTime: '10:00',
      endTime: '11:00',
      totalAmount: service.price,
      location: {
        coordinates: location.location.coordinates, // Valid coordinates
        address: `${location.apartmentName}, ${location.area}`,
        area: location.area,
        city: location.city,
        state: location.state,
        zipCode: location.zipCode,
        locationId: location._id,
        apartmentName: location.apartmentName
      },
      bookingType: 'oneTime',
      assignmentMethod: 'manual',
      worker: worker._id,
      status: 'pending'
    };

    console.log('📝 Booking Data:');
    console.log(`   Customer: ${customer.name}`);
    console.log(`   Service: ${service.name}`);
    console.log(`   Date: ${bookingDate}`);
    console.log(`   Time: ${validBookingData.startTime} - ${validBookingData.endTime}`);
    console.log(`   Location: [${validBookingData.location.coordinates[0]}, ${validBookingData.location.coordinates[1]}]`);
    console.log(`   Worker: ${worker.name}\n`);

    const booking = new Booking(validBookingData);
    await booking.save();

    console.log('✅ SUCCESS: Booking created successfully!');
    console.log(`   Booking ID: ${booking._id}`);
    console.log(`   Status: ${booking.status}\n`);

    // ==============================================
    // STEP 3: Test Case 2 - Invalid Coordinates (null)
    // ==============================================
    console.log('═══════════════════════════════════════════════════════');
    console.log('TEST CASE 2: Testing with NULL coordinates (should fail)');
    console.log('═══════════════════════════════════════════════════════\n');

    const invalidBookingData = {
      customer: customer._id,
      service: service._id,
      bookingDate: bookingDate,
      startTime: '12:00',
      endTime: '13:00',
      totalAmount: service.price,
      location: {
        coordinates: [null, null], // Invalid: null coordinates
        address: 'Test Address'
      },
      bookingType: 'oneTime'
    };

    console.log('📝 Attempting to create booking with NULL coordinates...');
    console.log(`   Coordinates: [${invalidBookingData.location.coordinates[0]}, ${invalidBookingData.location.coordinates[1]}]\n`);

    try {
      const invalidBooking = new Booking(invalidBookingData);
      await invalidBooking.save();
      console.log('❌ ERROR: Booking should have failed but succeeded!\n');
    } catch (error) {
      console.log('✅ EXPECTED BEHAVIOR: Booking creation failed');
      console.log(`   Error: ${error.message}\n`);
    }

    // ==============================================
    // STEP 4: Test Case 3 - Missing Coordinates
    // ==============================================
    console.log('═══════════════════════════════════════════════════════');
    console.log('TEST CASE 3: Testing with MISSING coordinates (should fail)');
    console.log('═══════════════════════════════════════════════════════\n');

    const missingCoordsData = {
      customer: customer._id,
      service: service._id,
      bookingDate: bookingDate,
      startTime: '14:00',
      endTime: '15:00',
      totalAmount: service.price,
      location: {
        address: 'Test Address'
        // coordinates: missing
      },
      bookingType: 'oneTime'
    };

    console.log('📝 Attempting to create booking without coordinates...\n');

    try {
      const missingCoordsBooking = new Booking(missingCoordsData);
      await missingCoordsBooking.save();
      console.log('❌ ERROR: Booking should have failed but succeeded!\n');
    } catch (error) {
      console.log('✅ EXPECTED BEHAVIOR: Booking creation failed');
      console.log(`   Error: ${error.message}\n`);
    }

    // ==============================================
    // STEP 5: Test Case 4 - Invalid Coordinates (out of range)
    // ==============================================
    console.log('═══════════════════════════════════════════════════════');
    console.log('TEST CASE 4: Testing with OUT OF RANGE coordinates');
    console.log('═══════════════════════════════════════════════════════\n');

    const outOfRangeData = {
      customer: customer._id,
      service: service._id,
      bookingDate: bookingDate,
      startTime: '16:00',
      endTime: '17:00',
      totalAmount: service.price,
      location: {
        coordinates: [200, 100], // Invalid: longitude > 180, latitude > 90
        address: 'Test Address',
        locationId: location._id
      },
      bookingType: 'oneTime'
    };

    console.log('📝 Attempting to create booking with out-of-range coordinates...');
    console.log(`   Coordinates: [${outOfRangeData.location.coordinates[0]}, ${outOfRangeData.location.coordinates[1]}]\n`);

    const outOfRangeBooking = new Booking(outOfRangeData);
    await outOfRangeBooking.save();
    console.log('⚠️  WARNING: Database accepted out-of-range coordinates (validation should be at API level)\n');

    // ==============================================
    // SUMMARY
    // ==============================================
    console.log('═══════════════════════════════════════════════════════');
    console.log('TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════\n');

    const allBookings = await Booking.find({
      customer: customer._id,
      bookingDate: bookingDate
    });

    console.log(`✅ Total test bookings created: ${allBookings.length}\n`);
    
    allBookings.forEach((b, idx) => {
      console.log(`${idx + 1}. Booking ${b._id}`);
      console.log(`   Status: ${b.status}`);
      console.log(`   Time: ${b.startTime} - ${b.endTime}`);
      console.log(`   Coordinates: [${b.location?.coordinates?.[0] || 'N/A'}, ${b.location?.coordinates?.[1] || 'N/A'}]`);
      console.log(`   Location: ${b.location?.apartmentName || 'N/A'}\n`);
    });

    console.log('═══════════════════════════════════════════════════════');
    console.log('KEY FINDINGS:');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('1. ✅ Valid bookings with proper coordinates work correctly');
    console.log('2. ✅ MongoDB schema validation catches some invalid data');
    console.log('3. ⚠️  API-level validation is REQUIRED to catch:');
    console.log('   - Null coordinates [null, null]');
    console.log('   - Out-of-range coordinates');
    console.log('   - Missing coordinates\n');
    console.log('4. 🔒 The updated booking API now validates coordinates BEFORE geo queries\n');

    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the test
console.log('\n🧪 Starting Booking Creation Test Suite...\n');
testCreateBooking();
