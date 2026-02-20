/**
 * Service Area Definitions using GeoJSON Polygons
 * These define the boundaries where services are available
 */

export interface ServiceArea {
  id: string;
  name: string;
  city: string;
  polygon: GeoJSON.Polygon;
  description: string;
}

// Example service areas - Replace with actual coordinates
export const serviceAreas: ServiceArea[] = [
  {
    id: 'mumbai-andheri',
    name: 'Andheri West',
    city: 'Mumbai',
    description: 'Andheri West including Lokhandwala, Versova, and Four Bungalows',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [72.8250, 19.1200], // Southwest corner
          [72.8250, 19.1450], // Northwest corner
          [72.8450, 19.1450], // Northeast corner
          [72.8450, 19.1200], // Southeast corner
          [72.8250, 19.1200], // Close the polygon
        ],
      ],
    },
  },
  {
    id: 'mumbai-bandra',
    name: 'Bandra',
    city: 'Mumbai',
    description: 'Bandra West and East including Linking Road area',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [72.8200, 19.0500],
          [72.8200, 19.0700],
          [72.8400, 19.0700],
          [72.8400, 19.0500],
          [72.8200, 19.0500],
        ],
      ],
    },
  },
  {
    id: 'mumbai-powai',
    name: 'Powai',
    city: 'Mumbai',
    description: 'Powai area including Hiranandani Gardens',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [72.8900, 19.1100],
          [72.8900, 19.1300],
          [72.9100, 19.1300],
          [72.9100, 19.1100],
          [72.8900, 19.1100],
        ],
      ],
    },
  },
  {
    id: 'bengaluru-whitefield',
    name: 'Whitefield',
    city: 'Bengaluru',
    description: 'Whitefield area including ITPL and Marathahalli',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [77.7000, 12.9600],
          [77.7000, 12.9900],
          [77.7300, 12.9900],
          [77.7300, 12.9600],
          [77.7000, 12.9600],
        ],
      ],
    },
  },
  {
    id: 'bengaluru-koramangala',
    name: 'Koramangala',
    city: 'Bengaluru',
    description: 'Koramangala and BTM Layout',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [77.6100, 12.9200],
          [77.6100, 12.9450],
          [77.6350, 12.9450],
          [77.6350, 12.9200],
          [77.6100, 12.9200],
        ],
      ],
    },
  },
];

/**
 * Get all service areas for a specific city
 */
export const getServiceAreasByCity = (city: string): ServiceArea[] => {
  return serviceAreas.filter(
    (area) => area.city.toLowerCase() === city.toLowerCase()
  );
};

/**
 * Get a service area by ID
 */
export const getServiceAreaById = (id: string): ServiceArea | undefined => {
  return serviceAreas.find((area) => area.id === id);
};

/**
 * Get all unique cities with service coverage
 */
export const getAvailableCities = (): string[] => {
  return [...new Set(serviceAreas.map((area) => area.city))];
};
