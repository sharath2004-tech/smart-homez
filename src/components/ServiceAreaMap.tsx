/**
 * Map Component for Service Area Visualization
 * Uses Leaflet to display service zones on a map
 */

import { serviceAreas } from '@/data/serviceAreas';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

interface ServiceAreaMapProps {
  userLocation?: { lat: number; lng: number };
  highlightedArea?: string;
  height?: string;
}

const ServiceAreaMap = ({
  userLocation,
  highlightedArea,
  height = '400px',
}: ServiceAreaMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Initialize map
    const map = L.map(mapRef.current).setView([19.0760, 72.8777], 11); // Mumbai center

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    mapInstance.current = map;

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear existing layers
    mapInstance.current.eachLayer((layer) => {
      if (layer instanceof L.Polygon || layer instanceof L.Marker) {
        mapInstance.current?.removeLayer(layer);
      }
    });

    // Add service area polygons
    serviceAreas.forEach((area) => {
      const coords = area.polygon.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
      
      const isHighlighted = highlightedArea === area.id;
      
      const polygon = L.polygon(coords, {
        color: isHighlighted ? '#22c55e' : '#3b82f6',
        fillColor: isHighlighted ? '#22c55e' : '#3b82f6',
        fillOpacity: isHighlighted ? 0.3 : 0.1,
        weight: isHighlighted ? 3 : 2,
      }).addTo(mapInstance.current!);

      // Add popup
      polygon.bindPopup(`
        <div class="p-2">
          <h3 class="font-bold">${area.name}</h3>
          <p class="text-sm text-muted-foreground">${area.city}</p>
          <p class="text-xs mt-1">${area.description}</p>
        </div>
      `);
    });

    // Add user location marker
    if (userLocation) {
      const marker = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        }),
      }).addTo(mapInstance.current!);

      marker.bindPopup('<div class="p-2"><strong>Your Location</strong></div>');
      
      // Center map on user location
      mapInstance.current!.setView([userLocation.lat, userLocation.lng], 13);
    }
  }, [userLocation, highlightedArea]);

  return (
    <div 
      ref={mapRef} 
      style={{ height, width: '100%' }} 
      className="rounded-xl overflow-hidden border border-border"
    />
  );
};

export default ServiceAreaMap;
