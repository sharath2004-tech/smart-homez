import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Location from './models/Location.js';
import User from './models/User.js';
import { SUPPORT_PHONE_NUMBER } from './config/constants.js';

dotenv.config();

const seedAdmins = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    // Create Super Admin
    const existingSuperAdmin = await User.findOne({ email: 'superadmin@pureappweave.com' });
    
    if (!existingSuperAdmin) {
      const superAdmin = new User({
        name: 'Super Admin',
        email: 'superadmin@pureappweave.com',
        password: 'SuperAdmin@123',
        phone: SUPPORT_PHONE_NUMBER,
        role: 'super_admin',
        isVerified: true
      });

      await superAdmin.save();
      console.log('✅ Super Admin created');
      console.log('📧 Email: superadmin@pureappweave.com');
      console.log('🔑 Password: SuperAdmin@123');
    } else {
      console.log('ℹ️  Super Admin already exists');
    }

    // Create a sample location (Andheri, Mumbai)
    const existingLocation = await Location.findOne({ apartmentName: 'Sample Apartment Complex' });
    
    let locationId;
    if (!existingLocation) {
      const location = new Location({
        apartmentName: 'Sample Apartment Complex',
        building: 'Tower A',
        area: 'Andheri West',
        city: 'Mumbai',
        state: 'Maharashtra',
        zipCode: '400053',
        location: {
          type: 'Point',
          coordinates: [72.8347, 19.1136] // [longitude, latitude] for Andheri
        },
        maxServiceRadius: 500,
        createdBy: (await User.findOne({ role: 'super_admin' }))._id
      });

      await location.save();
      locationId = location._id;
      console.log('✅ Sample location created (Andheri West, Mumbai)');
    } else {
      locationId = existingLocation._id;
      console.log('ℹ️  Sample location already exists');
    }

    // Create Sample Admin
    const existingAdmin = await User.findOne({ email: 'admin@pureappweave.com' });
    
    if (!existingAdmin) {
      const admin = new User({
        name: 'Admin Andheri',
        email: 'admin@pureappweave.com',
        password: 'Admin@123',
        phone: '+91 9888888888',
        role: 'admin',
        adminProfile: {
          assignedLocations: [{
            locationId: locationId,
            locationName: 'Sample Apartment Complex',
            area: 'Andheri West',
            city: 'Mumbai'
          }],
          permissions: {
            canCreateWorkers: true,
            canDeleteWorkers: true,
            canManageApartments: true,
            canViewReports: true
          },
          createdBy: (await User.findOne({ role: 'super_admin' }))._id
        },
        isVerified: true
      });

      await admin.save();

      // Update location with assigned admin
      await Location.findByIdAndUpdate(locationId, { assignedAdmin: admin._id });

      console.log('✅ Sample Admin created');
      console.log('📧 Email: admin@pureappweave.com');
      console.log('🔑 Password: Admin@123');
      console.log('📍 Assigned to: Andheri West, Mumbai');
    } else {
      console.log('ℹ️  Sample Admin already exists');
    }

    console.log('\n=== ADMIN CREDENTIALS ===');
    console.log('\n🔴 SUPER ADMIN (Full Access)');
    console.log('Email: superadmin@pureappweave.com');
    console.log('Password: SuperAdmin@123');
    console.log('Permissions: Create locations, create admins, manage all');
    
    console.log('\n🟠 ADMIN (Location-based Access)');
    console.log('Email: admin@pureappweave.com');
    console.log('Password: Admin@123');
    console.log('Permissions: Manage workers in Andheri West, Mumbai');
    
    console.log('\n✅ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedAdmins();
