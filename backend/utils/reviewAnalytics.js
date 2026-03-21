import mongoose from 'mongoose';
import Review from '../models/Review.js';
import User from '../models/User.js';

/**
 * Review Analytics Service
 *
 * Provides weekly and monthly rating analytics for workers
 * Supports admin dashboard with aggregated rating insights
 */
class ReviewAnalytics {

  /**
   * Get weekly rating averages for a worker (last 4 weeks)
   * @param {String} workerId - Worker's user ID
   * @returns {Array} Weekly rating data
   */
  async getWorkerWeeklyRatings(workerId) {
    try {
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

      const weeklyData = await Review.aggregate([
        {
          $match: {
            worker: new mongoose.Types.ObjectId(workerId),
            createdAt: { $gte: fourWeeksAgo }
          }
        },
        {
          $addFields: {
            // Calculate week start based on day of year
            dayOfYear: { $dayOfYear: "$createdAt" },
            year: { $year: "$createdAt" },
            weekNumber: {
              $floor: {
                $divide: [
                  { $subtract: [{ $dayOfYear: "$createdAt" }, 1] },
                  7
                ]
              }
            }
          }
        },
        {
          $addFields: {
            weekKey: {
              $concat: [
                { $toString: "$year" },
                "-W",
                { $toString: "$weekNumber" }
              ]
            }
          }
        },
        {
          $group: {
            _id: "$weekKey",
            year: { $first: "$year" },
            weekNumber: { $first: "$weekNumber" },
            averageOverall: { $avg: "$overallRating" },
            averageQuality: { $avg: "$categoryRatings.quality" },
            averageTimeliness: { $avg: "$categoryRatings.timeliness" },
            averageProfessionalism: { $avg: "$categoryRatings.professionalism" },
            reviewCount: { $sum: 1 },
            minDate: { $min: "$createdAt" },
            maxDate: { $max: "$createdAt" }
          }
        },
        { $sort: { year: 1, weekNumber: 1 } },
        { $limit: 4 }
      ]);

      return weeklyData.map(week => ({
        week: week._id,
        weekStart: week.minDate,
        weekEnd: week.maxDate,
        averageRating: Math.round(week.averageOverall * 10) / 10,
        categoryAverages: {
          quality: Math.round(week.averageQuality * 10) / 10,
          timeliness: Math.round(week.averageTimeliness * 10) / 10,
          professionalism: Math.round(week.averageProfessionalism * 10) / 10
        },
        reviewCount: week.reviewCount
      }));
    } catch (error) {
      console.error('Error getting weekly ratings:', error);
      throw error;
    }
  }

