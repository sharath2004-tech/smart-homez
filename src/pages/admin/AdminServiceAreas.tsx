import AppLayout from "@/components/AppLayout";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Edit2, MapPin, Plus, Save, Trash2, X } from "lucide-react";
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
  _id?: string;
  name: string;
  description: string;
  city: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  radiusKm: number;
  isActive: boolean;
  color?: string;
}

const AdminServiceAreas = () => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, { marker: L.Marker; circle: L.Circle }>>(new Map());

  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const [formData, setFormData] = useState<ServiceArea>({
    name: "",
    description: "",
    city: "",
    coordinates: { lat: 0, lng: 0 },
    radiusKm: 5,
    isActive: true,
    color: "#10b981"
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20.5937, 78.9629], // India center
      zoom: 5,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Add click handler for adding new service areas
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (isAddingNew) {
        setSelectedLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
        setFormData(prev => ({
          ...prev,
          coordinates: { lat: e.latlng.lat, lng: e.latlng.lng }
        }));
      }
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isAddingNew]);

  // Load service areas from backend
  useEffect(() => {
    fetchServiceAreas();
  }, []);

  // Render service areas on map
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers and circles
    markersRef.current.forEach(({ marker, circle }) => {
      marker.remove();
      circle.remove();
    });
    markersRef.current.clear();

    // Add markers and circles for each service area
    serviceAreas.forEach(area => {
      if (!mapRef.current) return;

      // Create marker
      const marker = L.marker([area.coordinates.lat, area.coordinates.lng], {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background-color: ${area.color}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
      }).addTo(mapRef.current);

      // Create circle
      const circle = L.circle([area.coordinates.lat, area.coordinates.lng], {
        radius: area.radiusKm * 1000, // Convert km to meters
        color: area.color,
        fillColor: area.color,
        fillOpacity: area.isActive ? 0.2 : 0.05,
        weight: 2,
        opacity: area.isActive ? 0.8 : 0.3
      }).addTo(mapRef.current);

      // Add popup
      const popupContent = `
        <div style="font-size: 12px;">
          <strong>${area.name}</strong><br/>
          ${area.city}<br/>
          Radius: ${area.radiusKm} km<br/>
          Status: ${area.isActive ? '✅ Active' : '❌ Inactive'}
        </div>
      `;
      marker.bindPopup(popupContent);
      circle.bindPopup(popupContent);

      if (area._id) {
        markersRef.current.set(area._id, { marker, circle });
      }
    });

    // Add preview marker if adding new
    if (isAddingNew && selectedLocation) {
      const previewMarker = L.marker([selectedLocation.lat, selectedLocation.lng], {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background-color: #3b82f6; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); animation: pulse 2s infinite;"></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
      }).addTo(mapRef.current);

      const previewCircle = L.circle([selectedLocation.lat, selectedLocation.lng], {
        radius: formData.radiusKm * 1000,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        weight: 2,
        dashArray: '5, 5'
      }).addTo(mapRef.current);

      markersRef.current.set('preview', { marker: previewMarker, circle: previewCircle });
    }
  }, [serviceAreas, isAddingNew, selectedLocation, formData.radiusKm]);

  const fetchServiceAreas = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/service-areas', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setServiceAreas(data.serviceAreas || []);
      }
    } catch (error) {
      console.error('Error fetching service areas:', error);
    }
  };

  const handleStartAdding = () => {
    setIsAddingNew(true);
    setEditingId(null);
    setSelectedLocation(null);
    setFormData({
      name: "",
      description: "",
      city: "",
      coordinates: { lat: 0, lng: 0 },
      radiusKm: 5,
      isActive: true,
      color: "#10b981"
    });
  };

  const handleCancelAdding = () => {
    setIsAddingNew(false);
    setSelectedLocation(null);
    setEditingId(null);
  };

  const handleSaveArea = async () => {
    if (!formData.name || !formData.city || !selectedLocation) {
      alert('Please fill in all required fields and select a location on the map');
      return;
    }

    const areaData = {
      ...formData,
      coordinates: selectedLocation
    };

    try {
      const url = editingId 
        ? `http://localhost:5000/api/admin/service-areas/${editingId}`
        : 'http://localhost:5000/api/admin/service-areas';
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(areaData)
      });

      if (response.ok) {
        await fetchServiceAreas();
        handleCancelAdding();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to save service area');
      }
    } catch (error) {
      console.error('Error saving service area:', error);
      alert('Failed to save service area');
    }
  };

  const handleEditArea = (area: ServiceArea) => {
    setIsAddingNew(true);
    setEditingId(area._id || null);
    setSelectedLocation(area.coordinates);
    setFormData(area);
    
    // Pan map to area
    if (mapRef.current) {
      mapRef.current.setView([area.coordinates.lat, area.coordinates.lng], 12);
    }
  };

  const handleDeleteArea = async (areaId: string) => {
    if (!confirm('Are you sure you want to delete this service area?')) return;

    try {
      const response = await fetch(`http://localhost:5000/api/admin/service-areas/${areaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        await fetchServiceAreas();
      } else {
        alert('Failed to delete service area');
      }
    } catch (error) {
      console.error('Error deleting service area:', error);
      alert('Failed to delete service area');
    }
  };

  const handleToggleActive = async (area: ServiceArea) => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/service-areas/${area._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ...area, isActive: !area.isActive })
      });

      if (response.ok) {
        await fetchServiceAreas();
      }
    } catch (error) {
      console.error('Error updating service area:', error);
    }
  };

  return (
    <AppLayout userType="admin" userName="Admin">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground mb-1">Service Areas</h1>
            <p className="text-muted-foreground text-sm">Manage service availability zones</p>
          </div>
          {!isAddingNew ? (
            <button
              onClick={handleStartAdding}
              className="btn-brand flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Service Area
            </button>
          ) : (
            <button
              onClick={handleCancelAdding}
              className="bg-muted text-foreground px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-border transition-colors"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Map Section */}
          <div className="lg:col-span-2">
            <div className="card-elevated">
              <div className="p-4 border-b border-border">
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Service Zone Map
                </h2>
                {isAddingNew && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Click on the map to place a service area marker
                  </p>
                )}
              </div>
              <div ref={mapContainerRef} className="h-[500px] w-full" />
            </div>
          </div>

          {/* Form/List Section */}
          <div className="space-y-4">
            {isAddingNew ? (
              // Add/Edit Form
              <div className="card-elevated p-4 space-y-4">
                <h3 className="font-bold text-foreground">
                  {editingId ? 'Edit' : 'New'} Service Area
                </h3>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Area Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Andheri West"
                    className="input-clean"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    City *
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g., Mumbai"
                    className="input-clean"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description..."
                    className="input-clean min-h-[60px]"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Service Radius (km)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    step="0.5"
                    value={formData.radiusKm}
                    onChange={(e) => setFormData({ ...formData, radiusKm: parseFloat(e.target.value) })}
                    className="input-clean"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Coverage area: ~{(Math.PI * formData.radiusKm * formData.radiusKm).toFixed(1)} km²
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Color
                  </label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10 w-full rounded-lg border border-border cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="isActive" className="text-sm text-foreground cursor-pointer">
                    Active (services available)
                  </label>
                </div>

                {selectedLocation && (
                  <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    📍 {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                  </div>
                )}

                <button
                  onClick={handleSaveArea}
                  disabled={!selectedLocation || !formData.name || !formData.city}
                  className="w-full btn-brand flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {editingId ? 'Update' : 'Create'} Service Area
                </button>
              </div>
            ) : (
              // Service Areas List
              <div className="space-y-3">
                <h3 className="font-bold text-foreground text-sm">
                  Active Service Areas ({serviceAreas.filter(a => a.isActive).length})
                </h3>
                
                {serviceAreas.length === 0 ? (
                  <div className="card-elevated p-8 text-center">
                    <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      No service areas yet. Click "Add Service Area" to get started.
                    </p>
                  </div>
                ) : (
                  serviceAreas.map(area => (
                    <div
                      key={area._id}
                      className="card-elevated p-4 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-start gap-2">
                          <div 
                            className="w-4 h-4 rounded-full mt-0.5 shrink-0"
                            style={{ backgroundColor: area.color }}
                          />
                          <div>
                            <h4 className="font-bold text-sm text-foreground">{area.name}</h4>
                            <p className="text-xs text-muted-foreground">{area.city}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditArea(area)}
                            className="p-1.5 hover:bg-muted rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => area._id && handleDeleteArea(area._id)}
                            className="p-1.5 hover:bg-destructive/10 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>Radius: {area.radiusKm} km</p>
                        <p>Coverage: ~{(Math.PI * area.radiusKm * area.radiusKm).toFixed(1)} km²</p>
                      </div>

                      <button
                        onClick={() => handleToggleActive(area)}
                        className={`mt-3 w-full py-1.5 px-3 rounded text-xs font-medium transition-colors ${
                          area.isActive
                            ? 'bg-success/20 text-success hover:bg-success/30'
                            : 'bg-muted text-muted-foreground hover:bg-border'
                        }`}
                      >
                        {area.isActive ? '✅ Active' : '❌ Inactive'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
      `}</style>
    </AppLayout>
  );
};

export default AdminServiceAreas;
