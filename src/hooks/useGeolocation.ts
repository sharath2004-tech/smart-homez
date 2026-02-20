import { useEffect, useState } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
}

interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

/**
 * Custom hook to get user's current geolocation
 */
export const useGeolocation = (options: GeolocationOptions = {}) => {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({
        latitude: null,
        longitude: null,
        error: 'Geolocation is not supported by your browser',
        loading: false,
      });
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      setState({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        error: null,
        loading: false,
      });

      // Save to localStorage for quick access
      localStorage.setItem('userLocation', JSON.stringify({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: Date.now()
      }));
    };

    const handleError = (error: GeolocationPositionError) => {
      let errorMessage = 'Unable to retrieve location';
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location permission denied';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information unavailable';
          break;
        case error.TIMEOUT:
          errorMessage = 'Location request timed out';
          break;
      }

      // Try to use cached location if available
      const cached = localStorage.getItem('userLocation');
      if (cached) {
        const cachedData = JSON.parse(cached);
        // Use cached location if less than 1 hour old
        if (Date.now() - cachedData.timestamp < 3600000) {
          setState({
            latitude: cachedData.latitude,
            longitude: cachedData.longitude,
            error: `${errorMessage} (using cached location)`,
            loading: false,
          });
          return;
        }
      }

      setState({
        latitude: null,
        longitude: null,
        error: errorMessage,
        loading: false,
      });
    };

    const geoOptions: PositionOptions = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 10000,
      maximumAge: options.maximumAge ?? 0,
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);
  }, []);

  const refetch = () => {
    setState(prev => ({ ...prev, loading: true }));
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          error: null,
          loading: false,
        });
        localStorage.setItem('userLocation', JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now()
        }));
      },
      (error) => {
        setState(prev => ({ ...prev, loading: false, error: error.message }));
      }
    );
  };

  return { ...state, refetch };
};

/**
 * Get cached location from localStorage
 */
export const getCachedLocation = (): { latitude: number; longitude: number } | null => {
  const cached = localStorage.getItem('userLocation');
  if (cached) {
    const data = JSON.parse(cached);
    // Return if less than 1 hour old
    if (Date.now() - data.timestamp < 3600000) {
      return {
        latitude: data.latitude,
        longitude: data.longitude
      };
    }
  }
  return null;
};

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Format distance for display
 */
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

/**
 * Check if location is within walking distance (500m)
 */
export const isWithinWalkingDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  maxDistance: number = 500
): boolean => {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  return distance <= maxDistance;
};

export default useGeolocation;
