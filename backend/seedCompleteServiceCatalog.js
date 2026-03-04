/**
 * Complete Service Catalog with Required Categories
 * Including Insta Maid, Monthly Subscription, and Specialized Services
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Service from './models/Service.js';
import User from './models/User.js';

dotenv.config();

const seedCompleteServices = async () => {
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
      // ========== MAID SERVICES (Time-Based) ==========
      {
        name: 'Insta Maid Service',
        description: 'On-demand maid service available instantly. Minimum 1 hour booking required. Perfect for quick cleaning tasks.',
        category: 'cleaning',
        price: 150, // per hour
        duration: 60, // 1 hour minimum
        pricingPlans: {
          oneTime: 150, // per hour
          daily: 130, // per hour (discounted)
          weekly: 120, // per hour (bulk discount)
          monthly: 110 // per hour (best value)
        },
        isActive: true,
        availableInAllLocations: true,
        tags: ['instant', 'maid', 'hourly', 'flexible'],
        createdBy: superAdmin._id
      },
      {
        name: 'Monthly Maid Subscription',
        description: 'Regular monthly maid service. Minimum 1 hour per session. Choose your schedule and get consistent service.',
        category: 'cleaning',
        price: 3000, // monthly package (1 hour daily)
        duration: 60, // 1 hour per session
        pricingPlans: {
          oneTime: 150, // single session
          daily: 4000, // daily service (30 days)
          weekly: 2400, // weekly service (4 weeks × 2 hrs)
          monthly: 3000 // monthly package (flexible hours)
        },
        isActive: true,
        availableInAllLocations: true,
        tags: ['subscription', 'maid', 'recurring', 'monthly'],
        createdBy: superAdmin._id
      },
      
      // ========== DEEP CLEANING SERVICES ==========
      {
        name: 'Full House Deep Cleaning',
        description: 'Complete deep cleaning of entire house including all rooms, kitchen, and bathrooms. Size-based pricing.',
        category: 'cleaning',
        price: 2500, // base price for 2 BHK
        duration: 240, // 4 hours
        pricingPlans: {
          oneTime: 2500,
          daily: 2200,
          weekly: 9500,
          monthly: 35000
        },
        isActive: true,
        availableInAllLocations: true,
        tags: ['deep-cleaning', 'full-house', 'comprehensive'],
        createdBy: superAdmin._id
      },
      {
        name: 'Room Deep Cleaning',
        description: 'Intensive deep cleaning of individual rooms with detailed attention to every corner',
        category: 'cleaning',
        price: 600,
        duration: 90,
        isActive: true,
        availableInAllLocations: true,
        tags: ['deep-cleaning', 'room-specific'],
        createdBy: superAdmin._id
      },
      {
        name: 'Kitchen Deep Cleaning',
        description: 'Thorough deep cleaning of kitchen including appliances, cabinets, chimney, and exhaust. Degreasing and sanitization.',
        category: 'cleaning',
        price: 1200,
        duration: 120,
        isActive: true,
        availableInAllLocations: true,
        tags: ['deep-cleaning', 'kitchen', 'degreasing'],
        createdBy: superAdmin._id
      },
      {
        name: 'Bathroom Deep Cleaning',
        description: 'Complete deep cleaning and sanitization of bathroom with descaling and anti-bacterial treatment',
        category: 'cleaning',
        price: 700,
        duration: 90,
        isActive: true,
        availableInAllLocations: true,
        tags: ['deep-cleaning', 'bathroom', 'sanitization'],
        createdBy: superAdmin._id
      },
      
      // ========== SPECIALIZED FIXED-PRICE SERVICES ==========
      {
        name: 'Basic Washroom Cleaning',
        description: 'Quick and efficient basic washroom cleaning - floor, toilet, sink, and mirror',
        category: 'cleaning',
        price: 300,
        duration: 30,
        isActive: true,
        availableInAllLocations: true,
        tags: ['washroom', 'basic', 'quick', 'fixed-price'],
        createdBy: superAdmin._id
      },
      {
        name: 'Washroom Deep Cleaning',
        description: 'Intensive washroom deep cleaning with descaling, tile scrubbing, and complete sanitization',
        category: 'cleaning',
        price: 600,
        duration: 60,
        isActive: true,
        availableInAllLocations: true,
        tags: ['washroom', 'deep-cleaning', 'sanitization', 'fixed-price'],
        createdBy: superAdmin._id
      },
      {
        name: 'Fan Cleaning',
        description: 'Complete cleaning of ceiling fans including blades, motor housing, and light fixtures',
        category: 'cleaning',
        price: 200,
        duration: 30,
        isActive: true,
        availableInAllLocations: true,
        tags: ['fan', 'ceiling-fan', 'fixed-price'],
        createdBy: superAdmin._id
      },
      {
        name: 'Window Cleaning',
        description: 'Professional window cleaning including glass, frames, and sills - inside and outside',
        category: 'cleaning',
        price: 150, // per window
        duration: 20, // per window
        isActive: true,
        availableInAllLocations: true,
        tags: ['window', 'glass', 'fixed-price'],
        createdBy: superAdmin._id
      },
      {
        name: 'Sofa Cleaning',
        description: 'Professional sofa and upholstery cleaning with fabric care and stain removal',
        category: 'cleaning',
        price: 800,
        duration: 90,
        isActive: true,
        availableInAllLocations: true,
        tags: ['sofa', 'upholstery', 'fixed-price'],
        createdBy: superAdmin._id
      },
      {
        name: 'Carpet Cleaning',
        description: 'Deep cleaning and stain removal for carpets with professional equipment',
        category: 'cleaning',
        price: 700,
        duration: 120,
        isActive: true,
        availableInAllLocations: true,
        tags: ['carpet', 'deep-cleaning', 'fixed-price'],
        createdBy: superAdmin._id
      },
      {
        name: 'Balcony Cleaning',
        description: 'Complete balcony cleaning including floor scrubbing, railing, and window cleaning',
        category: 'cleaning',
        price: 400,
        duration: 45,
        isActive: true,
        availableInAllLocations: true,
        tags: ['balcony', 'outdoor', 'fixed-price'],
        createdBy: superAdmin._id
      },
      
      // ========== MAINTENANCE SERVICES ==========
      {
        name: 'AC Servicing',
        description: 'Professional AC cleaning and maintenance service',
        category: 'maintenance',
        price: 800,
        duration: 90,
        isActive: true,
        availableInAllLocations: true,
        tags: ['ac', 'maintenance'],
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
        tags: ['plumbing', 'repair'],
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
        tags: ['electrical', 'repair'],
        createdBy: superAdmin._id
      },
      {
        name: 'Painting Service',
        description: 'Interior and exterior painting services',
        category: 'maintenance',
        price: 2000,
        duration: 240,
        isActive: true,
        availableInAllLocations: true,
        tags: ['painting', 'renovation'],
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
        tags: ['pest-control', 'treatment'],
        createdBy: superAdmin._id
      }
    ];

    console.log('🌱 Clearing existing services and seeding complete catalog...');
    await Service.deleteMany({});
    await Service.insertMany(services);

    console.log(`✅ ${services.length} services created successfully!\n`);
    
    console.log('📋 MAID SERVICES (Time-Based):');
    services.filter(s => s.tags?.includes('maid')).forEach((service, index) => {
      console.log(`${index + 1}. ${service.name} - ₹${service.price}/hr`);
    });
    
    console.log('\n📋 DEEP CLEANING SERVICES:');
    services.filter(s => s.tags?.includes('deep-cleaning')).forEach((service, index) => {
      console.log(`${index + 1}. ${service.name} - ₹${service.price} (${service.duration} mins)`);
    });
    
    console.log('\n📋 SPECIALIZED FIXED-PRICE SERVICES:');
    services.filter(s => s.tags?.includes('fixed-price')).forEach((service, index) => {
      console.log(`${index + 1}. ${service.name} - ₹${service.price} (${service.duration} mins)`);
    });
    
    console.log('\n📋 MAINTENANCE SERVICES:');
    services.filter(s => s.category === 'maintenance').forEach((service, index) => {
      console.log(`${index + 1}. ${service.name} - ₹${service.price} (${service.duration} mins)`);
    });

    console.log('\n✅ Complete service catalog seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding services:', error);
    process.exit(1);
  }
};

seedCompleteServices();
