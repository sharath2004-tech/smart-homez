import mongoose from 'mongoose';
import User from '../models/User.js';
import ReliabilityScore from '../models/ReliabilityScore.js';

/**
 * Reliability Scoring Service
 *
 * Scoring Logic:
 * - Base Score: 10/20 points (starting point)
 * - Leave Bonus: +2 points if ≤4 leaves OR no leaves in month
 * - Uninformed Leave Penalty: -1 point per leave applied <24 hours
 * - Final Score: 0-20 range (converted to 0-100 for worker profile)
 */
class ReliabilityScoring {

  /**
   * Calculate reliability score for a worker for a specific month
   * @param {String} workerId - Worker's user ID
   * @param {Number} month - Month (0-11)
   * @param {Number} year - Year
   * @returns {Object} Calculated score data
   */
  async calculateMonthlyScore(workerId, month, year) {
    try {
      const worker = await User.findById(workerId).select('role workerProfile');
      if (!worker || worker.role !== 'worker') {
        throw new Error('Worker not found');
      }

      // Get leaves for the specified month
      const leaves = worker.workerProfile?.leaves || [];
      const monthLeaves = leaves.filter(leave => {
        const leaveDate = new Date(leave.date);
        return leaveDate.getMonth() === month &&
               leaveDate.getFullYear() === year &&
               leave.status === 'approved';
      });

      // Calculate leave data
      const totalLeaves = monthLeaves.length;
      const uninformedLeaves = monthLeaves.filter(leave => leave.penaltyApplied).length;
      const informedLeaves = totalLeaves - uninformedLeaves;

      // Scoring logic
      const baseScore = 10; // Base 10/20 points
      let leaveBonus = 0;
      let leavePenalties = 0;

      // Leave bonus: +2 if ≤4 leaves OR no leaves
      if (totalLeaves <= 4) {
        leaveBonus = 2;
      }

      // Uninformed leave penalty: -1 per uninformed leave
      leavePenalties = uninformedLeaves * 1;

      // Calculate final score (capped at 0-20)
      const finalScore = Math.max(0, Math.min(20, baseScore + leaveBonus - leavePenalties));

      const scoreData = {
        worker: workerId,
        month,
        year,
        scoreBreakdown: {
          baseScore,
          leaveBonus,
          leavePenalties,
          finalScore
        },
        leaveData: {
          totalLeaves,
          uninformedLeaves,
          informedLeaves
        }
      };

      console.log(`Reliability score calculated for worker ${workerId} (${year}-${month+1}):`, {
        totalLeaves,
        uninformedLeaves,
        finalScore: `${finalScore}/20`
      });

      return scoreData;
    } catch (error) {
      console.error('Error calculating monthly score:', error);
      throw error;
    }
  }

  /**
   * Save or update reliability score for a worker
   * @param {Object} scoreData - Score data from calculateMonthlyScore
   * @returns {Object} Saved reliability score document
   */
  async saveReliabilityScore(scoreData) {
    try {
      const existingScore = await ReliabilityScore.findOne({
        worker: scoreData.worker,
        month: scoreData.month,
        year: scoreData.year
      });

      if (existingScore) {
        // Update existing score
        Object.assign(existingScore, scoreData);
        existingScore.lastUpdated = new Date();
        return await existingScore.save();
      } else {
        // Create new score
        return await ReliabilityScore.create(scoreData);
      }
    } catch (error) {
      console.error('Error saving reliability score:', error);
      throw error;
    }
  }

  /**
   * Update worker's overall reliability score (0-100 scale)
   * @param {String} workerId - Worker's user ID
   * @param {Number} finalScore - Score from 0-20
   */
  async updateWorkerProfile(workerId, finalScore) {
    try {
      // Convert 0-20 scale to 0-100 scale
      const normalizedScore = Math.round((finalScore / 20) * 100);

      await User.findByIdAndUpdate(
        workerId,
        {
          'workerProfile.reliabilityScore': normalizedScore
        },
        { new: true }
      );

      console.log(`Worker ${workerId} profile updated with reliability score: ${normalizedScore}/100`);
    } catch (error) {
      console.error('Error updating worker profile:', error);
      throw error;
    }
  }

