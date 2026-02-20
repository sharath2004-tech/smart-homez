/**
 * Geolocation utility functions for location-based services
 */

/**
 * Calculate distance between two points using Haversine formula
 * @param {Number} lat1 - Latitude of point 1
 * @param {Number} lon1 - Longitude of point 1
 * @param {Number} lat2 - Latitude of point 2
 * @param {Number} lon2 - Longitude of point 2
 * @returns {Number} Distance in meters
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

/**
 * Check if a location is within walking distance (500m default)
 * @param {Number} lat1 - Latitude of point 1
 * @param {Number} lon1 - Longitude of point 1
 * @param {Number} lat2 - Latitude of point 2
 * @param {Number} lon2 - Longitude of point 2
 * @param {Number} maxDistance - Maximum distance in meters (default: 500m)
 * @returns {Boolean} True if within walking distance
 */
export const isWithinWalkingDistance = (lat1, lon1, lat2, lon2, maxDistance = 500) => {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  return distance <= maxDistance;
};

/**
 * Find nearby locations using MongoDB geospatial query
 * @param {Model} Model - Mongoose model to query
 * @param {Number} longitude - Longitude of center point
 * @param {Number} latitude - Latitude of center point
 * @param {Number} maxDistance - Maximum distance in meters (default: 500m)
 * @param {Object} additionalFilters - Additional query filters
 * @returns {Promise<Array>} Array of nearby locations
 */
export const findNearbyLocations = async (
  Model,
  longitude,
  latitude,
  maxDistance = 500,
  additionalFilters = {}
) => {
  try {
    return await Model.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: maxDistance
        }
      },
      ...additionalFilters
    });
  } catch (error) {
    throw new Error(`Error finding nearby locations: ${error.message}`);
  }
};

/**
 * Find available workers within walking distance of a location
 * @param {Number} longitude - Longitude of service location
 * @param {Number} latitude - Latitude of service location
 * @param {Number} maxDistance - Maximum distance in meters (default: 500m)
 * @param {Array<String>} specializations - Required specializations (optional)
 * @returns {Promise<Array>} Array of available workers
 */
export const findNearbyWorkers = async (
  longitude,
  latitude,
  maxDistance = 500,
  specializations = []
) => {
  try {
    const { default: User } = await import('../models/User.js');
    
    // Build query for available workers
    const query = {
      role: 'worker',
      'workerProfile.availability': true,
      isActive: true,
      'workerProfile.assignedApartments.0': { $exists: true } // Has at least one apartment
    };

    if (specializations && specializations.length > 0) {
      query['workerProfile.specialization'] = { $in: specializations };
    }

    // Get all available workers
    const workers =  await User.find(query)
      .select('name email phone workerProfile')
      .sort({ 'workerProfile.rating': -1 });

    // Filter workers by distance manually (since $near doesn't work well with nested arrays)
    const nearbyWorkers = workers.filter(worker => {
      if (!worker.workerProfile?.assignedApartments?.length) {
        return false;
      }

      // Check if any of the worker's assigned apartments are within range
      return worker.workerProfile.assignedApartments.some(apartment => {
        if (!apartment.location?.coordinates || apartment.location.coordinates.length !== 2) {
          return false;
        }

        const [aptLongitude, aptLatitude] = apartment.location.coordinates;
        const distance = calculateDistance(latitude, longitude, aptLatitude, aptLongitude);
        return distance <= (apartment.maxWalkingDistance || maxDistance);
      });
    });

    return nearbyWorkers;
  } catch (error) {
    console.error('findNearbyWorkers error:', error);
    throw new Error(`Error finding nearby workers: ${error.message}`);
  }
};

/**
 * Check if a service is available at a given location
 * @param {String} serviceId - Service ID
 * @param {Number} longitude - Longitude
 * @param {Number} latitude - Latitude
 * @param {String} apartmentName - Apartment name (optional)
 * @returns {Promise<Object>} Availability info with workers count
 */
