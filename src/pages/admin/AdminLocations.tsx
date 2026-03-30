import AppLayout from "@/components/AppLayout";
import { useConfirm } from "@/hooks/useConfirm";
import { adminAPI, authAPI, locationRequestsAPI, locationsAPI, superAdminAPI } from "@/lib/api";
import { cropQRFromImage } from "@/utils/cropQRFromImage";
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Building, CheckCircle, Clock, FileText, MapPin, Pencil, Plus, QrCode, Search, Shield, Trash2, Upload, UserPlus, X, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  permissions?: {
    canCreateWorkers: boolean;
    canDeleteWorkers: boolean;
    canManageApartments: boolean;
    canViewReports: boolean;
  };
  idDocument?: string | null;
  idDocumentType?: string | null;
  workerCount: number;
  createdAt: string;
}

interface UserProfile {
  _id: string;
  role: string;
  name: string;
}

interface LocationRequest {
  _id: string;
  apartmentName: string;
  building?: string;
  area: string;
  city: string;
  state: string;
  zipCode?: string;
  reason?: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: {
    _id: string;
    name: string;
  };
  reviewedBy?: {
    _id: string;
    name: string;
  };
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
}

// Indian cities for selection
const indianCities = [
  "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai",
  "Kolkata", "Ahmedabad", "Pune", "Jaipur", "Surat",
  "Lucknow", "Kanpur", "Nagpur", "Indore", "Thane",
  "Bhopal", "Visakhapatnam", "Patna", "Vadodara", "Ghaziabad",
  "Ludhiana", "Agra", "Nashik", "Faridabad", "Meerut",
  "Rajkot", "Kalyan", "Varanasi", "Srinagar", "Aurangabad",
  "Dhanbad", "Amritsar", "Navi Mumbai", "Allahabad", "Ranchi",
  "Howrah", "Coimbatore", "Jabalpur", "Gwalior", "Vijayawada",
  "Jodhpur", "Madurai", "Raipur", "Kota", "Guwahati",
  "Chandigarh", "Solapur", "Hubballi", "Tiruchirappalli", "Bareilly",
  "Mysuru", "Tiruppur", "Gurgaon", "Noida", "Aligarh",
  "Jalandhar", "Bhubaneswar", "Salem", "Warangal", "Guntur",
  "Bhiwandi", "Gorakhpur", "Bikaner", "Jamshedpur", "Bhilai",
  "Cuttack", "Kochi", "Nellore", "Bhavnagar", "Dehradun",
  "Durgapur", "Asansol", "Rourkela", "Nanded", "Kolhapur",
  "Ajmer", "Ujjain", "Udaipur", "Siliguri", "Jhansi",
  "Mangalore", "Erode", "Belgaum", "Tirunelveli", "Malegaon"
];

