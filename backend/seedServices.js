/**
 * Seed Basic Services
 * Creates essential home services for the platform
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Service from './models/Service.js';
import User from './models/User.js';

dotenv.config();

const seedServices = async () => {
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

    const services = [
      {
        name: 'House Deep Cleaning',
        description: 'Complete deep cleaning of your home including all rooms, kitchen, and bathrooms',
        category: 'cleaning',
        price: 1500,
        duration: 180, // 3 hours
        isActive: true,
        availableInAllLocations: true,
        createdBy: superAdmin._id
      },
      {
        name: 'Kitchen Cleaning',
        description: 'Thorough cleaning of kitchen including appliances, counters, and floors',
        category: 'cleaning',
        price: 600,
        duration: 90,
        isActive: true,
        availableInAllLocations: true,
        createdBy: superAdmin._id
      },
      {
        name: 'Bathroom Cleaning',
        description: 'Complete bathroom cleaning with sanitization',
        category: 'cleaning',
        price: 400,
        duration: 60,
        isActive: true,
        availableInAllLocations: true,
        createdBy: superAdmin._id
      },
      {
        name: 'AC Servicing',
        description: 'Professional AC cleaning and maintenance',
        category: 'maintenance',
        price: 800,
        duration: 90,
        isActive: true,
        availableInAllLocations: true,
        createdBy: superAdmin._id
      },
      {
        name: 'Plumbing Repair',
        description: 'Fix leaks, unclog drains, and repair pipes',
        category: 'maintenance',
        price: 500,
        duration: 60,
        isActive: true,
        availableInAllLocations: true,
        createdBy: superAdmin._id
      },
      {
        name: 'Electrical Repair',
        description: 'Fix electrical issues, install fixtures, and wire repairs',
        category: 'maintenance',
        price: 600,
        duration: 90,
        isActive: true,
        availableInAllLocations: true,
        createdBy: superAdmin._id
      },
      {
        name: 'Carpet Cleaning',
        description: 'Deep cleaning and stain removal for carpets',
        category: 'cleaning',
        price: 700,
        duration: 120,
        isActive: true,
        availableInAllLocations: true,
        createdBy: superAdmin._id
      },
      {
        name: 'Sofa Cleaning',
        description: 'Professional sofa and upholstery cleaning',
        category: 'cleaning',
        price: 800,
        duration: 90,
        isActive: true,
        availableInAllLocations: true,
        createdBy: superAdmin._id
      },
      {
        name: 'Painting Service',
        description: 'Interior and exterior painting services',
        category: 'maintenance',
        price: 2000,
        duration: 240, // 4 hours
        isActive: true,
        availableInAllLocations: true,
        createdBy: superAdmin._id
      },
      {
        name: 'Pest Control',
        description: 'Complete pest control treatment for your home',
        category: 'maintenance',
        price: 1200,
        duration: 120,
        isActive: true,
        availableInAllLocations: true,
        createdBy: superAdmin._id
      }
    ];

    console.log('🌱 Seeding services...');
    await Service.insertMany(services);

    console.log(`✅ ${services.length} services created successfully!\n`);
    console.log('📋 Services:');
    services.forEach((service, index) => {
      console.log(`${index + 1}. ${service.name} - ₹${service.price} (${service.duration} mins)`);
    });

    console.log('\n✅ Service seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding services:', error);
    process.exit(1);
  }
};

seedServices();
