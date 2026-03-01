import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Booking from './models/Booking.js';
import Service from './models/Service.js';
import User from './models/User.js';

dotenv.config();

async function fixCorruptedBookings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find the corrupted booking
    const corruptedBookingId = '69971536f779b2c407d404f7';
    const booking = await Booking.findById(corruptedBookingId);

    if (!booking) {
      console.log('❌ Booking not found');
      return;
    }

    console.log('Found booking:', {
      _id: booking._id,
      customer: booking.customer,
      service: booking.service,
      worker: booking.worker,
      isRecurring: booking.isRecurring,
      status: booking.status
    });

    // Check if references exist
    const customerExists = booking.customer ? await User.findById(booking.customer) : null;
    const serviceExists = booking.service ? await Service.findById(booking.service) : null;

    console.log('Reference check:', {
      customerExists: !!customerExists,
      serviceExists: !!serviceExists
    });

    // If references are broken, delete the booking
    if (!customerExists || !serviceExists) {
      console.log('⚠️  Broken references detected. Deleting booking...');
      await Booking.findByIdAndDelete(corruptedBookingId);
      console.log('✅ Deleted corrupted booking');
    } else {
      console.log('✅ References are valid');
    }

    // Find and fix all bookings with broken references
    console.log('\n🔍 Checking all bookings for broken references...');
    const allBookings = await Booking.find({});
    let fixedCount = 0;

    for (const booking of allBookings) {
      let needsDelete = false;

      if (booking.customer) {
        const customerExists = await User.findById(booking.customer);
        if (!customerExists) {
          console.log(`❌ Booking ${booking._id}: customer reference broken`);
          needsDelete = true;
        }
      } else {
        console.log(`❌ Booking ${booking._id}: missing customer`);
        needsDelete = true;
      }

      if (booking.service) {
        const serviceExists = await Service.findById(booking.service);
        if (!serviceExists) {
          console.log(`❌ Booking ${booking._id}: service reference broken`);
          needsDelete = true;
        }
      } else {
        console.log(`❌ Booking ${booking._id}: missing service`);
        needsDelete = true;
      }

      // Check worker reference if assigned
      if (booking.worker) {
        const workerExists = await User.findById(booking.worker);
        if (!workerExists) {
          console.log(`⚠️  Booking ${booking._id}: worker reference broken - clearing worker`);
          booking.worker = null;
          await booking.save();
          fixedCount++;
        }
      }

      if (needsDelete) {
        await Booking.findByIdAndDelete(booking._id);
        console.log(`🗑️  Deleted booking ${booking._id}`);
        fixedCount++;
      }
    }

    console.log(`\n✅ Cleanup complete. Fixed/deleted ${fixedCount} bookings.`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

fixCorruptedBookings();
