import mongoose from 'mongoose';

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const breakPeriodSchema = new mongoose.Schema({
  start: { type: String, required: true }, // HH:MM
  end:   { type: String, required: true }, // HH:MM
  label: { type: String, default: 'Break' }
}, { _id: false });

const dayConfigSchema = new mongoose.Schema({
  day:       { type: String, enum: DAYS_OF_WEEK, required: true },
  isActive:  { type: Boolean, default: false },
  openTime:  { type: String, default: '09:00' }, // HH:MM
  closeTime: { type: String, default: '17:00' }, // HH:MM
  breaks:    { type: [breakPeriodSchema], default: [] }
}, { _id: false });

const holidaySchema = new mongoose.Schema({
  date:  { type: String, required: true }, // YYYY-MM-DD
  label: { type: String, default: 'Holiday' }
}, { _id: false });

const businessHoursSchema = new mongoose.Schema({
  schedule: {
    type: [dayConfigSchema],
    default: () => DAYS_OF_WEEK.map((day, idx) => ({
      day,
      isActive: idx >= 1 && idx <= 5, // Mon–Fri active by default
      openTime: '09:00',
      closeTime: '18:00',
      breaks: [{ start: '13:00', end: '14:00', label: 'Lunch Break' }]
    }))
  },
  holidays:             { type: [holidaySchema], default: [] },
  timezone:             { type: String, default: 'Asia/Kolkata' },
  slotDurationMinutes:  { type: Number, default: 30, min: 15, max: 120 },
  updatedBy:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

// Singleton helper — always returns (and lazily creates) the single config document.
businessHoursSchema.statics.getConfig = async function () {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({});
  }
  return config;
};

const BusinessHours = mongoose.model('BusinessHours', businessHoursSchema);
export default BusinessHours;
