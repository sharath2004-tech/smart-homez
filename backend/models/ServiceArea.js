import mongoose from 'mongoose';

const serviceAreaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Service area name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  coordinates: {
    lat: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: -90,
      max: 90
    },
    lng: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: -180,
      max: 180
    }
  },
  radiusKm: {
    type: Number,
    required: [true, 'Radius is required'],
    min: 0.5,
    max: 50,
    default: 5
  },
  isActive: {
    type: Boolean,
    default: true
  },
  color: {
    type: String,
    default: '#10b981'
  },
  // GeoJSON Point for geospatial queries (for future PostGIS-like queries)
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to sync GeoJSON
serviceAreaSchema.pre('save', function(next) {
  if (this.coordinates) {
    this.location = {
      type: 'Point',
      coordinates: [this.coordinates.lng, this.coordinates.lat] // GeoJSON format: [lng, lat]
    };
  }
  this.updatedAt = new Date();
  next();
});

// Method to check if a point is within this service area
serviceAreaSchema.methods.containsPoint = function(lat, lng) {
  if (!this.isActive) return false;
  
  // Calculate distance using Haversine formula
  const R = 6371; // Earth's radius in km
  const dLat = (lat - this.coordinates.lat) * Math.PI / 180;
  const dLng = (lng - this.coordinates.lng) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(this.coordinates.lat * Math.PI / 180) *
    Math.cos(lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance <= this.radiusKm;
};

// Static method to find service areas containing a point
serviceAreaSchema.statics.findContainingPoint = async function(lat, lng) {
  const areas = await this.find({ isActive: true });
  return areas.filter(area => area.containsPoint(lat, lng));
};

// Static method to find nearest service area to a point
serviceAreaSchema.statics.findNearest = async function(lat, lng, maxDistance = 50) {
  const areas = await this.find({ isActive: true });
  
  const areasWithDistance = areas.map(area => {
    const R = 6371;
    const dLat = (lat - area.coordinates.lat) * Math.PI / 180;
    const dLng = (lng - area.coordinates.lng) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(area.coordinates.lat * Math.PI / 180) *
      Math.cos(lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return { area, distance };
  }).filter(item => item.distance <= maxDistance);
  
  areasWithDistance.sort((a, b) => a.distance - b.distance);
  
  return areasWithDistance.length > 0 ? areasWithDistance[0] : null;
};

const ServiceArea = mongoose.model('ServiceArea', serviceAreaSchema);

export default ServiceArea;