export const checkServiceAvailability = async (
  serviceId,
  longitude,
  latitude,
  apartmentName = null
) => {
  try {
    const { default: Service } = await import('../models/Service.js');
    const { default: Location } = await import('../models/Location.js');
    
    // Get the service
    const service = await Service.findById(serviceId);
    if (!service || !service.isActive) {
      return {
        available: false,
        reason: 'Service not found or inactive',
        workers: []
      };
    }

    // Check if service is available in all locations
    if (service.availableInAllLocations) {
      const workers = await findNearbyWorkers(longitude, latitude, 500);
      return {
        available: workers.length > 0,
        reason: workers.length > 0 ? 'Service available' : 'No workers nearby',
        workersCount: workers.length,
        workers: workers.slice(0, 3) // Return top 3 workers
      };
    }

    // Find nearby service locations
    const nearbyLocations = await Location.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: 500
        }
      },
      isServiceAvailable: true,
      isActive: true
    });

    if (nearbyLocations.length === 0) {
      return {
        available: false,
        reason: 'Service not available in your area',
        workers: []
      };
    }

    // Check if apartment name matches (if provided)
    if (apartmentName) {
      const matchingLocation = nearbyLocations.find(
        loc => loc.apartmentName.toLowerCase() === apartmentName.toLowerCase()
      );
      if (!matchingLocation) {
        return {
          available: false,
          reason: 'Service not available in your apartment',
          workers: []
        };
      }
    }

    // Find available workers
    const workers = await findNearbyWorkers(longitude, latitude, 500);
    
    return {
      available: workers.length > 0,
      reason: workers.length > 0 ? 'Service available' : 'No workers available now',
      workersCount: workers.length,
      workers: workers.slice(0, 3),
      nearbyLocations: nearbyLocations.map(loc => ({
        apartmentName: loc.apartmentName,
        area: loc.area,
        distance: calculateDistance(
          latitude,
          longitude,
          loc.location.coordinates[1],
          loc.location.coordinates[0]
        )
      }))
    };
  } catch (error) {
    throw new Error(`Error checking service availability: ${error.message}`);
  }
};

/**
 * Geocode an address to coordinates using OpenStreetMap Nominatim (FREE - no API key needed)
 * @param {Object} address - Address object
 * @returns {Promise<Object>} Coordinates {latitude, longitude}
 */
export const geocodeAddress = async (address) => {
  try {
    // Build search query from address parts
    const parts = [
      address.street,
      address.apartment,
      address.area,
      address.city,
      address.state,
      address.zipCode,
      address.country || 'India'
    ].filter(Boolean);
    
    const query = parts.join(', ');
    
    // Use OpenStreetMap Nominatim API (free, no API key required)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PureAppWeave/1.0' // Required by Nominatim usage policy
      }
    });
    
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon)
      };
    }
    
    // Fallback: Try with just city
    if (address.city) {
      const cityUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address.city + ', India')}&limit=1`;
      const cityResponse = await fetch(cityUrl, {
        headers: { 'User-Agent': 'PureAppWeave/1.0' }
      });
      const cityData = await cityResponse.json();
      
      if (cityData && cityData.length > 0) {
        return {
          latitude: parseFloat(cityData[0].lat),
          longitude: parseFloat(cityData[0].lon)
        };
      }
    }
    
    // Final fallback to Mumbai
    return { latitude: 19.0760, longitude: 72.8777 };
  } catch (error) {
    console.error('Geocoding error:', error);
    // Fallback to Mumbai coordinates
    return { latitude: 19.0760, longitude: 72.8777 };
  }
};

/**
 * Reverse geocode coordinates to address using OpenStreetMap Nominatim (FREE)
 * @param {Number} latitude - Latitude
 * @param {Number} longitude - Longitude
 * @returns {Promise<Object>} Address object
 */
export const reverseGeocode = async (latitude, longitude) => {
  try {
    // Use OpenStreetMap Nominatim reverse geocoding (free, no API key)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PureAppWeave/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.address) {
      return {
        street: data.address.road || '',
        area: data.address.suburb || data.address.neighbourhood || data.address.hamlet || '',
        city: data.address.city || data.address.town || data.address.village || '',
        state: data.address.state || '',
        zipCode: data.address.postcode || '',
        country: data.address.country || 'India',
        formattedAddress: data.display_name || ''
      };
    }
    
    // Fallback
    return {
      street: '',
      area: 'Unknown Area',
      city: 'Mumbai',
      state: 'Maharashtra',
      zipCode: '',
      country: 'India'
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return {
      street: '',
      area: 'Unknown Area',
      city: 'Mumbai',
      state: 'Maharashtra',
      zipCode: '',
      country: 'India'
    };
  }
};

export default {
  calculateDistance,
  isWithinWalkingDistance,
  findNearbyLocations,
  findNearbyWorkers,
  checkServiceAvailability,
  geocodeAddress,
  reverseGeocode
};
