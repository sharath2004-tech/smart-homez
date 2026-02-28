import AppLayout from "@/components/AppLayout";
import { adminAPI } from "@/lib/api";
import { CheckCircle, Loader2, MapPin, Plus, Search, Star, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

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
  workerProfile?: {
    specialization: string[];
    rating: number;
    completedJobs: number;
    totalEarnings: number;
    isAvailable: boolean;
    assignedApartments: Array<{
      apartmentName: string;
      area: string;
      city: string;
    }>;
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [creatingWorker, setCreatingWorker] = useState(false);

  const [workerForm, setWorkerForm] = useState({
    name: "",
    email: "",
    phone: "",
    gender: "" as string,
    religion: "",
    experience: "" as string,
    specialization: [] as string[],
    selectedLocations: [] as string[]
  });

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
      setLocations(locationsRes.locations || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorker = async (workerId: string) => {
    if (!confirm('Are you sure you want to delete this worker?')) return;
    
    try {
      await adminAPI.deleteWorker(workerId);
      alert('Worker deleted successfully');
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete worker';
      alert(message);
    }
  };

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();

    if (workerForm.specialization.length === 0) {
      alert('Please select at least one specialization');
      return;
    }

    setCreatingWorker(true);

    try {
      const response = await adminAPI.createWorker({
        name: workerForm.name,
        email: workerForm.email,
        phone: workerForm.phone,
        gender: workerForm.gender,
        religion: workerForm.religion || undefined,
        experience: parseInt(workerForm.experience) || 0,
        specialization: workerForm.specialization,
        assignedApartmentIds: workerForm.selectedLocations.length > 0 ? workerForm.selectedLocations : []
      });
      
      // Show temporary password to admin
      if (response.temporaryPassword) {
        alert(`Worker created successfully! ✅\n\nTemporary Password: ${response.temporaryPassword}\n\n📧 An email with login credentials is being sent to: ${workerForm.email}\n\nPlease save this password as a backup and share it with the worker if they don't receive the email.`);
      } else {
        alert('Worker created successfully! ✅\n\nTemporary password is being sent to their email.');
      }
      
      setShowWorkerForm(false);
      setWorkerForm({
        name: "",
        email: "",
        phone: "",
        gender: "",
        religion: "",
        experience: "",
        specialization: [],
        selectedLocations: []
      });
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
      <AppLayout userType="admin" userName="Admin Team">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading workers...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="admin" userName="Admin Team">
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
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
        <div className="grid grid-cols-2 gap-4">
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
        {filtered.length === 0 ? (
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
                  
                  <div className="grid grid-cols-3 gap-2 p-3 bg-muted rounded-xl mb-4">
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

                  <button 
                    onClick={() => handleDeleteWorker(w._id)}
                    className="w-full py-2 border border-destructive/30 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Worker
                  </button>
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

                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    required
                    className="input-clean"
                    placeholder="worker@example.com"
                    value={workerForm.email}
                    onChange={(e) => setWorkerForm({...workerForm, email: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground mt-1">A temporary password will be sent to this email</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    className="input-clean"
                    placeholder="+91 9876543210"
                    value={workerForm.phone}
                    onChange={(e) => setWorkerForm({...workerForm, phone: e.target.value})}
                  />
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

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowWorkerForm(false)} 
                    className="flex-1 py-2 border border-border rounded-xl"
                    disabled={creatingWorker}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 btn-brand py-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      </div>
    </AppLayout>
  );
};

export default AdminWorkers;
