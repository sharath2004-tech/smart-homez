import mongoose from 'mongoose';

/**
 * ServiceCatalog — admin-managed categories & subcategories for organizing the
 * customer-facing service catalog. Each catalog entry groups related services
 * (linked via the Service model's `catalogCategoryId` field) and controls how
 * they appear to customers (icon, colour, description, display order, etc.).
 *
 * Examples:
 *   category: "Insta Help"       → subcategories: ["Ad Hoc Instant Help"]
 *   category: "Subscription"     → subcategories: ["Daily Housekeeping", "Washroom Subscription"]
 *   category: "Mini Services"    → subcategories: ["Kitchen Appliances", "Bedroom Essentials", ...]
 */

const subcategorySchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  slug:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  icon:        { type: String, default: '✨' },
  image:       { type: String, default: null },
  isActive:    { type: Boolean, default: true },
  sortOrder:   { type: Number, default: 0 },
  // pricing display hint shown on cards (e.g. "Starts ₹199", "₹200/hr")
  pricingHint: { type: String, default: '' },
}, { _id: true });

const serviceCatalogSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    unique: true,
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    lowercase: true,
  },
  description: {
    type: String,
    default: '',
  },
  icon: {
    type: String,
    default: '🏠',
  },
  image: {
    type: String,
    default: null,
  },
  color: {
    type: String,
    default: 'blue',  // tailwind color key for UI theming
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
  // How services in this category are priced / displayed
  pricingModel: {
    type: String,
    enum: ['hourly', 'fixed', 'per_unit', 'subscription', 'quote', 'mixed'],
    default: 'fixed',
  },
  // Pricing hint shown on top-level card (e.g. "From ₹200/hr")
  pricingHint: {
    type: String,
    default: '',
  },
  subcategories: [subcategorySchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true });

// Auto-generate slug from name if not provided
serviceCatalogSchema.pre('validate', function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  // Ensure subcategory slugs
  if (this.subcategories) {
    this.subcategories.forEach(sub => {
      if (!sub.slug && sub.name) {
        sub.slug = sub.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }
    });
  }
  next();
});

const ServiceCatalog = mongoose.model('ServiceCatalog', serviceCatalogSchema);
export default ServiceCatalog;
