import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Service from './models/Service.js';

async function checkService() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Find the Insta Maid service
    const service = await Service.findOne({ name: /insta.*maid/i });

    if (service) {
      console.log('Service found:', service.name);
      console.log('ID:', service._id);
      console.log('Service Type:', service.serviceType);
      console.log('Price:', service.price);
      console.log('Subscription Plans count:', service.subscriptionPlans?.length || 0);

      if (service.subscriptionPlans && service.subscriptionPlans.length > 0) {
        console.log('\nSubscription Plans:');
        service.subscriptionPlans.forEach((plan, index) => {
          console.log(`${index + 1}. ${plan.displayName} (${plan.id}) - ₹${plan.price}`);
        });
      }

      console.log('\nPricing Plans:');
      if (service.pricingPlans) {
        console.log('  One Time:', service.pricingPlans.oneTime);
        console.log('  Daily:', service.pricingPlans.daily);
        console.log('  Weekly:', service.pricingPlans.weekly);
        console.log('  Monthly:', service.pricingPlans.monthly);
      }
    } else {
      console.log('Insta Maid service not found');

      // Show all services
      const allServices = await Service.find({}, 'name serviceType subscriptionPlans');
      console.log('\nAll services:');
      allServices.forEach(s => {
        const planCount = s.subscriptionPlans?.length || 0;
        console.log(`- ${s.name} (type: ${s.serviceType}, plans: ${planCount})`);
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkService();