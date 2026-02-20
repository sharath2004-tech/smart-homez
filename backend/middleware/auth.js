import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        error: { 
          message: 'No authentication token, access denied', 
          status: 401 
        } 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        error: { 
          message: 'User not found', 
          status: 401 
        } 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        error: { 
          message: 'Account is deactivated', 
          status: 401 
        } 
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ 
      error: { 
        message: 'Invalid token', 
        status: 401 
      } 
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: { 
          message: 'Unauthorized', 
          status: 401 
        } 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: { 
          message: 'Forbidden: You do not have permission to access this resource', 
          status: 403 
        } 
      });
    }

    next();
  };
};
