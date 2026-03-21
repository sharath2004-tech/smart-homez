import dotenv from 'dotenv';
import mongoose from 'mongoose';
import monthlyReliabilityJob from './jobs/monthlyScoring.js';
import reliabilityScoring from './utils/reliabilityScoring.js';

// Load environment variables
dotenv.config();

async function testManualScoring() {
  try {
    console.log('🚀 Testing Manual Reliability Scoring...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n🔧 Running manual monthly scoring job...');
    const results = await reliabilityScoring.updateAllWorkerScores();

    console.log('\n📊 Manual scoring results:', {
      totalWorkers: results.total,
      successful: results.successful,
      failed: results.failed
    });

    // Show some sample results
    console.log('\n🔍 Sample worker results:');
    results.details.slice(0, 3).forEach(detail => {
      if (detail.success) {
        console.log(`✅ ${detail.workerId}: ${detail.score}/20 (${detail.normalizedScore}/100)`);
      } else {
        console.log(`❌ ${detail.workerId}: ${detail.error}`);
      }
    });

    // Test job status
    console.log('\n📅 Monthly job status:', monthlyReliabilityJob.getStatus());

    // Get and display statistics
    console.log('\n📈 Getting reliability statistics...');
    const stats = await reliabilityScoring.getReliabilityStatistics();
    if (stats) {
      console.log('✅ Current statistics:', {
        totalWorkers: stats.totalWorkers,
        averageScore: stats.averageScore?.toFixed(1),
        highPerformers: `${stats.highPerformers}/${stats.totalWorkers}`,
        lowPerformers: `${stats.lowPerformers}/${stats.totalWorkers}`,
        totalLeaves: stats.totalLeaves,
        uninformedLeaves: stats.totalUninformedLeaves
      });
    } else {
      console.log('ℹ️ No statistics available yet');
    }

    console.log('\n🎉 Manual scoring test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the test
testManualScoring();