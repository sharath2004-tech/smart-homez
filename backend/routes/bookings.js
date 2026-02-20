import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { updateBookingStatuses } from '../utils/bookingStatusUpdater.js';
import { assignWorkerToBooking, reassignWorker } from '../utils/workerAssignment.js';

const router = express.Router();

// @route   GET /api/bookings
// @desc    Get bookings (filtered by user role)
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    // Update booking statuses before fetching
    await updateBookingStatuses();
    
    const { status, page = 1, limit = 10 } = req.query;
    
    let query = {};
    
    // Filter based on user role
    if (req.user.role === 'customer') {
      query.customer = req.user._id;
    } else if (req.user.role === 'worker') {
      query.worker = req.user._id;
    }
    // Admin can see all bookings (no filter applied)

    // Handle comma-separated status values (e.g., "pending,confirmed")
    if (status) {
      const statusArray = status.split(',').map(s => s.trim());
      if (statusArray.length > 1) {
        query.status = { $in: statusArray };
      } else {
        query.status = statusArray[0];
      }
    }

    const bookings = await Booking.find(query)
      .populate('customer', 'name email phone')
      .populate('worker', 'name email phone gender religion workerProfile')
      .populate('service', 'name description price duration')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ bookingDate: -1 });

    const count = await Booking.countDocuments(query);

    res.json({
      bookings,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalBookings: count
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get booking by ID
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('worker', 'name email phone gender religion workerProfile')
      .populate('service', 'name description price duration');
    
    if (!booking) {
      return res.status(404).json({ 
        error: { message: 'Booking not found', status: 404 } 
      });
    }

    // Check access permissions
    const isAuthorized = 
      req.user.role === 'admin' ||
      booking.customer._id.toString() === req.user._id.toString() ||
      booking.worker._id.toString() === req.user._id.toString();

    if (!isAuthorized) {
      return res.status(403).json({ 
        error: { message: 'Forbidden', status: 403 } 
      });
    }

    res.json({ booking });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/bookings
// @desc    Create a new booking (with automatic worker assignment)
// @access  Private/Customer
router.post('/',
  authenticate,
  authorize('customer', 'admin'),
  [
    body('worker').optional().isString(),
    body('service').notEmpty().withMessage('Service ID is required'),
    body('bookingDate').isISO8601().withMessage('Valid booking date is required'),
    body('startTime').notEmpty().withMessage('Start time is required'),
    body('endTime').notEmpty().withMessage('End time is required'),
    body('totalAmount').isNumeric().withMessage('Total amount must be a number'),
    body('autoAssign').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { 
        worker, 
        service, 
        bookingDate, 
        startTime, 
        endTime, 
        totalAmount, 
        location, 
        notes, 
        autoAssign,
        bookingType,
        preferences
      } = req.body;

      // If worker is provided, verify they exist and are available
      if (worker) {
        const workerUser = await User.findById(worker);
        if (!workerUser || workerUser.role !== 'worker') {
          return res.status(400).json({ 
            error: { message: 'Invalid worker', status: 400 } 
          });
        }
      }

      // Prepare booking data
      const bookingData = {
        customer: req.user._id,
        worker: worker || undefined,
        service,
        bookingDate,
        startTime,
        endTime,
        totalAmount,
        location,
        notes,
        assignmentMethod: worker ? 'manual' : 'auto',
        bookingType: bookingType || 'oneTime',
        isRecurring: bookingType && bookingType !== 'oneTime',
        preferences: preferences || {}
      };

      // Add recurring schedule if it's a recurring booking
      if (bookingData.isRecurring) {
        bookingData.recurringSchedule = {
          frequency: bookingType,
          startDate: new Date(bookingDate),
          nextScheduledDate: new Date(bookingDate)
        };
      }

      const booking = new Booking(bookingData);

      await booking.save();

      // Auto-assign worker if requested or no worker provided
      let populatedBooking;
      if (!worker || autoAssign === true) {
        try {
          populatedBooking = await assignWorkerToBooking(booking._id);
        } catch (assignError) {
          console.error('Worker assignment error:', assignError);
          // Booking created but no worker assigned yet
          populatedBooking = await Booking.findById(booking._id)
            .populate('customer', 'name email phone')
            .populate('service', 'name description price duration');
        }
      } else {
        populatedBooking = await Booking.findById(booking._id)
          .populate('customer', 'name email phone')
          .populate('worker', 'name email phone gender religion workerProfile')
          .populate('service', 'name description price duration');
      }

      res.status(201).json({ 
        message: 'Booking created successfully', 
        booking: populatedBooking 
      });
    } catch (error) {
      console.error('Create booking error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   PUT /api/bookings/:id
// @desc    Update booking
// @access  Private
router.put('/:id', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ 
        error: { message: 'Booking not found', status: 404 } 
      });
    }

    // Check permissions
    const isAuthorized = 
      req.user.role === 'admin' ||
      booking.customer.toString() === req.user._id.toString() ||
      booking.worker.toString() === req.user._id.toString();

    if (!isAuthorized) {
      return res.status(403).json({ 
        error: { message: 'Forbidden', status: 403 } 
      });
    }

    const { status, notes, rating, review, cancellationReason, actualEndTime } = req.body;

    if (status) booking.status = status;
    if (notes) booking.notes = notes;
    if (rating) booking.rating = rating;
    if (review) booking.review = review;
    if (cancellationReason) booking.cancellationReason = cancellationReason;
    if (actualEndTime) booking.actualEndTime = actualEndTime;

    // Calculate overtime charges when completing the booking
    if (status === 'completed' && booking.actualStartTime) {
      const endTime = actualEndTime ? new Date(actualEndTime) : new Date();
      booking.actualEndTime = endTime;

      // Calculate actual duration
      const actualDurationMs = endTime - new Date(booking.actualStartTime);
      const actualDurationMinutes = Math.floor(actualDurationMs / 60000);
      booking.actualDurationMinutes = actualDurationMinutes;

      // Calculate scheduled end time
      const scheduledEndDate = new Date(booking.bookingDate);
      const [endHours, endMinutes] = booking.endTime.split(':');
      scheduledEndDate.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);

      // Calculate overtime
      const overtimeMs = endTime - scheduledEndDate;
      if (overtimeMs > 0) {
        const overtimeMinutes = Math.ceil(overtimeMs / 60000);
        booking.overtimeMinutes = overtimeMinutes;
        
        // ₹2.5 per minute overtime charge
        const OVERTIME_RATE = 2.5;
        const overtimeCharges = overtimeMinutes * OVERTIME_RATE;
        booking.overtimeCharges = overtimeCharges;
        
        // Update total amount
        booking.totalAmount = (booking.totalAmount || 0) + overtimeCharges;
      }
    }

    await booking.save();

    const updatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name email phone')
      .populate('worker', 'name email phone gender religion workerProfile')
      .populate('service', 'name description price duration');

    res.json({ message: 'Booking updated successfully', booking: updatedBooking });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   DELETE /api/bookings/:id
// @desc    Cancel booking
// @access  Private
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ 
        error: { message: 'Booking not found', status: 404 } 
      });
    }

    // Only customer or admin can cancel
    if (req.user.role !== 'admin' && booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        error: { message: 'Forbidden', status: 403 } 
      });
    }

    booking.status = 'cancelled';
    booking.cancellationReason = req.body.reason || 'Cancelled by customer';
    await booking.save();

    res.json({ message: 'Booking cancelled successfully', booking });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   POST /api/bookings/:id/assign-worker
