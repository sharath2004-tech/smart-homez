/**
 * Seed Deep Cleaning Sub-Services
 * Creates Bathroom DC, Kitchen DC, and Windows DC as standalone services
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Service from './models/Service.js';
import User from './models/User.js';

dotenv.config();

const seedDeepCleaningServices = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get super admin to set as creator
    const superAdmin = await User.findOne({ role: 'super_admin' });
    if (!superAdmin) {
      console.error('❌ Super admin not found. Please run seedAdmins.js first.');
      process.exit(1);
    }

    const deepCleaningServices = [
      {
        name: 'Bathroom Deep Clean',
        description: 'Professional deep cleaning of your bathroom including tiles, fixtures, and sanitization',
        category: 'cleaning',
        serviceType: 'deep_cleaning_bathroom',
        price: 899,
        duration: 120, // 2 hours
        isActive: true,
        availableInAllLocations: true,
        tags: ['mini-service', 'spot-clean', 'deep-clean'],
        createdBy: superAdmin._id
      },
      {
        name: 'Kitchen Deep Clean',
        description: 'Complete kitchen deep cleaning including cabinets, appliances, counters, and floors',
        category: 'cleaning',
        serviceType: 'deep_cleaning_kitchen',
        price: 1199,
        duration: 150, // 2.5 hours
        isActive: true,
        availableInAllLocations: true,
        tags: ['mini-service', 'spot-clean', 'deep-clean'],
        createdBy: superAdmin._id
      },
      {
        name: 'Windows & Glass Cleaning',
        description: 'Professional window and glass cleaning service for crystal clear glass surfaces',
        category: 'cleaning',
        serviceType: 'fixed_window_cleaning',
        price: 599,
        duration: 90, // 1.5 hours
        isActive: true,
        availableInAllLocations: true,
        tags: ['mini-service', 'spot-clean'],
        createdBy: superAdmin._id
      }
    ];

    // Check if services already exist
    console.log('🔍 Checking existing services...');
    for (const service of deepCleaningServices) {
      const existing = await Service.findOne({ serviceType: service.serviceType });
      if (existing) {
        console.log(`⚠️  Service "${service.name}" already exists (${service.serviceType})`);
      }
    }

    console.log('\n🌱 Seeding deep cleaning sub-services...');
    const createdServices = await Service.insertMany(deepCleaningServices, { ordered: false }).catch((error) => {
      // If some services fail due to duplicates, that's okay
      if (error.code === 11000) {
        console.log('⚠️  Some services already exist (duplicate keys), skipping those');
        return error.insertedDocs || [];
      }
      throw error;
    });

    console.log(`✅ ${deepCleaningServices.length} deep cleaning services processed!\n`);
    console.log('📋 Services:');
    deepCleaningServices.forEach((service, index) => {
      console.log(`${index + 1}. ${service.name} - ₹${service.price} (${service.duration} mins) [${service.serviceType}]`);
    });

    console.log('\n✅ Deep Cleaning Services seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding services:', error);
    process.exit(1);
  }
};

seedDeepCleaningServices();
