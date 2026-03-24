import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import Location from '../models/Location.js';
import User from '../models/User.js';
import { calculateDistance } from '../utils/geolocation.js';
import { evaluateWorkerEffectiveAvailability } from '../utils/workerAvailability.js';

const router = express.Router();

const getUserCoordinates = (user) => {
  const defaultAddress = user?.addresses?.find(address => address?.isDefault) || user?.addresses?.[0];
  const coordinates = defaultAddress?.location?.coordinates || user?.currentLocation?.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return null;
  }

  const [longitude, latitude] = coordinates;
  if ([longitude, latitude].some(value => typeof value !== 'number' || Number.isNaN(value))) {
    return null;
  }

  return { longitude, latitude };
};

const resolveStrictLocation = async ({ longitude, latitude }) => {
  const nearestLocation = await Location.findOne({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: 50000
      }
    },
    isActive: true,
    isServiceAvailable: true
  }).select('_id location maxServiceRadius').lean();

  if (!nearestLocation?.location?.coordinates?.length) {
    return null;
  }

  const distanceMeters = calculateDistance(
    latitude,
    longitude,
    nearestLocation.location.coordinates[1],
    nearestLocation.location.coordinates[0]
  );
  const maxRadiusMeters = Math.max(nearestLocation.maxServiceRadius || 500, 100);

  return distanceMeters <= maxRadiusMeters ? nearestLocation : null;
};

