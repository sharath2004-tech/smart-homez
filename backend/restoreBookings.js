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

async function restoreBookings(backupFilePath) {
  try {
    // Validate backup file exists
    if (!fs.existsSync(backupFilePath)) {
      console.error(`❌ Backup file not found: ${backupFilePath}`);
      console.log('\n📁 Available backup files:');
      const backupDir = path.join(__dirname, 'backups');
      if (fs.existsSync(backupDir)) {
        const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
        files.forEach(file => console.log(`   - ${file}`));
      }
      process.exit(1);
    }

    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Read backup file
    console.log('\n📦 Reading backup file...');
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    console.log(`📊 Found ${backupData.length} bookings in backup`);

    if (backupData.length === 0) {
      console.log('⚠️  No bookings to restore');
      process.exit(0);
    }

    // Check if bookings already exist
    const existingCount = await Booking.countDocuments({});
    if (existingCount > 0) {
      console.log(`\n⚠️  Warning: Database already contains ${existingCount} booking(s)`);
      console.log('💡 This will add bookings without removing existing ones');
    }

    // Restore bookings
    console.log('\n📥 Restoring bookings...');

    // Remove _id and populated fields to avoid conflicts
    const bookingsToRestore = backupData.map(booking => {
      const { _id, customer, worker, service, __v, ...rest } = booking;
      return {
        ...rest,
        // Keep only IDs, not populated data
        customer: booking.customer?._id || booking.customer,
        worker: booking.worker?._id || booking.worker,
        service: booking.service?._id || booking.service
      };
    });

    const result = await Booking.insertMany(bookingsToRestore, { ordered: false });
    console.log(`✅ Restored ${result.length} bookings`);

    // Verify restoration
    const totalCount = await Booking.countDocuments({});
    console.log(`\n✅ Total bookings in database: ${totalCount}`);

    console.log('\n🎉 Restoration completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
}

// Get backup file from command line argument
const backupFile = process.argv[2];

if (!backupFile) {
  console.log('Usage: node restoreBookings.js <backup-file-path>');
  console.log('\nExample:');
  console.log('  node restoreBookings.js ./backups/bookings-backup-YYYY-MM-DDTHH-mm-ss.json');
  process.exit(1);
}

// Execute
const fullPath = path.isAbsolute(backupFile)
  ? backupFile
  : path.join(__dirname, backupFile);

restoreBookings(fullPath);
