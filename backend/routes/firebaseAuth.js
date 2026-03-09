import express from 'express';
import admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// Lazy-initialize Firebase Admin (only if credentials are configured)
let adminInitialized = false;
function getFirebaseAdmin() {
  if (!adminInitialized) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Firebase Admin credentials not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env');
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    }
    adminInitialized = true;
  }
  return admin;
}

// POST /api/auth/firebase-verify
// Verifies a Firebase ID token and returns a platform JWT
// Body: { idToken, role, name, gender }
router.post('/firebase-verify', async (req, res) => {
  try {
    const { idToken, role = 'customer', name, gender } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: 'idToken is required' });
    }

    const firebaseAdminApp = getFirebaseAdmin();
    const decoded = await firebaseAdminApp.auth().verifyIdToken(idToken);
    const phoneNumber = decoded.phone_number;

    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number not found in Firebase token' });
    }

    // Normalize: +919876543210 → store as-is
    let user = await User.findOne({ phone: phoneNumber });

    if (!user) {
      // New user — create account
      const allowedRoles = ['customer', 'worker'];
      const finalRole = allowedRoles.includes(role) ? role : 'customer';

      user = new User({
        name: name || `User${phoneNumber.slice(-4)}`,
        phone: phoneNumber,
        role: finalRole,
        gender: gender || 'prefer_not_to_say',
        isPhoneVerified: true,
        isFirstLogin: false,
        // No password — phone-only account
        password: Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12),
      });
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      isNewUser: !user.name || user.name.startsWith('User'),
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isPhoneVerified: true,
      },
    });
  } catch (error) {
    console.error('Firebase verify error:', error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ message: 'OTP session expired. Please request a new OTP.' });
    }
    if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
      return res.status(401).json({ message: 'Invalid verification. Please try again.' });
    }
    res.status(500).json({ message: 'Verification failed. Please try again.' });
  }
});

export default router;
