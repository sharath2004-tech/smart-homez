import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SubscriptionSection from './models/SubscriptionSection.js';
import User from './models/User.js';

dotenv.config();

const seedSubscriptionSections = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/healthy-homez');
    console.log('✅ Connected to MongoDB');

    // Find or create a default admin user for createdBy
    let adminUser = await User.findOne({ role: 'super_admin' });
    if (!adminUser) {
      adminUser = await User.findOne({ role: 'admin' });
    }
    if (!adminUser) {
      console.warn('⚠️  No admin user found. Attempting to use any user...');
      adminUser = await User.findOne();
    }

    if (!adminUser) {
      console.error('❌ No users found in database. Please create an admin user first.');
      process.exit(1);
    }

    console.log(`📝 Using user: ${adminUser.name} (${adminUser.role})`);

    // Default subscription sections
    const defaultSections = [
      {
        name: 'Maid Services Subscription',
        description: 'Regular housekeeping & daily cleaning plans',
        emoji: '👩‍💼',
        icon: 'Users',
        color: 'blue',
        sortOrder: 0,
        filterConfig: {
          serviceTypeIncludes: ['monthly_subscription'],
          serviceTypeExcludes: [],
          namePatternsInclude: ['maid', 'housekeeping', 'daily cleaning'],
          namePatternsExclude: ['washroom']
        },
        isActive: true
      },
      {
        name: 'Washroom Cleaning Subscription',
        description: 'Professional bathroom deep clean & maintenance plans',
        emoji: '🚿',
        icon: 'Droplet',
        color: 'teal',
        sortOrder: 1,
        filterConfig: {
          serviceTypeIncludes: ['fixed_washroom_deep', 'fixed_washroom_basic'],
          serviceTypeExcludes: [],
          namePatternsInclude: ['washroom', 'bathroom', 'wash'],
          namePatternsExclude: []
        },
        isActive: true
      }
    ];

    // Clear existing sections (optional - comment out to keep existing)
    const deletedCount = await SubscriptionSection.deleteMany({});
    console.log(`🗑️  Deleted ${deletedCount.deletedCount} existing sections`);

    // Create sections
    const createdSections = [];
    for (const sectionData of defaultSections) {
      const section = new SubscriptionSection({
        ...sectionData,
        createdBy: adminUser._id
      });
      await section.save();
      createdSections.push(section);
      console.log(`✅ Created section: ${section.name}`);
    }

    console.log(`\n🎉 Successfully seeded ${createdSections.length} subscription sections!`);
    console.log('\n📋 Seeded Sections:');
    createdSections.forEach(section => {
      console.log(`  • ${section.emoji} ${section.name}`);
      console.log(`    ID: ${section._id}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding subscription sections:', error);
    process.exit(1);
  }
};

seedSubscriptionSections();
