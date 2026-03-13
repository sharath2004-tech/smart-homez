import dotenv from 'dotenv';
import fs from 'fs';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import Booking from './models/Booking.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthy-homez';

async function deleteAllBookings() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Step 1: Export all bookings to backup file
    console.log('\n📦 Creating backup...');
    const bookings = await Booking.find({})
      .populate('customer', 'name email phone')
      .populate('worker', 'name email phone')
      .populate('service', 'name')
      .lean();

    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFilePath = path.join(backupDir, `bookings-backup-${timestamp}.json`);

    fs.writeFileSync(backupFilePath, JSON.stringify(bookings, null, 2), 'utf8');
    console.log(`✅ Backup created: ${backupFilePath}`);
    console.log(`📊 Total bookings backed up: ${bookings.length}`);

    // Step 2: Delete all bookings
    console.log('\n🗑️  Deleting all bookings from database...');
    const result = await Booking.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} bookings`);

    // Step 3: Verify deletion
    const remainingCount = await Booking.countDocuments({});
    console.log(`\n✅ Verification: ${remainingCount} bookings remaining in database`);

    console.log('\n🎉 Operation completed successfully!');
    console.log(`📁 Backup file location: ${backupFilePath}`);
    console.log('💡 You can restore bookings from this file if needed.');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
}

// Execute
deleteAllBookings();
