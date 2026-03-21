import dns from 'dns';
// Force IPv4 for all outbound connections — Render does not support outbound IPv6
dns.setDefaultResultOrder('ipv4first');

import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

// Import routes
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import businessExpensesRoutes from './routes/businessExpenses.js';
import chatRoutes from './routes/chat.js';
import dashboardPreferencesRoutes from './routes/dashboardPreferences.js';
import deepCleaningRoutes from './routes/deepCleaning.js';
import earningsRoutes from './routes/earnings.js';
import helpRoutes from './routes/help.js';
import leavesRoutes from './routes/leaves.js';
import locationRequestsRoutes from './routes/locationRequests.js';
import locationRoutes from './routes/locations.js';
import notificationPreferencesRoutes from './routes/notificationPreferences.js';
import notificationRoutes from './routes/notifications.js';
import paymentRoutes from './routes/payments.js';
import preferencesRoutes from './routes/preferences.js';
import qrPaymentRoutes from './routes/qrPayments.js';
import quotesRoutes from './routes/quotes.js';
import reliabilityRoutes from './routes/reliability.js';
import reviewRoutes from './routes/reviews.js';
import salaryRequestsRoutes from './routes/salaryRequests.js';
import serviceAreaRoutes from './routes/serviceAreas.js';
import serviceRoutes from './routes/services.js';
import settingsRoutes from './routes/settings.js';
import sosRoutes from './routes/sos.js';
import subscriptionRoutes from './routes/subscriptions.js';
import subscriptionSectionsRoutes from './routes/subscriptionSections.js';
import superAdminRoutes from './routes/superAdmin.js';
import trackingRoutes from './routes/tracking.js';
import twilioAuthRoutes from './routes/twilioAuth.js';
import userRoutes from './routes/users.js';

// Import utilities
import monthlyReliabilityJob from './jobs/monthlyScoring.js';
import initializeDashboardPreferences from './seedDashboardPreferences.js';
import { runBookingUpdates } from './utils/bookingStatusUpdater.js';
import { runRenewalChecker } from './utils/subscriptionRenewalChecker.js';

// Import models for stats endpoint
import Booking from './models/Booking.js';
import User from './models/User.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Trust the first proxy (required for express-rate-limit when deployed behind a reverse proxy)
app.set('trust proxy', 1);

// CORS Configuration
const configuredOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:5173',
      'http://localhost:8080',
      'http://localhost:8081',
      'http://localhost:8082',
      'https://smart-homez.vercel.app',
      'https://*.vercel.app'
    ];

const allowedOrigins = Array.from(new Set([
  ...configuredOrigins,
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082'
]));

console.log('🔒 CORS Allowed Origins:', allowedOrigins);

// Helper function to check if origin matches (supports wildcards)
function isOriginAllowed(origin) {
  // Always allow localhost/127.0.0.1 on any port for local development against remote API
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;

  // Check exact matches
  if (allowedOrigins.includes(origin)) return true;
  
  // Check wildcard patterns (e.g., https://smart-homez-*.vercel.app)
  return allowedOrigins.some(allowedOrigin => {
    if (allowedOrigin.includes('*')) {
      const pattern = allowedOrigin
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(origin);
    }
    return false;
  });
}

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve static files - for uploaded photos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Pure App Weave Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Health check route with server time
app.get('/health', (req, res) => {
  const now = new Date();
  res.json({
    status: 'healthy',
    serverTime: now.toISOString(),
    serverTimeLocal: now.toString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: now.getTime()
  });
});

// Public statistics endpoint (no authentication required)
app.get('/api/public/stats', async (req, res) => {
  try {
    // Run all count queries in parallel for better performance
    const [totalCustomers, totalWorkers, servicesDone, totalBookings] = await Promise.all([
      User.countDocuments({ role: 'customer', isActive: true }),
      User.countDocuments({ role: 'worker', isActive: true }),
      Booking.countDocuments({ status: 'completed' }),
      Booking.countDocuments({})
    ]);

    const fulfillmentRate = totalBookings > 0 
      ? Math.round((servicesDone / totalBookings) * 100)
      : 95;

    res.json({
      success: true,
      stats: {
        totalCustomers,
        totalWorkers,
        servicesDone,
        fulfillmentRate
      }
    });
  } catch (error) {
    console.error('Get public stats error:', error);
    res.status(500).json({ 
      error: { 
        message: 'Server error', 
        status: 500 
      } 
    });
  }
});

// API Routes
app.use('/api/admin', adminRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/auth', twilioAuthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/earnings', earningsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/qr-payments', qrPaymentRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/notification-preferences', notificationPreferencesRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/service-areas', serviceAreaRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/subscription-sections', subscriptionSectionsRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/leaves', leavesRoutes);
app.use('/api/salary-requests', salaryRequestsRoutes);
app.use('/api/help', helpRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/deep-cleaning', deepCleaningRoutes);
app.use('/api/business-expenses', businessExpensesRoutes);
app.use('/api/location-requests', locationRequestsRoutes);
app.use('/api/reliability', reliabilityRoutes);
app.use('/api/dashboard-preferences', dashboardPreferencesRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    error: {
      message: isProd && !err.status ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
      status: err.status || 500
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: { 
      message: 'Route not found', 
      status: 404 
    } 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Start booking status updater (runs every minute)
  console.log('⏰ Starting booking status updater...');
  runBookingUpdates(); // Run immediately on startup
  setInterval(runBookingUpdates, 60000); // Run every 60 seconds

  // Start subscription renewal checker (runs daily)
  console.log('📅 Starting subscription renewal checker...');
  runRenewalChecker();

  // Start monthly reliability scoring job (runs 1st of each month)
  console.log('📊 Starting monthly reliability scoring job...');
  monthlyReliabilityJob.start();

  // Initialize dashboard preferences
  console.log('🎨 Initializing dashboard preferences...');
  await initializeDashboardPreferences();
});

export default app;