// @desc    Auto-assign best worker to booking
// @access  Private/Admin
router.post('/:id/assign-worker', authenticate, authorize('admin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ 
        error: { message: 'Booking not found', status: 404 } 
      });
    }

    if (booking.worker) {
      return res.status(400).json({ 
        error: { message: 'Worker already assigned. Use reassign if needed.', status: 400 } 
      });
    }

    const assignedBooking = await assignWorkerToBooking(req.params.id);

    res.json({ 
      message: 'Worker assigned successfully', 
      booking: assignedBooking 
    });

  } catch (error) {
    console.error('Assign worker error:', error);
    res.status(500).json({ error: { message: error.message || 'Server error', status: 500 } });
  }
});

// @route   POST /api/bookings/:id/reassign-worker
// @desc    Reassign worker (use backup or find new)
// @access  Private/Admin
router.post('/:id/reassign-worker', 
  authenticate, 
  authorize('admin'),
  [body('reason').notEmpty().withMessage('Reason for reassignment is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { reason } = req.body;

      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      const reassignedBooking = await reassignWorker(req.params.id, reason);

      res.json({ 
        message: 'Worker reassigned successfully', 
        booking: reassignedBooking 
      });

    } catch (error) {
      console.error('Reassign worker error:', error);
      res.status(500).json({ error: { message: error.message || 'Server error', status: 500 } });
    }
  }
);

