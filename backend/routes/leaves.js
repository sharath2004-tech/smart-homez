/**
 * Leave Management Routes
 * Handles worker leave requests and admin approvals
 */

import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { handleWorkerReassignment } from '../utils/preferenceAssignment.js';

const router = express.Router();

/**
 * Apply for leave (Worker only)
 * POST /api/leaves/apply
 */
router.post(
  '/apply',
  authenticate,
  authorize('worker'),
  [
    body('date').isISO8601().withMessage('Valid date is required'),
    body('reason').optional().isString().isLength({ max: 200 }).withMessage('Reason must be less than 200 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { date, reason } = req.body;
      const workerId = req.user._id;

      // Get worker
      const worker = await User.findById(workerId);
      if (!worker) {
        return res.status(404).json({ message: 'Worker not found' });
      }

      // Check if already have leave on this date
      const leaveDate = new Date(date);
      leaveDate.setHours(0, 0, 0, 0);

      const existingLeave = worker.workerProfile.leaves.find(leave => {
        const leaveDateOnly = new Date(leave.date);
        leaveDateOnly.setHours(0, 0, 0, 0);
        return leaveDateOnly.getTime() === leaveDate.getTime();
      });

      if (existingLeave) {
        return res.status(400).json({ 
          message: 'Leave request already exists for this date',
          status: existingLeave.status
        });
      }

      // Check monthly quota
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const lastResetMonth = worker.workerProfile.lastLeaveReset ? new Date(worker.workerProfile.lastLeaveReset).getMonth() : -1;
      
      // Reset if different month
      if (currentMonth !== lastResetMonth) {
        worker.workerProfile.leavesUsedThisMonth = 0;
        worker.workerProfile.lastLeaveReset = new Date();
      }

      if (worker.workerProfile.leavesUsedThisMonth >= worker.workerProfile.monthlyLeaveQuota) {
        return res.status(400).json({ 
          message: `Monthly leave quota exceeded (${worker.workerProfile.monthlyLeaveQuota} leaves per month)`,
          leavesUsed: worker.workerProfile.leavesUsedThisMonth,
          quota: worker.workerProfile.monthlyLeaveQuota
        });
      }

      // Add leave request
      worker.workerProfile.leaves.push({
        date: leaveDate,
        reason: reason || '',
        status: 'pending',
        requestedAt: new Date()
      });

      await worker.save();

      res.status(201).json({
        message: 'Leave request submitted successfully',
        leave: worker.workerProfile.leaves[worker.workerProfile.leaves.length - 1]
      });
    } catch (error) {
      console.error('Apply leave error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

/**
 * Approve or reject leave (Admin only)
 * PUT /api/leaves/:workerId/:leaveId/status
 */
router.put(
  '/:workerId/:leaveId/status',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    param('workerId').isMongoId().withMessage('Valid worker ID is required'),
    param('leaveId').isMongoId().withMessage('Valid leave ID is required'),
    body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { workerId, leaveId } = req.params;
      const { status } = req.body;
      const adminId = req.user._id;

      // Get worker
      const worker = await User.findById(workerId);
      if (!worker) {
        return res.status(404).json({ message: 'Worker not found' });
      }

      // Find leave request
      const leave = worker.workerProfile.leaves.id(leaveId);
      if (!leave) {
        return res.status(404).json({ message: 'Leave request not found' });
      }

      if (leave.status !== 'pending') {
        return res.status(400).json({ 
          message: `Leave request already ${leave.status}` 
        });
      }

      // Update leave status
      leave.status = status;
      leave.approvedBy = adminId;

      if (status === 'approved') {
        // Increment leaves used
        worker.workerProfile.leavesUsedThisMonth += 1;

        // Get all bookings for this worker on the leave date
        const leaveDate = new Date(leave.date);
        leaveDate.setHours(0, 0, 0, 0);
        
        const nextDay = new Date(leaveDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const affectedBookings = await Booking.find({
          worker: workerId,
          bookingDate: { $gte: leaveDate, $lt: nextDay },
          status: { $in: ['pending', 'confirmed'] }
        });

        // Auto-reassign all affected bookings
        const reassignmentResults = [];
        for (const booking of affectedBookings) {
          const result = await handleWorkerReassignment(
            booking._id, 
            Booking, 
            'worker-on-leave'
          );
          reassignmentResults.push({
            bookingId: booking._id,
            ...result
          });
        }

        await worker.save();

        return res.json({
          message: 'Leave approved and bookings reassigned',
          leave,
          affectedBookings: affectedBookings.length,
          reassignmentResults
        });
      } else {
        await worker.save();

        return res.json({
          message: 'Leave request rejected',
          leave
        });
      }
    } catch (error) {
      console.error('Leave status update error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

/**
 * Get worker's leaves (Worker, Admin)
 * GET /api/leaves/my-leaves
 */
router.get(
  '/my-leaves',
  authenticate,
  authorize('worker'),
  async (req, res) => {
    try {
      const workerId = req.user._id;

      const worker = await User.findById(workerId).select('workerProfile.leaves workerProfile.monthlyLeaveQuota workerProfile.leavesUsedThisMonth');
      
      if (!worker) {
        return res.status(404).json({ message: 'Worker not found' });
      }

      res.json({
        leaves: worker.workerProfile.leaves || [],
        quota: worker.workerProfile.monthlyLeaveQuota,
        used: worker.workerProfile.leavesUsedThisMonth,
        remaining: worker.workerProfile.monthlyLeaveQuota - worker.workerProfile.leavesUsedThisMonth
      });
    } catch (error) {
      console.error('Get my leaves error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

/**
 * Get all pending leave requests (Admin only)
 * GET /api/leaves/pending
 */
router.get(
  '/pending',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const workers = await User.find({
        role: 'worker',
        'workerProfile.leaves.status': 'pending'
      }).select('name email phone workerProfile.leaves');

      // Filter to only pending leaves
      const pendingLeaves = workers.map(worker => ({
        workerId: worker._id,
        workerName: worker.name,
        workerEmail: worker.email,
        workerPhone: worker.phone,
        leaves: worker.workerProfile.leaves.filter(leave => leave.status === 'pending')
      })).filter(w => w.leaves.length > 0);

      res.json({
        pendingRequests: pendingLeaves,
        totalPending: pendingLeaves.reduce((sum, w) => sum + w.leaves.length, 0)
      });
    } catch (error) {
      console.error('Get pending leaves error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

/**
 * Get worker's leave history (Admin only)
 * GET /api/leaves/worker/:workerId
 */
router.get(
  '/worker/:workerId',
  authenticate,
  authorize('admin', 'super_admin'),
  [
    param('workerId').isMongoId().withMessage('Valid worker ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { workerId } = req.params;

      const worker = await User.findById(workerId)
        .select('name email phone workerProfile.leaves workerProfile.monthlyLeaveQuota workerProfile.leavesUsedThisMonth')
        .populate('workerProfile.leaves.approvedBy', 'name email');

      if (!worker) {
        return res.status(404).json({ message: 'Worker not found' });
      }

      res.json({
        workerId: worker._id,
        workerName: worker.name,
        workerEmail: worker.email,
        leaves: worker.workerProfile.leaves || [],
        quota: worker.workerProfile.monthlyLeaveQuota,
        used: worker.workerProfile.leavesUsedThisMonth,
        remaining: worker.workerProfile.monthlyLeaveQuota - worker.workerProfile.leavesUsedThisMonth
      });
    } catch (error) {
      console.error('Get worker leaves error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

/**
 * Cancel leave request (Worker only - only pending leaves)
 * DELETE /api/leaves/:leaveId
 */
router.delete(
  '/:leaveId',
  authenticate,
  authorize('worker'),
  [
    param('leaveId').isMongoId().withMessage('Valid leave ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { leaveId } = req.params;
      const workerId = req.user._id;

      const worker = await User.findById(workerId);
      if (!worker) {
        return res.status(404).json({ message: 'Worker not found' });
      }

      const leave = worker.workerProfile.leaves.id(leaveId);
      if (!leave) {
        return res.status(404).json({ message: 'Leave request not found' });
      }

      // Can only cancel pending leaves
      if (leave.status !== 'pending') {
        return res.status(400).json({ 
          message: `Cannot cancel ${leave.status} leave request` 
        });
      }

      // Remove leave
      worker.workerProfile.leaves.pull(leaveId);
      await worker.save();

      res.json({
        message: 'Leave request cancelled successfully'
      });
    } catch (error) {
      console.error('Cancel leave error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

/**
 * Get leave statistics (Admin only)
 * GET /api/leaves/statistics
 */
router.get(
  '/statistics',
  authenticate,
  authorize('admin', 'super_admin'),
  async (req, res) => {
    try {
      const workers = await User.find({ role: 'worker' })
        .select('name workerProfile.leaves workerProfile.monthlyLeaveQuota workerProfile.leavesUsedThisMonth');

      const stats = {
        totalWorkers: workers.length,
        totalPendingRequests: 0,
        totalApprovedLeaves: 0,
        totalRejectedLeaves: 0,
        workersAtQuota: 0,
        upcomingLeaves: []
      };

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      workers.forEach(worker => {
        const leaves = worker.workerProfile.leaves || [];
        
        leaves.forEach(leave => {
          if (leave.status === 'pending') stats.totalPendingRequests++;
          if (leave.status === 'approved') stats.totalApprovedLeaves++;
          if (leave.status === 'rejected') stats.totalRejectedLeaves++;

          // Check upcoming approved leaves
          const leaveDate = new Date(leave.date);
          leaveDate.setHours(0, 0, 0, 0);
          
          if (leave.status === 'approved' && leaveDate >= today) {
            stats.upcomingLeaves.push({
              workerId: worker._id,
              workerName: worker.name,
              date: leave.date,
              reason: leave.reason
            });
          }
        });

        // Check if at quota
        if (worker.workerProfile.leavesUsedThisMonth >= worker.workerProfile.monthlyLeaveQuota) {
          stats.workersAtQuota++;
        }
      });

      // Sort upcoming leaves by date
      stats.upcomingLeaves.sort((a, b) => new Date(a.date) - new Date(b.date));

      res.json(stats);
    } catch (error) {
      console.error('Get leave statistics error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

export default router;
