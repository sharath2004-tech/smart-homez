import mongoose from 'mongoose';
import dotenv from 'dotenv';
import DashboardPreferences from './models/DashboardPreferences.js';

dotenv.config();

const fixWashroomRoute = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/healthyhomez';
    await mongoose.connect(mongoUri);
    console.log('📀 Connected to MongoDB');

    // Find and update the dashboard preferences
    const preferences = await DashboardPreferences.findOne();
    
    if (preferences) {
      // Find the washroom service
      const washroomService = preferences.services.find(s => s.id === 'intense_washroom');
      
      if (washroomService) {
        console.log(`🔍 Found washroom service with path: ${washroomService.path}`);
        
        if (washroomService.path === '/customer/services/washroom') {
          // Update to the correct path
          washroomService.path = '/customer/services/spot-clean';
          await preferences.save();
          console.log('✅ Updated washroom service path to: /customer/services/spot-clean');
        } else {
          console.log(`✓ Washroom service path is already correct: ${washroomService.path}`);
        }
      } else {
        console.log('⚠️  Washroom service not found in preferences');
      }
    } else {
      console.log('⚠️  Dashboard preferences not found in database');
    }

    await mongoose.disconnect();
    console.log('📀 Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing washroom route:', error);
    process.exit(1);
  }
};

fixWashroomRoute();
