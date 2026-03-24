import mongoose from 'mongoose';

const tierSchema = new mongoose.Schema({
  label: { type: String, required: true },
  price: { type: Number, required: true, min: 0 }
}, { _id: false });

const itemSchema = new mongoose.Schema({
  id:          { type: String, required: true },
  category:    { type: String, required: true },
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  pricingType: { type: String, enum: ['fixed', 'per_unit', 'per_sqft', 'tiered'], required: true },
  price:       { type: Number, default: 0, min: 0 },
  tiers:       [tierSchema],
  durationMinutes: { type: Number, default: 180, min: 15 },
  maxQty:      { type: Number, default: 20 },
  unit:        { type: String, default: 'unit' },
  icon:        { type: String, default: '✨' },
  isActive:    { type: Boolean, default: true },
  sortOrder:   { type: Number, default: 0 }
}, { _id: false });

const categorySchema = new mongoose.Schema({
  id:       { type: String, required: true },
  label:    { type: String, required: true },
  emoji:    { type: String, default: '✨' },
  isActive: { type: Boolean, default: true },
  sortOrder:{ type: Number, default: 0 },
  description: { type: String, default: '' },
  highlights: { type: [String], default: [] },
  mode: { type: String, enum: ['package', 'customize', 'quote'], default: 'customize' },
  headline: { type: String, default: '' },
  inclusionsTitle: { type: String, default: '' },
  idealFor: { type: [String], default: [] },
  howItWorksTitle: { type: String, default: 'How this works' },
  howItWorksSteps: { type: [String], default: [] },
  primaryActionLabel: { type: String, default: '' },
  secondaryActionLabel: { type: String, default: '' }
}, { _id: false });

const pageContentSchema = new mongoose.Schema({
  heroBadge:            { type: String, default: 'Professional home care' },
  heroTitle:            { type: String, default: 'Deep Cleaning Services' },
  heroSubtitle:         { type: String, default: 'Choose the right deep cleaning service for your home, move-in, move-out, kitchen, bathroom and more.' },
  categoriesTitle:      { type: String, default: 'Choose a deep cleaning service' },
  categoriesSubtitle:   { type: String, default: 'Pick a category, enter your requirements and get the final amount based on your home details.' },
  miniServicesTitle:    { type: String, default: 'Popular mini services' },
  miniServicesSubtitle: { type: String, default: 'Add-on services for specific areas and appliances.' }
}, { _id: false });

const DEFAULT_PAGE_CONTENT = {
  heroBadge: 'Professional home care',
  heroTitle: 'Deep Cleaning Services',
  heroSubtitle: 'Choose the right deep cleaning service for your home, move-in, move-out, kitchen, bathroom and more.',
  categoriesTitle: 'Choose a deep cleaning service',
  categoriesSubtitle: 'Pick a category, enter your requirements and get the final amount based on your home details.',
  miniServicesTitle: 'Popular mini services',
  miniServicesSubtitle: 'Add-on services for specific areas and appliances.'
};

