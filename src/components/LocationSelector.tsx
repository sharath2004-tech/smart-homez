import { API_BASE_URL } from "@/lib/api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Fix Leaflet default marker icon issue
// @ts-expect-error - Modifying Leaflet internals for marker icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface ServiceArea {
  id: string;
  name: string;
  city: string;
  description: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  radiusKm: number;
  color: string;
}

export interface LocationData {
  lat: number;
  lng: number;
  address?: string;
  area?: string;
  city?: string;
  zipCode?: string;
  isAvailable: boolean;
  serviceAreaId?: string;
}

interface Props {
  onLocationConfirmed: (location: LocationData) => void;
  onClose?: () => void;
  defaultLocation?: { lat: number; lng: number };
  showCloseButton?: boolean;
}

const LocationSelector = ({ onLocationConfirmed, onClose, defaultLocation, showCloseButton = false }: Props) => {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const circleLayersRef = useRef<L.Circle[]>([]);
  
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
    defaultLocation || null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingGPS, setIsLoadingGPS] = useState(false);
  const [availabilityInfo, setAvailabilityInfo] = useState<{
    isAvailable: boolean;
    serviceArea?: { id: string; name: string };
    message: string;
    nearestArea?: { name: string; distance: number };
    address?: string;
    area?: string;
    city?: string;
    zipCode?: string;
  } | null>(null);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);

  // Fetch service areas from backend
  useEffect(() => {
    fetchServiceAreas();
  }, []);

  const fetchServiceAreas = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/service-areas/map-data`);
      if (response.ok) {
        const data = await response.json();
        setServiceAreas(data.areas.map((area: ServiceArea) => ({
          id: area.id,
          name: area.name,
          city: area.city,
          description: area.description,
          coordinates: area.coordinates,
          radiusKm: area.radiusKm,
          color: area.color || '#10b981'
        })));
      }
    } catch (error) {
      console.error('Error fetching service areas:', error);
    }
  };

  // Initialize map ONCE on mount
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const defaultCenter: [number, number] = defaultLocation
      ? [defaultLocation.lat, defaultLocation.lng]
      : [19.0760, 72.8777]; // Mumbai default

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultLocation ? 15 : 12,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Add click handler for map
    map.on("click", (e: L.LeafletMouseEvent) => {
      handleMapClick(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    // Force Leaflet to recalculate the container size after CSS layout
    const mapInstance = map;
    setTimeout(() => {
      if (mapRef.current === mapInstance) {
        mapInstance.invalidateSize();
      }
    }, 150);

    // Set initial marker if default location provided
    if (defaultLocation) {
      addOrUpdateMarker(defaultLocation.lat, defaultLocation.lng);
      checkAvailability(defaultLocation.lat, defaultLocation.lng);
    }

    return () => {
      circleLayersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add/update service area circles whenever serviceAreas loads
  useEffect(() => {
    if (!mapRef.current || serviceAreas.length === 0) return;

    // Remove old circles
    circleLayersRef.current.forEach((c) => c.remove());
    circleLayersRef.current = [];

    // Add new circles
    serviceAreas.forEach((area) => {
      const circle = L.circle([area.coordinates.lat, area.coordinates.lng], {
        radius: area.radiusKm * 1000,
        color: area.color,
        fillColor: area.color,
        fillOpacity: 0.15,
        weight: 2,
        opacity: 0.6,
      })
        .bindPopup(`
          <div style="font-size: 13px; line-height: 1.4;">
            <strong>${area.name}</strong><br/>
            <span style="color: #666;">${area.city}</span><br/>
            <span style="color: #999; font-size: 11px;">Radius: ${area.radiusKm} km</span>
          </div>
        `)
        .addTo(mapRef.current!);
      circleLayersRef.current.push(circle);
    });
  }, [serviceAreas]);

  const addOrUpdateMarker = (lat: number, lng: number) => {
    if (!mapRef.current) return;

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.remove();
    }

    // Create draggable marker
    const marker = L.marker([lat, lng], {
      draggable: true,
      icon: L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      }),
    }).addTo(mapRef.current);

    // Handle marker drag
    marker.on("dragend", (e) => {
      const position = e.target.getLatLng();
      handleMapClick(position.lat, position.lng);
    });

    markerRef.current = marker;
  };

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
    addOrUpdateMarker(lat, lng);
    mapRef.current?.setView([lat, lng], 15, { animate: true });
    checkAvailability(lat, lng);
  };

  const checkAvailability = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/service-areas/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ latitude: lat, longitude: lng })
      });

      if (response.ok) {
        const result = await response.json();
        setAvailabilityInfo({
          isAvailable: result.isAvailable,
          serviceArea: result.serviceArea,
          message: result.message,
          nearestArea: result.nearest
        });

        // Reverse geocode to get address if available
        if (result.isAvailable) {
          try {
            const reverseResponse = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
            );
            const reverseData = await reverseResponse.json();

            if (reverseData?.address) {
              const addr = reverseData.address;
              setAvailabilityInfo((prev) => ({
                ...prev,
                address: reverseData.display_name,
                area: addr.suburb || addr.neighbourhood || addr.city_district,
                city: addr.city || addr.town || addr.state_district,
                zipCode: addr.postcode,
              }));
            }
          } catch (error) {
            console.error("Reverse geocoding error:", error);
          }
        }
      }
    } catch (error) {
      console.error('Availability check error:', error);
    }
  };

  const handleUseCurrentLocation = () => {
    setIsLoadingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        handleMapClick(latitude, longitude);
        setIsLoadingGPS(false);
      },
      (error) => {
        console.error("GPS error:", error);
        alert("Unable to get your location. Please enable location permissions or select manually on the map.");
        setIsLoadingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSearchAddress = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&limit=1`
      );
      const results = await response.json();

      if (results && results.length > 0) {
        const result = results[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        handleMapClick(lat, lng);
      } else {
        alert("Address not found. Please try a different search or select on the map.");
      }
    } catch (error) {
      console.error("Search error:", error);
      alert("Search failed. Please try again or select manually on the map.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmLocation = () => {
    if (!selectedLocation || !availabilityInfo) {
      alert("Please select a location on the map first.");
      return;
    }

    const locationData: LocationData = {
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
      address: availabilityInfo.address,
      area: availabilityInfo.area,
      city: availabilityInfo.city,
      zipCode: availabilityInfo.zipCode,
      isAvailable: availabilityInfo.isAvailable,
      serviceAreaId: availabilityInfo.serviceArea?.id,
    };

    onLocationConfirmed(locationData);
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold font-heading text-foreground">Select Your Location</h2>
        </div>
        {showCloseButton && onClose && (
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-card border-b border-border px-4 py-3 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchAddress()}
              placeholder="Search address (e.g., Andheri West, Mumbai)"
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleSearchAddress}
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {isSearching ? "..." : "Search"}
          </button>
        </div>

        <button
          onClick={handleUseCurrentLocation}
          disabled={isLoadingGPS}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-background border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <Navigation className="w-4 h-4" />
          {isLoadingGPS ? "Getting location..." : "Use Current Location"}
        </button>

        <p className="text-xs text-muted-foreground text-center">
          Tap on the map or drag the pin to set your exact location
        </p>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="absolute inset-0" />
        
        {/* Service zones legend */}
        <div className="absolute top-4 right-4 bg-card border border-border rounded-lg shadow-lg p-3 space-y-2 z-[1000]">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-green-500 bg-green-500/10 rounded"></div>
            <span className="text-xs text-foreground">Service Available</span>
          </div>
        </div>
      </div>

      {/* Bottom Panel - Availability Info */}
      {availabilityInfo && (
        <div className={`bg-card border-t border-border px-4 py-4 space-y-3 ${
          availabilityInfo.isAvailable ? "" : "bg-destructive/5"
        }`}>
          {availabilityInfo.isAvailable ? (
            <>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-success/20 rounded-full flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-foreground">Service Available in Your Area</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {availabilityInfo.serviceArea?.name}
                  </p>
                  {availabilityInfo.address && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {availabilityInfo.address}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleConfirmLocation}
                className="w-full btn-brand py-3 text-sm font-medium"
              >
                Confirm Location & Continue
              </button>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-destructive/20 rounded-full flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-destructive" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-foreground">Service Not Available Yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {availabilityInfo.message}
                  </p>
                  {availabilityInfo.nearestArea && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Nearest service area: <strong>{availabilityInfo.nearestArea.name}</strong> ({availabilityInfo.nearestArea.distance.toFixed(1)} km away)
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => alert("We'll notify you when we expand to your area!")}
                className="w-full bg-muted text-foreground py-3 rounded-lg text-sm font-medium hover:bg-border transition-colors"
              >
                Notify Me When Available
              </button>
            </>
          )}
        </div>
      )}

      {/* No location selected yet */}
      {!availabilityInfo && (
        <div className="bg-card border-t border-border px-4 py-6 text-center">
          <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">
            Select your location to check service availability
          </p>
        </div>
      )}
    </div>
  );
};

export default LocationSelector;
