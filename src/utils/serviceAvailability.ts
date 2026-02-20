/**
 * Service Availability Checker using Turf.js
 * Determines if a user's location falls within service areas
 */

import { ServiceArea, serviceAreas } from '@/data/serviceAreas';
import * as turf from '@turf/turf';

export interface LocationCheck {
  isAvailable: boolean;
  serviceArea?: ServiceArea;
  nearestArea?: {
    area: ServiceArea;
    distance: number; // in kilometers
  };
  message: string;
}

/**
 * Check if coordinates fall within any service area
 */
export const checkServiceAvailability = (
  latitude: number,
  longitude: number
): LocationCheck => {
  const userPoint = turf.point([longitude, latitude]);

  // Check each service area
  for (const area of serviceAreas) {
    const polygon = turf.polygon(area.polygon.coordinates);
    
    if (turf.booleanPointInPolygon(userPoint, polygon)) {
      return {
        isAvailable: true,
        serviceArea: area,
        message: `Great! Services are available in ${area.name}`,
      };
    }
  }

  // Not in any service area - find nearest
  const nearestArea = findNearestServiceArea(latitude, longitude);

  return {
    isAvailable: false,
    nearestArea,
    message: nearestArea
      ? `Service not available in your area. Nearest service area is ${nearestArea.area.name} (${nearestArea.distance.toFixed(1)} km away)`
      : 'Service not available in your area yet',
  };
};

/**
 * Find the nearest service area to the given coordinates
 */
export const findNearestServiceArea = (
  latitude: number,
  longitude: number
): { area: ServiceArea; distance: number } | undefined => {
  const userPoint = turf.point([longitude, latitude]);
  let nearest: { area: ServiceArea; distance: number } | undefined;

  for (const area of serviceAreas) {
    const polygon = turf.polygon(area.polygon.coordinates);
    const centerPoint = turf.centroid(polygon);
    const distance = turf.distance(userPoint, centerPoint, { units: 'kilometers' });

    if (!nearest || distance < nearest.distance) {
      nearest = { area, distance };
    }
  }

  return nearest;
};

/**
 * Get all service areas within a radius (in km)
 */
export const getServiceAreasInRadius = (
  latitude: number,
  longitude: number,
  radiusKm: number
): ServiceArea[] => {
  const userPoint = turf.point([longitude, latitude]);
  const areasInRadius: ServiceArea[] = [];

  for (const area of serviceAreas) {
    const polygon = turf.polygon(area.polygon.coordinates);
    const centerPoint = turf.centroid(polygon);
    const distance = turf.distance(userPoint, centerPoint, { units: 'kilometers' });

    if (distance <= radiusKm) {
      areasInRadius.push(area);
    }
  }

  return areasInRadius;
};

/**
 * Validate if coordinates are valid
 */
export const validateCoordinates = (
  latitude: number,
  longitude: number
): boolean => {
  return (
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};
