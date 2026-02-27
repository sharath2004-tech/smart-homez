import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  // Payment Settings
  payment: {
    upiId: {
      type: String,
      default: 'healthyhomez@upi',
      required: true
    },
    upiName: {
      type: String,
      default: 'Healthy Homez',
      required: true
    },
    qrCodeImage: {
      type: String, // Base64 or URL of uploaded QR code
      default: null
    }
  },
  
  // Company Settings
  company: {
    name: {
      type: String,
      default: 'Healthy Homez'
    },
    phone: {
      type: String,
      default: ''
    },
    email: {
      type: String,
      default: ''
    },
    address: {
      type: String,
      default: ''
    }
  },

  // Booking Settings
  booking: {
    overtimeRate: {
      type: Number,
      default: 2.5, // ₹2.5 per minute
      min: 0
    },
    cancellationHours: {
      type: Number,
      default: 24, // Hours before booking
      min: 0
    }
  },

  // Last updated info
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

settingsSchema.statics.updateSettings = async function(updates, userId) {
  let settings = await this.getSettings();
  
  if (updates.payment) {
    settings.payment = { ...settings.payment, ...updates.payment };
  }
  if (updates.company) {
    settings.company = { ...settings.company, ...updates.company };
  }
  if (updates.booking) {
    settings.booking = { ...settings.booking, ...updates.booking };
  }
  
  settings.updatedBy = userId;
  settings.updatedAt = new Date();
  
  await settings.save();
  return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
