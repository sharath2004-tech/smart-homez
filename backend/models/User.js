import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['customer', 'worker', 'admin', 'super_admin'],
    default: 'customer'
  },
  // Admin-specific fields
  adminProfile: {
    assignedLocations: [{
      locationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location'
      },
      locationName: String,
      area: String,
      city: String
    }],
    permissions: {
      canCreateWorkers: {
        type: Boolean,
        default: true
      },
      canDeleteWorkers: {
        type: Boolean,
        default: true
      },
      canManageApartments: {
        type: Boolean,
        default: true
      },
      canViewReports: {
        type: Boolean,
        default: true
      }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User' // Reference to super_admin who created this admin
    },
    leaves: [{
      fromDate: { type: Date, required: true },
      toDate: { type: Date, required: true },
      reason: { type: String, maxlength: 500 },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      requestedAt: { type: Date, default: Date.now },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    idDocument: { type: String, default: null },
    idDocumentType: {
      type: String,
      enum: ['aadhaar', 'pan', 'passport', 'driving_license', 'voter_id', 'other', null],
      default: null
    }
  },
  phone: {
    type: String,
    trim: true
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    default: 'prefer_not_to_say'
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  religion: {
    type: String,
    trim: true
  },
  // Temporary password for first-time login
  temporaryPassword: {
    type: String,
    select: false
  },
  isFirstLogin: {
    type: Boolean,
    default: false // Only true for admin-created workers with temporary passwords
  },
  // Address with geolocation support
  addresses: [{
    label: {
      type: String,
      default: 'Home'
    },
    street: String,
    blockNo: String,
    flatNo: String,
    apartment: String,
    building: String,
    area: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'India'
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: '2dsphere'
      }
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  profileImage: {
    type: String,
    default: null
  },
  // Worker-specific fields
  workerProfile: {
    specialization: [String],
    experience: Number,
    languages: [String],
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalReviews: {
      type: Number,
      default: 0
    },
    availability: {
      type: Boolean,
      default: true
    },
    hourlyRate: Number,
    // Location-based assignment
    assignedApartments: [{
      locationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location'
      },
      apartmentName: String,
      building: String,
      area: String,
      city: String,
      location: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: [Number] // [longitude, latitude]
      },
      maxWalkingDistance: {
        type: Number,
        default: 500 // meters (walking distance only)
      }
    }],
    serviceRadius: {
      type: Number,
      default: 500 // meters - maximum walking distance for work
    },
    // Leave management
    monthlyLeaveQuota: {
      type: Number,
      default: 2 // 2 leaves per month as per BRD
    },
    leavesUsedThisMonth: {
      type: Number,
      default: 0
    },
    lastLeaveReset: {
      type: Date,
      default: Date.now
    },
    leaves: [{
      date: {
        type: Date,
        required: true
      },
      reason: {
        type: String,
        maxlength: 200
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      requestedAt: {
        type: Date,
        default: Date.now
      },
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      penaltyApplied: {
        type: Boolean,
        default: false
      },
      penaltyAmount: {
        type: Number,
        default: 0
      }
    }],
    // Working hours tracking
    dailyWorkingHoursTarget: {
      type: Number,
      default: 7 // 7 hours minimum as per BRD
    },
    workingHoursToday: {
      type: Number,
      default: 0
    },
    lastWorkingHoursReset: {
      type: Date,
      default: Date.now
    },
    // Assignment priority factors
    onTimeArrivalRate: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    completionRate: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    totalBookingsCompleted: {
      type: Number,
      default: 0
    },
    // Bank details for payouts
    bankDetails: {
      accountHolderName: String,
      accountNumber: String,
      ifscCode: String,
      bankName: String,
      upiId: String
    },
    // Worker account approval status
    accountStatus: {
      type: String,
      enum: ['pending_review', 'active', 'rejected'],
      default: 'active'
    },
    // Wage type: hourly (HR-based), daily (day-based), or monthly
    wageType: {
      type: String,
      enum: ['hourly', 'daily', 'monthly'],
      default: 'hourly'
    },
    dailyWage: {
      type: Number,
      default: null
    },
    monthlyWage: {
      type: Number,
      default: null
    },
    // Reliability score (0-100) based on punctuality, uniform, behaviour, etc.
    reliabilityScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    // Resigned / archive date
    resignedDate: {
      type: Date,
      default: null
    },
    // Join date (set when worker is activated)
    joinDate: {
      type: Date,
      default: null
    },
    // KYC documents
    documents: {
      aadhaarFront: { type: String, default: null },
      aadhaarBack: { type: String, default: null },
      aadhaarNumber: { type: String, default: null },
      uploadedAt: { type: Date, default: null }
    }
  },
  // Customer preferences
  preferences: {
    workerGenderPreference: {
      type: String,
      enum: ['any', 'male', 'female'],
      default: 'any'
    },
    // Preference Priority: P1, P2, P3
    preferredWorkerP1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    preferredWorkerP2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    preferredWorkerP3: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    // Legacy preferred workers list (kept for backward compatibility)
    preferredWorkers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    // Exception List - Workers to NEVER assign
    exceptionWorkers: [{
      workerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      reason: {
        type: String,
        maxlength: 500
      },
      addedBy: {
        type: String,
        enum: ['customer', 'admin'],
        default: 'customer'
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    languagePreference: {
      type: [String],
      default: []
    },
    religionPreference: {
      type: String,
      default: 'any'
    },
    specialInstructions: {
      type: String,
      maxlength: 500,
      default: ''
    },
    serviceCustomizations: {
      type: Map,
      of: {
        instructions: String,
        preferences: [String]
      },
      default: new Map()
    }
  },
  // Notification Preferences (REQ-C-010)
  notificationPreferences: {
    inApp: {
      enabled: {
        type: Boolean,
        default: true
      }
    },
    whatsapp: {
      enabled: {
        type: Boolean,
        default: false
      },
      consentDate: {
        type: Date
      }
    },
    sms: {
      enabled: {
        type: Boolean,
        default: false
      },
      consentDate: {
        type: Date
      }
    },
    // Notification type preferences
    notifyOnWorkerAssignment: {
      type: Boolean,
      default: true
    },
    notifyOnScheduleChange: {
      type: Boolean,
      default: true
    },
    notifyOnWorkerReassignment: {
      type: Boolean,
      default: true
    },
    notifyOnDelay: {
      type: Boolean,
      default: true
    },
    notifyOnCancellation: {
      type: Boolean,
      default: true
    }
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error(error);
  }
};

// Remove password from JSON response
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

// 2dsphere index for geospatial queries on worker assigned apartments
userSchema.index({ 'workerProfile.assignedApartments.location': '2dsphere' }, { sparse: true });

const User = mongoose.model('User', userSchema);

export default User;