// ==================== SERVICE QR CODE WORKFLOW ====================

// @route   POST /api/bookings/:id/generate-start-qr
// @desc    Worker generates QR code for service start
// @access  Private/Worker
router.post('/:id/generate-start-qr', 
  authenticate, 
  authorize('worker', 'admin'),
  [
    body('jobDescriptionAcknowledged').isBoolean().withMessage('Job description acknowledgment is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      // Verify worker is assigned to this booking
      if (booking.worker.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: { message: 'You are not assigned to this booking', status: 403 } 
        });
      }

      // Check booking status
      if (booking.status !== 'confirmed') {
        return res.status(400).json({ 
          error: { message: 'Booking must be confirmed to generate start QR', status: 400 } 
        });
      }

      // Check if already started
      if (booking.actualStartTime) {
        return res.status(400).json({ 
          error: { message: 'Service already started', status: 400 } 
        });
      }

      const { jobDescriptionAcknowledged } = req.body;

      // Generate unique QR code for service start
      const startQRCode = `START-${booking._id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      booking.serviceStartQRCode = startQRCode;
      booking.jobDescriptionAcknowledged = jobDescriptionAcknowledged;
      booking.jobDescriptionAcknowledgedAt = new Date();
      
      await booking.save();

      res.json({ 
        message: 'Service start QR code generated successfully',
        qrCode: startQRCode,
        bookingId: booking._id,
        service: booking.service
      });

    } catch (error) {
      console.error('Generate start QR error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/bookings/:id/scan-start-qr
// @desc    Customer scans QR code to start service
// @access  Private/Customer
router.post('/:id/scan-start-qr',
  authenticate,
  authorize('customer', 'admin'),
  [
    body('qrCode').notEmpty().withMessage('QR code is required'),
    body('termsAccepted').isBoolean().withMessage('Terms acceptance is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { qrCode, termsAccepted } = req.body;

      const booking = await Booking.findById(req.params.id)
        .populate('service', 'name description price duration')
        .populate('worker', 'name email phone gender religion workerProfile');
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      // Verify customer owns this booking
      if (booking.customer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: { message: 'Forbidden', status: 403 } 
        });
      }

      // Verify QR code matches
      if (booking.serviceStartQRCode !== qrCode) {
        return res.status(400).json({ 
          error: { message: 'Invalid QR code', status: 400 } 
        });
      }

      // Check if already started
      if (booking.actualStartTime) {
        return res.status(400).json({ 
          error: { message: 'Service already started', status: 400 } 
        });
      }

      // Verify terms are accepted
      if (!termsAccepted) {
        return res.status(400).json({ 
          error: { message: 'Terms and conditions must be accepted', status: 400 } 
        });
      }

      // Start the service
      const now = new Date();
      booking.actualStartTime = now;
      booking.termsAccepted = termsAccepted;
      booking.termsAcceptedAt = now;
      booking.status = 'in-progress';
      
      await booking.save();

      res.json({ 
        message: 'Service started successfully',
        booking: {
          _id: booking._id,
          status: booking.status,
          actualStartTime: booking.actualStartTime,
          service: booking.service,
          worker: booking.worker
        },
        startTime: now
      });

    } catch (error) {
      console.error('Scan start QR error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/bookings/:id/generate-end-qr
// @desc    Worker generates QR code for service end
// @access  Private/Worker
router.post('/:id/generate-end-qr', 
  authenticate, 
  authorize('worker', 'admin'),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      // Verify worker is assigned to this booking
      if (booking.worker.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: { message: 'You are not assigned to this booking', status: 403 } 
        });
      }

      // Check if service has started
      if (!booking.actualStartTime) {
        return res.status(400).json({ 
          error: { message: 'Service must be started first', status: 400 } 
        });
      }

      // Check if already ended
      if (booking.actualEndTime) {
        return res.status(400).json({ 
          error: { message: 'Service already ended', status: 400 } 
        });
      }

      // Generate unique QR code for service end
      const endQRCode = `END-${booking._id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      booking.serviceEndQRCode = endQRCode;
      await booking.save();

      res.json({ 
        message: 'Service end QR code generated successfully',
        qrCode: endQRCode,
        bookingId: booking._id,
        startTime: booking.actualStartTime
      });

    } catch (error) {
      console.error('Generate end QR error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/bookings/:id/scan-end-qr
// @desc    Customer scans QR code to end service
// @access  Private/Customer
router.post('/:id/scan-end-qr',
  authenticate,
  authorize('customer', 'admin'),
  [
    body('qrCode').notEmpty().withMessage('QR code is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { qrCode } = req.body;

      const booking = await Booking.findById(req.params.id)
        .populate('service', 'name description price duration')
        .populate('worker', 'name email phone gender religion workerProfile');
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      // Verify customer owns this booking
      if (booking.customer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: { message: 'Forbidden', status: 403 } 
        });
      }

      // Verify QR code matches
      if (booking.serviceEndQRCode !== qrCode) {
        return res.status(400).json({ 
          error: { message: 'Invalid QR code', status: 400 } 
        });
      }

      // Check if service has started
      if (!booking.actualStartTime) {
        return res.status(400).json({ 
          error: { message: 'Service must be started first', status: 400 } 
        });
      }

      // Check if already ended
      if (booking.actualEndTime) {
        return res.status(400).json({ 
          error: { message: 'Service already ended', status: 400 } 
        });
      }

      // End the service and calculate duration
      const now = new Date();
      booking.actualEndTime = now;
      
      // Calculate actual duration in minutes
      const durationMs = now - booking.actualStartTime;
      const actualDurationMinutes = Math.floor(durationMs / (1000 * 60));
      booking.actualDurationMinutes = actualDurationMinutes;

      // Calculate scheduled duration from startTime and endTime
      // Assuming startTime and endTime are in HH:MM format
      const [startHour, startMin] = booking.startTime.split(':').map(Number);
      const [endHour, endMin] = booking.endTime.split(':').map(Number);
      const scheduledDurationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      booking.scheduledDurationMinutes = scheduledDurationMinutes;

      // Calculate overtime if applicable
      if (actualDurationMinutes > scheduledDurationMinutes) {
        booking.overtimeMinutes = actualDurationMinutes - scheduledDurationMinutes;
        
        // Calculate overtime charges (e.g., 1.5x the hourly rate)
        // Assuming service price is for the scheduled duration
        const hourlyRate = booking.totalAmount / (scheduledDurationMinutes / 60);
        booking.overtimeCharges = (booking.overtimeMinutes / 60) * hourlyRate * 1.5;
        
        // Update total amount to include overtime
        booking.totalAmount += booking.overtimeCharges;
      } else {
        booking.overtimeMinutes = 0;
        booking.overtimeCharges = 0;
      }

      booking.status = 'completed';
      await booking.save();

      res.json({ 
        message: 'Service completed successfully',
        booking: {
          _id: booking._id,
          status: booking.status,
          actualStartTime: booking.actualStartTime,
          actualEndTime: booking.actualEndTime,
          actualDurationMinutes: booking.actualDurationMinutes,
          scheduledDurationMinutes: booking.scheduledDurationMinutes,
          overtimeMinutes: booking.overtimeMinutes,
          overtimeCharges: booking.overtimeCharges,
          totalAmount: booking.totalAmount,
          service: booking.service,
          worker: booking.worker
        }
      });

    } catch (error) {
      console.error('Scan end QR error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// ==================== WORK DOCUMENTATION (REQ-C-012) ====================

// @route   POST /api/bookings/:id/upload-photo
// @desc    Upload work documentation photo
// @access  Private/Worker
router.post('/:id/upload-photo',
  authenticate,
  authorize('worker', 'admin'),
  [
    body('photoUrl').notEmpty().withMessage('Photo URL is required'),
    body('type').isIn(['before', 'during', 'after']).withMessage('Photo type must be before, during, or after'),
    body('notes').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { photoUrl, type, notes } = req.body;

      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      // Verify worker is assigned to this booking
      if (booking.worker.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: { message: 'You are not assigned to this booking', status: 403 } 
        });
      }

      // Check photo limit (max 10 photos)
      if (!booking.workDocumentation) {
        booking.workDocumentation = { photos: [], additionalNotes: '' };
      }

      if (booking.workDocumentation.photos.length >= 10) {
        return res.status(400).json({ 
          error: { message: 'Maximum 10 photos allowed per booking', status: 400 } 
        });
      }

      // Add photo to work documentation
      const photo = {
        url: photoUrl,
        type: type,
        timestamp: new Date(),
        notes: notes || '',
        uploadedBy: req.user._id
      };

      booking.workDocumentation.photos.push(photo);
      await booking.save();

      res.json({ 
        message: 'Photo uploaded successfully',
        photo: photo,
        totalPhotos: booking.workDocumentation.photos.length
      });

    } catch (error) {
      console.error('Upload photo error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/bookings/:id/work-documentation
// @desc    Get work documentation for a booking
// @access  Private
router.get('/:id/work-documentation', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('workDocumentation.photos.uploadedBy', 'name email')
      .populate('service', 'name')
      .populate('worker', 'name email gender religion workerProfile');
    
    if (!booking) {
      return res.status(404).json({ 
        error: { message: 'Booking not found', status: 404 } 
      });
    }

    // Check access permissions
    const isAuthorized = 
      req.user.role === 'admin' ||
      booking.customer.toString() === req.user._id.toString() ||
      booking.worker.toString() === req.user._id.toString();

    if (!isAuthorized) {
      return res.status(403).json({ 
        error: { message: 'Forbidden', status: 403 } 
      });
    }

    res.json({ 
      bookingId: booking._id,
      service: booking.service,
      worker: booking.worker,
      workDocumentation: booking.workDocumentation || { photos: [], additionalNotes: '' }
    });

  } catch (error) {
    console.error('Get work documentation error:', error);
    res.status(500).json({ error: { message: 'Server error', status: 500 } });
  }
});

// @route   PUT /api/bookings/:id/work-documentation/notes
// @desc    Update additional notes for work documentation
// @access  Private/Worker
router.put('/:id/work-documentation/notes',
  authenticate,
  authorize('worker', 'admin'),
  [
    body('notes').notEmpty().withMessage('Notes are required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { notes } = req.body;

      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      // Verify worker is assigned to this booking
      if (booking.worker.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: { message: 'You are not assigned to this booking', status: 403 } 
        });
      }

      // Initialize work documentation if it doesn't exist
      if (!booking.workDocumentation) {
        booking.workDocumentation = { photos: [], additionalNotes: '' };
      }

      booking.workDocumentation.additionalNotes = notes;
      await booking.save();

      res.json({ 
        message: 'Notes updated successfully',
        notes: booking.workDocumentation.additionalNotes
      });

    } catch (error) {
      console.error('Update notes error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   DELETE /api/bookings/:id/work-documentation/photos/:photoId
// @desc    Delete a work documentation photo
// @access  Private/Worker/Admin
router.delete('/:id/work-documentation/photos/:photoId',
  authenticate,
  authorize('worker', 'admin'),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({ 
          error: { message: 'Booking not found', status: 404 } 
        });
      }

      // Verify worker is assigned to this booking
      if (booking.worker.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: { message: 'You are not assigned to this booking', status: 403 } 
        });
      }

      if (!booking.workDocumentation || !booking.workDocumentation.photos) {
        return res.status(404).json({ 
          error: { message: 'No work documentation found', status: 404 } 
        });
      }

      // Find and remove the photo
      const photoIndex = booking.workDocumentation.photos.findIndex(
        photo => photo._id.toString() === req.params.photoId
      );

      if (photoIndex === -1) {
        return res.status(404).json({ 
          error: { message: 'Photo not found', status: 404 } 
        });
      }

      booking.workDocumentation.photos.splice(photoIndex, 1);
      await booking.save();

      res.json({ 
        message: 'Photo deleted successfully',
        totalPhotos: booking.workDocumentation.photos.length
      });

    } catch (error) {
      console.error('Delete photo error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

export default router;