const AdminLocations = () => {
  const confirm = useConfirm();
  const [locations, setLocations] = useState<Location[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [cityFilter, setCityFilter] = useState("");
  const [activeTab, setActiveTab] = useState<'locations' | 'admins' | 'request' | 'location-requests'>('locations');
  const [geocoding, setGeocoding] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  
  // Payment QR state
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [qrFormData, setQRFormData] = useState({
    upiId: '',
    upiName: '',
    phoneNumber: '',
    qrCodeImage: ''
  });
  const [uploadingQR, setUploadingQR] = useState(false);
  
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
    selectedLocations: [] as string[],
    idDocumentFile: null as File | null,
    idDocumentType: ""
  });

  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [editAdminForm, setEditAdminForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    selectedLocations: [] as string[],
    permissions: {
      canCreateWorkers: true,
      canDeleteWorkers: true,
      canManageApartments: true,
      canViewReports: true
    }
  });
  const [updatingAdmin, setUpdatingAdmin] = useState(false);

  // Location Request States
  const [locationRequests, setLocationRequests] = useState([]);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestReviewingId, setRequestReviewingId] = useState<string | null>(null);
  const [requestReviewNote, setRequestReviewNote] = useState("");
  const [requestReviewLatitude, setRequestReviewLatitude] = useState("");
  const [requestReviewLongitude, setRequestReviewLongitude] = useState("");
  const [requestReviewLoading, setRequestReviewLoading] = useState(false);
  const [requestFilterStatus, setRequestFilterStatus] = useState("");
  
  const [requestForm, setRequestForm] = useState({
    apartmentName: "",
    building: "",
    area: "",
    city: "",
    state: "",
    zipCode: "",
    reason: "",
  });

  const isSuperAdmin = profile?.role === 'super_admin';

  const locationApi = isSuperAdmin ? superAdminAPI : adminAPI;

  const handleCloseLocationForm = () => {
    setShowLocationForm(false);
    setShowMap(false);
    setEditingLocation(null);
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
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
      markerRef.current = null;
    }
  };

  const handleDeleteLocation = async (locationId: string, locationName: string) => {
    if (!await confirm(`Are you sure you want to delete "${locationName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await locationApi.deleteLocation(locationId);
      alert('Location deleted successfully!');
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete location';
      alert(message);
    }
  };

  const handleOpenEditLocation = (location: Location) => {
    const [longitude, latitude] = location.location?.coordinates || [];

    setEditingLocation(location);
    setShowLocationForm(true);
    setShowMap(false);
    setLocationForm({
      apartmentName: location.apartmentName || "",
      building: location.building || "",
      area: location.area || "",
      city: location.city || "",
      state: location.state || "Maharashtra",
      zipCode: location.zipCode || "",
      latitude: typeof latitude === 'number' ? latitude.toString() : "",
      longitude: typeof longitude === 'number' ? longitude.toString() : "",
      maxServiceRadius: location.maxServiceRadius?.toString() || "500"
    });
  };

  const handleDeleteAdmin = async (adminId: string, adminName: string) => {
    if (!await confirm(`Are you sure you want to delete admin "${adminName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await adminAPI.deleteAdmin(adminId);
      alert('Admin deleted successfully!');
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete admin';
      alert(message);
    }
  };

  const handleOpenQRModal = async (location: Location) => {
    setSelectedLocation(location);
    setShowQRModal(true);
    
    // Fetch existing QR if available
    try {
      const response = await locationsAPI.getPaymentQR(location._id);
      if (response.success && response.paymentQR && !response.paymentQR.isGlobal) {
        setQRFormData({
          upiId: response.paymentQR.upiId || '',
          upiName: response.paymentQR.upiName || '',
          phoneNumber: response.paymentQR.phoneNumber || '',
          qrCodeImage: response.paymentQR.qrCodeImage || ''
        });
      } else {
        // Reset form for new QR
        setQRFormData({
          upiId: '',
          upiName: '',
          phoneNumber: '',
          qrCodeImage: ''
        });
      }
    } catch (error) {
      console.error('Error fetching payment QR:', error);
      setQRFormData({
        upiId: '',
        upiName: '',
        phoneNumber: '',
        qrCodeImage: ''
      });
    }
  };

  const handleQRImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    setUploadingQR(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        // Step 1: detect & crop just the QR region
        const cropped = await cropQRFromImage(reader.result as string);

        // Step 2: resize to 600×600 max
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max = 600;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setQRFormData(prev => ({ ...prev, qrCodeImage: canvas.toDataURL('image/png') }));
          setUploadingQR(false);
        };
        img.onerror = () => { alert('Image processing failed.'); setUploadingQR(false); };
        img.src = cropped;
      } catch {
        alert('Failed to process image.');
        setUploadingQR(false);
      }
    };
    reader.onerror = () => { alert('Failed to read file.'); setUploadingQR(false); };
    reader.readAsDataURL(file);
  };

  const handleSavePaymentQR = async () => {
    if (!selectedLocation) return;

    if (!qrFormData.qrCodeImage) {
      alert('Please upload a QR code image');
      return;
    }

    try {
      setUploadingQR(true);
      await locationsAPI.updatePaymentQR(selectedLocation._id, qrFormData);
      alert('✅ Payment QR updated successfully! Workers will see this QR when collecting payment at this location.');
      setShowQRModal(false);
      fetchData();
    } catch (error) {
      console.error('Error updating payment QR:', error);
      alert('Failed to update payment QR');
    } finally {
      setUploadingQR(false);
    }
  };

  const handleDeletePaymentQR = async () => {
    if (!selectedLocation) return;
    
    if (!await confirm('Remove custom payment QR? Workers will use the default payment method.')) {
      return;
    }

    try {
      await locationsAPI.deletePaymentQR(selectedLocation._id);
      alert('Payment QR removed successfully');
      setShowQRModal(false);
      fetchData();
    } catch (error) {
      console.error('Error deleting payment QR:', error);
      alert('Failed to delete payment QR');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Initialize map when show map is toggled
  useEffect(() => {
    if (!showMap || !mapRef.current || mapInstance.current) return;

    // Initialize map centered on India
    const map = L.map(mapRef.current).setView([20.5937, 78.9629], 5);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Fix Leaflet default marker icon issue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    // Add click handler to place marker
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      
      // Remove existing marker if any
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }

      // Add new marker
      const marker = L.marker([lat, lng]).addTo(map);
      marker.bindPopup(`<b>Selected Location</b><br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}`).openPopup();
      markerRef.current = marker;

      // Update form with coordinates
      setLocationForm(prev => ({
        ...prev,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6)
      }));
    });

    mapInstance.current = map;

    // If coordinates already exist, show marker
    if (locationForm.latitude && locationForm.longitude) {
      const lat = parseFloat(locationForm.latitude);
      const lng = parseFloat(locationForm.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        const marker = L.marker([lat, lng]).addTo(map);
        marker.bindPopup(`<b>Selected Location</b><br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}`).openPopup();
        markerRef.current = marker;
        map.setView([lat, lng], 15);
      }
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markerRef.current = null;
      }
    };
  }, [showMap, locationForm.latitude, locationForm.longitude]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const profileRes = await authAPI.getProfile();
      setProfile(profileRes.user || profileRes);

      const roleIsSuperAdmin = profileRes.user?.role === 'super_admin' || profileRes.role === 'super_admin';
      const locationsRes = await (roleIsSuperAdmin ? superAdminAPI.getLocations() : adminAPI.getLocations());
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
      const payload = {
        apartmentName: locationForm.apartmentName,
        building: locationForm.building || undefined,
        area: locationForm.area,
        city: locationForm.city,
        state: locationForm.state,
        zipCode: locationForm.zipCode || undefined,
        coordinates: [parseFloat(locationForm.longitude), parseFloat(locationForm.latitude)],
        maxServiceRadius: parseInt(locationForm.maxServiceRadius)
      };

      if (editingLocation) {
        await locationApi.updateLocation(editingLocation._id, payload);
        alert('Location updated successfully!');
      } else {
        await locationApi.createLocation(payload);
        alert('Location created successfully!');
      }

      handleCloseLocationForm();
      fetchData();
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : editingLocation
          ? 'Failed to update location'
          : 'Failed to create location';
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
        assignedLocationIds: adminForm.selectedLocations,
        idDocument: adminForm.idDocumentFile,
        idDocumentType: adminForm.idDocumentType || undefined
      });
      alert('Admin created successfully!');
      setShowAdminForm(false);
      setAdminForm({
        name: "",
        email: "",
        password: "",
        phone: "",
        city: "",
        selectedLocations: [],
        idDocumentFile: null,
        idDocumentType: ""
      });
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create admin';
      alert(message);
    }
  };

  const handleOpenEditAdmin = (admin: Admin) => {
    setEditingAdmin(admin);
    const currentCity = admin.assignedLocations?.[0]?.city || '';
    setEditAdminForm({
      name: admin.name,
      email: admin.email,
      phone: admin.phone || '',
      city: currentCity,
      selectedLocations: admin.assignedLocations?.map(loc => loc.locationId) || [],
      permissions: {
        canCreateWorkers: admin.permissions?.canCreateWorkers ?? true,
        canDeleteWorkers: admin.permissions?.canDeleteWorkers ?? true,
        canManageApartments: admin.permissions?.canManageApartments ?? true,
        canViewReports: admin.permissions?.canViewReports ?? true
      }
    });
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    try {
      setUpdatingAdmin(true);
      await adminAPI.updateAdmin(editingAdmin._id, {
        name: editAdminForm.name,
        email: editAdminForm.email,
        phone: editAdminForm.phone,
        assignedLocationIds: editAdminForm.selectedLocations,
        permissions: editAdminForm.permissions
      });
      alert('Admin updated successfully!');
      setEditingAdmin(null);
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update admin';
      alert(message);
    } finally {
      setUpdatingAdmin(false);
    }
  };

  const toggleEditLocationSelection = (locationId: string) => {
    setEditAdminForm(prev => ({
      ...prev,
      selectedLocations: prev.selectedLocations.includes(locationId)
        ? prev.selectedLocations.filter(id => id !== locationId)
        : [...prev.selectedLocations, locationId]
    }));
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

  // Location Request Handlers
  const fetchLocationRequests = async (status?: string) => {
    try {
      setRequestLoading(true);
      const res = await locationRequestsAPI.getAll(status || undefined);
      setLocationRequests(res.requests || []);
    } catch (error) {
      console.error('Error fetching location requests:', error);
    } finally {
      setRequestLoading(false);
    }
  };

  const handleSubmitLocationRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestSubmitting(true);
    try {
      await locationRequestsAPI.create({
        apartmentName: requestForm.apartmentName,
        building: requestForm.building || undefined,
        area: requestForm.area,
        city: requestForm.city,
        state: requestForm.state,
        zipCode: requestForm.zipCode || undefined,
        reason: requestForm.reason || undefined,
      });
      alert('✅ Location request submitted! Super admin will review it and approve or reject.');
      setActiveTab('locations');
      setRequestForm({ apartmentName: "", building: "", area: "", city: "", state: "", zipCode: "", reason: "" });
      fetchLocationRequests();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit request';
      alert(message);
    } finally {
      setRequestSubmitting(false);
    }
  };

  const handleReviewLocationRequest = async (id: string, status: "approved" | "rejected") => {
    if (status === "approved") {
      const lat = parseFloat(requestReviewLatitude);
      const lng = parseFloat(requestReviewLongitude);
      if (!requestReviewLatitude || !requestReviewLongitude || isNaN(lat) || isNaN(lng)) {
        alert('Please provide valid coordinates (latitude and longitude) to approve');
        return;
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        alert('Invalid coordinates. Lat: -90 to 90, Lng: -180 to 180');
        return;
      }
      if (lat === 0 && lng === 0) {
        alert('Placeholder coordinates [0, 0] are not allowed. Please provide actual location coordinates.');
        return;
      }
    }

    setRequestReviewLoading(true);
    try {
      const coordinates = status === "approved" ? [parseFloat(requestReviewLongitude), parseFloat(requestReviewLatitude)] as [number, number] : undefined;
      await locationRequestsAPI.review(id, status, requestReviewNote, coordinates);
      alert(status === "approved" ? '✅ Location approved and created!' : '❌ Location request rejected.');
      setRequestReviewingId(null);
      setRequestReviewNote("");
      setRequestReviewLatitude("");
      setRequestReviewLongitude("");
      fetchLocationRequests();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to review request';
      alert(message);
    } finally {
      setRequestReviewLoading(false);
    }
  };

  const getRequestStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> Pending</span>;
      case "approved": return <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" /> Approved</span>;
      case "rejected": return <span className="flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Rejected</span>;
      default: return null;
    }
  };

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
      <AppLayout userType={isSuperAdmin ? 'super_admin' : 'admin'} userName={profile?.name || "Admin"}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType={isSuperAdmin ? 'super_admin' : 'admin'} userName={profile?.name || "Admin"}>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 space-y-6 animate-fade-in">
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
                onClick={() => {
                  setEditingLocation(null);
                  setShowLocationForm(true);
                }}
                className="flex items-center gap-2 btn-brand text-sm py-2.5 px-4"
              >
                <Plus className="w-4 h-4" /> Add Location
              </button>
            </div>
          )}
        </div>

        {/* Tabs for Super Admin */}
        {isSuperAdmin && (
          <div className="flex gap-2 border-b border-border overflow-x-auto">
            <button
              onClick={() => { setActiveTab('locations'); }}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'locations'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building className="w-4 h-4 inline mr-2" />
              Locations ({locations.length})
            </button>
            <button
              onClick={() => { setActiveTab('admins'); }}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'admins'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Shield className="w-4 h-4 inline mr-2" />
              Admins ({admins.length})
            </button>
            <button
              onClick={() => { setActiveTab('location-requests'); fetchLocationRequests(requestFilterStatus); }}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'location-requests'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Location Requests
            </button>
          </div>
        )}

        {/* Tabs for Admin (non-super admin) */}
        {!isSuperAdmin && (
          <div className="flex gap-2 border-b border-border overflow-x-auto">
            <button
              onClick={() => { setActiveTab('locations'); }}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'locations'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building className="w-4 h-4 inline mr-2" />
              My Locations ({locations.length})
            </button>
            <button
              onClick={() => { setActiveTab('request'); }}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'request'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Request Location
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
                  <div key={location._id} className="card-elevated p-5 relative overflow-hidden">
                    {/* Action buttons for super admin */}
                    {isSuperAdmin && (
                      <div className="absolute top-3 right-3 flex gap-1">
                        <button
                          onClick={() => handleOpenEditLocation(location)}
                          className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary transition-colors"
                          title="Edit location"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLocation(location._id, location.apartmentName)}
                          className="w-7 h-7 rounded-lg bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center text-destructive transition-colors"
                          title="Delete location"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center text-primary shrink-0">
                        <Building className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <h3 className="font-bold text-foreground line-clamp-2 break-words">{location.apartmentName}</h3>
                        {location.building && (
                          <p className="text-xs text-muted-foreground line-clamp-2 break-words">{location.building}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="line-clamp-2 break-words">{location.area}, {location.city}</span>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted rounded-xl mb-3">
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
                      <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg flex items-center gap-2 mb-3">
                        <Shield className="w-3 h-3 shrink-0" />
                        <span className="line-clamp-2 break-words"><strong>Admin:</strong> {location.assignedAdmin.name}</span>
                      </div>
                    )}

                    {/* Payment QR Button — Super Admin only */}
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleOpenQRModal(location)}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        <QrCode className="w-4 h-4" />
                        Manage Payment QR
                      </button>
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
                  <div key={admin._id} className="card-elevated p-5 relative overflow-hidden">
                    {/* Action buttons for super admin */}
                    <div className="absolute top-3 right-3 flex gap-1">
                      <button
                        onClick={() => handleOpenEditAdmin(admin)}
                        className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary transition-colors"
                        title="Edit admin"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAdmin(admin._id, admin.name)}
                        className="w-7 h-7 rounded-lg bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center text-destructive transition-colors"
                        title="Delete admin"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center text-secondary-foreground font-bold shrink-0">
                        {admin.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground line-clamp-2 break-words">{admin.name}</p>
                          <span className="badge-primary text-xs shrink-0">Admin</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 break-words" title={admin.email}>{admin.email}</p>
                        {admin.phone && <p className="text-xs text-muted-foreground line-clamp-1 break-words" title={admin.phone}>{admin.phone}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted rounded-xl mb-4">
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
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="line-clamp-1 break-words" title={`${loc.locationName} - ${loc.area}, ${loc.city}`}>{loc.locationName} - {loc.area}, {loc.city}</span>
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

                    {/* Document verification status */}
                    <div className={`mt-3 flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${admin.idDocument ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      <FileText className="w-3 h-3 shrink-0" />
                      <span>{admin.idDocument ? `ID Verified (${admin.idDocumentType || 'document'})` : 'No ID document uploaded'}</span>
                    </div>
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
                <h2 className="text-xl font-bold">{editingLocation ? 'Edit Location' : 'Add New Location'}</h2>
                <button onClick={handleCloseLocationForm} className="text-muted-foreground hover:text-foreground">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                {/* Interactive Map for Location Selection */}
                <div className="bg-accent/50 border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Pin Location on Map</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Click on the map to select exact coordinates
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMap(!showMap)}
                      className="text-xs btn-brand py-1 px-3"
                    >
                      {showMap ? 'Hide Map' : 'Show Map'}
                    </button>
                  </div>
                  
                  {showMap && (
                    <div className="mt-3">
                      <div 
                        ref={mapRef} 
                        className="w-full h-[400px] rounded-lg border-2 border-border overflow-hidden"
                        style={{ zIndex: 0 }}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        💡 Click anywhere on the map to pin your location. The coordinates will be filled automatically.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button type="button" onClick={handleCloseLocationForm} className="w-full sm:flex-1 py-2 border border-border rounded-xl">
                    Cancel
                  </button>
                  <button type="submit" className="w-full sm:flex-1 btn-brand py-2">
                    {editingLocation ? 'Save Changes' : 'Create Location'}
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
                    minLength={8}
                    className="input-clean"
                    placeholder="Min 8 characters"
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

                {/* Document Verification Upload */}
                <div className="border border-border rounded-xl p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-primary" />
                    <p className="text-sm font-medium">ID Document Verification</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="col-span-2">
                      <label className="block text-xs text-muted-foreground mb-1">Document Type</label>
                      <select
                        className="input-clean"
                        value={adminForm.idDocumentType}
                        onChange={(e) => setAdminForm({...adminForm, idDocumentType: e.target.value})}
                      >
                        <option value="">Select document type</option>
                        <option value="aadhaar">Aadhaar Card</option>
                        <option value="pan">PAN Card</option>
                        <option value="passport">Passport</option>
                        <option value="driving_license">Driving License</option>
                        <option value="voter_id">Voter ID</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  {adminForm.idDocumentFile ? (
                    <div className="flex items-center gap-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                      <FileText className="w-4 h-4 text-green-600 shrink-0" />
                      <span className="text-xs text-green-800 line-clamp-1 break-words flex-1" title={adminForm.idDocumentFile.name}>{adminForm.idDocumentFile.name}</span>
                      <button
                        type="button"
                        onClick={() => setAdminForm({...adminForm, idDocumentFile: null})}
                        className="text-red-500 shrink-0"
                      ><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted transition-colors">
                      <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">Upload ID document (JPG, PNG, PDF)</p>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setAdminForm({...adminForm, idDocumentFile: file});
                        }}
                      />
                    </label>
                  )}
                </div>

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

        {/* Edit Admin Modal - Super Admin Only */}
        {editingAdmin && isSuperAdmin && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Edit Admin</h2>
                <button onClick={() => setEditingAdmin(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateAdmin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    className="input-clean"
                    value={editAdminForm.name}
                    onChange={(e) => setEditAdminForm({...editAdminForm, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    required
                    className="input-clean"
                    value={editAdminForm.email}
                    onChange={(e) => setEditAdminForm({...editAdminForm, email: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="tel"
                    className="input-clean"
                    value={editAdminForm.phone}
                    onChange={(e) => setEditAdminForm({...editAdminForm, phone: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Reassign to City</label>
                  <select
                    className="input-clean"
                    value={editAdminForm.city}
                    onChange={(e) => setEditAdminForm({...editAdminForm, city: e.target.value, selectedLocations: []})}
                  >
                    <option value="">-- Keep current city --</option>
                    {[...new Set(locations.map(l => l.city))].map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>

                {/* Location assignment */}
                <div>
                  <label className="block text-sm font-medium mb-2">Assigned Locations</label>
                  {locations.filter(loc => !editAdminForm.city || loc.city.toLowerCase() === editAdminForm.city.toLowerCase()).length === 0 ? (
                    <p className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">No locations in selected city.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {locations
                        .filter(loc => !editAdminForm.city || loc.city.toLowerCase() === editAdminForm.city.toLowerCase())
                        .map(loc => (
                          <label
                            key={loc._id}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              editAdminForm.selectedLocations.includes(loc._id)
                                ? 'bg-primary/10 border-primary'
                                : 'bg-muted/50 border-border hover:bg-muted'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={editAdminForm.selectedLocations.includes(loc._id)}
                              onChange={() => toggleEditLocationSelection(loc._id)}
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

                {/* Permissions */}
                <div>
                  <label className="block text-sm font-medium mb-2">Permissions</label>
                  <div className="space-y-2">
                    {[
                      { key: 'canCreateWorkers', label: 'Create Workers' },
                      { key: 'canDeleteWorkers', label: 'Delete Workers' },
                      { key: 'canManageApartments', label: 'Manage Apartments' },
                      { key: 'canViewReports', label: 'View Reports' }
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editAdminForm.permissions[key as keyof typeof editAdminForm.permissions]}
                          onChange={(e) => setEditAdminForm(prev => ({
                            ...prev,
                            permissions: { ...prev.permissions, [key]: e.target.checked }
                          }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Existing document info */}
                {editingAdmin.idDocument && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <FileText className="w-5 h-5 text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800">ID Document on file</p>
                      <p className="text-xs text-green-600 line-clamp-1 break-words">{editingAdmin.idDocumentType || 'Document'}</p>
                    </div>
                    <a
                      href={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}${editingAdmin.idDocument}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-700 underline shrink-0"
                    >View</a>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setEditingAdmin(null)} className="flex-1 py-2 border border-border rounded-xl">
                    Cancel
                  </button>
                  <button type="submit" disabled={updatingAdmin} className="flex-1 btn-brand py-2 disabled:opacity-50">
                    {updatingAdmin ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Payment QR Modal */}
        {showQRModal && selectedLocation && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-3 sm:p-4 md:p-5 rounded-t-2xl flex items-center gap-4">
                <button
                  onClick={() => setShowQRModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex-1">
                  <h2 className="text-xl font-bold">Payment QR Code</h2>
                  <p className="text-sm opacity-90">{selectedLocation.apartmentName}</p>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
                  <p className="font-semibold text-blue-900 mb-2">💡 Location-Specific Payment QR</p>
                  <p className="text-blue-800">
                    Upload your custom payment QR code for this location. Workers assigned here will automatically show
                    this QR to customers when collecting payment after completing work.
                  </p>
                </div>

                {/* QR Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    QR Code Image *
                  </label>
                  {uploadingQR && !qrFormData.qrCodeImage ? (
                    <div className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-purple-400 rounded-xl bg-purple-50">
                      <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mb-3"></div>
                      <p className="text-sm text-foreground font-medium">Detecting QR code...</p>
                      <p className="text-xs text-muted-foreground mt-1">Cropping to QR region</p>
                    </div>
                  ) : qrFormData.qrCodeImage ? (
                    <div className="relative">
                      <img 
                        src={qrFormData.qrCodeImage} 
                        alt="Payment QR" 
                        className="w-full max-w-sm mx-auto rounded-lg border-2 border-purple-300 shadow-lg"
                      />
                      <button
                        onClick={() => setQRFormData(prev => ({ ...prev, qrCodeImage: '' }))}
                        className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted transition-colors bg-muted/30">
                      <Upload className="w-12 h-12 text-muted-foreground mb-2" />
                      <p className="text-sm text-foreground font-medium">Click to upload QR code</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 2MB</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleQRImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* UPI Details */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      UPI ID (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., yourname@upi"
                      className="input-clean"
                      value={qrFormData.upiId}
                      onChange={(e) => setQRFormData(prev => ({ ...prev, upiId: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Payee Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., John Doe"
                      className="input-clean"
                      value={qrFormData.upiName}
                      onChange={(e) => setQRFormData(prev => ({ ...prev, upiName: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Contact Phone (Optional)
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g., +91 98765 43210"
                      className="input-clean"
                      value={qrFormData.phoneNumber}
                      onChange={(e) => setQRFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {qrFormData.qrCodeImage && (
                    <button
                      onClick={handleDeletePaymentQR}
                      className="flex items-center gap-2 px-4 py-2 border-2 border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete QR
                    </button>
                  )}
                  <button
                    onClick={() => setShowQRModal(false)}
                    className="flex-1 btn-secondary py-2"
                    disabled={uploadingQR}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePaymentQR}
                    disabled={uploadingQR || !qrFormData.qrCodeImage}
                    className="flex-1 btn-brand py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingQR ? 'Saving...' : 'Save QR Code'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Location Requests Tab - Super Admin */}
        {isSuperAdmin && activeTab === 'location-requests' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex flex-wrap gap-2">
              {["", "pending", "approved", "rejected"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setRequestFilterStatus(s); fetchLocationRequests(s); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${requestFilterStatus === s ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
                >
                  {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
                </button>
              ))}
            </div>

            {/* Requests List */}
            {requestLoading ? (
              <div className="text-center py-10 text-muted-foreground">Loading requests...</div>
            ) : locationRequests.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground card-elevated">
                <div className="text-4xl mb-3">📋</div>
                <p>No location requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {locationRequests.map((req: LocationRequest) => (
                  <div key={req._id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{req.apartmentName}{req.building ? `, ${req.building}` : ""}</h3>
                        <p className="text-sm text-muted-foreground">{req.area}, {req.city}, {req.state}{req.zipCode ? ` - ${req.zipCode}` : ""}</p>
                      </div>
                      {getRequestStatusBadge(req.status)}
                    </div>
                    {req.reason && <p className="text-sm text-muted-foreground">Reason: {req.reason}</p>}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-muted-foreground">
                      <span>Requested by: {req.requestedBy?.name}</span>
                      <span className="hidden sm:block">·</span>
                      <span>{new Date(req.createdAt).toLocaleDateString("en-IN")}</span>
                    </div>
                    {req.reviewedBy && (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>Reviewed by: {req.reviewedBy.name}{req.reviewedAt ? ` on ${new Date(req.reviewedAt).toLocaleDateString("en-IN")}` : ""}</div>
                        {req.reviewNote && <div>Note: {req.reviewNote}</div>}
                      </div>
                    )}

                    {/* Review Panel */}
                    {req.status === "pending" && (
                      <div className="space-y-2">
                        {requestReviewingId === req._id ? (
                          <>
                            <div className="space-y-3 border border-border rounded-lg p-3 bg-muted/30">
                              <div className="text-sm font-medium">Review Details</div>
                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">Review note (optional)</label>
                                <textarea
                                  className="input-clean text-sm w-full"
                                  rows={2}
                                  placeholder="Add any comments..."
                                  value={requestReviewNote}
                                  onChange={(e) => setRequestReviewNote(e.target.value)}
                                />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs text-muted-foreground mb-1">Latitude <span className="text-destructive">*</span></label>
                                  <input
                                    type="number"
                                    step="any"
                                    className="input-clean text-sm w-full"
                                    placeholder="e.g. 12.9716"
                                    value={requestReviewLatitude}
                                    onChange={(e) => setRequestReviewLatitude(e.target.value)}
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-muted-foreground mb-1">Longitude <span className="text-destructive">*</span></label>
                                  <input
                                    type="number"
                                    step="any"
                                    className="input-clean text-sm w-full"
                                    placeholder="e.g. 77.5946"
                                    value={requestReviewLongitude}
                                    onChange={(e) => setRequestReviewLongitude(e.target.value)}
                                    required
                                  />
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Coordinates are required for approval. Get them from Google Maps.
                              </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <button
                                onClick={() => handleReviewLocationRequest(req._id, "approved")}
                                disabled={requestReviewLoading}
                                className="flex-1 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                              >
                                {requestReviewLoading ? "Processing..." : "✓ Approve & Create"}
                              </button>
                              <button
                                onClick={() => handleReviewLocationRequest(req._id, "rejected")}
                                disabled={requestReviewLoading}
                                className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                              >
                                {requestReviewLoading ? "Processing..." : "✗ Reject"}
                              </button>
                              <button
                                onClick={() => { setRequestReviewingId(null); setRequestReviewNote(""); setRequestReviewLatitude(""); setRequestReviewLongitude(""); }}
                                disabled={requestReviewLoading}
                                className="py-2 px-3 border border-border rounded-lg"
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <button
                            onClick={() => setRequestReviewingId(req._id)}
                            className="text-sm text-primary hover:underline"
                          >
                            Review this request →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Request Location Tab - Admin Only */}
        {!isSuperAdmin && activeTab === 'request' && (
          <div className="max-w-2xl">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold mb-2">Request New Location</h2>
                <p className="text-sm text-muted-foreground">Submit a location request for super admin approval</p>
              </div>
              
              <form onSubmit={handleSubmitLocationRequest} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Apartment / Society Name <span className="text-destructive">*</span></label>
                  <input type="text" required className="input-clean" placeholder="e.g. Green Valley Apartments" value={requestForm.apartmentName} onChange={(e) => setRequestForm({ ...requestForm, apartmentName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Building (Optional)</label>
                  <input type="text" className="input-clean" placeholder="e.g. Block A" value={requestForm.building} onChange={(e) => setRequestForm({ ...requestForm, building: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Area <span className="text-destructive">*</span></label>
                  <input type="text" required className="input-clean" placeholder="e.g. Koramangala" value={requestForm.area} onChange={(e) => setRequestForm({ ...requestForm, area: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">City <span className="text-destructive">*</span></label>
                    <input type="text" required className="input-clean" placeholder="e.g. Bangalore" value={requestForm.city} onChange={(e) => setRequestForm({ ...requestForm, city: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">State <span className="text-destructive">*</span></label>
                    <input type="text" required className="input-clean" placeholder="e.g. Karnataka" value={requestForm.state} onChange={(e) => setRequestForm({ ...requestForm, state: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ZIP Code (Optional)</label>
                  <input type="text" className="input-clean" placeholder="e.g. 560034" value={requestForm.zipCode} onChange={(e) => setRequestForm({ ...requestForm, zipCode: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Reason for request (Optional)</label>
                  <textarea className="input-clean" rows={3} maxLength={500} placeholder="Explain why this location should be added..." value={requestForm.reason} onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })} />
                </div>
                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  <button type="button" onClick={() => setActiveTab('locations')} className="flex-1 py-2 border border-border rounded-lg" disabled={requestSubmitting}>Cancel</button>
                  <button type="submit" className="flex-1 btn-brand py-2 disabled:opacity-50" disabled={requestSubmitting}>
                    {requestSubmitting ? "Submitting..." : "Submit Request"}
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
