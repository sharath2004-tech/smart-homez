import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Service from './models/Service.js';

const DEFAULT_PLAN_IDS = ['oneTime', 'daily', 'bi-weekly', 'weekly', 'monthly'];

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB Atlas');

    const services = await Service.find({
      subscriptionPlans: { $exists: true, $ne: [] }
    });

    console.log(`Found ${services.length} services with subscription plans`);

    let cleanedCount = 0;
    let skippedCount = 0;

    for (const service of services) {
      const plans = service.subscriptionPlans || [];
      console.log(`Service: ${service.name} has ${plans.length} subscription plans`);

      // Check if all subscription plans are auto-generated defaults
      const hasOnlyDefaults = plans.length > 0 && plans.every(plan =>
        DEFAULT_PLAN_IDS.includes(plan.id) &&
        plan.description && (
          plan.description.includes('Single service') ||
          plan.description.includes('6 days/week') ||
          plan.description.includes('2 days/week') ||
          plan.description.includes('1 day/week') ||
          plan.description.includes('Once a month')
        )
      );

      const hasAllDefaults = plans.length === 5 &&
        DEFAULT_PLAN_IDS.every(id => plans.some(plan => plan.id === id));

      if (hasOnlyDefaults || hasAllDefaults) {
        console.log(`Cleaning service: ${service.name}`);
        await Service.updateOne(
          { _id: service._id },
          { $set: { subscriptionPlans: [] } }
        );
        cleanedCount++;
      } else {
        console.log(`Skipping service: ${service.name} (has custom plans)`);
        skippedCount++;
      }
    }

    console.log(`Cleanup completed! Cleaned: ${cleanedCount}, Skipped: ${skippedCount}`);
    await mongoose.disconnect();
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

cleanup();