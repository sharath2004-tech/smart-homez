import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';

dotenv.config();

const activateAccount = async (email) => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-homez';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');

    if (!email) {
      console.log('❌ Please provide an email address');
      console.log('Usage: node activateAccount.js <email>');
      await mongoose.disconnect();
      return;
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log(`❌ User not found with email: ${email}`);
      await mongoose.disconnect();
      return;
    }

    // Check current status
    console.log('📋 User Information:');
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Current Status: ${user.isActive ? '✅ Active' : '❌ Deactivated'}`);
    console.log('');

    if (user.isActive) {
      console.log('ℹ️  Account is already active!');
    } else {
      // Activate account
      user.isActive = true;
      await user.save();
      console.log('✅ Account has been ACTIVATED!');
      console.log('👉 You can now login with this account.');
    }

    console.log('');
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

// Get email from command line argument
const email = process.argv[2];
activateAccount(email);
