import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import reviewAnalytics from './utils/reviewAnalytics.js';

// Load environment variables
dotenv.config();

async function testReviewAnalytics() {
  try {
    console.log('🔧 Testing Review Analytics System...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get a few workers who have reviews
    const workersWithReviews = await User.aggregate([
      { $match: { role: 'worker' } },
      { $lookup: { from: 'reviews', localField: '_id', foreignField: 'worker', as: 'reviews' } },
      { $match: { 'reviews.0': { $exists: true } } },
      { $limit: 2 },
      { $project: { _id: 1, name: 1, 'workerProfile.rating': 1, 'workerProfile.totalReviews': 1 } }
    ]);

    console.log(`\n📊 Testing with ${workersWithReviews.length} workers who have reviews:`);

    for (const worker of workersWithReviews) {
      console.log(`\n🔍 Testing worker: ${worker.name} (ID: ${worker._id})`);
      console.log('Current rating:', worker.workerProfile?.rating?.toFixed(1) || '0.0');
      console.log('Total reviews:', worker.workerProfile?.totalReviews || 0);

      // Test getting weekly ratings
      try {
        const weeklyData = await reviewAnalytics.getWorkerWeeklyRatings(worker._id);
        console.log(`✅ Weekly data: ${weeklyData.length} weeks of data available`);
        if (weeklyData.length > 0) {
          console.log('Latest week:', {
            averageRating: weeklyData[weeklyData.length - 1].averageRating,
            reviewCount: weeklyData[weeklyData.length - 1].reviewCount
          });
        }
      } catch (error) {
        console.log('❌ Error getting weekly data:', error.message);
      }

      // Test getting monthly ratings
      try {
        const monthlyData = await reviewAnalytics.getWorkerMonthlyRatings(worker._id);
        console.log(`✅ Monthly data: ${monthlyData.length} months of data available`);
        if (monthlyData.length > 0) {
          console.log('Latest month:', {
            averageRating: monthlyData[monthlyData.length - 1].averageRating,
            reviewCount: monthlyData[monthlyData.length - 1].reviewCount,
            satisfactionRate: monthlyData[monthlyData.length - 1].satisfactionRate + '%'
          });
        }
      } catch (error) {
        console.log('❌ Error getting monthly data:', error.message);
      }

      // Test getting rating trends
      try {
        const trends = await reviewAnalytics.getWorkerRatingTrends(worker._id);
        console.log('✅ Rating trends:', {
          trend: trends.trend,
          currentRating: trends.currentPeriod.averageRating,
          previousRating: trends.previousPeriod.averageRating,
          change: trends.changes.rating
        });
      } catch (error) {
        console.log('❌ Error getting trends:', error.message);
      }

      // Test complete analytics
      try {
        const completeAnalytics = await reviewAnalytics.getWorkerCompleteAnalytics(worker._id);
        console.log('✅ Complete analytics retrieved successfully');
        console.log('Analytics structure:', {
          hasWeeklyData: !!completeAnalytics.weeklyData,
          hasMonthlyData: !!completeAnalytics.monthlyData,
          hasTrends: !!completeAnalytics.trends,
          workerInfo: !!completeAnalytics.worker
        });
      } catch (error) {
        console.log('❌ Error getting complete analytics:', error.message);
      }
    }

    // Test dashboard analytics
    console.log('\n📈 Testing admin dashboard analytics...');
    try {
      const dashboardData = await reviewAnalytics.getAdminDashboardRatings();
      if (dashboardData) {
        console.log('✅ Dashboard analytics:', {
          totalReviews: dashboardData.summary.totalReviews,
          averageRating: dashboardData.summary.averageRating,
          satisfactionRate: dashboardData.summary.satisfactionRate + '%',
          topPerformers: dashboardData.topPerformers.length,
          bottomPerformers: dashboardData.bottomPerformers.length
        });
      } else {
        console.log('ℹ️ No dashboard data available');
      }
    } catch (error) {
      console.log('⚠️ Error getting dashboard analytics:', error.message);
    }

    console.log('\n🎉 Review analytics test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the test
testReviewAnalytics();