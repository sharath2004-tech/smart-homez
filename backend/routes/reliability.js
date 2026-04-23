import express from 'express';
import { param, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import ReliabilityScore from '../models/ReliabilityScore.js';
import User from '../models/User.js';
import reliabilityScoring from '../utils/reliabilityScoring.js';

const router = express.Router();

/**
 * Get reliability score and history for a specific worker
 * GET /api/reliability/worker/:workerId
 */
router.get('/worker/:workerId', authenticate, [
  param('workerId').isMongoId().withMessage('Valid worker ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Only allow admin/super_admin access
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: { message: 'Access denied', status: 403 }
      });
    }

    const { workerId } = req.params;

    // Verify worker exists
    const worker = await User.findById(workerId).select('name role workerProfile.reliabilityScore');
    if (!worker || worker.role !== 'worker') {
      return res.status(404).json({
        error: { message: 'Worker not found', status: 404 }
      });
    }

    // Get current score and history
    const [currentScore, history] = await Promise.all([
      reliabilityScoring.getCurrentWorkerScore(workerId),
      reliabilityScoring.getWorkerReliabilityHistory(workerId, 12)
    ]);

    const latestAvailableScore = currentScore || history?.[0] || null;
    const latestScoreLabel = latestAvailableScore
      ? `${String((latestAvailableScore.month ?? 0) + 1).padStart(2, '0')}/${latestAvailableScore.year}`
      : null;

    res.json({
      worker: {
        id: workerId,
        name: worker.name,
        currentReliabilityScore: worker.workerProfile?.reliabilityScore || 75
      },
      currentMonthScore: latestAvailableScore,
      currentMonthLabel: latestScoreLabel,
      hasCurrentMonthScore: Boolean(currentScore),
      history,
      scoringRules: {
        baseScore: 15,
        maxScore: 20,
        leaveBonus: '+2 points if ≤4 leaves OR no leaves in month',
        uninformedLeavePenalty: '-1 point per leave applied <24 hours'
      }
    });
  } catch (error) {
    console.error('Error getting worker reliability score:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

/**
 * Get reliability dashboard statistics
 * GET /api/reliability/dashboard
 */
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    // Only allow admin/super_admin access
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: { message: 'Access denied', status: 403 }
      });
    }

    const statistics = await reliabilityScoring.getReliabilityStatistics();

    // Get recent monthly scores for trend analysis
    const { month, year } = ReliabilityScore.getPreviousPeriod();
    const recentScores = await ReliabilityScore.find({ month, year })
      .populate('worker', 'name')
      .sort({ 'scoreBreakdown.finalScore': -1 })
      .limit(20)
      .lean();

    // Score distribution
    const scoreDistribution = {
      excellent: recentScores.filter(s => s.scoreBreakdown.finalScore >= 18).length,
      good: recentScores.filter(s => s.scoreBreakdown.finalScore >= 14 && s.scoreBreakdown.finalScore < 18).length,
      average: recentScores.filter(s => s.scoreBreakdown.finalScore >= 10 && s.scoreBreakdown.finalScore < 14).length,
      poor: recentScores.filter(s => s.scoreBreakdown.finalScore < 10).length
    };

    res.json({
      statistics,
      period: `${year}-${String(month + 1).padStart(2, '0')}`,
      scoreDistribution,
      topPerformers: recentScores.slice(0, 5).map(score => ({
        workerId: score.worker._id,
        workerName: score.worker.name,
        score: score.scoreBreakdown.finalScore,
        leaveData: score.leaveData
      })),
      needsImprovement: recentScores.slice(-5).reverse().map(score => ({
        workerId: score.worker._id,
        workerName: score.worker.name,
        score: score.scoreBreakdown.finalScore,
        leaveData: score.leaveData
      }))
    });
  } catch (error) {
    console.error('Error getting reliability dashboard:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

/**
 * Manually recalculate reliability scores
 * POST /api/reliability/recalculate
 */
router.post('/recalculate', authenticate, async (req, res) => {
  try {
    // Only allow super_admin access for manual recalculation
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        error: { message: 'Super admin access required', status: 403 }
      });
    }

    console.log('Manual reliability score recalculation triggered by:', req.user.name);

    const results = await reliabilityScoring.updateAllWorkerScores();

    res.json({
      message: 'Reliability scores recalculated successfully',
      results: {
        totalWorkers: results.total,
        successful: results.successful,
        failed: results.failed
      },
      triggeredBy: req.user.name,
      triggeredAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error recalculating reliability scores:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

/**
 * Get reliability scores for multiple workers (bulk)
 * POST /api/reliability/bulk
 */
router.post('/bulk', authenticate, async (req, res) => {
  try {
    // Only allow admin/super_admin access
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: { message: 'Access denied', status: 403 }
      });
    }

    const { workerIds } = req.body;

    if (!Array.isArray(workerIds) || workerIds.length === 0) {
      return res.status(400).json({
        error: { message: 'workerIds array is required', status: 400 }
      });
    }

    if (workerIds.length > 50) {
      return res.status(400).json({
        error: { message: 'Maximum 50 workers per request', status: 400 }
      });
    }

    const { month, year } = ReliabilityScore.getPreviousPeriod();

    // Get reliability scores for specified workers
    const reliabilityScores = await ReliabilityScore.find({
      worker: { $in: workerIds },
      month,
      year
    }).populate('worker', 'name workerProfile.reliabilityScore').lean();

    // Get workers without reliability scores
    const scoredWorkerIds = reliabilityScores.map(score => score.worker._id.toString());
    const unscoredWorkerIds = workerIds.filter(id => !scoredWorkerIds.includes(id));

    const unscoredWorkers = await User.find({
      _id: { $in: unscoredWorkerIds },
      role: 'worker'
    }).select('name workerProfile.reliabilityScore').lean();

    const results = [
      ...reliabilityScores.map(score => ({
        workerId: score.worker._id,
        workerName: score.worker.name,
        reliabilityScore: score.scoreBreakdown.finalScore,
        normalizedScore: score.worker.workerProfile?.reliabilityScore || 75,
        leaveData: score.leaveData,
        hasScore: true
      })),
      ...unscoredWorkers.map(worker => ({
        workerId: worker._id,
        workerName: worker.name,
        reliabilityScore: null,
        normalizedScore: worker.workerProfile?.reliabilityScore || 75,
        leaveData: null,
        hasScore: false
      }))
    ];

    res.json({
      results,
      period: `${year}-${String(month + 1).padStart(2, '0')}`,
      totalRequested: workerIds.length,
      foundScores: reliabilityScores.length
    });
  } catch (error) {
    console.error('Error getting bulk reliability scores:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

/**
 * Get monthly reliability score trends
 * GET /api/reliability/trends
 */
router.get('/trends', authenticate, async (req, res) => {
  try {
    // Only allow admin/super_admin access
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: { message: 'Access denied', status: 403 }
      });
    }

    const { months = 6 } = req.query;
    const limitMonths = Math.min(parseInt(months) || 6, 12);

    // Get score trends for the last N months
    const trends = await ReliabilityScore.aggregate([
      {
        $group: {
          _id: { year: '$year', month: '$month' },
          averageScore: { $avg: '$scoreBreakdown.finalScore' },
          totalWorkers: { $sum: 1 },
          totalLeaves: { $sum: '$leaveData.totalLeaves' },
          totalUninformedLeaves: { $sum: '$leaveData.uninformedLeaves' },
          excellentScores: {
            $sum: { $cond: [{ $gte: ['$scoreBreakdown.finalScore', 16] }, 1, 0] }
          },
          poorScores: {
            $sum: { $cond: [{ $lte: ['$scoreBreakdown.finalScore', 10] }, 1, 0] }
          }
        }
      },
      {
        $sort: { '_id.year': -1, '_id.month': -1 }
      },
      {
        $limit: limitMonths
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    const formattedTrends = trends.map(trend => ({
      period: `${trend._id.year}-${String(trend._id.month + 1).padStart(2, '0')}`,
      averageScore: Math.round(trend.averageScore * 10) / 10,
      totalWorkers: trend.totalWorkers,
      excellentPercentage: Math.round((trend.excellentScores / trend.totalWorkers) * 100),
      poorPercentage: Math.round((trend.poorScores / trend.totalWorkers) * 100),
      leaveStats: {
        totalLeaves: trend.totalLeaves,
        uninformedLeaves: trend.totalUninformedLeaves,
        uninformedRate: trend.totalLeaves > 0
          ? Math.round((trend.totalUninformedLeaves / trend.totalLeaves) * 100)
          : 0
      }
    }));

    res.json({
      trends: formattedTrends,
      monthsRequested: limitMonths
    });
  } catch (error) {
    console.error('Error getting reliability trends:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

export default router;