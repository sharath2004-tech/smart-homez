import AppLayout from "@/components/AppLayout";
import { adminAPI, authAPI, locationsAPI } from "@/lib/api";
import { Building, MapPin, Plus, Search, Shield, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";

interface Location {
  _id: string;
  apartmentName: string;
  building?: string;
  area: string;
  city: string;
  state: string;
  zipCode?: string;
  location: {
    coordinates: number[];
  };
  maxServiceRadius: number;
  assignedAdmin?: {
    _id: string;
    name: string;
    email: string;
  };
  assignedWorkers: string[];
}

interface Admin {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  assignedLocations: Array<{
    locationId: string;
    locationName: string;
    area: string;
    city: string;
  }>;
  workerCount: number;
  createdAt: string;
}

interface UserProfile {
  _id: string;
  role: string;
  name: string;
}

// Indian cities for selection
const indianCities = [
  "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", 
  "Kolkata", "Ahmedabad", "Pune", "Jaipur", "Surat",
  "Lucknow", "Kanpur", "Nagpur", "Indore", "Thane",
  "Bhopal", "Visakhapatnam", "Patna", "Vadodara", "Ghaziabad"
];

const AdminLocations = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [cityFilter, setCityFilter] = useState("");
  const [activeTab, setActiveTab] = useState<'locations' | 'admins'>('locations');
  const [geocoding, setGeocoding] = useState(false);
  
  const [locationForm, setLocationForm] = useState({
    apartmentName: "",
    building: "",
    area: "",
    city: "",
    state: "Maharashtra",
    zipCode: "",
    latitude: "",
    longitude: "",
    maxServiceRadius: "500"
  });

  const [adminForm, setAdminForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    city: "",
    selectedLocations: [] as string[]
  });

  const isSuperAdmin = profile?.role === 'super_admin';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const profileRes = await authAPI.getProfile();
      setProfile(profileRes.user || profileRes);
      
      const locationsRes = await adminAPI.getLocations();
      setLocations(locationsRes.locations || []);

      // Only super admin can see admins
      if (profileRes.user?.role === 'super_admin' || profileRes.role === 'super_admin') {
        const adminsRes = await adminAPI.getAdmins();
        setAdmins(adminsRes.admins || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAPI.createLocation({
        apartmentName: locationForm.apartmentName,
        building: locationForm.building || undefined,
        area: locationForm.area,
        city: locationForm.city,
        state: locationForm.state,
        zipCode: locationForm.zipCode || undefined,
        coordinates: [parseFloat(locationForm.longitude), parseFloat(locationForm.latitude)],
        maxServiceRadius: parseInt(locationForm.maxServiceRadius)
      });
      alert('Location created successfully!');
      setShowLocationForm(false);
      setLocationForm({
        apartmentName: "",
        building: "",
        area: "",
        city: "",
        state: "Maharashtra",
        zipCode: "",
        latitude: "",
        longitude: "",
        maxServiceRadius: "500"
      });
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create location';
      alert(message);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminForm.city) {
      alert('Please select a city for the admin');
      return;
    }

    try {
      await adminAPI.createAdmin({
        name: adminForm.name,
        email: adminForm.email,
        password: adminForm.password,
        phone: adminForm.phone,
        city: adminForm.city,
        assignedLocationIds: adminForm.selectedLocations
      });
      alert('Admin created successfully!');
      setShowAdminForm(false);
      setAdminForm({
        name: "",
        email: "",
        password: "",
        phone: "",
        city: "",
        selectedLocations: []
      });
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create admin';
      alert(message);
    }
  };

  const toggleLocationSelection = (locationId: string) => {
    setAdminForm(prev => ({
      ...prev,
      selectedLocations: prev.selectedLocations.includes(locationId)
        ? prev.selectedLocations.filter(id => id !== locationId)
        : [...prev.selectedLocations, locationId]
    }));
  };

  const handleSearchLocation = async () => {
    if (!locationForm.apartmentName || !locationForm.area || !locationForm.city) {
      alert('Please fill in Apartment Name, Area, and City before searching');
      return;
    }

    try {
      setGeocoding(true);
      const address = {
        apartment: locationForm.apartmentName,
        building: locationForm.building || undefined,
        area: locationForm.area,
        city: locationForm.city,
        state: locationForm.state,
        zipCode: locationForm.zipCode || undefined
      };

      const result = await locationsAPI.geocode(address);
      
      if (result.coordinates) {
        setLocationForm(prev => ({
          ...prev,
          latitude: result.coordinates.latitude.toString(),
          longitude: result.coordinates.longitude.toString()
        }));
        alert('Location found! Coordinates have been filled in.');
      } else {
        alert('Could not find exact coordinates. Please enter them manually.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('Could not find location. Please enter coordinates manually.');
    } finally {
      setGeocoding(false);
    }
  };

  // Filter locations by city for admin form
  const cityLocations = adminForm.city 
    ? locations.filter(loc => loc.city.toLowerCase() === adminForm.city.toLowerCase())
    : [];

  // Get unique cities from locations
  const uniqueCities = [...new Set(locations.map(loc => loc.city))];

  // Filter admins by city
  const filteredAdmins = cityFilter
    ? admins.filter(admin => 
        admin.assignedLocations?.some(loc => 
          loc.city.toLowerCase().includes(cityFilter.toLowerCase())
        )
      )
    : admins;

  if (loading) {
    return (
      <AppLayout userType="admin" userName="Admin Team">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="admin" userName="Admin Team">
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">
              {isSuperAdmin ? 'Manage Locations & Admins' : 'My Locations'}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isSuperAdmin 
                ? 'Create locations and assign admins by city' 
                : 'View your assigned locations'}
            </p>
          </div>
          {isSuperAdmin && (
            <div className="flex gap-2">
              <button 
                onClick={() => setShowAdminForm(true)}
                className="flex items-center gap-2 bg-secondary text-secondary-foreground text-sm py-2.5 px-4 rounded-xl hover:bg-secondary/80 transition-colors"
              >
                <UserPlus className="w-4 h-4" /> Add Admin
              </button>
              <button 
                onClick={() => setShowLocationForm(true)}
                className="flex items-center gap-2 btn-brand text-sm py-2.5 px-4"
              >
                <Plus className="w-4 h-4" /> Add Location
              </button>
            </div>
          )}
        </div>

        {/* Tabs for Super Admin */}
        {isSuperAdmin && (
          <div className="flex gap-2 border-b border-border">
            <button
              onClick={() => setActiveTab('locations')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'locations'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building className="w-4 h-4 inline mr-2" />
              Locations ({locations.length})
            </button>
            <button
              onClick={() => setActiveTab('admins')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'admins'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Shield className="w-4 h-4 inline mr-2" />
              Admins ({admins.length})
            </button>
          </div>
        )}

        {/* Locations Tab */}
        {(activeTab === 'locations' || !isSuperAdmin) && (
          <>
            {locations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground card-elevated">
                <div className="text-4xl mb-3">🏢</div>
                <p>No locations found</p>
                {isSuperAdmin && <p className="text-sm mt-2">Create a location to get started</p>}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {locations.map((location) => (
                  <div key={location._id} className="card-elevated p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center text-primary shrink-0">
                        <Building className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground truncate">{location.apartmentName}</h3>
                        {location.building && (
                          <p className="text-xs text-muted-foreground">{location.building}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {location.area}, {location.city}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted rounded-xl mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Workers</p>
                        <p className="text-sm font-bold text-foreground">{location.assignedWorkers?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Radius</p>
                        <p className="text-sm font-bold text-foreground">{location.maxServiceRadius}m</p>
                      </div>
                    </div>

                    {location.assignedAdmin && (
                      <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg flex items-center gap-2">
                        <Shield className="w-3 h-3" />
                        <span><strong>Admin:</strong> {location.assignedAdmin.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Admins Tab - Super Admin Only */}
        {isSuperAdmin && activeTab === 'admins' && (
          <>
            {/* City Filter */}
            <div className="flex gap-3">
              <select
                className="input-clean flex-1 max-w-xs"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
              >
                <option value="">All Cities</option>
                {uniqueCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            {filteredAdmins.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground card-elevated">
                <div className="text-4xl mb-3">👤</div>
                <p>No admins found</p>
                <p className="text-sm mt-2">Create an admin and assign them to locations</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredAdmins.map((admin) => (
                  <div key={admin._id} className="card-elevated p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center text-secondary-foreground font-bold shrink-0">
                        {admin.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground">{admin.name}</p>
                          <span className="badge-primary text-xs">Admin</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{admin.email}</p>
                        {admin.phone && <p className="text-xs text-muted-foreground">{admin.phone}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted rounded-xl mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Locations</p>
                        <p className="text-sm font-bold text-foreground">{admin.assignedLocations?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Workers</p>
                        <p className="text-sm font-bold text-foreground">{admin.workerCount || 0}</p>
                      </div>
                    </div>

                    {admin.assignedLocations && admin.assignedLocations.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Assigned Locations:</p>
                        <div className="space-y-1">
                          {admin.assignedLocations.slice(0, 3).map((loc, idx) => (
                            <div key={idx} className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {loc.locationName} - {loc.area}, {loc.city}
                            </div>
                          ))}
                          {admin.assignedLocations.length > 3 && (
                            <p className="text-xs text-muted-foreground px-2">
                              +{admin.assignedLocations.length - 3} more locations
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Create Location Modal - Super Admin Only */}
        {showLocationForm && isSuperAdmin && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Add New Location</h2>
                <button onClick={() => setShowLocationForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateLocation} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Apartment/Complex Name</label>
                  <input
                    type="text"
                    required
                    className="input-clean"
                    placeholder="e.g., Lodha Palava"
                    value={locationForm.apartmentName}
                    onChange={(e) => setLocationForm({...locationForm, apartmentName: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Building (Optional)</label>
                  <input
                    type="text"
                    className="input-clean"
                    placeholder="e.g., Tower A"
                    value={locationForm.building}
                    onChange={(e) => setLocationForm({...locationForm, building: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Area</label>
                    <input
                      type="text"
                      required
                      className="input-clean"
                      placeholder="Andheri West"
                      value={locationForm.area}
                      onChange={(e) => setLocationForm({...locationForm, area: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">City</label>
                    <select
                      required
                      className="input-clean"
                      value={locationForm.city}
                      onChange={(e) => setLocationForm({...locationForm, city: e.target.value})}
                    >
                      <option value="">Select City</option>
                      {indianCities.map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">State</label>
                    <input
                      type="text"
                      required
                      className="input-clean"
                      placeholder="Maharashtra"
                      value={locationForm.state}
                      onChange={(e) => setLocationForm({...locationForm, state: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">ZIP Code</label>
                    <input
                      type="text"
                      className="input-clean"
                      placeholder="400058"
                      value={locationForm.zipCode}
                      onChange={(e) => setLocationForm({...locationForm, zipCode: e.target.value})}
                    />
                  </div>
                </div>

                {/* Search Button */}
                <div className="bg-accent/50 border border-border rounded-xl p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <MapPin className="w-5 h-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Find on Map</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Search for the apartment location automatically
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSearchLocation}
                    disabled={geocoding || !locationForm.apartmentName || !locationForm.area || !locationForm.city}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {geocoding ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        Search Location
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      className="input-clean"
                      placeholder="19.1136"
                      value={locationForm.latitude}
                      onChange={(e) => setLocationForm({...locationForm, latitude: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      className="input-clean"
                      placeholder="72.8347"
                      value={locationForm.longitude}
                      onChange={(e) => setLocationForm({...locationForm, longitude: e.target.value})}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  💡 Use "Search Location" button above to auto-fill coordinates
                </p>

                <div>
                  <label className="block text-sm font-medium mb-1">Walking Distance Radius (meters)</label>
                  <input
                    type="number"
                    required
                    className="input-clean"
                    placeholder="500"
                    value={locationForm.maxServiceRadius}
                    onChange={(e) => setLocationForm({...locationForm, maxServiceRadius: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Workers can serve within this distance</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowLocationForm(false)} className="flex-1 py-2 border border-border rounded-xl">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 btn-brand py-2">
                    Create Location
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Admin Modal - Super Admin Only */}
        {showAdminForm && isSuperAdmin && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Add New Admin</h2>
                <button onClick={() => setShowAdminForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateAdmin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    className="input-clean"
                    placeholder="Admin name"
                    value={adminForm.name}
                    onChange={(e) => setAdminForm({...adminForm, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    required
                    className="input-clean"
                    placeholder="admin@example.com"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({...adminForm, email: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input
                    type="password"
                    required
                    className="input-clean"
                    placeholder="Min 6 characters"
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({...adminForm, password: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    className="input-clean"
                    placeholder="+91 9876543210"
                    value={adminForm.phone}
                    onChange={(e) => setAdminForm({...adminForm, phone: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Assign to City</label>
                  <select
                    required
                    className="input-clean"
                    value={adminForm.city}
                    onChange={(e) => setAdminForm({...adminForm, city: e.target.value, selectedLocations: []})}
                  >
                    <option value="">Select City or Enter New</option>
                    {indianCities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>

                {adminForm.city && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Assign Locations in {adminForm.city} (Optional)
                    </label>
                    {cityLocations.length === 0 ? (
                      <p className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                        No locations in {adminForm.city} yet. Create locations first, then assign them to this admin.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {cityLocations.map(loc => (
                          <label 
                            key={loc._id} 
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              adminForm.selectedLocations.includes(loc._id)
                                ? 'bg-primary/10 border-primary'
                                : 'bg-muted/50 border-border hover:bg-muted'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={adminForm.selectedLocations.includes(loc._id)}
                              onChange={() => toggleLocationSelection(loc._id)}
                              className="w-4 h-4"
                            />
                            <div>
                              <p className="text-sm font-medium">{loc.apartmentName}</p>
                              <p className="text-xs text-muted-foreground">{loc.area}, {loc.city}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowAdminForm(false)} className="flex-1 py-2 border border-border rounded-xl">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 btn-brand py-2">
                    Create Admin
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminLocations;
