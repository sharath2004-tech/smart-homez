import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';

dotenv.config();

const checkAllAccounts = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-homez';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');

    // Find all users
    const users = await User.find({})
      .select('name email role isActive createdAt')
      .sort({ createdAt: -1 })
      .limit(50);

    if (users.length === 0) {
      console.log('❌ No users found in database');
      await mongoose.disconnect();
      return;
    }

    console.log('📊 USER ACCOUNTS STATUS');
    console.log('='.repeat(100));
    console.log('');

    const activeUsers = users.filter(u => u.isActive);
    const inactiveUsers = users.filter(u => !u.isActive);

    console.log(`Total Users: ${users.length}`);
    console.log(`✅ Active: ${activeUsers.length}`);
    console.log(`❌ Deactivated: ${inactiveUsers.length}`);
    console.log('');
    console.log('='.repeat(100));
    console.log('');

    // Group by role
    const byRole = {
      customer: users.filter(u => u.role === 'customer'),
      worker: users.filter(u => u.role === 'worker'),
      admin: users.filter(u => u.role === 'admin'),
      super_admin: users.filter(u => u.role === 'super_admin')
    };

    for (const [role, roleUsers] of Object.entries(byRole)) {
      if (roleUsers.length === 0) continue;

      console.log(`\n👥 ${role.toUpperCase()} ACCOUNTS (${roleUsers.length})`);
      console.log('-'.repeat(100));

      roleUsers.forEach((user, index) => {
        const status = user.isActive ? '✅ Active' : '❌ Deactivated';
        const date = new Date(user.createdAt).toLocaleDateString();
        console.log(`${index + 1}. ${status} | ${user.name.padEnd(25)} | ${user.email.padEnd(35)} | Created: ${date}`);
      });
    }

    console.log('\n' + '='.repeat(100));
    
    if (inactiveUsers.length > 0) {
      console.log('\n⚠️  DEACTIVATED ACCOUNTS:');
      console.log('-'.repeat(100));
      inactiveUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email}) - ${user.role}`);
      });
      console.log('\n💡 To activate an account, run:');
      console.log('   node activateAccount.js <email>');
    }

    console.log('\n' + '='.repeat(100));
    console.log('');

    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
};

// Run the check
checkAllAccounts();
