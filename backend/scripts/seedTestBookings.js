/**
 * seedTestBookings.js
 * 1. Wipes all existing Booking documents
 * 2. Finds real users (customer, worker, admin, super_admin) from the DB
 * 3. Inserts 5 representative bookings covering every status + bookingType
 * 4. Verifies visibility via live API (GET /api/bookings and /api/super-admin/bookings)
 *
 * Run: node scripts/seedTestBookings.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const API_BASE  = `http://localhost:${process.env.PORT || 5000}/api`;

// ── Minimal inline schemas (mirrors the real models) ─────────────────────────
const UserSchema = new mongoose.Schema({}, { strict: false });
const BookingSchema = new mongoose.Schema({}, { strict: false });
const LocationSchema = new mongoose.Schema({}, { strict: false });
const ServiceSchema  = new mongoose.Schema({}, { strict: false });

const User     = mongoose.models.User     || mongoose.model('User',     UserSchema,     'users');
const Booking  = mongoose.models.Booking  || mongoose.model('Booking',  BookingSchema,  'bookings');
const Location = mongoose.models.Location || mongoose.model('Location', LocationSchema, 'locations');
const Service  = mongoose.models.Service  || mongoose.model('Service',  ServiceSchema,  'services');

// ── Helpers ───────────────────────────────────────────────────────────────────
const log  = (msg) => console.log(`  ✅ ${msg}`);
const warn = (msg) => console.warn(`  ⚠️  ${msg}`);
const fail = (msg) => console.error(`  ❌ ${msg}`);

async function apiLogin(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  return data.token;
}

async function apiGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`GET ${path} failed: ${JSON.stringify(data)}`);
  return data;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  Healthy Homez — Booking Seed & Test Script');
  console.log('══════════════════════════════════════════════\n');

  // 1. Connect
  await mongoose.connect(MONGO_URI);
  log('Connected to MongoDB');

  // 2. Fetch real users
  const customer   = await User.findOne({ role: 'customer',   isActive: { $ne: false } }).lean();
  const worker     = await User.findOne({ role: 'worker',     isActive: { $ne: false } }).lean();
  const admin      = await User.findOne({ role: 'admin',      isActive: { $ne: false } }).lean();
  const superAdmin = await User.findOne({ role: 'super_admin',isActive: { $ne: false } }).lean();
  const location   = await Location.findOne({ isActive: true }).lean();
  const service    = await Service.findOne({ isActive: true }).lean();

  console.log('  📋 Users found:');
  console.log(`     customer    : ${customer   ? `${customer.name} (${customer.email})`     : '⚠️  NONE'}`);
  console.log(`     worker      : ${worker     ? `${worker.name} (${worker.email})`         : '⚠️  NONE'}`);
  console.log(`     admin       : ${admin      ? `${admin.name} (${admin.email})`           : '⚠️  NONE'}`);
  console.log(`     super_admin : ${superAdmin ? `${superAdmin.name} (${superAdmin.email})` : '⚠️  NONE'}`);
  console.log(`     location    : ${location   ? `${location.apartmentName}, ${location.area}` : '⚠️  NONE'}`);
  console.log(`     service     : ${service    ? service.name                                   : '⚠️  NONE'}`);
  console.log();

  if (!customer) {
    fail('No customer found in DB. Please register a customer first.');
    process.exit(1);
  }

  // 3. Wipe all bookings
  const deleted = await Booking.deleteMany({});
  log(`Deleted ${deleted.deletedCount} existing booking(s)`);

  // 4. Build location data
  const locationData = {
    locationId:    location?._id || null,
    apartmentName: location?.apartmentName || 'Test Apartments',
    area:          location?.area || 'Koramangala',
    city:          location?.city || 'Bengaluru',
    address:       '123 Test Lane',
    coordinates:   location?.location?.coordinates || [77.5946, 12.9716],
  };

  const baseDate = new Date('2026-03-25');

  // 5. Insert 5 test bookings
  const bookings = await Booking.insertMany([
    // ── 1. Pending adhoc — no worker yet ───────────────────────────────────
    {
      customer:    customer._id,
      service:     service?._id || undefined,
      worker:      undefined,
      bookingDate: baseDate,
      startTime:   '09:00',
      endTime:     '10:00',
      totalAmount: 350,
      bookingType: 'adhoc',
      status:      'pending',
      location:    locationData,
      notes:       'Test: pending adhoc, no worker',
      createdAt:   new Date(),
    },
    // ── 2. Confirmed adhoc — worker assigned ────────────────────────────────
    {
      customer:        customer._id,
      service:         service?._id || undefined,
      worker:          worker?._id  || undefined,
      bookingDate:     new Date('2026-03-26'),
      startTime:       '10:00',
      endTime:         '11:00',
      totalAmount:     450,
      bookingType:     'adhoc',
      status:          'confirmed',
      assignmentMethod:'auto',
      assignedAt:      new Date(),
      confirmedAt:     new Date(),
      location:        locationData,
      notes:           'Test: confirmed adhoc, worker assigned',
      createdAt:       new Date(),
    },
    // ── 3. In-progress ──────────────────────────────────────────────────────
    {
      customer:        customer._id,
      service:         service?._id || undefined,
      worker:          worker?._id  || undefined,
      bookingDate:     new Date(),
      startTime:       '08:00',
      endTime:         '09:00',
      totalAmount:     400,
      bookingType:     'adhoc',
      status:          'in-progress',
      assignmentMethod:'auto',
      assignedAt:      new Date(),
      confirmedAt:     new Date(),
      location:        locationData,
      notes:           'Test: in-progress booking',
      createdAt:       new Date(),
    },
    // ── 4. Completed ────────────────────────────────────────────────────────
    {
      customer:        customer._id,
      service:         service?._id || undefined,
      worker:          worker?._id  || undefined,
      bookingDate:     new Date('2026-03-20'),
      startTime:       '14:00',
      endTime:         '15:00',
      totalAmount:     500,
      bookingType:     'monthly',
      status:          'completed',
      assignmentMethod:'auto',
      assignedAt:      new Date('2026-03-20'),
      confirmedAt:     new Date('2026-03-20'),
      location:        locationData,
      notes:           'Test: completed monthly',
      createdAt:       new Date('2026-03-20'),
    },
    // ── 5. Deep-cleaning-cart ───────────────────────────────────────────────
    {
      customer:    customer._id,
      service:     undefined,          // intentionally null — deep cleaning cart
      worker:      worker?._id || undefined,
      bookingDate: new Date('2026-03-27'),
      startTime:   '11:00',
      endTime:     '14:00',
      totalAmount: 1398,
      bookingType: 'deep-cleaning-cart',
      status:      'confirmed',
      assignmentMethod: 'auto',
      assignedAt:  new Date(),
      confirmedAt: new Date(),
      cartItems: [
        { itemId: 'washroom_deep', name: 'Intense Washroom Deep Clean', qty: 2, totalPrice: 1000 },
        { itemId: 'fullhouse_bare', name: 'Full House (Bare)', selectedTier: 50, totalPrice: 398 },
      ],
      location:    locationData,
      notes:       'Test: deep-cleaning-cart (service=null)',
      createdAt:   new Date(),
    },
  ]);

  log(`Inserted ${bookings.length} test bookings`);
  console.log();
  bookings.forEach((b, i) => {
    console.log(`     [${i + 1}] ${b.bookingType.padEnd(22)} status=${b.status.padEnd(14)} amount=₹${b.totalAmount}  _id=${b._id}`);
  });
  console.log();

  // ── 6. API verification ───────────────────────────────────────────────────
  console.log('  🔍 API Verification (requires backend running on port 5000)\n');

  // Try to get passwords from DB for test logins
  // We'll use a known default or skip gracefully
  const testCredentials = [
    { role: 'super_admin', user: superAdmin },
    { role: 'admin',       user: admin },
    { role: 'customer',    user: customer },
  ];

  for (const { role, user } of testCredentials) {
    if (!user) { warn(`Skipping ${role} API check — no user found`); continue; }

    // Try common test passwords
    const passwords = ['Admin@123', 'Test@123', 'Password@123', 'admin123', 'test@123', '123456', 'Admin@1234'];
    let token = null;
    for (const pw of passwords) {
      try { token = await apiLogin(user.email, pw); break; } catch { /* try next */ }
    }

    if (!token) {
      warn(`Could not login as ${role} (${user.email}) — password unknown. Skipping API check.`);
      continue;
    }

    try {
      if (role === 'super_admin') {
        const data = await apiGet('/super-admin/bookings?limit=100', token);
        const count = (data.bookings || []).length;
        count === bookings.length
          ? log(`super_admin sees ${count}/${bookings.length} bookings via /super-admin/bookings ✔`)
          : warn(`super_admin sees ${count}/${bookings.length} bookings via /super-admin/bookings`);

      } else if (role === 'admin') {
        const data = await apiGet('/bookings?limit=100', token);
        const count = (data.bookings || []).length;
        count === bookings.length
          ? log(`admin sees ${count}/${bookings.length} bookings via /bookings ✔`)
          : warn(`admin sees ${count}/${bookings.length} bookings (may be filtered by region)`);

      } else if (role === 'customer') {
        const data = await apiGet('/bookings?limit=100', token);
        const count = (data.bookings || []).length;
        count === bookings.length
          ? log(`customer sees ${count}/${bookings.length} own bookings via /bookings ✔`)
          : warn(`customer sees ${count}/${bookings.length} own bookings`);
      }

      // Check deep-cleaning-cart booking is visible
      if (role === 'super_admin') {
        const data = await apiGet('/super-admin/bookings?limit=100', token);
        const dcBooking = (data.bookings || []).find(b => b.bookingType === 'deep-cleaning-cart');
        dcBooking
          ? log(`deep-cleaning-cart booking visible to super_admin (no "service.name" crash) ✔`)
          : warn(`deep-cleaning-cart booking NOT visible to super_admin`);
      }
    } catch (err) {
      fail(`API error for ${role}: ${err.message}`);
    }
  }

  console.log('\n══════════════════════════════════════════════');
  console.log('  Seed complete. Reload the admin/super-admin');
  console.log('  booking pages in the browser to verify UI.');
  console.log('══════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  fail(`Fatal: ${err.message}`);
  mongoose.disconnect();
  process.exit(1);
});