  /**
   * Process reliability score for a single worker for the previous month
   * @param {String} workerId - Worker's user ID
   * @returns {Object} Processing result
   */
  async processWorkerScore(workerId) {
    try {
      const { month, year } = ReliabilityScore.getPreviousPeriod();

      const scoreData = await this.calculateMonthlyScore(workerId, month, year);
      const savedScore = await this.saveReliabilityScore(scoreData);
      await this.updateWorkerProfile(workerId, scoreData.scoreBreakdown.finalScore);

      return {
        success: true,
        workerId,
        month,
        year,
        score: savedScore.scoreBreakdown.finalScore,
        normalizedScore: savedScore.normalizedScore
      };
    } catch (error) {
      console.error(`Error processing worker ${workerId}:`, error);
      return {
        success: false,
        workerId,
        error: error.message
      };
    }
  }

  /**
   * Update reliability scores for all active workers (monthly cron job)
   * @returns {Object} Processing summary
   */
  async updateAllWorkerScores() {
    try {
      console.log('Starting monthly reliability score update...');

      // Get all active workers
      const workers = await User.find({
        role: 'worker',
        'workerProfile.resignedDate': null
      }).select('_id name');

      console.log(`Processing ${workers.length} active workers...`);

      const results = {
        total: workers.length,
        successful: 0,
        failed: 0,
        details: []
      };

      // Process each worker
      for (const worker of workers) {
        const result = await this.processWorkerScore(worker._id);
        results.details.push(result);

        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
        }
      }

      const { month, year } = ReliabilityScore.getPreviousPeriod();
      console.log(`Monthly update completed for ${year}-${month+1}:`, {
        total: results.total,
        successful: results.successful,
        failed: results.failed
      });

      return results;
    } catch (error) {
      console.error('Error updating all worker scores:', error);
      throw error;
    }
  }

  /**
   * Get reliability score history for a worker
   * @param {String} workerId - Worker's user ID
   * @param {Number} limit - Number of months to retrieve (default: 12)
   * @returns {Array} Reliability score history
   */
  async getWorkerReliabilityHistory(workerId, limit = 12) {
    try {
      return await ReliabilityScore.find({ worker: workerId })
        .sort({ year: -1, month: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('Error getting worker reliability history:', error);
      throw error;
    }
  }

  /**
   * Get current reliability score for a worker
   * @param {String} workerId - Worker's user ID
   * @returns {Object|null} Current month's reliability score
   */
  async getCurrentWorkerScore(workerId) {
    try {
      const { month, year } = ReliabilityScore.getCurrentPeriod();
      return await ReliabilityScore.findOne({
        worker: workerId,
        month,
        year
      }).lean();
    } catch (error) {
      console.error('Error getting current worker score:', error);
      return null;
    }
  }

  /**
   * Get reliability statistics for admin dashboard
   * @returns {Object} Reliability statistics
   */
  async getReliabilityStatistics() {
    try {
      const { month, year } = ReliabilityScore.getPreviousPeriod();

      const stats = await ReliabilityScore.aggregate([
        { $match: { month, year } },
        {
          $group: {
            _id: null,
            totalWorkers: { $sum: 1 },
            averageScore: { $avg: '$scoreBreakdown.finalScore' },
            highPerformers: {
              $sum: { $cond: [{ $gte: ['$scoreBreakdown.finalScore', 16] }, 1, 0] }
            },
            lowPerformers: {
              $sum: { $cond: [{ $lte: ['$scoreBreakdown.finalScore', 10] }, 1, 0] }
            },
            totalLeaves: { $sum: '$leaveData.totalLeaves' },
            totalUninformedLeaves: { $sum: '$leaveData.uninformedLeaves' }
          }
        }
      ]);

      return stats.length > 0 ? stats[0] : null;
    } catch (error) {
      console.error('Error getting reliability statistics:', error);
      return null;
    }
  }
}

export default new ReliabilityScoring();