const DEFAULT_CATEGORIES = [
  { id: 'fullhouse', label: 'Full Home Deep Cleaning', emoji: '🏡', isActive: true, sortOrder: 1, description: 'Choose a home-size package for full-house professional deep cleaning.', highlights: ['Packages by home size', 'Advance scheduling', 'Team-based cleaning'], mode: 'package', headline: 'Full-home deep cleaning packages for apartments, villas and handover prep.', inclusionsTitle: 'Package includes', idealFor: ['Seasonal full-home reset', 'Festival or guest preparation', 'Homes needing a team visit'], howItWorksTitle: 'How this works', howItWorksSteps: ['Pick this category to understand what is covered.', 'Choose the package or continue to booking and enter your home details.', 'Review the amount and confirm your preferred slot.'], primaryActionLabel: 'Continue to packages', secondaryActionLabel: 'Prefer custom selection?' },
  { id: 'bathroom', label: 'Bathroom Cleaning', emoji: '🚿', isActive: true, sortOrder: 2, description: 'From basic washroom cleaning to intense descaling and sanitization.', highlights: ['Descaling', 'Sanitization', 'Tile & fixture cleaning'], mode: 'customize', headline: 'Bathroom-focused deep cleaning with flexible add-to-cart options.', inclusionsTitle: 'Popular bathroom tasks', idealFor: ['Hard-water stain removal', 'Tile and grout refresh', 'Washrooms needing hygienic sanitization'], howItWorksTitle: 'How this works', howItWorksSteps: ['Pick this category to understand what is covered.', 'Continue to booking, choose the tasks you want, and enter your home details.', 'Review the amount and confirm your slot.'], primaryActionLabel: 'Continue to booking', secondaryActionLabel: 'See full-home packages' },
  { id: 'kitchen', label: 'Kitchen Cleaning', emoji: '🍳', isActive: true, sortOrder: 3, description: 'Degreasing, appliance detailing, chimney cleaning and more.', highlights: ['Grease removal', 'Appliance detailing', 'Chimney options'], mode: 'customize', headline: 'Kitchen deep cleaning built around grease, appliances and high-touch areas.', inclusionsTitle: 'Popular kitchen tasks', idealFor: ['Heavy grease build-up', 'Appliance refresh before guests', 'Monthly kitchen maintenance'], howItWorksTitle: 'How this works', howItWorksSteps: ['Pick this category to see the active kitchen services.', 'Continue to booking and select the tasks or package that fit your kitchen.', 'Review the amount and confirm your preferred slot.'], primaryActionLabel: 'Continue to booking', secondaryActionLabel: 'See full-home packages' },
  { id: 'sofa_upholstery', label: 'Sofa & Upholstery', emoji: '🛋️', isActive: true, sortOrder: 4, description: 'Wet shampooing and upholstery refresh for sofas and seating.', highlights: ['Fabric refresh', 'Seat-wise pricing', 'Quick add-ons'], mode: 'customize', headline: 'Seat-wise upholstery cleaning for fabric and soft furniture.', inclusionsTitle: 'Popular upholstery tasks', idealFor: ['Sofa refresh', 'Dust and stain control', 'Living-room touch-ups'], howItWorksTitle: 'How this works', howItWorksSteps: ['Pick the service to see what is covered.', 'Continue to booking and choose the upholstery tasks you need.', 'Review the amount and confirm your slot.'] },
  { id: 'mattress', label: 'Mattress Cleaning', emoji: '🛏️', isActive: true, sortOrder: 5, description: 'Deep mattress cleaning and sanitization for healthier sleep spaces.', highlights: ['Sanitization', 'Dust removal', 'Spot treatment'], mode: 'customize', headline: 'Mattress and sleep-surface cleaning for a fresher bedroom setup.', inclusionsTitle: 'Popular mattress tasks', idealFor: ['Dust-sensitive homes', 'Spot treatment', 'Bedroom hygiene upgrades'], howItWorksTitle: 'How this works', howItWorksSteps: ['Open the category to see the active services.', 'Continue to booking and select the items you need.', 'Review the amount and confirm your slot.'] },
  { id: 'balcony_window', label: 'Balcony & Window', emoji: '🪟', isActive: true, sortOrder: 6, description: 'Window tracks, glass, balcony wash and utility-area detailing.', highlights: ['Glass cleaning', 'Utility detailing', 'Balcony wash'], mode: 'customize', headline: 'Exterior-adjacent cleaning for windows, tracks, balconies and utility edges.', inclusionsTitle: 'Popular balcony and window tasks', idealFor: ['Dusty balconies', 'Track and frame cleanup', 'Utility-area detailing'], howItWorksTitle: 'How this works', howItWorksSteps: ['See the active tasks in this category.', 'Continue to booking and choose the services you need.', 'Review the amount and confirm your slot.'] },
  { id: 'move_in_out', label: 'Move-in / Move-out', emoji: '📦', isActive: true, sortOrder: 7, description: 'Best for handovers, empty flats and pre-move/post-move home cleaning.', highlights: ['Area-based estimate', 'Vacant-home cleaning', 'Shift-ready service'], mode: 'customize', headline: 'Move-in and move-out cleaning with instant amount calculation after you enter your home area.', inclusionsTitle: 'Usually covered', idealFor: ['Tenant handover', 'Pre-possession cleanup', 'Move-in preparation before shifting'], howItWorksTitle: 'How this works', howItWorksSteps: ['Pick the right move-in or move-out option for your home.', 'Enter your home area and get the amount calculated for you.', 'Choose your slot and confirm the booking.'], primaryActionLabel: 'Continue to booking', secondaryActionLabel: 'Browse all deep-cleaning types' },
  { id: 'office', label: 'Office Deep Cleaning', emoji: '🏢', isActive: true, sortOrder: 8, description: 'Commercial and office deep-cleaning requests handled through custom quotes.', highlights: ['Office spaces', 'Commercial scope', 'Custom quote'], mode: 'quote', headline: 'Commercial deep-cleaning for offices and business spaces.', inclusionsTitle: 'Common office tasks', idealFor: ['Office refresh', 'Commercial scope planning', 'Custom team sizing'], howItWorksTitle: 'How this works', howItWorksSteps: ['Review the service scope and common office tasks.', 'Request a custom quote for your office or commercial property.', 'Our team will contact you with the next steps.'], primaryActionLabel: 'Request custom quote', secondaryActionLabel: 'Browse all deep-cleaning types' },
  { id: 'post_construction', label: 'Post-Construction Cleaning', emoji: '🏗️', isActive: true, sortOrder: 9, description: 'Dust, residue and post-worksite cleaning for newly finished spaces.', highlights: ['Post-renovation', 'Heavy dust cleanup', 'Custom quote'], mode: 'quote', headline: 'Post-construction cleanup for heavy dust, residue and finishing work.', inclusionsTitle: 'Typical post-worksite cleanup', idealFor: ['Newly renovated homes', 'Builder handover', 'Dust-heavy properties'], howItWorksTitle: 'How this works', howItWorksSteps: ['Review the cleanup scope for your property.', 'Request a quote for the site size and condition.', 'Our team will contact you with the next steps.'], primaryActionLabel: 'Request custom quote', secondaryActionLabel: 'Browse all deep-cleaning types' },
  { id: 'appliances', label: 'Appliances', emoji: '💨', isActive: true, sortOrder: 10, description: 'Single-purpose cleaning for fans, chimneys and appliance-focused tasks.', highlights: ['Fast booking', 'Appliance-only', 'Easy add-ons'], mode: 'customize', headline: 'Focused appliance cleaning without booking a full-room package.', inclusionsTitle: 'Popular appliance tasks', idealFor: ['Appliance-only visits', 'Chimney refresh', 'Quick maintenance cleaning'], howItWorksTitle: 'How this works', howItWorksSteps: ['Review the appliance tasks available.', 'Continue to booking and choose what you need.', 'Review the amount and confirm your slot.'] },
  { id: 'furniture', label: 'Furniture', emoji: '🪑', isActive: true, sortOrder: 11, description: 'Sofa sets, dining areas and fabric furniture cleaning with clear pricing.', highlights: ['Furniture care', 'Seat-based services', 'Add to cart'], mode: 'customize', headline: 'Furniture-focused cleaning that fits neatly into a custom builder flow.', inclusionsTitle: 'Popular furniture tasks', idealFor: ['Dining-area refresh', 'Furniture detailing', 'Living-space upkeep'], howItWorksTitle: 'How this works', howItWorksSteps: ['Review the furniture tasks available in this category.', 'Continue to booking and add the services you need.', 'Review the amount and confirm your slot.'] },
];

const deepCleaningConfigSchema = new mongoose.Schema({
  minimumCartValue: { type: Number, default: 500 },
  categories:       { type: [categorySchema], default: DEFAULT_CATEGORIES },
  pageContent:      { type: pageContentSchema, default: DEFAULT_PAGE_CONTENT },
  items:            [itemSchema],
  updatedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

const DeepCleaningConfig = mongoose.model('DeepCleaningConfig', deepCleaningConfigSchema);
export default DeepCleaningConfig;
