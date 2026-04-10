import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Made optional as worker will be assigned by algorithm
  },
  // Worker assignment details
  assignmentMethod: {
    type: String,
    enum: [
      'auto',
      'manual',
      'customer-preferred',
      'auto-nearest',
      'preference-p1',
      'preference-p2',
      'preference-p3',
      'worker-accepted',
      'backup-activated'
    ],
    default: 'auto'
  },
  assignedAt: {
    type: Date,
    default: null
  },
  confirmedAt: {
    type: Date,
    default: null
  },
  backupWorkers: [{
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedAt: Date,
    priority: Number
  }],
  // Track backup worker activations
  backupActivations: [{
    previousWorker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    backupWorker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    activatedAt: {
      type: Date,
      default: Date.now
    },
    reason: String,
    backupPriority: Number
  }],
  // Support staff for deep cleaning (team head = booking.worker, support staff = this array)
  supportStaff: [{
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: { type: String }
  }],
  // Break time tracking for deep cleaning services
  breakRequests: [{
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    requestedByName: { type: String },
    reason: { type: String, default: '' },
    requestedAt: { type: Date, default: Date.now },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    durationMinutes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'active', 'completed', 'rejected'],
      default: 'pending'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  }],
  // Total break duration in minutes (sum of all completed breaks)
  totalBreakMinutes: {
    type: Number,
    default: 0
  },
  // Whether service is currently paused for a break
  isOnBreak: {
    type: Boolean,
    default: false
  },
  // Worker arrival tracking
  workerArrivalTime: {
    type: Date,
    default: null
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: false  // optional for cart-type bookings (deep cleaning)
  },
  bookingDate: {
    type: Date,
    required: [true, 'Booking date is required']
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required']
  },
  endTime: {
    type: String,
    required: [true, 'End time is required']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-progress', 'pending-review', 'completed', 'cancelled'],
    default: 'pending'
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  // Recurring booking details
  bookingType: {
    type: String,
    enum: ['adhoc', 'recurring-short', 'monthly-subscription', 'oneTime', 'daily', 'weekly', 'biweekly', 'monthly', 'deep-cleaning-cart'],
    default: 'adhoc'
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringSchedule: {
    frequency: {
      type: String,
      enum: ['daily', 'custom-days', '3-days', '4-days', '7-days', 'weekly', 'biweekly', 'monthly']
    },
    customDays: {
      type: Number, // For custom day intervals
      default: null
    },
    selectedDays: [{
      type: String, // For weekly subscriptions: ['monday', 'tuesday', etc.]
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    preferredTime: String, // Preferred time for recurring bookings
    startDate: Date,
    endDate: Date,
    nextScheduledDate: Date,
    completedOccurrences: {
      type: Number,
      default: 0
    },
    totalOccurrences: Number
  },
  // Monthly subscription specific
  subscription: {
    isSubscription: {
      type: Boolean,
      default: false
    },
    activationStatus: {
      type: String,
      enum: ['payment_pending', 'approval_pending', 'active'],
      default: 'active'
    },
    activatedAt: {
      type: Date,
      default: null
    },
    subscriptionId: String,
    renewedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null
    },
    subscriptionStartDate: Date,
    subscriptionEndDate: Date,
    autoRenewal: {
      type: Boolean,
      default: false
    },
    allowPause: {
      type: Boolean,
      default: true
    },
    isPaused: {
      type: Boolean,
      default: false
    },
    pauseRequestStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none'
    },
    pauseRequestedAt: {
      type: Date,
      default: null
    },
    pauseRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    pauseRequestStartDate: {
      type: Date,
      default: null
    },
    pauseRequestEndDate: {
      type: Date,
      default: null
    },
    pauseRequestReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500
    },
    pauseReviewedAt: {
      type: Date,
      default: null
    },
    pauseReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    pauseReviewNote: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500
    },
    pausedAt: Date,
    resumedAt: Date,
    fixedWorker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User' // The assigned worker for all subscription bookings
    },
    durationPerSession: {
      type: Number, // Duration in hours for each session
      default: 1
    },
    // Split sessions: if total hours > 2, customer can split work into multiple time windows
    splitSessions: [{
      startTime: { type: String, required: true }, // e.g. "09:00"
      endTime:   { type: String, required: true }  // e.g. "11:00"
    }],
    preferredTime: String, // Preferred time for all bookings
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    originalAmount: Number, // Amount before discount
    isPrepaid: {
      type: Boolean,
      default: false
    },
    prepaidAmount: Number
  },
  parentBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null // For recurring bookings, links to the original booking
  },
  // 15-minute slot system
  slotDetails: {
    slotDuration: {
      type: Number,
      default: 15 // minutes
    },
    minimumBookingDuration: {
      type: Number,
      default: 60 // 1 hour minimum
    },
    bufferTime: {
      type: Number,
      default: 15 // 15-minute buffer between bookings
    }
  },
  // Customer preferences for this booking
  preferences: {
    workerGenderPreference: {
      type: String,
      enum: ['any', 'male', 'female'],
      default: 'any'
    },
    // Preference priorities for this booking
    preferenceP1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    preferenceP2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    preferenceP3: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    languagePreference: String,
    religionPreference: String,
    specialInstructions: {
      type: String,
      maxlength: 500
    }
  },
  // Service extension
  extensionRequests: [{
    requestedAt: {
      type: Date,
      default: Date.now
    },
    additionalMinutes: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['approved', 'denied'],
      default: 'approved'
    },
    denialReason: String, // If next booking exists
    additionalCharge: {
      type: Number,
      default: 0
    }
  }],
  // Auto-reassignment tracking
  reassignmentHistory: [{
    previousWorker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    newWorker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['worker-delayed', 'worker-unavailable', 'worker-on-leave', 'customer-exception', 'system-auto'],
      required: true
    },
    reassignedAt: {
      type: Date,
      default: Date.now
    },
    delayMinutes: Number,
    customerNotified: {
      type: Boolean,
      default: false
    }
  }],
  // Delay tracking
  delayNotifications: [{
    notifiedAt: {
      type: Date,
      default: Date.now
    },
    delayReason: String,
    estimatedDelayMinutes: Number,
    updatedETA: Date
  }],
  // Time rounding for billing
  billing: {
    roundedDurationMinutes: {
      type: Number,
      default: null
    },
    billingSlots: {
      type: Number,
      default: 0 // Number of 15-minute slots
    },
    roundingApplied: {
      type: Boolean,
      default: false
    },
    roundingDetails: {
      originalMinutes: Number,
      extraMinutes: Number,
      roundedUp: {
        type: Boolean,
        default: false
      }
    }
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'qr-generated', 'worker-confirmed', 'paid', 'refunded', 'failed'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['qr-upi', 'cash', 'card', 'other'],
    default: 'qr-upi'
  },
  qrPayment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QRPayment',
    default: null
  },
  location: {
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location'
    },
    apartmentName: String,
    address: String,
    area: String,
    city: String,
    state: String,
    zipCode: String,
    coordinates: [Number] // [longitude, latitude]
  },
  // Service-specific details captured at booking time
  serviceDetails: {
    // Insta/Adhoc specific
    hours: { type: Number, default: null },
    taskList: [{ type: String }],
    bringSupplies: { type: Boolean, default: false },
    roomsCount: { type: Number, default: null },
    // Deep cleaning specific
    package: { type: String, default: null }, // '1BHK','2BHK','3BHK','4BHK','villa'
    areas: [{ type: String }],  // e.g. 'kitchen','bathroom','sofa','carpet','window','fan','balcony'
    addOns: [{ type: String }],
    // Subscription specific (mirrors recurringSchedule for UI)
    sessionDurationHours: { type: Number, default: null }
  },
  // Deep Cleaning cart items (used when bookingType === 'deep-cleaning-cart')
  cartItems: [{
    itemId:       { type: String },
    name:         { type: String },
    category:     { type: String },
    qty:          { type: Number, default: 1 },
    durationMinutes: { type: Number, default: 0 },
    unitPrice:    { type: Number, default: 0 },
    totalPrice:   { type: Number, default: 0 },
    selectedTier: { type: String, default: null },
    areaValue:    { type: Number, default: null }
  }],
  notes: {
    type: String,
    default: ''
  },
  cancellationReason: {
    type: String,
    default: null
  },
  cancellationDate: {
    type: Date,
    default: null
  },
  // Penalty payment gate for early cancellation
  pendingCancellation: {
    type: Boolean,
    default: false
  },
  cancellationPenaltyProof: {
    type: String,
    default: null  // URL of uploaded penalty payment screenshot
  },
  cancellationPenaltyPaid: {
    type: Boolean,
    default: false
  },
  cancellationPenaltyReviewStatus: {
    type: String,
    enum: ['pending_review', 'approved', 'rejected', null],
    default: null  // Set to 'pending_review' when customer uploads proof; admin changes to approved/rejected
  },
  // Refund information (REQ-C-010)
  refund: {
    amount: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    },
    reason: {
      type: String,
      default: null
    },
    processedAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['not-applicable', 'pending', 'processed', 'failed'],
      default: 'not-applicable'
    }
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: null
  },
  review: {
    type: String,
    default: null
  },
  // Service Start/End QR Code Tracking
  serviceStartQRCode: {
    type: String,
    default: null // Generated by worker when ready to start
  },
  serviceEndQRCode: {
    type: String,
    default: null // Generated by worker when ready to end
  },
  lateStartQrNotificationSentAt: {
    type: Date,
    default: null
  },
  lateActualStartNotificationSentAt: {
    type: Date,
    default: null
  },
  actualStartTime: {
    type: Date,
    default: null // Set when customer scans start QR
  },
  actualEndTime: {
    type: Date,
    default: null // Set when customer scans end QR
  },
  termsAccepted: {
    type: Boolean,
    default: false // Customer accepts terms before service start
  },
  termsAcceptedAt: {
    type: Date,
    default: null
  },
  jobDescriptionAcknowledged: {
    type: Boolean,
    default: false // Worker acknowledges job description
  },
  jobDescriptionAcknowledgedAt: {
    type: Date,
    default: null
  },
  actualDurationMinutes: {
    type: Number,
    default: null // Calculated from actualStartTime and actualEndTime
  },
  scheduledDurationMinutes: {
    type: Number,
    default: null // Calculated from startTime and endTime
  },
  overtimeMinutes: {
    type: Number,
    default: 0 // Calculated if actualDuration > scheduledDuration
  },
  overtimeCharges: {
    type: Number,
    default: 0 // Additional charges for overtime
  },
  peakHoursSurcharge: {
    type: Number,
    default: 0 // Surcharge applied when booking falls in a peak-hours window
  },
  // Photo Verification at Service Completion
  completionPhoto: {
    url: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      default: null
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    verified: {
      type: Boolean,
      default: false
    }
  },
  // Photo Verification on Arrival (before service starts)
  arrivalPhoto: {
    url: { type: String, default: null },
    timestamp: { type: Date, default: null },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  // Worker service checklist items
  workerChecklist: [{
    text: { type: String, required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null }
  }],
  // Multiple Completion Photos (minimum 2 required for admin review)
  completionPhotos: [{
    url: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    verified: {
      type: Boolean,
      default: false
    }
  }],
  // Payment Proof Photo
  paymentProof: {
    url: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      default: null
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    verified: {
      type: Boolean,
      default: false
    },
    reviewStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    reviewNotes: {
      type: String,
      default: null
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    transactionId: {
      type: String,
      default: null
    },
    transactionTime: {
      type: Date,
      default: null
    }
  },
  paymentProofs: [{
    url: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    verified: {
      type: Boolean,
      default: false
    },
    reviewStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    reviewNotes: {
      type: String,
      default: null
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    transactionId: {
      type: String,
      default: null
    },
    transactionTime: {
      type: Date,
      default: null
    }
  }],
  // Workforce tracking — snapshotted from service at booking creation, editable by admin post-confirm
  workforce: {
    workerCount: {
      type: Number,
      default: 1,
      min: 1
    },
    wageType: {
      type: String,
      enum: ['per_hour', 'per_session'],
      default: 'per_hour'
    },
    wageRate: {
      type: Number,
      default: 0,
      min: 0
    },
    totalWorkerWage: {
      type: Number,
      default: 0,
      min: 0
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    updatedAt: {
      type: Date,
      default: null
    }
  },
  // Work Documentation (REQ-C-012)
  workDocumentation: {
    photos: [{
      url: {
        type: String,
        required: true
      },
      type: {
        type: String,
        enum: ['before', 'during', 'after'],
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      notes: {
        type: String,
        default: ''
      },
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    }],
    additionalNotes: {
      type: String,
      default: ''
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ── Pre-save overlap guard (last-resort safety net) ─────────────────────────
// Catches overlapping bookings that slip through route-level checks
// (e.g. race conditions, cron jobs, alternate creation paths).
bookingSchema.pre('save', async function preSaveOverlapGuard(next) {
  // Only guard NEW bookings — updates and child visits are exempt
  if (!this.isNew) return next();
  if (this.parentBooking) return next();
  if (this.status === 'cancelled') return next();
  if (!this.customer || !this.startTime || !this.endTime || !this.bookingDate) return next();

  const parseTimeToMinutes = (time) => {
    if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) return null;
    const [hours, minutes] = time.split(':').map(Number);
    return (hours * 60) + minutes;
  };

  const startMin = parseTimeToMinutes(this.startTime);
  const endMin = parseTimeToMinutes(this.endTime);
  if (startMin === null || endMin === null) return next();

  const isSubscription = Boolean(this.subscription?.isSubscription);
  const bookingDate = new Date(this.bookingDate);
  const dayStart = new Date(bookingDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(bookingDate);
  dayEnd.setHours(23, 59, 59, 999);

  // For subscriptions, check whether an identical subscription root already exists
  if (isSubscription) {
    const subEnd = this.subscription.subscriptionEndDate || new Date('2099-01-01');
    const duplicate = await mongoose.model('Booking').findOne({
      customer: this.customer,
      _id: { $ne: this._id },
      'subscription.isSubscription': true,
      parentBooking: null,
      status: { $in: ['pending', 'confirmed', 'in-progress'] },
      startTime: { $lt: this.endTime },
      endTime: { $gt: this.startTime },
      bookingDate: { $lte: subEnd },
      $or: [
        { 'subscription.subscriptionEndDate': null },
        { 'subscription.subscriptionEndDate': { $gte: dayStart } },
      ],
    }).select('_id').lean();

    if (duplicate) {
      const err = new Error('You already have an overlapping subscription for this time slot.');
      err.status = 409;
      err.code = 'DUPLICATE_SUBSCRIPTION';
      return next(err);
    }
  }

  // For all bookings: check same-day same-time overlap with existing bookings
  // Exclude child visits whose parent subscription root has been cancelled
  const cancelledRootIds = await mongoose.model('Booking').find({
    customer: this.customer,
    'subscription.isSubscription': true,
    parentBooking: null,
    status: 'cancelled',
  }).distinct('_id');

  const cancelledParentFilter = cancelledRootIds.length > 0
    ? { parentBooking: { $nin: cancelledRootIds } }
    : {};

  const overlap = await mongoose.model('Booking').findOne({
    customer: this.customer,
    _id: { $ne: this._id },
    ...cancelledParentFilter,
    bookingDate: { $gte: dayStart, $lte: dayEnd },
    status: { $in: ['pending', 'confirmed', 'in-progress'] },
    startTime: { $lt: this.endTime },
    endTime: { $gt: this.startTime },
  }).select('_id').lean();

  if (overlap) {
    const err = new Error('You already have another booking at this time.');
    err.status = 409;
    err.code = 'BOOKING_OVERLAP';
    return next(err);
  }

  // Check against subscription roots that span this date
  const subRootOverlap = await mongoose.model('Booking').findOne({
    customer: this.customer,
    _id: { $ne: this._id },
    'subscription.isSubscription': true,
    parentBooking: null,
    status: { $in: ['pending', 'confirmed', 'in-progress'] },
    bookingDate: { $lte: dayEnd },
    startTime: { $lt: this.endTime },
    endTime: { $gt: this.startTime },
    $or: [
      { 'subscription.subscriptionEndDate': null },
      { 'subscription.subscriptionEndDate': { $gte: dayStart } },
    ],
  }).select('_id recurringSchedule bookingType subscription').lean();

  if (subRootOverlap) {
    // For daily subscriptions the overlap is certain.
    // For weekly/monthly: verify the subscription actually has an occurrence today.
    const freq = subRootOverlap.recurringSchedule?.frequency || subRootOverlap.bookingType || 'daily';
    if (freq === 'daily') {
      const err = new Error('You already have a daily subscription at this time.');
      err.status = 409;
      err.code = 'BOOKING_OVERLAP_SUBSCRIPTION';
      return next(err);
    }

    // Weekly check: see if today's weekday is in the selected days
    const selectedDays = subRootOverlap.recurringSchedule?.selectedDays || [];
    if (selectedDays.length > 0) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayName = dayNames[bookingDate.getDay()];
      if (selectedDays.map(d => d.toLowerCase()).includes(todayName)) {
        const err = new Error('You already have a subscription scheduled at this time on this day.');
        err.status = 409;
        err.code = 'BOOKING_OVERLAP_SUBSCRIPTION';
        return next(err);
      }
    } else {
      // No selectedDays means it runs every matching frequency cycle
      const err = new Error('You already have an overlapping subscription at this time.');
      err.status = 409;
      err.code = 'BOOKING_OVERLAP_SUBSCRIPTION';
      return next(err);
    }
  }

  return next();
});

// Index for faster queries
bookingSchema.index({ customer: 1, bookingDate: -1 });
bookingSchema.index({ worker: 1, bookingDate: -1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ customer: 1, 'subscription.isSubscription': 1, parentBooking: 1, status: 1 });

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