// @route   GET /api/preferences
// @desc    Get customer preferences
// @access  Private/Customer/Admin
router.get('/',
  authenticate,
  authorize('customer', 'admin'),
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id)
        .populate('preferences.preferredWorkerP1', 'name gender rating workerProfile')
        .populate('preferences.preferredWorkerP2', 'name gender rating workerProfile')
        .populate('preferences.preferredWorkerP3', 'name gender rating workerProfile')
        .populate('preferences.exceptionWorkers.workerId', 'name gender');

      if (!user) {
        return res.status(404).json({ 
          error: { message: 'User not found', status: 404 } 
        });
      }

      res.json({ preferences: user.preferences });
    } catch (error) {
      console.error('Get preferences error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   PUT /api/preferences
// @desc    Update customer preferences
// @access  Private/Customer/Admin
router.put('/',
  authenticate,
  authorize('customer', 'admin'),
  [
    body('workerGenderPreference').optional().isIn(['any', 'male', 'female']),
    body('preferredWorkerP1').optional().isMongoId(),
    body('preferredWorkerP2').optional().isMongoId(),
    body('preferredWorkerP3').optional().isMongoId(),
    body('languagePreference').optional().isArray(),
    body('religionPreference').optional().isString(),
    body('specialInstructions').optional().isString().isLength({ max: 500 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ 
          error: { message: 'User not found', status: 404 } 
        });
      }

      const {
        workerGenderPreference,
        preferredWorkerP1,
        preferredWorkerP2,
        preferredWorkerP3,
        languagePreference,
        religionPreference,
        specialInstructions
      } = req.body;

      // Validate preferred workers are actually workers
      const workerIds = [preferredWorkerP1, preferredWorkerP2, preferredWorkerP3].filter(Boolean);
      if (workerIds.length > 0) {
        const workers = await User.find({ 
          _id: { $in: workerIds }, 
          role: 'worker',
          isActive: true
        });
        
        if (workers.length !== workerIds.length) {
          return res.status(400).json({ 
            error: { message: 'One or more selected workers are invalid', status: 400 } 
          });
        }
      }

      // Update preferences
      if (workerGenderPreference !== undefined) {
        user.preferences.workerGenderPreference = workerGenderPreference;
      }
      if (preferredWorkerP1 !== undefined) {
        user.preferences.preferredWorkerP1 = preferredWorkerP1 || null;
      }
      if (preferredWorkerP2 !== undefined) {
        user.preferences.preferredWorkerP2 = preferredWorkerP2 || null;
      }
      if (preferredWorkerP3 !== undefined) {
        user.preferences.preferredWorkerP3 = preferredWorkerP3 || null;
      }
      if (languagePreference !== undefined) {
        user.preferences.languagePreference = languagePreference;
      }
      if (religionPreference !== undefined) {
        user.preferences.religionPreference = religionPreference;
      }
      if (specialInstructions !== undefined) {
        user.preferences.specialInstructions = specialInstructions;
      }

      await user.save();

      const updatedUser = await User.findById(req.user._id)
        .populate('preferences.preferredWorkerP1', 'name gender rating workerProfile')
        .populate('preferences.preferredWorkerP2', 'name gender rating workerProfile')
        .populate('preferences.preferredWorkerP3', 'name gender rating workerProfile');

      res.json({ 
        message: 'Preferences updated successfully',
        preferences: updatedUser.preferences 
      });
    } catch (error) {
      console.error('Update preferences error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/preferences/exception
// @desc    Add worker to exception list (blacklist)
// @access  Private/Customer/Admin
router.post('/exception',
  authenticate,
  authorize('customer', 'admin'),
  [
    body('workerId').notEmpty().isMongoId().withMessage('Worker ID is required'),
    body('reason').optional().isString().isLength({ max: 500 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { workerId, reason } = req.body;

      // Verify worker exists
      const worker = await User.findOne({ _id: workerId, role: 'worker' });
      if (!worker) {
        return res.status(404).json({ 
          error: { message: 'Worker not found', status: 404 } 
        });
      }

      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ 
          error: { message: 'User not found', status: 404 } 
        });
      }

      // Check if already in exception list
      const alreadyInException = user.preferences.exceptionWorkers.find(
        ex => ex.workerId.toString() === workerId
      );

      if (alreadyInException) {
        return res.status(400).json({ 
          error: { message: 'Worker already in exception list', status: 400 } 
        });
      }

      // Add to exception list
      user.preferences.exceptionWorkers.push({
        workerId,
        reason: reason || 'Customer preference',
        addedBy: 'customer',
        addedAt: new Date()
      });

      // Remove from preferred workers if exists
      if (user.preferences.preferredWorkerP1?.toString() === workerId) {
        user.preferences.preferredWorkerP1 = null;
      }
      if (user.preferences.preferredWorkerP2?.toString() === workerId) {
        user.preferences.preferredWorkerP2 = null;
      }
      if (user.preferences.preferredWorkerP3?.toString() === workerId) {
        user.preferences.preferredWorkerP3 = null;
      }

      await user.save();

      const updatedUser = await User.findById(req.user._id)
        .populate('preferences.exceptionWorkers.workerId', 'name gender');

      res.json({ 
        message: 'Worker added to exception list',
        exceptionWorkers: updatedUser.preferences.exceptionWorkers 
      });
    } catch (error) {
      console.error('Add exception error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   DELETE /api/preferences/exception/:workerId
// @desc    Remove worker from exception list
// @access  Private/Customer/Admin
router.delete('/exception/:workerId',
  authenticate,
  authorize('customer', 'admin'),
  async (req, res) => {
    try {
      const { workerId } = req.params;

      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ 
          error: { message: 'User not found', status: 404 } 
        });
      }

      // Remove from exception list
      user.preferences.exceptionWorkers = user.preferences.exceptionWorkers.filter(
        ex => ex.workerId.toString() !== workerId
      );

      await user.save();

      res.json({ 
        message: 'Worker removed from exception list',
        exceptionWorkers: user.preferences.exceptionWorkers 
      });
    } catch (error) {
      console.error('Remove exception error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   GET /api/preferences/available-workers
// @desc    Get available workers for preference selection
// @access  Private/Customer/Admin
router.get('/available-workers',
  authenticate,
  authorize('customer', 'admin'),
  async (req, res) => {
    try {
      const { latitude, longitude } = req.query;

      const currentUser = await User.findById(req.user._id)
        .select('addresses currentLocation')
        .lean();

      const explicitCoordinates = latitude && longitude
        ? {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude)
          }
        : getUserCoordinates(currentUser);

      const targetLocation = explicitCoordinates
        ? await resolveStrictLocation(explicitCoordinates)
        : null;

      if (!targetLocation) {
        return res.json({ workers: [] });
      }

      let query = {
        role: 'worker',
        isActive: true,
        'workerProfile.availability': true,
        'workerProfile.assignedApartments.locationId': targetLocation._id
      };

      const workers = await User.find(query)
        .select('name gender phone isFirstLogin hasCustomPassword workerProfile.rating workerProfile.totalReviews workerProfile.specialization workerProfile.experience workerProfile.availability workerProfile.leaves workerProfile.workingTimeWindow')
        .limit(50);

      const workerEntries = await Promise.all(
        workers.map(async (worker) => ({
          worker,
          effectiveAvailability: await evaluateWorkerEffectiveAvailability(worker)
        }))
      );

      const availableWorkers = workerEntries
        .filter(entry => entry.effectiveAvailability.effectiveAvailability)
        .map(entry => {
          const worker = entry.worker.toObject();
          return {
            ...worker,
            workerProfile: {
              ...worker.workerProfile,
              availability: true,
              manualAvailability: worker.workerProfile?.availability,
              effectiveAvailability: true,
              availabilityReason: null
            }
          };
        });

      res.json({ workers: availableWorkers });
    } catch (error) {
      console.error('Get available workers error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

// @route   POST /api/preferences/admin-exception
// @desc    Admin adds worker to customer exception list
// @access  Private/Admin
router.post('/admin-exception',
  authenticate,
  authorize('admin'),
  [
    body('customerId').notEmpty().isMongoId().withMessage('Customer ID is required'),
    body('workerId').notEmpty().isMongoId().withMessage('Worker ID is required'),
    body('reason').notEmpty().isString().withMessage('Reason is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { customerId, workerId, reason } = req.body;

      const customer = await User.findOne({ _id: customerId, role: 'customer' });
      if (!customer) {
        return res.status(404).json({ 
          error: { message: 'Customer not found', status: 404 } 
        });
      }

      const worker = await User.findOne({ _id: workerId, role: 'worker' });
      if (!worker) {
        return res.status(404).json({ 
          error: { message: 'Worker not found', status: 404 } 
        });
      }

      // Check if already in exception list
      const alreadyInException = customer.preferences.exceptionWorkers.find(
        ex => ex.workerId.toString() === workerId
      );

      if (alreadyInException) {
        return res.status(400).json({ 
          error: { message: 'Worker already in exception list', status: 400 } 
        });
      }

      // Add to exception list
      customer.preferences.exceptionWorkers.push({
        workerId,
        reason,
        addedBy: 'admin',
        addedAt: new Date()
      });

      await customer.save();

      res.json({ 
        message: 'Worker added to customer exception list by admin',
        customer: {
          _id: customer._id,
          name: customer.name,
          exceptionWorkers: customer.preferences.exceptionWorkers
        }
      });
    } catch (error) {
      console.error('Admin add exception error:', error);
      res.status(500).json({ error: { message: 'Server error', status: 500 } });
    }
  }
);

export default router;
