import AppLayout from "@/components/AppLayout";
import { useGeolocation } from "@/hooks/useGeolocation";
import { authAPI, locationsAPI, usersAPI } from "@/lib/api";
import { Bell, Check, ChevronRight, Edit2, MapPin, Plus, Shield, Star, Trash2, User, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface Address {
  _id: string;
  label: string;
  street?: string;
  apartment?: string;
  area: string;
  city: string;
  zipCode?: string;
  isDefault: boolean;
}

interface PreferredWorker {
  name: string;
  rating: number;
  specialization: string[];
  jobsCount: number;
}

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  addresses: Address[];
}

interface Stats {
  totalBookings: number;
  preferredWorkers: PreferredWorker[];
  monthsActive: number;
}

const ProfilePage = () => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats>({ totalBookings: 0, preferredWorkers: [], monthsActive: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: 'Home',
    apartment: '',
    area: '',
    city: '',
    zipCode: ''
  });
  const [geocoding, setGeocoding] = useState(false);
  const { latitude, longitude } = useGeolocation();

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const [profileData, statsData] = await Promise.all([
        authAPI.getProfile(),
        usersAPI.getStats()
      ]);
      setProfile(profileData.user || profileData);
      setStats(statsData.stats || statsData);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddress = async () => {
    try {
      setGeocoding(true);
      
      // Geocode the address using OpenStreetMap
      const coordinates = await locationsAPI.geocode({
        apartment: newAddress.apartment,
        area: newAddress.area,
        city: newAddress.city,
        zipCode: newAddress.zipCode
      });

      await usersAPI.addAddress({
        label: newAddress.label,
        apartment: newAddress.apartment,
        area: newAddress.area,
        city: newAddress.city,
        zipCode: newAddress.zipCode,
        location: {
          type: 'Point',
          coordinates: [coordinates.data.longitude, coordinates.data.latitude]
        },
        isDefault: profile?.addresses.length === 0
      });

      // Reset form
      setNewAddress({ label: 'Home', apartment: '', area: '', city: '', zipCode: '' });
      setShowAddressForm(false);
      
      // Refresh profile
      await fetchProfileData();
    } catch (error) {
      console.error('Error adding address:', error);
      alert('Failed to add address. Please try again.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;
    
    try {
      await usersAPI.deleteAddress(addressId);
      await fetchProfileData();
    } catch (error) {
      console.error('Error deleting address:', error);
      alert('Failed to delete address.');
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    try {
      await usersAPI.setDefaultAddress(addressId);
      await fetchProfileData();
    } catch (error) {
      console.error('Error setting default address:', error);
      alert('Failed to set default address.');
    }
  };

  const handleUseCurrentLocation = async () => {
    if (!latitude || !longitude) {
      alert('Location not available. Please enable location access.');
      return;
    }

    try {
      setGeocoding(true);
      const addressData = await locationsAPI.reverseGeocode(latitude, longitude);
      
      setNewAddress({
        label: newAddress.label,
        apartment: '',
        area: addressData.data.area || '',
        city: addressData.data.city || '',
        zipCode: addressData.data.zipCode || ''
      });
    } catch (error) {
      console.error('Error getting address from location:', error);
      alert('Failed to get address from location.');
    } finally {
      setGeocoding(false);
    }
  };

  if (loading) {
    return (
      <AppLayout userType="customer" userName="Loading...">
        <div className="max-w-2xl mx-auto flex items-center justify-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout userType="customer" userName="Guest">
        <div className="max-w-2xl mx-auto text-center py-20">
          <div className="text-4xl mb-4">👤</div>
          <h2 className="text-xl font-bold mb-2">Please Log In</h2>
          <p className="text-muted-foreground mb-4">You need to be logged in to view your profile.</p>
          <a href="/login" className="btn-brand px-6 py-2 inline-block">
            Go to Login
          </a>
        </div>
      </AppLayout>
    );
  }

  const initials = profile.name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <AppLayout userType="customer" userName={profile.name}>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">
        {/* Profile header */}
        <div className="card-elevated p-6 text-center relative">
          <button className="absolute top-4 right-4 p-2 bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <div className="w-20 h-20 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-primary/20">
            <span className="text-2xl font-bold text-primary">{initials}</span>
          </div>
          <h2 className="text-xl font-bold font-heading text-foreground">{profile.name}</h2>
          <p className="text-muted-foreground text-sm mt-1">{profile.email}</p>
          {profile.phone && <p className="text-muted-foreground text-sm">{profile.phone}</p>}
          <div className="flex items-center justify-center gap-1 mt-3">
            <Star className="w-4 h-4 fill-warning text-warning" />
            <span className="text-sm font-semibold text-foreground">Customer</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card-elevated p-4 text-center">
            <p className="text-2xl font-bold font-heading text-foreground">{stats.totalBookings}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Bookings</p>
          </div>
          <div className="card-elevated p-4 text-center">
            <p className="text-2xl font-bold font-heading text-foreground">{stats.preferredWorkers.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Preferred Workers</p>
          </div>
          <div className="card-elevated p-4 text-center">
            <p className="text-2xl font-bold font-heading text-foreground">{stats.monthsActive}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Months Active</p>
          </div>
        </div>

        {/* Saved addresses */}
        <div className="card-elevated p-5">
          <h3 className="font-bold font-heading text-foreground mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Saved Addresses
          </h3>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : profile.addresses.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">No addresses saved yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {profile.addresses.map((addr) => (
                <div key={addr._id} className="flex items-start gap-3 p-3 bg-muted rounded-xl group">
                  <div className="w-8 h-8 bg-primary-light rounded-lg flex items-center justify-center shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{addr.label}</p>
                      {addr.isDefault && <span className="badge-primary text-xs">Default</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[addr.apartment, addr.area, addr.city, addr.zipCode].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!addr.isDefault && (
                      <button
                        onClick={() => handleSetDefaultAddress(addr._id)}
                        className="p-1.5 hover:bg-primary/10 rounded-lg text-primary"
                        title="Set as default"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteAddress(addr._id)}
                      className="p-1.5 hover:bg-destructive/10 rounded-lg text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Address Form */}
          {showAddressForm ? (
            <div className="mt-4 p-4 border-2 border-primary/20 rounded-xl bg-primary/5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">Add New Address</h4>
                <button
                  onClick={() => setShowAddressForm(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Label (e.g., Home)"
                  className="input-clean text-sm"
                  value={newAddress.label}
                  onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Apartment/Building"
                  className="input-clean text-sm"
                  value={newAddress.apartment}
                  onChange={(e) => setNewAddress({ ...newAddress, apartment: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Area *"
                  className="input-clean text-sm"
                  value={newAddress.area}
                  onChange={(e) => setNewAddress({ ...newAddress, area: e.target.value })}
                  required
                />
                <input
                  type="text"
                  placeholder="City *"
                  className="input-clean text-sm"
                  value={newAddress.city}
                  onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                  required
                />
                <input
                  type="text"
                  placeholder="ZIP Code"
                  className="input-clean text-sm col-span-2"
                  value={newAddress.zipCode}
                  onChange={(e) => setNewAddress({ ...newAddress, zipCode: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                {latitude && longitude && (
                  <button
                    onClick={handleUseCurrentLocation}
                    disabled={geocoding}
                    className="flex-1 py-2 px-3 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {geocoding ? 'Getting location...' : 'Use Current Location'}
                  </button>
                )}
                <button
                  onClick={handleAddAddress}
                  disabled={!newAddress.area || !newAddress.city || geocoding}
                  className="flex-1 btn-brand py-2 text-xs disabled:opacity-50"
                >
                  {geocoding ? 'Adding...' : 'Add Address'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddressForm(true)}
              className="w-full mt-3 py-2.5 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add new address
            </button>
          )}
        </div>

        {/* Preferred Workers */}
        {stats.preferredWorkers.length > 0 && (
          <div className="card-elevated p-5">
            <h3 className="font-bold font-heading text-foreground mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Preferred Workers
            </h3>
            <div className="space-y-3">
              {stats.preferredWorkers.map((w, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                  <div className="w-9 h-9 bg-primary-light rounded-full flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {w.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{w.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.specialization.join(', ')} • {w.jobsCount} sessions with you
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <Star className="w-3 h-3 fill-warning text-warning" />
                    <span className="font-medium text-foreground">{w.rating.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="card-elevated overflow-hidden">
          {[
            { icon: Shield, label: "Privacy & Security", desc: "Manage your data and security" },
            { icon: Bell, label: "Notifications", desc: "SMS, WhatsApp, push alerts" },
            { icon: User, label: "Account Settings", desc: "Update profile & password" },
          ].map((item, i) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-4 p-4 hover:bg-muted transition-colors text-left ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shrink-0">
                <item.icon className="w-4 h-4 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default ProfilePage;
