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
import earningsRoutes from './routes/earnings.js';
import leavesRoutes from './routes/leaves.js';
import locationRoutes from './routes/locations.js';
import notificationPreferencesRoutes from './routes/notificationPreferences.js';
import notificationRoutes from './routes/notifications.js';
import paymentRoutes from './routes/payments.js';
import preferencesRoutes from './routes/preferences.js';
import qrPaymentRoutes from './routes/qrPayments.js';
import reviewRoutes from './routes/reviews.js';
import serviceAreaRoutes from './routes/serviceAreas.js';
import serviceRoutes from './routes/services.js';
import settingsRoutes from './routes/settings.js';
import sosRoutes from './routes/sos.js';
import subscriptionRoutes from './routes/subscriptions.js';
import trackingRoutes from './routes/tracking.js';
import userRoutes from './routes/users.js';

// Import utilities
import { runBookingUpdates } from './utils/bookingStatusUpdater.js';

// Import models for stats endpoint
import Booking from './models/Booking.js';
import User from './models/User.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:8080', 'http://localhost:8081', 'http://localhost:8082'];

console.log('🔒 CORS Allowed Origins:', allowedOrigins);

// Helper function to check if origin matches (supports wildcards)
function isOriginAllowed(origin) {
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
    // Count active customers
    const totalCustomers = await User.countDocuments({ 
      role: 'customer',
      isActive: true
    });

    // Count active workers
    const totalWorkers = await User.countDocuments({ 
      role: 'worker',
      isActive: true
    });

    // Count completed bookings (services done)
    const servicesDone = await Booking.countDocuments({ 
      status: 'completed' 
    });

    // Calculate fulfillment rate (completed / total bookings)
    const totalBookings = await Booking.countDocuments({});
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
app.use('/api/auth', authRoutes);
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
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/leaves', leavesRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
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
});

export default app;
