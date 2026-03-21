import cron from 'node-cron';
import reliabilityScoring from '../utils/reliabilityScoring.js';

/**
 * Monthly Reliability Scoring Job
 *
 * Runs on the 1st of each month at 2:00 AM to calculate
 * reliability scores for all active workers based on
 * the previous month's leave data.
 *
 * Cron Expression: '0 2 1 * *'
 * - 0 minutes
 * - 2 hours (2:00 AM)
 * - 1st day of month
 * - Every month
 * - Every day of week
 */

class MonthlyReliabilityJob {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.taskCount = 0;
  }

  /**
   * Start the monthly cron job
   */
  start() {
    console.log('🕐 Monthly Reliability Scoring Job: Starting scheduler...');

    // Schedule job for 1st of each month at 2:00 AM
    const task = cron.schedule('0 2 1 * *', async () => {
      await this.runMonthlyScoring();
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata" // IST timezone
    });

    console.log('✅ Monthly Reliability Scoring Job: Scheduled successfully');
    console.log('📅 Next run: 1st of next month at 2:00 AM IST');

    return task;
  }

  /**
   * Run the monthly scoring process
   */
  async runMonthlyScoring() {
    if (this.isRunning) {
      console.log('⏸️  Monthly scoring job already running, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      this.taskCount++;

      console.log('🚀 Monthly Reliability Scoring Job: Starting execution...');
      console.log(`📊 Task #${this.taskCount} - ${new Date().toISOString()}`);

      // Run the scoring process
      const results = await reliabilityScoring.updateAllWorkerScores();

      this.lastRun = new Date();

      console.log('✅ Monthly Reliability Scoring Job: Completed successfully');
      console.log('📈 Results Summary:', {
        totalWorkers: results.total,
        successful: results.successful,
        failed: results.failed,
        timestamp: this.lastRun.toISOString()
      });

      // Log any failures
      if (results.failed > 0) {
        console.log('⚠️  Failed workers:');
        results.details
          .filter(detail => !detail.success)
          .forEach(detail => {
            console.log(`   - Worker ${detail.workerId}: ${detail.error}`);
          });
      }

      // Get statistics after update
      const stats = await reliabilityScoring.getReliabilityStatistics();
      if (stats) {
        console.log('📊 Reliability Statistics:', {
          averageScore: `${stats.averageScore?.toFixed(1)}/20`,
          highPerformers: `${stats.highPerformers}/${stats.totalWorkers}`,
          lowPerformers: `${stats.lowPerformers}/${stats.totalWorkers}`,
          totalLeaves: stats.totalLeaves,
          uninformedLeaves: stats.totalUninformedLeaves
        });
      }

    } catch (error) {
      console.error('❌ Monthly Reliability Scoring Job: Failed', error);

      // You could add error notification logic here
      // For example, send email to admins or log to monitoring service

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run scoring manually (for testing or manual triggers)
   */
  async runManual() {
    console.log('🔧 Manual execution of reliability scoring job...');
    await this.runMonthlyScoring();
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      taskCount: this.taskCount,
      nextRun: '1st of next month at 2:00 AM IST'
    };
  }

  /**
   * Test job with dry run (calculate but don't save)
   */
  async testRun() {
    console.log('🧪 Test run: Calculating scores without saving...');

    try {
      const reliabilityScoring = require('../utils/reliabilityScoring.js').default;

      // Test with a few workers
      const workers = await User.find({
        role: 'worker',
        'workerProfile.resignedDate': null
      }).limit(3).select('_id name');

      console.log(`Testing with ${workers.length} workers...`);

      for (const worker of workers) {
        const { month, year } = ReliabilityScore.getPreviousPeriod();
        const scoreData = await reliabilityScoring.calculateMonthlyScore(worker._id, month, year);

        console.log(`Worker ${worker.name}: ${scoreData.scoreBreakdown.finalScore}/20`);
        console.log('  Breakdown:', scoreData.scoreBreakdown);
        console.log('  Leave Data:', scoreData.leaveData);
      }

    } catch (error) {
      console.error('Test run failed:', error);
    }
  }
}

// Create and export singleton instance
const monthlyReliabilityJob = new MonthlyReliabilityJob();

export default monthlyReliabilityJob;