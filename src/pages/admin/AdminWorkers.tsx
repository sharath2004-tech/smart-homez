import AppLayout from "@/components/AppLayout";
import { useAdminRole } from "@/hooks/useAdminRole";
import { adminAPI } from "@/lib/api";
import { AlertTriangle, Archive, ArchiveRestore, CheckCircle, Clock, Edit, Eye, EyeOff, FileText, Info, Loader2, MapPin, Plus, Search, Star, Upload, X, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Location {
  _id: string;
  apartmentName: string;
  area: string;
  city: string;
}

interface Worker {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  religion?: string;
  profileImage?: string;
  workerProfile?: {
    specialization: string[];
    experience?: number;
    languages?: string[];
    rating: number;
    completedJobs: number;
    totalEarnings: number;
    isAvailable: boolean;
    wageType?: string;
    hourlyRate?: number;
    dailyWage?: number;
    monthlyWage?: number;
    reliabilityScore?: number;
    joinDate?: string;
    resignedDate?: string;
    accountStatus?: string;
    assignedApartments: Array<{
      locationId?: string;
      apartmentName: string;
      area: string;
      city: string;
    }>;
    bankDetails?: {
      accountHolderName?: string;
      accountNumber?: string;
      ifscCode?: string;
      bankName?: string;
      upiId?: string;
    };
    documents?: {
      aadhaarFront?: string;
      aadhaarBack?: string;
      aadhaarNumber?: string;
      uploadedAt?: string;
    };
    workingTimeWindow?: {
      enabled: boolean;
      startTime?: string;
      endTime?: string;
      workingDays?: number[];
      timezone?: string;
    };
  };
  currentLocation?: {
    coordinates: [number, number]; // [lng, lat]
  };
  addresses?: Array<{
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    label?: string;
  }>;
  isActive: boolean;
  isArchived?: boolean;
}

const statusConfig: Record<string, { label: string; class: string }> = {
  available: { label: "Available", class: "badge-success" },
  offline: { label: "Offline", class: "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-muted text-muted-foreground" },
};

const specializationOptions = [
  "Cleaning",
  "Deep Clean",
  "Kitchen",
  "Bathroom",
  "Window",
  "Laundry",
  "Sofa",
  "Carpet"
];

const AdminWorkers = () => {
  const { role, name, isSuperAdmin } = useAdminRole();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [noRegionAssigned, setNoRegionAssigned] = useState(false);
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [creatingWorker, setCreatingWorker] = useState(false);
  const [credentialDelivery, setCredentialDelivery] = useState<"email" | "phone" | "both">("email");

  // Archive with resigned date state
  const [archiveWorkerData, setArchiveWorkerData] = useState<{ id: string; name: string } | null>(null);
  const [resignedDate, setResignedDate] = useState("");

  // Edit worker state
  const [editWorker, setEditWorker] = useState<Worker | null>(null);
  const [updatingWorker, setUpdatingWorker] = useState(false);

  // Credential management (superadmin only)
  const [showCredentials, setShowCredentials] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const [workerForm, setWorkerForm] = useState({
    name: "",
    email: "",
    phone: "",
    gender: "" as string,
    dateOfBirth: "",
    religion: "",
    experience: "" as string,
    specialization: [] as string[],
    selectedLocations: [] as string[],
    aadhaarNumber: "",
    wageType: "hourly" as "hourly" | "daily" | "monthly",
    hourlyRate: "",
    dailyWage: "",
    monthlyWage: "",
  });

  const [docFiles, setDocFiles] = useState<{
    profilePicture: File | null;
    aadhaarFront: File | null;
    aadhaarBack: File | null;
  }>({
    profilePicture: null,
    aadhaarFront: null,
    aadhaarBack: null
  });

  const profilePicRef = useRef<HTMLInputElement>(null);
  const aadhaarFrontRef = useRef<HTMLInputElement>(null);
  const aadhaarBackRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [workersRes, locationsRes] = await Promise.all([
        adminAPI.getWorkers(),
        adminAPI.getLocations()
      ]);
      console.log('📊 Workers fetched:', workersRes.workers?.length || 0, 'workers');
      console.log('📍 Locations fetched:', locationsRes.locations?.length || 0, 'locations');
      if (workersRes.workers?.length > 0) {
        console.log('Sample worker:', workersRes.workers[0]);
      }
      setWorkers(workersRes.workers || []);
      setNoRegionAssigned(!!workersRes.noRegionAssigned);
      setLocations(locationsRes.locations || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveWorker = (workerId: string, workerName: string) => {
    setArchiveWorkerData({ id: workerId, name: workerName });
    setResignedDate(new Date().toISOString().split('T')[0]);
  };

  const handleConfirmArchive = async () => {
    if (!archiveWorkerData) return;

    // Validate resignedDate
    if (!resignedDate || resignedDate.trim() === '') {
      alert('Please provide a resigned date');
      return;
    }

    const parsedDate = new Date(resignedDate);
    if (isNaN(parsedDate.getTime())) {
      alert('Invalid resigned date. Please enter a valid date.');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parsedDate > today) {
      alert('Resigned date cannot be in the future');
      return;
    }

    try {
      await adminAPI.archiveWorker(archiveWorkerData.id, resignedDate);
      alert('Worker archived successfully');
      setArchiveWorkerData(null);
      setResignedDate("");
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to archive worker';
      alert(message);
    }
  };

  const handleUnarchiveWorker = async (workerId: string) => {
    if (!confirm('Restore this worker? They will be reactivated.')) return;
    try {
      await adminAPI.unarchiveWorker(workerId);
      alert('Worker restored successfully');
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to restore worker';
      alert(message);
    }
  };

  const handleEditWorker = async (workerId: string) => {
    try {
      const response = await adminAPI.getWorkerDetails(workerId);
      setEditWorker(response.worker);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load worker details';
      alert(message);
    }
  };

  const handleUpdateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWorker) return;

    setUpdatingWorker(true);
    try {
      const formData = new FormData();

      // Basic fields
      formData.append('name', editWorker.name);
      formData.append('email', editWorker.email);
      if (editWorker.phone) formData.append('phone', editWorker.phone);
      if (editWorker.gender) formData.append('gender', editWorker.gender);
      if (editWorker.dateOfBirth) formData.append('dateOfBirth', editWorker.dateOfBirth);
      if (editWorker.religion) formData.append('religion', editWorker.religion);

      // Worker profile as JSON
      if (editWorker.workerProfile) {
        formData.append('workerProfile', JSON.stringify({
          specialization: editWorker.workerProfile.specialization,
          experience: editWorker.workerProfile.experience || 0,
          languages: editWorker.workerProfile.languages || [],
          wageType: editWorker.workerProfile.wageType || 'hourly',
          hourlyRate: editWorker.workerProfile.hourlyRate || 0,
          dailyWage: editWorker.workerProfile.dailyWage || 0,
          monthlyWage: editWorker.workerProfile.monthlyWage || 0,
          availability: editWorker.workerProfile.isAvailable,
          accountStatus: editWorker.workerProfile.accountStatus || 'active',
          joinDate: editWorker.workerProfile.joinDate || null,
          resignedDate: editWorker.workerProfile.resignedDate || null,
          bankDetails: editWorker.workerProfile.bankDetails || {},
          workingTimeWindow: editWorker.workerProfile.workingTimeWindow || {
            enabled: false,
            startTime: "09:00",
            endTime: "18:00",
            workingDays: [1, 2, 3, 4, 5, 6]
          }
        }));
      }

      // Aadhaar number
      if (editWorker.workerProfile?.documents?.aadhaarNumber) {
        formData.append('aadhaarNumber', editWorker.workerProfile.documents.aadhaarNumber);
      }

      await adminAPI.updateWorker(editWorker._id, formData);
      alert('Worker updated successfully!');
      setEditWorker(null);
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update worker';
      alert(message);
    } finally {
      setUpdatingWorker(false);
    }
  };

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();

    if (workerForm.specialization.length === 0) {
      alert('Please select at least one specialization');
      return;
    }

    if (workerForm.selectedLocations.length === 0) {
      alert('Please assign worker to at least one location');
      return;
    }

    // Validate Aadhaar number (must be exactly 12 digits if provided)
    if (workerForm.aadhaarNumber) {
      const digits = workerForm.aadhaarNumber.replace(/\s/g, '');
      if (!/^\d{12}$/.test(digits)) {
        alert('Aadhaar number must be exactly 12 digits');
        return;
      }
    }

    // Validate Date of Birth (worker must be 18+)
    if (workerForm.dateOfBirth) {
      const dob = new Date(workerForm.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear() -
        (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
      if (age < 18) {
        alert('Worker must be at least 18 years old');
        return;
      }
    }

    // Credential delivery validation
    if (credentialDelivery === 'email' && !workerForm.email) {
      alert('Email is required for email credential delivery');
      return;
    }
    if (credentialDelivery === 'phone' && !workerForm.phone) {
      alert('Phone is required for phone credential delivery');
      return;
    }

    // Validate wage inputs
    if (workerForm.wageType === 'hourly') {
      const rate = Number(workerForm.hourlyRate);
      if (!workerForm.hourlyRate || rate <= 0 || isNaN(rate)) {
        alert('Please provide a valid hourly rate greater than 0');
        return;
      }
    }
    if (workerForm.wageType === 'daily') {
      const wage = Number(workerForm.dailyWage);
      if (!workerForm.dailyWage || wage <= 0 || isNaN(wage)) {
        alert('Please provide a valid daily wage greater than 0');
        return;
      }
    }
    if (workerForm.wageType === 'monthly') {
      const wage = Number(workerForm.monthlyWage);
      if (!workerForm.monthlyWage || wage <= 0 || isNaN(wage)) {
        alert('Please provide a valid monthly wage greater than 0');
        return;
      }
    }

    // Validate gender and experience if provided
    if (workerForm.gender && !['male', 'female', 'other'].includes(workerForm.gender.toLowerCase())) {
      alert('Please select a valid gender option');
      return;
    }
    if (workerForm.experience) {
      const exp = Number(workerForm.experience);
      if (isNaN(exp) || exp < 0) {
        alert('Experience must be a positive number');
        return;
      }
    }

    setCreatingWorker(true);

    try {
      const formData = new FormData();
      formData.append('name', workerForm.name);
      if (workerForm.email) formData.append('email', workerForm.email);
      if (workerForm.phone) formData.append('phone', workerForm.phone);
      if (workerForm.gender) formData.append('gender', workerForm.gender);
      if (workerForm.religion) formData.append('religion', workerForm.religion);
      if (workerForm.dateOfBirth) formData.append('dateOfBirth', workerForm.dateOfBirth);
      formData.append('experience', String(parseInt(workerForm.experience) || 0));
      formData.append('specialization', JSON.stringify(workerForm.specialization));
      formData.append('assignedApartmentIds', JSON.stringify(workerForm.selectedLocations));
      if (workerForm.aadhaarNumber) formData.append('aadhaarNumber', workerForm.aadhaarNumber.replace(/\s/g, ''));
      formData.append('wageType', workerForm.wageType);
      if (workerForm.wageType === 'hourly' && workerForm.hourlyRate) formData.append('hourlyRate', workerForm.hourlyRate);
      if (workerForm.wageType === 'daily' && workerForm.dailyWage) formData.append('dailyWage', workerForm.dailyWage);
      if (workerForm.wageType === 'monthly' && workerForm.monthlyWage) formData.append('monthlyWage', workerForm.monthlyWage);
      formData.append('credentialDelivery', credentialDelivery);
      if (docFiles.profilePicture) formData.append('profilePicture', docFiles.profilePicture);
      if (docFiles.aadhaarFront) formData.append('aadhaarFront', docFiles.aadhaarFront);
      if (docFiles.aadhaarBack) formData.append('aadhaarBack', docFiles.aadhaarBack);

      const response = await adminAPI.createWorker(formData);
      
      // Show temporary password to admin
      const deliveryLabel =
        credentialDelivery === "both" ? `📧 Email: ${workerForm.email}\n📱 Phone: ${workerForm.phone}` :
        credentialDelivery === "phone" ? `📱 Phone: ${workerForm.phone}` :
        `📧 Email: ${workerForm.email}`;
      const deliveryStatus = response.deliveryResults
        ? Object.entries(response.deliveryResults).map(([k, v]) => `${k}: ${v}`).join(', ')
        : 'pending';
      alert(`Worker created successfully! ✅\n\nTemporary Password: ${response.temporaryPassword || '(see delivery channel)'}\n\nCredentials sent via:\n${deliveryLabel}\nStatus: ${deliveryStatus}\n\nPlease save this password as backup.`);
      
      setShowWorkerForm(false);
      setCredentialDelivery("email");
      setWorkerForm({
        name: "",
        email: "",
        phone: "",
        gender: "",
        dateOfBirth: "",
        religion: "",
        experience: "",
        specialization: [],
        selectedLocations: [],
        aadhaarNumber: "",
        wageType: "hourly",
        hourlyRate: "",
        dailyWage: "",
        monthlyWage: "",
      });
      setDocFiles({ profilePicture: null, aadhaarFront: null, aadhaarBack: null });
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create worker';
      alert('❌ Error: ' + message);
    } finally {
      setCreatingWorker(false);
    }
  };

  const toggleSpecialization = (spec: string) => {
    setWorkerForm(prev => ({
      ...prev,
      specialization: prev.specialization.includes(spec)
        ? prev.specialization.filter(s => s !== spec)
        : [...prev.specialization, spec]
    }));
  };

  const toggleLocation = (locationId: string) => {
    setWorkerForm(prev => ({
      ...prev,
      selectedLocations: prev.selectedLocations.includes(locationId)
        ? prev.selectedLocations.filter(id => id !== locationId)
        : [...prev.selectedLocations, locationId]
    }));
  };

  const filtered = workers.filter((w) => {
    const matchSearch = w.name.toLowerCase().includes(search.toLowerCase()) || 
      w.email.toLowerCase().includes(search.toLowerCase());
    
    if (statusFilter === "all") return matchSearch;
    
    const workerStatus = w.workerProfile?.isAvailable ? 'available' : 'offline';
    return matchSearch && workerStatus === statusFilter;
  });

  const onlineCount = workers.filter(w => w.workerProfile?.isAvailable && w.isActive).length;
  const offlineCount = workers.filter(w => !w.workerProfile?.isAvailable || !w.isActive).length;

  if (loading) {
    return (
      <AppLayout userType={role} userName={name}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading workers...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType={role} userName={name}>
      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 space-y-6 animate-fade-in">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Workers</h1>
            <p className="text-muted-foreground text-sm mt-1">{workers.length} registered workers</p>
          </div>
          <button 
            onClick={() => setShowWorkerForm(true)}
            className="flex items-center gap-2 btn-brand text-sm py-2.5 px-4"
          >
            <Plus className="w-4 h-4" /> Add Worker
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-success-light rounded-xl p-4">
            <p className="text-2xl font-bold font-heading text-success">{onlineCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Available</p>
          </div>
          <div className="bg-muted rounded-xl p-4">
            <p className="text-2xl font-bold font-heading text-muted-foreground">{offlineCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Offline</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input className="input-clean pl-10" placeholder="Search workers..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input-clean sm:w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="offline">Offline</option>
          </select>
        </div>

        {/* Worker cards */}
        {noRegionAssigned ? (
          <div className="text-center py-12 text-muted-foreground card-elevated">
            <div className="text-4xl mb-3">🗺️</div>
            <p className="font-semibold text-foreground">No region assigned</p>
            <p className="text-sm mt-1">Contact your super admin to assign you to a location region.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground card-elevated">
            <div className="text-4xl mb-3">👷</div>
            <p>No workers found</p>
            <p className="text-sm mt-2">Click "Add Worker" to create one</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((w) => {
              const status = w.workerProfile?.isAvailable ? 'available' : 'offline';
              return (
                <div key={w._id} className="card-elevated p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 bg-primary-light rounded-full flex items-center justify-center text-primary font-bold shrink-0">
                      {w.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-foreground">{w.name}</p>
                        <span className={statusConfig[status].class}>{statusConfig[status].label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{w.email}</p>
                      {w.phone && <p className="text-xs text-muted-foreground">{w.phone}</p>}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-muted rounded-xl mb-4">
                    <div className="text-center">
                      <p className="text-sm font-bold text-foreground flex items-center justify-center gap-1">
                        <Star className="w-3 h-3 fill-warning text-warning" />
                        {w.workerProfile?.rating?.toFixed(1) || '0.0'}
                      </p>
                      <p className="text-xs text-muted-foreground">Rating</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-foreground">{w.workerProfile?.completedJobs || 0}</p>
                      <p className="text-xs text-muted-foreground">Jobs</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-foreground">₹{w.workerProfile?.totalEarnings || 0}</p>
                      <p className="text-xs text-muted-foreground">Earned</p>
                    </div>
                  </div>

                  {/* Reliability Score */}
                  {w.workerProfile?.reliabilityScore !== undefined && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-muted-foreground">Reliability:</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${w.workerProfile.reliabilityScore >= 80 ? 'bg-green-500' : w.workerProfile.reliabilityScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${w.workerProfile.reliabilityScore}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{w.workerProfile.reliabilityScore}%</span>
                    </div>
                  )}

                  {/* Wage Info */}
                  {w.workerProfile?.wageType && (
                    <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded capitalize">{w.workerProfile.wageType} wage</span>
                      {w.workerProfile.wageType === 'hourly' && w.workerProfile.hourlyRate && <span>₹{w.workerProfile.hourlyRate}/hr</span>}
                      {w.workerProfile.wageType === 'daily' && w.workerProfile.dailyWage && <span>₹{w.workerProfile.dailyWage}/day</span>}
                      {w.workerProfile.wageType === 'monthly' && w.workerProfile.monthlyWage && <span>₹{w.workerProfile.monthlyWage}/month</span>}
                    </div>
                  )}

                  {w.workerProfile?.specialization && w.workerProfile.specialization.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {w.workerProfile.specialization.map((s) => (
                        <span key={s} className="text-xs bg-accent text-accent-foreground px-2.5 py-1 rounded-lg">{s}</span>
                      ))}
                    </div>
                  )}

                  {/* Location Information */}
                  {w.workerProfile?.assignedApartments && w.workerProfile.assignedApartments.length > 0 ? (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Assigned Locations:</p>
                      <div className="space-y-1">
                        {w.workerProfile.assignedApartments.map((apt, idx) => (
                          <div key={idx} className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {apt.apartmentName} - {apt.area}, {apt.city}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : w.addresses && w.addresses.length > 0 ? (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Registered Location:</p>
                      <div className="space-y-1">
                        {w.addresses.map((addr, idx) => (
                          <div key={idx} className="text-xs text-muted-foreground bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-blue-600" />
                            {addr.label && <span className="font-medium">{addr.label}:</span>} {addr.street}, {addr.city}, {addr.state} {addr.zipCode}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Self-registered worker
                      </p>
                    </div>
                  ) : w.currentLocation?.coordinates ? (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Location:</p>
                      <div className="text-xs text-muted-foreground bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-blue-600" />
                        {w.currentLocation.coordinates[1].toFixed(4)}, {w.currentLocation.coordinates[0].toFixed(4)}
                      </div>
                      <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Self-registered worker
                      </p>
                    </div>
                  ) : null}

                  {/* Edit Button */}
                  <button
                    onClick={() => handleEditWorker(w._id)}
                    className="w-full py-2 mb-2 border border-blue-300 rounded-xl text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit Worker
                  </button>

                  {w.isArchived ? (
                    <button
                      onClick={() => handleUnarchiveWorker(w._id)}
                      className="w-full py-2 border border-green-300 rounded-xl text-sm font-medium text-green-700 hover:bg-green-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <ArchiveRestore className="w-3.5 h-3.5" /> Restore Worker
                    </button>
                  ) : (
                    <button
                      onClick={() => handleArchiveWorker(w._id, w.name)}
                      className="w-full py-2 border border-amber-300 rounded-xl text-sm font-medium text-amber-700 hover:bg-amber-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <Archive className="w-3.5 h-3.5" /> Archive Worker
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Create Worker Modal */}
        {showWorkerForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Add New Worker</h2>
                <button onClick={() => setShowWorkerForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateWorker} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    className="input-clean"
                    placeholder="Worker name"
                    value={workerForm.name}
                    onChange={(e) => setWorkerForm({...workerForm, name: e.target.value})}
                  />
                </div>

                {/* Credential delivery method — affects which fields are required */}
                <div>
                  <label className="block text-sm font-medium mb-2">Send temporary password via</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(["email", "phone", "both"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setCredentialDelivery(opt)}
                        className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                          credentialDelivery === opt
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-muted text-foreground"
                        }`}
                      >
                        {opt === "email" ? "📧 Email" : opt === "phone" ? "📱 Phone" : "📧+📱 Both"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Email {credentialDelivery === 'phone' ? <span className="text-muted-foreground font-normal">(Optional)</span> : <span className="text-destructive">*</span>}
                  </label>
                  <input
                    type="email"
                    required={credentialDelivery !== 'phone'}
                    className="input-clean"
                    placeholder="worker@example.com"
                    value={workerForm.email}
                    onChange={(e) => setWorkerForm({...workerForm, email: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Worker's login email address</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Phone {credentialDelivery === 'email' ? <span className="text-muted-foreground font-normal">(Optional)</span> : <span className="text-destructive">*</span>}
                  </label>
                  <input
                    type="tel"
                    required={credentialDelivery !== 'email'}
                    className="input-clean"
                    placeholder="+91 9876543210"
                    value={workerForm.phone}
                    onChange={(e) => setWorkerForm({...workerForm, phone: e.target.value})}
                  />
                </div>

                {/* Credential delivery method */}
                <div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {credentialDelivery === "email" && "Temporary password will be sent to the email address."}
                    {credentialDelivery === "phone" && "Temporary password will be sent as an SMS to the phone number."}
                    {credentialDelivery === "both" && "Temporary password will be sent to both email and phone."}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Gender</label>
                  <select
                    required
                    className="input-clean"
                    value={workerForm.gender}
                    onChange={(e) => setWorkerForm({...workerForm, gender: e.target.value})}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Date of Birth <span className="text-destructive">*</span></label>
                  <input
                    type="date"
                    required
                    className="input-clean"
                    max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                    value={workerForm.dateOfBirth}
                    onChange={(e) => setWorkerForm({...workerForm, dateOfBirth: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Worker must be at least 18 years old</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Religion (Optional)</label>
                  <input
                    type="text"
                    className="input-clean"
                    placeholder="e.g. Hindu, Muslim, Christian, etc."
                    value={workerForm.religion}
                    onChange={(e) => setWorkerForm({...workerForm, religion: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Years of Experience</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="50"
                    className="input-clean"
                    placeholder="e.g. 3"
                    value={workerForm.experience}
                    onChange={(e) => setWorkerForm({...workerForm, experience: e.target.value})}
                  />
                </div>

                {/* Wage Type */}
                <div>
                  <label className="block text-sm font-medium mb-2">Wage Type <span className="text-destructive">*</span></label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                    {(["hourly", "daily", "monthly"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setWorkerForm({...workerForm, wageType: opt})}
                        className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                          workerForm.wageType === opt
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-muted text-foreground"
                        }`}
                      >
                        {opt === "hourly" ? "⏱ Hourly" : opt === "daily" ? "📅 Daily" : "🗓 Monthly"}
                      </button>
                    ))}
                  </div>
                  {workerForm.wageType === 'hourly' && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Hourly Rate (₹)</label>
                      <input type="number" min="0" className="input-clean" placeholder="e.g. 150" value={workerForm.hourlyRate} onChange={(e) => setWorkerForm({...workerForm, hourlyRate: e.target.value})} />
                    </div>
                  )}
                  {workerForm.wageType === 'daily' && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Daily Wage (₹)</label>
                      <input type="number" min="0" className="input-clean" placeholder="e.g. 800" value={workerForm.dailyWage} onChange={(e) => setWorkerForm({...workerForm, dailyWage: e.target.value})} />
                    </div>
                  )}
                  {workerForm.wageType === 'monthly' && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Monthly Wage (₹)</label>
                      <input type="number" min="0" className="input-clean" placeholder="e.g. 15000" value={workerForm.monthlyWage} onChange={(e) => setWorkerForm({...workerForm, monthlyWage: e.target.value})} />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Specialization</label>
                  <div className="flex flex-wrap gap-2">
                    {specializationOptions.map(spec => (
                      <button
                        key={spec}
                        type="button"
                        onClick={() => toggleSpecialization(spec)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          workerForm.specialization.includes(spec)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border hover:bg-muted'
                        }`}
                      >
                        {workerForm.specialization.includes(spec) && <CheckCircle className="w-3 h-3 inline mr-1" />}
                        {spec}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Assign to Locations *</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-border rounded-lg p-3">
                    {locations.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No locations available</p>
                    ) : (
                      locations.map(loc => (
                        <button
                          key={loc._id}
                          type="button"
                          onClick={() => toggleLocation(loc._id)}
                          className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors ${
                            workerForm.selectedLocations.includes(loc._id)
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background border-border hover:bg-muted'
                          }`}
                        >
                          {workerForm.selectedLocations.includes(loc._id) && <CheckCircle className="w-3 h-3 inline mr-1" />}
                          {loc.apartmentName} - {loc.area}, {loc.city}
                        </button>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Worker will only be visible to admins of selected locations</p>
                </div>

                {/* Verification Documents */}
                <div className="border border-border rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold">Verification Documents <span className="text-muted-foreground font-normal">(Optional)</span></h3>
                  </div>

                  {/* Profile Picture */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Profile Picture</label>
                    <input
                      ref={profilePicRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => setDocFiles(prev => ({ ...prev, profilePicture: e.target.files?.[0] || null }))}
                    />
                    <button
                      type="button"
                      onClick={() => profilePicRef.current?.click()}
                      className="flex items-center gap-2 text-xs px-3 py-2 border border-dashed border-border rounded-lg hover:bg-muted transition-colors w-full"
                    >
                      <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                      {docFiles.profilePicture ? (
                        <span className="text-foreground">{docFiles.profilePicture.name}</span>
                      ) : (
                        <span className="text-muted-foreground">Upload profile photo (JPEG/PNG)</span>
                      )}
                    </button>
                  </div>

                  {/* Aadhaar Front */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Aadhaar Card — Front</label>
                    <input
                      ref={aadhaarFrontRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => setDocFiles(prev => ({ ...prev, aadhaarFront: e.target.files?.[0] || null }))}
                    />
                    <button
                      type="button"
                      onClick={() => aadhaarFrontRef.current?.click()}
                      className="flex items-center gap-2 text-xs px-3 py-2 border border-dashed border-border rounded-lg hover:bg-muted transition-colors w-full"
                    >
                      <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                      {docFiles.aadhaarFront ? (
                        <span className="text-foreground">{docFiles.aadhaarFront.name}</span>
                      ) : (
                        <span className="text-muted-foreground">Upload Aadhaar front (image or PDF)</span>
                      )}
                    </button>
                  </div>

                  {/* Aadhaar Back */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Aadhaar Card — Back</label>
                    <input
                      ref={aadhaarBackRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => setDocFiles(prev => ({ ...prev, aadhaarBack: e.target.files?.[0] || null }))}
                    />
                    <button
                      type="button"
                      onClick={() => aadhaarBackRef.current?.click()}
                      className="flex items-center gap-2 text-xs px-3 py-2 border border-dashed border-border rounded-lg hover:bg-muted transition-colors w-full"
                    >
                      <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                      {docFiles.aadhaarBack ? (
                        <span className="text-foreground">{docFiles.aadhaarBack.name}</span>
                      ) : (
                        <span className="text-muted-foreground">Upload Aadhaar back (image or PDF)</span>
                      )}
                    </button>
                  </div>

                  {/* Aadhaar Number */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Aadhaar Number</label>
                    <input
                      type="text"
                      className="input-clean"
                      placeholder="XXXX XXXX XXXX"
                      maxLength={14}
                      value={workerForm.aadhaarNumber}
                      onChange={(e) => {
                        // Allow only digits and spaces
                        const val = e.target.value.replace(/[^\d\s]/g, '');
                        setWorkerForm({ ...workerForm, aadhaarNumber: val });
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Must be exactly 12 digits (data governance requirement)
                      {workerForm.aadhaarNumber && (
                        <span className={`ml-2 ${workerForm.aadhaarNumber.replace(/\s/g, '').length === 12 ? 'text-green-600' : 'text-destructive'}`}>
                          {workerForm.aadhaarNumber.replace(/\s/g, '').length}/12
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowWorkerForm(false)} 
                    className="w-full sm:flex-1 py-2 border border-border rounded-xl"
                    disabled={creatingWorker}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="w-full sm:flex-1 btn-brand py-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={creatingWorker}
                  >
                    {creatingWorker && <Loader2 className="w-4 h-4 animate-spin" />}
                    {creatingWorker ? 'Creating Worker...' : 'Create Worker'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Archive Worker Modal */}
        {archiveWorkerData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-2xl max-w-sm w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Archive Worker</h2>
                <button onClick={() => setArchiveWorkerData(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Archive <span className="font-semibold text-foreground">{archiveWorkerData.name}</span>? Their history will be preserved.
              </p>
              <div>
                <label className="block text-sm font-medium mb-1">Resigned / Archive Date</label>
                <input
                  type="date"
                  className="input-clean"
                  value={resignedDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setResignedDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">This date will be saved as the worker's official resigned date.</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setArchiveWorkerData(null)}
                  className="flex-1 py-2 border border-border rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmArchive}
                  className="flex-1 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors"
                >
                  Confirm Archive
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Worker Modal */}
        {editWorker && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-background rounded-2xl max-w-3xl w-full p-6 my-8">
              <form onSubmit={handleUpdateWorker} className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Edit className="w-5 h-5" />
                    Edit Worker: {editWorker.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditWorker(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground border-b pb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        className="input-clean"
                        value={editWorker.name}
                        onChange={(e) => setEditWorker({ ...editWorker, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Email *</label>
                      <input
                        type="email"
                        required
                        className="input-clean"
                        value={editWorker.email}
                        onChange={(e) => setEditWorker({ ...editWorker, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Phone</label>
                      <input
                        type="tel"
                        className="input-clean"
                        value={editWorker.phone || ''}
                        onChange={(e) => setEditWorker({ ...editWorker, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Gender</label>
                      <select
                        className="input-clean"
                        value={editWorker.gender || ''}
                        onChange={(e) => setEditWorker({ ...editWorker, gender: e.target.value })}
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Date of Birth</label>
                      <input
                        type="date"
                        className="input-clean"
                        value={editWorker.dateOfBirth?.split('T')[0] || ''}
                        onChange={(e) => setEditWorker({ ...editWorker, dateOfBirth: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Religion</label>
                      <input
                        type="text"
                        className="input-clean"
                        value={editWorker.religion || ''}
                        onChange={(e) => setEditWorker({ ...editWorker, religion: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Worker Profile */}
                {editWorker.workerProfile && (
                  <>
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-foreground border-b pb-2">Worker Profile</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Experience (years)</label>
                          <input
                            type="number"
                            min="0"
                            className="input-clean"
                            value={editWorker.workerProfile.experience || 0}
                            onChange={(e) => setEditWorker({
                              ...editWorker,
                              workerProfile: { ...editWorker.workerProfile!, experience: parseInt(e.target.value) || 0 }
                            })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Account Status</label>
                          <select
                            className="input-clean"
                            value={editWorker.workerProfile.accountStatus || 'active'}
                            onChange={(e) => setEditWorker({
                              ...editWorker,
                              workerProfile: { ...editWorker.workerProfile!, accountStatus: e.target.value }
                            })}
                          >
                            <option value="active">Active</option>
                            <option value="pending_review">Pending Review</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Availability</label>
                          <select
                            className="input-clean"
                            value={editWorker.workerProfile.isAvailable ? 'true' : 'false'}
                            onChange={(e) => setEditWorker({
                              ...editWorker,
                              workerProfile: { ...editWorker.workerProfile!, isAvailable: e.target.value === 'true' }
                            })}
                          >
                            <option value="true">Available</option>
                            <option value="false">Offline</option>
                          </select>
                        </div>
                      </div>

                      {/* Specializations */}
                      <div>
                        <label className="block text-sm font-medium mb-2">Specializations *</label>
                        <div className="grid grid-cols-2 gap-2">
                          {specializationOptions.map((spec) => (
                            <label key={spec} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={editWorker.workerProfile?.specialization.includes(spec)}
                                onChange={(e) => {
                                  const current = editWorker.workerProfile?.specialization || [];
                                  const updated = e.target.checked
                                    ? [...current, spec]
                                    : current.filter((s) => s !== spec);
                                  setEditWorker({
                                    ...editWorker,
                                    workerProfile: { ...editWorker.workerProfile!, specialization: updated }
                                  });
                                }}
                                className="rounded"
                              />
                              {spec}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Working Time Window */}
                      <div className="border border-border rounded-xl p-4 space-y-4 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-semibold">Working Time Window</h3>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editWorker.workerProfile?.workingTimeWindow?.enabled || false}
                              onChange={(e) => {
                                const current = editWorker.workerProfile?.workingTimeWindow || {};
                                setEditWorker({
                                  ...editWorker,
                                  workerProfile: {
                                    ...editWorker.workerProfile!,
                                    workingTimeWindow: {
                                      ...current,
                                      enabled: e.target.checked,
                                      startTime: current.startTime || "09:00",
                                      endTime: current.endTime || "18:00",
                                      workingDays: current.workingDays || [1, 2, 3, 4, 5, 6]
                                    }
                                  }
                                });
                              }}
                              className="rounded"
                            />
                            <span className="text-xs text-muted-foreground">Enable time restrictions</span>
                          </label>
                        </div>

                        {editWorker.workerProfile?.workingTimeWindow?.enabled && (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium mb-1">Start Time</label>
                                <input
                                  type="time"
                                  className="input-clean"
                                  value={editWorker.workerProfile.workingTimeWindow?.startTime || "09:00"}
                                  onChange={(e) => {
                                    const current = editWorker.workerProfile?.workingTimeWindow || {};
                                    setEditWorker({
                                      ...editWorker,
                                      workerProfile: {
                                        ...editWorker.workerProfile!,
                                        workingTimeWindow: { ...current, startTime: e.target.value }
                                      }
                                    });
                                  }}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">End Time</label>
                                <input
                                  type="time"
                                  className="input-clean"
                                  value={editWorker.workerProfile.workingTimeWindow?.endTime || "18:00"}
                                  onChange={(e) => {
                                    const current = editWorker.workerProfile?.workingTimeWindow || {};
                                    setEditWorker({
                                      ...editWorker,
                                      workerProfile: {
                                        ...editWorker.workerProfile!,
                                        workingTimeWindow: { ...current, endTime: e.target.value }
                                      }
                                    });
                                  }}
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium mb-2">Working Days</label>
                              <div className="grid grid-cols-7 gap-2">
                                {[
                                  { label: "Sun", value: 0 },
                                  { label: "Mon", value: 1 },
                                  { label: "Tue", value: 2 },
                                  { label: "Wed", value: 3 },
                                  { label: "Thu", value: 4 },
                                  { label: "Fri", value: 5 },
                                  { label: "Sat", value: 6 }
                                ].map((day) => {
                                  const workingDays = editWorker.workerProfile?.workingTimeWindow?.workingDays || [];
                                  const isSelected = workingDays.includes(day.value);
                                  return (
                                    <button
                                      key={day.value}
                                      type="button"
                                      onClick={() => {
                                        const current = editWorker.workerProfile?.workingTimeWindow || {};
                                        const currentDays = current.workingDays || [];
                                        const updated = isSelected
                                          ? currentDays.filter(d => d !== day.value)
                                          : [...currentDays, day.value];
                                        setEditWorker({
                                          ...editWorker,
                                          workerProfile: {
                                            ...editWorker.workerProfile!,
                                            workingTimeWindow: { ...current, workingDays: updated }
                                          }
                                        });
                                      }}
                                      className={`text-xs px-2 py-2 rounded-lg border transition-colors ${
                                        isSelected
                                          ? 'bg-primary text-primary-foreground border-primary'
                                          : 'bg-background border-border hover:bg-muted'
                                      }`}
                                    >
                                      {day.label}
                                    </button>
                                  );
                                })}
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                Select the days when this worker is available for bookings
                              </p>
                            </div>
                          </>
                        )}

                        {!editWorker.workerProfile?.workingTimeWindow?.enabled && (
                          <p className="text-xs text-muted-foreground">
                            When disabled, worker is available 24/7 for bookings
                          </p>
                        )}
                      </div>

                      {/* Wage Configuration */}
                      <div>
                        <label className="block text-sm font-medium mb-2">Wage Type</label>
                        <div className="flex gap-4 mb-3">
                          {(['hourly', 'daily', 'monthly'] as const).map((type) => (
                            <label key={type} className="flex items-center gap-2 text-sm">
                              <input
                                type="radio"
                                name="wageType"
                                value={type}
                                checked={editWorker.workerProfile?.wageType === type}
                                onChange={(e) => setEditWorker({
                                  ...editWorker,
                                  workerProfile: { ...editWorker.workerProfile!, wageType: e.target.value }
                                })}
                              />
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </label>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {editWorker.workerProfile.wageType === 'hourly' && (
                            <div>
                              <label className="block text-sm font-medium mb-1">Hourly Rate (₹)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="input-clean"
                                value={editWorker.workerProfile.hourlyRate || 0}
                                onChange={(e) => setEditWorker({
                                  ...editWorker,
                                  workerProfile: { ...editWorker.workerProfile!, hourlyRate: parseFloat(e.target.value) || 0 }
                                })}
                              />
                            </div>
                          )}
                          {editWorker.workerProfile.wageType === 'daily' && (
                            <div>
                              <label className="block text-sm font-medium mb-1">Daily Wage (₹)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="input-clean"
                                value={editWorker.workerProfile.dailyWage || 0}
                                onChange={(e) => setEditWorker({
                                  ...editWorker,
                                  workerProfile: { ...editWorker.workerProfile!, dailyWage: parseFloat(e.target.value) || 0 }
                                })}
                              />
                            </div>
                          )}
                          {editWorker.workerProfile.wageType === 'monthly' && (
                            <div>
                              <label className="block text-sm font-medium mb-1">Monthly Wage (₹)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="input-clean"
                                value={editWorker.workerProfile.monthlyWage || 0}
                                onChange={(e) => setEditWorker({
                                  ...editWorker,
                                  workerProfile: { ...editWorker.workerProfile!, monthlyWage: parseFloat(e.target.value) || 0 }
                                })}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bank Details */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-foreground border-b pb-2">Bank Details</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Account Holder Name</label>
                          <input
                            type="text"
                            className="input-clean"
                            value={editWorker.workerProfile.bankDetails?.accountHolderName || ''}
                            onChange={(e) => setEditWorker({
                              ...editWorker,
                              workerProfile: {
                                ...editWorker.workerProfile!,
                                bankDetails: { ...editWorker.workerProfile?.bankDetails, accountHolderName: e.target.value }
                              }
                            })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Account Number</label>
                          <input
                            type="text"
                            className="input-clean"
                            value={editWorker.workerProfile.bankDetails?.accountNumber || ''}
                            onChange={(e) => setEditWorker({
                              ...editWorker,
                              workerProfile: {
                                ...editWorker.workerProfile!,
                                bankDetails: { ...editWorker.workerProfile?.bankDetails, accountNumber: e.target.value }
                              }
                            })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">IFSC Code</label>
                          <input
                            type="text"
                            className="input-clean"
                            value={editWorker.workerProfile.bankDetails?.ifscCode || ''}
                            onChange={(e) => setEditWorker({
                              ...editWorker,
                              workerProfile: {
                                ...editWorker.workerProfile!,
                                bankDetails: { ...editWorker.workerProfile?.bankDetails, ifscCode: e.target.value }
                              }
                            })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Bank Name</label>
                          <input
                            type="text"
                            className="input-clean"
                            value={editWorker.workerProfile.bankDetails?.bankName || ''}
                            onChange={(e) => setEditWorker({
                              ...editWorker,
                              workerProfile: {
                                ...editWorker.workerProfile!,
                                bankDetails: { ...editWorker.workerProfile?.bankDetails, bankName: e.target.value }
                              }
                            })}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium mb-1">UPI ID</label>
                          <input
                            type="text"
                            className="input-clean"
                            value={editWorker.workerProfile.bankDetails?.upiId || ''}
                            onChange={(e) => setEditWorker({
                              ...editWorker,
                              workerProfile: {
                                ...editWorker.workerProfile!,
                                bankDetails: { ...editWorker.workerProfile?.bankDetails, upiId: e.target.value }
                              }
                            })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Credentials Section (Super Admin Only) */}
                    {isSuperAdmin && (
                      <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <h3 className="text-sm font-semibold text-amber-900">Worker Credentials (Super Admin Access)</h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowCredentials(!showCredentials)}
                            className="text-xs text-amber-700 hover:text-amber-900 underline flex items-center gap-1"
                          >
                            {showCredentials ? (
                              <>
                                <EyeOff className="w-3 h-3" />
                                Hide
                              </>
                            ) : (
                              <>
                                <Eye className="w-3 h-3" />
                                Show Credentials
                              </>
                            )}
                          </button>
                        </div>

                        {showCredentials && (
                          <div className="space-y-3 pt-2">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-amber-900 mb-1">Email</label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={editWorker.email}
                                    readOnly
                                    className="input-clean bg-white text-sm font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(editWorker.email);
                                      alert('Email copied to clipboard!');
                                    }}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-amber-700 hover:text-amber-900"
                                  >
                                    Copy
                                  </button>
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-amber-900 mb-1">Phone</label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={editWorker.phone || 'Not provided'}
                                    readOnly
                                    className="input-clean bg-white text-sm font-mono"
                                  />
                                  {editWorker.phone && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(editWorker.phone || '');
                                        alert('Phone copied to clipboard!');
                                      }}
                                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-amber-700 hover:text-amber-900"
                                    >
                                      Copy
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-amber-200">
                              <p className="text-xs text-amber-800 mb-3">
                                <Info className="w-3 h-3 inline mr-1" />
                                Use these credentials for troubleshooting or account recovery
                              </p>

                              {tempPassword && (
                                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                  <p className="text-xs font-semibold text-green-900 mb-1">New Temporary Password Generated:</p>
                                  <div className="flex items-center gap-2">
                                    <code className="text-sm font-mono text-green-700 bg-white px-2 py-1 rounded">{tempPassword}</code>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(tempPassword);
                                        alert('Password copied to clipboard!');
                                      }}
                                      className="text-xs text-green-700 hover:text-green-900 underline"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                  <p className="text-xs text-green-700 mt-2">Share this with the worker securely. They must change it on first login.</p>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm(`Generate a new temporary password for ${editWorker.name}? This will invalidate their current password.`)) {
                                    setResettingPassword(true);
                                    try {
                                      // TODO: Add API endpoint for password reset
                                      // For now, generate a random password
                                      const newPass = Math.random().toString(36).slice(-8) + Math.random().toString(36).toUpperCase().slice(-4);
                                      setTempPassword(newPass);
                                      alert('⚠️ Password reset endpoint not yet implemented. In production, this would call the backend API.');
                                    } catch (error) {
                                      alert('Failed to reset password');
                                    } finally {
                                      setResettingPassword(false);
                                    }
                                  }
                                }}
                                disabled={resettingPassword}
                                className="w-full py-2 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {resettingPassword ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Resetting...
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="w-3 h-3" />
                                    Reset Worker Password
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Documents */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-foreground border-b pb-2">Documents</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Aadhaar Number</label>
                          <input
                            type="text"
                            className="input-clean"
                            maxLength={14}
                            value={editWorker.workerProfile?.documents?.aadhaarNumber || ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^\d\s]/g, '');
                              setEditWorker({
                                ...editWorker,
                                workerProfile: {
                                  ...editWorker.workerProfile!,
                                  documents: {
                                    ...editWorker.workerProfile?.documents,
                                    aadhaarNumber: val
                                  }
                                }
                              });
                            }}
                            placeholder="XXXX XXXX XXXX"
                          />
                        </div>

                        {/* Aadhaar Front */}
                        {editWorker.workerProfile?.documents?.aadhaarFront ? (
                          <div className="flex items-center gap-2 text-sm">
                            <FileText className="w-4 h-4 text-green-600" />
                            <span className="text-foreground">Aadhaar Front:</span>
                            <a
                              href={editWorker.workerProfile.documents.aadhaarFront}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Document
                            </a>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <XCircle className="w-4 h-4" />
                            <span>Aadhaar Front: Not uploaded</span>
                          </div>
                        )}

                        {/* Aadhaar Back */}
                        {editWorker.workerProfile?.documents?.aadhaarBack ? (
                          <div className="flex items-center gap-2 text-sm">
                            <FileText className="w-4 h-4 text-green-600" />
                            <span className="text-foreground">Aadhaar Back:</span>
                            <a
                              href={editWorker.workerProfile.documents.aadhaarBack}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Document
                            </a>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <XCircle className="w-4 h-4" />
                            <span>Aadhaar Back: Not uploaded</span>
                          </div>
                        )}

                        {/* Profile Picture */}
                        {editWorker.profileImage ? (
                          <div className="flex items-center gap-2 text-sm">
                            <FileText className="w-4 h-4 text-green-600" />
                            <span className="text-foreground">Profile Picture:</span>
                            <a
                              href={editWorker.profileImage}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Photo
                            </a>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <XCircle className="w-4 h-4" />
                            <span>Profile Picture: Not uploaded</span>
                          </div>
                        )}

                        {/* Document Upload Info */}
                        <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground">
                            <Info className="w-3.5 h-3.5 inline mr-1" />
                            To update documents, use the document upload section below or contact system administrator.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditWorker(null)}
                    className="flex-1 py-2 border border-border rounded-xl text-sm"
                    disabled={updatingWorker}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 btn-brand py-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={updatingWorker}
                  >
                    {updatingWorker && <Loader2 className="w-4 h-4 animate-spin" />}
                    {updatingWorker ? 'Updating...' : 'Update Worker'}
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

export default AdminWorkers;
