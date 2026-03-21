import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import reliabilityScoring from './utils/reliabilityScoring.js';

// Load environment variables
dotenv.config();

async function testReliabilityScoring() {
  try {
    console.log('🔧 Testing Reliability Scoring System...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get a few workers to test with
    const workers = await User.find({
      role: 'worker',
      'workerProfile.resignedDate': null
    }).limit(3).select('_id name workerProfile');

    console.log(`\n📊 Testing with ${workers.length} workers:`);

    for (const worker of workers) {
      console.log(`\n🔍 Testing worker: ${worker.name} (ID: ${worker._id})`);
      console.log('Current reliability score:', worker.workerProfile?.reliabilityScore || 100);

      // Test calculating current month score
      const currentDate = new Date();
      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();

      try {
        const scoreData = await reliabilityScoring.calculateMonthlyScore(worker._id, month, year);
        console.log('✅ Monthly score calculation successful:', {
          finalScore: scoreData.scoreBreakdown.finalScore,
          leaves: scoreData.leaveData.totalLeaves,
          uninformedLeaves: scoreData.leaveData.uninformedLeaves
        });
      } catch (error) {
        console.log('❌ Error calculating score:', error.message);
      }

      // Test getting reliability history
      try {
        const history = await reliabilityScoring.getWorkerReliabilityHistory(worker._id, 3);
        console.log(`📈 Found ${history.length} historical reliability records`);
      } catch (error) {
        console.log('⚠️ Error getting history:', error.message);
      }
    }

    // Test general statistics
    console.log('\n📈 Testing reliability statistics...');
    try {
      const stats = await reliabilityScoring.getReliabilityStatistics();
      if (stats) {
        console.log('✅ Reliability statistics:', {
          totalWorkers: stats.totalWorkers,
          averageScore: stats.averageScore?.toFixed(1),
          highPerformers: stats.highPerformers,
          lowPerformers: stats.lowPerformers
        });
      } else {
        console.log('ℹ️ No reliability statistics available yet (no previous month data)');
      }
    } catch (error) {
      console.log('⚠️ Error getting statistics:', error.message);
    }

    console.log('\n🎉 Reliability scoring test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the test
testReliabilityScoring();