  /**
   * Get monthly rating averages for a worker (last 6 months)
   * @param {String} workerId - Worker's user ID
   * @returns {Array} Monthly rating data
   */
  async getWorkerMonthlyRatings(workerId) {
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const monthlyData = await Review.aggregate([
        {
          $match: {
            worker: new mongoose.Types.ObjectId(workerId),
            createdAt: { $gte: sixMonthsAgo }
          }
        },
        {
          $addFields: {
            yearMonth: {
              $dateToString: {
                format: "%Y-%m",
                date: "$createdAt"
              }
            },
            monthStart: {
              $dateFromString: {
                dateString: {
                  $concat: [
                    { $substr: [{ $dateToString: { format: "%Y", date: "$createdAt" }}, 0, 4] },
                    "-",
                    { $substr: [{ $dateToString: { format: "%m", date: "$createdAt" }}, 0, 2] },
                    "-01"
                  ]
                }
              }
            }
          }
        },
        {
          $group: {
            _id: "$yearMonth",
            monthStart: { $first: "$monthStart" },
            averageOverall: { $avg: "$overallRating" },
            averageQuality: { $avg: "$categoryRatings.quality" },
            averageTimeliness: { $avg: "$categoryRatings.timeliness" },
            averageProfessionalism: { $avg: "$categoryRatings.professionalism" },
            reviewCount: { $sum: 1 },
            highRatings: {
              $sum: { $cond: [{ $gte: ["$overallRating", 4] }, 1, 0] }
            },
            lowRatings: {
              $sum: { $cond: [{ $lte: ["$overallRating", 2] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } },
        { $limit: 6 }
      ]);

      return monthlyData.map(month => ({
        month: month._id,
        monthStart: month.monthStart,
        averageRating: Math.round(month.averageOverall * 10) / 10,
        categoryAverages: {
          quality: Math.round(month.averageQuality * 10) / 10,
          timeliness: Math.round(month.averageTimeliness * 10) / 10,
          professionalism: Math.round(month.averageProfessionalism * 10) / 10
        },
        reviewCount: month.reviewCount,
        highRatings: month.highRatings,
        lowRatings: month.lowRatings,
        satisfactionRate: month.reviewCount > 0 ?
          Math.round((month.highRatings / month.reviewCount) * 100) : 0
      }));
    } catch (error) {
      console.error('Error getting monthly ratings:', error);
      throw error;
    }
  }

  /**
   * Get rating trends for a worker (compare current vs previous period)
   * @param {String} workerId - Worker's user ID
   * @returns {Object} Rating trend analysis
   */
  async getWorkerRatingTrends(workerId) {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

      const [currentPeriod, previousPeriod] = await Promise.all([
        // Current 30 days
        Review.aggregate([
          {
            $match: {
              worker: new mongoose.Types.ObjectId(workerId),
              createdAt: { $gte: thirtyDaysAgo }
            }
          },
          {
            $group: {
              _id: null,
              averageRating: { $avg: "$overallRating" },
              reviewCount: { $sum: 1 },
              averageQuality: { $avg: "$categoryRatings.quality" },
              averageTimeliness: { $avg: "$categoryRatings.timeliness" },
              averageProfessionalism: { $avg: "$categoryRatings.professionalism" }
            }
          }
        ]),
        // Previous 30 days (30-60 days ago)
        Review.aggregate([
          {
            $match: {
              worker: new mongoose.Types.ObjectId(workerId),
              createdAt: {
                $gte: sixtyDaysAgo,
                $lt: thirtyDaysAgo
              }
            }
          },
          {
            $group: {
              _id: null,
              averageRating: { $avg: "$overallRating" },
              reviewCount: { $sum: 1 },
              averageQuality: { $avg: "$categoryRatings.quality" },
              averageTimeliness: { $avg: "$categoryRatings.timeliness" },
              averageProfessionalism: { $avg: "$categoryRatings.professionalism" }
            }
          }
        ])
      ]);

      const current = currentPeriod[0] || { averageRating: 0, reviewCount: 0, averageQuality: 0, averageTimeliness: 0, averageProfessionalism: 0 };
      const previous = previousPeriod[0] || { averageRating: 0, reviewCount: 0, averageQuality: 0, averageTimeliness: 0, averageProfessionalism: 0 };

      const ratingChange = current.averageRating - previous.averageRating;
      const reviewChange = current.reviewCount - previous.reviewCount;

      let trend = 'stable';
      if (ratingChange > 0.2) trend = 'improving';
      else if (ratingChange < -0.2) trend = 'declining';

      return {
        currentPeriod: {
          averageRating: Math.round(current.averageRating * 10) / 10,
          reviewCount: current.reviewCount,
          averageQuality: Math.round(current.averageQuality * 10) / 10,
          averageTimeliness: Math.round(current.averageTimeliness * 10) / 10,
          averageProfessionalism: Math.round(current.averageProfessionalism * 10) / 10
        },
        previousPeriod: {
          averageRating: Math.round(previous.averageRating * 10) / 10,
          reviewCount: previous.reviewCount
        },
        changes: {
          rating: Math.round(ratingChange * 10) / 10,
          reviews: reviewChange,
          percentage: previous.averageRating > 0 ?
            Math.round(((ratingChange / previous.averageRating) * 100)) : 0
        },
        trend
      };
    } catch (error) {
      console.error('Error getting rating trends:', error);
      throw error;
    }
  }

  /**
   * Get admin dashboard rating analytics
   * @param {String} adminId - Admin's user ID for location filtering
   * @returns {Object} Dashboard analytics
   */
  async getAdminDashboardRatings(adminId = null) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let workerFilter = {};

      // If admin provided, filter by assigned locations
      if (adminId) {
        const admin = await User.findById(adminId).select('adminProfile.assignedLocations');
        if (admin?.adminProfile?.assignedLocations?.length > 0) {
          const locationIds = admin.adminProfile.assignedLocations.map(loc => loc.locationId);

          // Get workers assigned to admin's locations
          const workers = await User.find({
            role: 'worker',
            'workerProfile.assignedApartments.locationId': { $in: locationIds }
          }).select('_id');

          workerFilter = { _id: { $in: workers.map(w => w._id) } };
        }
      }

      // Get recent ratings summary
      const recentRatings = await Review.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'worker',
            foreignField: '_id',
            as: 'workerInfo'
          }
        },
        {
          $match: {
            'workerInfo.role': 'worker',
            ...(Object.keys(workerFilter).length > 0 ? { 'workerInfo._id': workerFilter._id } : {})
          }
        },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: "$overallRating" },
            highRatings: { $sum: { $cond: [{ $gte: ["$overallRating", 4] }, 1, 0] } },
            lowRatings: { $sum: { $cond: [{ $lte: ["$overallRating", 2] }, 1, 0] } },
            averageQuality: { $avg: "$categoryRatings.quality" },
            averageTimeliness: { $avg: "$categoryRatings.timeliness" },
            averageProfessionalism: { $avg: "$categoryRatings.professionalism" }
          }
        }
      ]);

      // Get top and bottom performers
      const [topPerformers, bottomPerformers] = await Promise.all([
        // Top performers
        User.aggregate([
          { $match: { role: 'worker', ...workerFilter } },
          { $match: { 'workerProfile.totalReviews': { $gte: 3 } } },
          { $sort: { 'workerProfile.rating': -1 } },
          { $limit: 5 },
          {
            $project: {
              name: 1,
              rating: '$workerProfile.rating',
              totalReviews: '$workerProfile.totalReviews',
              reliabilityScore: '$workerProfile.reliabilityScore'
            }
          }
        ]),
        // Bottom performers
        User.aggregate([
          { $match: { role: 'worker', ...workerFilter } },
          { $match: { 'workerProfile.totalReviews': { $gte: 3 } } },
          { $sort: { 'workerProfile.rating': 1 } },
          { $limit: 5 },
          {
            $project: {
              name: 1,
              rating: '$workerProfile.rating',
              totalReviews: '$workerProfile.totalReviews',
              reliabilityScore: '$workerProfile.reliabilityScore'
            }
          }
        ])
      ]);

      const summary = recentRatings[0] || {
        totalReviews: 0,
        averageRating: 0,
        highRatings: 0,
        lowRatings: 0,
        averageQuality: 0,
        averageTimeliness: 0,
        averageProfessionalism: 0
      };

      return {
        summary: {
          totalReviews: summary.totalReviews,
          averageRating: Math.round(summary.averageRating * 10) / 10,
          satisfactionRate: summary.totalReviews > 0 ?
            Math.round((summary.highRatings / summary.totalReviews) * 100) : 0,
          categoryAverages: {
            quality: Math.round(summary.averageQuality * 10) / 10,
            timeliness: Math.round(summary.averageTimeliness * 10) / 10,
            professionalism: Math.round(summary.averageProfessionalism * 10) / 10
          }
        },
        topPerformers,
        bottomPerformers,
        period: '30 days'
      };
    } catch (error) {
      console.error('Error getting dashboard ratings:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive analytics for a specific worker
   * @param {String} workerId - Worker's user ID
   * @returns {Object} Complete worker analytics
   */
  async getWorkerCompleteAnalytics(workerId) {
    try {
      const [weeklyData, monthlyData, trends, worker] = await Promise.all([
        this.getWorkerWeeklyRatings(workerId),
        this.getWorkerMonthlyRatings(workerId),
        this.getWorkerRatingTrends(workerId),
        User.findById(workerId).select('name workerProfile.rating workerProfile.totalReviews workerProfile.reliabilityScore')
      ]);

      return {
        worker: {
          id: workerId,
          name: worker?.name,
          currentRating: worker?.workerProfile?.rating || 0,
          totalReviews: worker?.workerProfile?.totalReviews || 0,
          reliabilityScore: worker?.workerProfile?.reliabilityScore || 100
        },
        weeklyData,
        monthlyData,
        trends
      };
    } catch (error) {
      console.error('Error getting complete analytics:', error);
      throw error;
    }
  }
}

export default new ReviewAnalytics();