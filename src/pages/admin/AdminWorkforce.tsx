import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { adminAPI, bookingsAPI } from "@/lib/api";
import { Calendar, Clock, MapPin, Search, Star, User, UserCheck, UserX, Users } from "lucide-react";
import { useEffect, useState } from "react";

interface Location {
  apartmentName: string;
  area: string;
  city: string;
}

interface Apartment {
  apartmentName: string;
  area: string;
  city: string;
}

interface WorkerTask {
  bookingId: string;
  customer: string;
  service: string;
  location: Location;
  startTime: string;
  endTime: string;
  status: string;
}

interface Worker {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  specialization: string[];
  rating: number;
  completedJobs: number;
  assignedApartments: Apartment[];
  availability: boolean;
  status: 'free' | 'working' | 'scheduled' | 'on-leave' | 'offline';
  statusDetail: string;
  currentTask: WorkerTask | null;
  todayBookings: WorkerTask[];
  onLeave: boolean;
}

interface Summary {
  total: number;
  free: number;
  working: number;
  onLeave: number;
  offline: number;
}

interface Booking {
  _id: string;
  customer: { name: string };
  worker?: { _id: string; name: string };
  service: { name: string };
  location: Location;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
}

const AdminWorkforce = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, free: 0, working: 0, onLeave: 0, offline: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [unassignedBookings, setUnassignedBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [workforceRes, bookingsRes] = await Promise.all([
        adminAPI.getWorkforceStatus(),
        bookingsAPI.getAll({ status: 'pending' })
      ]);
      
      setWorkers(workforceRes.workers || []);
      setSummary(workforceRes.summary || { total: 0, free: 0, working: 0, onLeave: 0, offline: 0 });
      setUnassignedBookings((bookingsRes.bookings || []).filter((b: Booking) => !b.worker));
    } catch (error) {
      console.error('Error fetching workforce data:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch workforce data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualAssign = async (workerId: string) => {
    if (!selectedBooking) return;

    try {
      await adminAPI.manualAssign(selectedBooking, workerId);
      toast({
        title: "Success",
        description: "Worker assigned successfully",
        variant: "default"
      });
      setShowAssignModal(false);
      setSelectedBooking(null);
      fetchData();
    } catch (error) {
      console.error('Error assigning worker:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign worker",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'free':
        return <Badge className="bg-green-500 hover:bg-green-600">Free</Badge>;
      case 'working':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Working</Badge>;
      case 'scheduled':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Scheduled</Badge>;
      case 'on-leave':
        return <Badge className="bg-purple-500 hover:bg-purple-600">On Leave</Badge>;
      case 'offline':
        return <Badge variant="secondary">Offline</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredWorkers = workers.filter((w) => {
    const matchSearch = w.name.toLowerCase().includes(search.toLowerCase()) ||
                       w.email.toLowerCase().includes(search.toLowerCase()) ||
                       w.specialization.some(s => s.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = statusFilter === 'all' || w.status === statusFilter;
    return matchSearch && matchFilter;
  });

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <AppLayout userType="admin" userName="Admin Team">
        <div className="text-center py-12">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading workforce data...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="admin" userName="Admin Team">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Workforce Status</h1>
            <p className="text-muted-foreground text-sm mt-1">Real-time worker availability and assignments</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card-elevated">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="w-4 h-4" />
              <span>Total Workers</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{summary.total}</p>
          </div>
          <div className="card-elevated">
            <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
              <UserCheck className="w-4 h-4" />
              <span>Available</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{summary.free}</p>
          </div>
          <div className="card-elevated">
            <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
              <Clock className="w-4 h-4" />
              <span>Working</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{summary.working}</p>
          </div>
          <div className="card-elevated">
            <div className="flex items-center gap-2 text-purple-600 text-sm mb-1">
              <Calendar className="w-4 h-4" />
              <span>On Leave</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{summary.onLeave}</p>
          </div>
          <div className="card-elevated">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <UserX className="w-4 h-4" />
              <span>Offline</span>
            </div>
            <p className="text-2xl font-bold text-muted-foreground">{summary.offline}</p>
          </div>
        </div>

        {/* Unassigned Bookings Alert */}
        {unassignedBookings.length > 0 && (
          <div className="card-elevated bg-orange-50 border-orange-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-foreground mb-1">⚠️ Unassigned Bookings</h3>
                <p className="text-sm text-muted-foreground">
                  {unassignedBookings.length} booking(s) need worker assignment
                </p>
              </div>
              <button 
                onClick={() => setShowAssignModal(true)}
                className="btn-brand text-sm px-4 py-2"
              >
                Assign Workers
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              className="input-clean pl-10" 
              placeholder="Search by name, email, or skill..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          <select 
            className="input-clean sm:w-48" 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="free">Available</option>
            <option value="working">Working</option>
            <option value="scheduled">Scheduled</option>
            <option value="on-leave">On Leave</option>
            <option value="offline">Offline</option>
          </select>
        </div>

        {/* Workers List */}
        <div className="space-y-3">
          {filteredWorkers.length === 0 ? (
            <div className="card-elevated text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Workers Found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filters.</p>
            </div>
          ) : (
            filteredWorkers.map((worker) => (
              <div key={worker._id} className="card-elevated space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate">{worker.name}</h3>
                        {getStatusBadge(worker.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{worker.email}</p>
                      {worker.phone && (
                        <p className="text-sm text-muted-foreground mb-2">{worker.phone}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-medium">{worker.rating.toFixed(1)}</span>
                        </div>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">{worker.completedJobs} jobs</span>
                        <span className="text-muted-foreground">•</span>
                        <div className="flex flex-wrap gap-1">
                          {worker.specialization.map((skill, idx) => (
                            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                    <p className="text-sm font-semibold text-foreground">{worker.statusDetail}</p>
                  </div>
                </div>

                {/* Current Task */}
                {worker.currentTask && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-blue-900 mb-2">Current Assignment</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-blue-700">Customer:</span> {worker.currentTask.customer}
                      </div>
                      <div>
                        <span className="text-blue-700">Service:</span> {worker.currentTask.service}
                      </div>
                      <div>
                        <span className="text-blue-700">Time:</span> {formatTime(worker.currentTask.startTime)} - {formatTime(worker.currentTask.endTime)}
                      </div>
                      {worker.currentTask.location && (
                        <div className="md:col-span-3 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-blue-700" />
                          <span className="text-blue-700">Location:</span>
                          <span>{worker.currentTask.location.apartmentName}, {worker.currentTask.location.area}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Today's Schedule */}
                {worker.todayBookings.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <p className="text-sm font-semibold text-foreground mb-2">Today's Schedule ({worker.todayBookings.length})</p>
                    <div className="space-y-2">
                      {worker.todayBookings.map((booking, idx) => (
                        <div key={idx} className="bg-muted/30 rounded p-2 text-sm flex items-center justify-between">
                          <div className="flex-1">
                            <span className="font-medium">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</span>
                            <span className="text-muted-foreground mx-2">•</span>
                            <span>{booking.service}</span>
                          </div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                            booking.status === 'in-progress' ? 'bg-blue-100 text-blue-800' : 
                            booking.status === 'confirmed' ? 'bg-green-100 text-green-800' : 
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assigned Locations */}
                {worker.assignedApartments.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <p className="text-sm font-semibold text-foreground mb-2">Assigned Locations</p>
                    <div className="flex flex-wrap gap-2">
                      {worker.assignedApartments.map((apt, idx) => (
                        <div key={idx} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
                          <MapPin className="w-3 h-3" />
                          <span>{apt.apartmentName}, {apt.area}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Manual Assignment Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-bold text-foreground">Manual Worker Assignment</h2>
                <p className="text-sm text-muted-foreground mt-1">Select a booking and assign an available worker</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground mb-3">Unassigned Bookings</h3>
                    <div className="space-y-2">
                      {unassignedBookings.map((booking) => (
                        <div 
                          key={booking._id}
                          onClick={() => setSelectedBooking(booking._id)}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedBooking === booking._id 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{booking.customer.name}</p>
                              <p className="text-sm text-muted-foreground">{booking.service.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                              </p>
                            </div>
                            {selectedBooking === booking._id && (
                              <div className="text-primary font-semibold">Selected ✓</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedBooking && (
                    <div>
                      <h3 className="font-semibold text-foreground mb-3">Available Workers</h3>
                      <div className="space-y-2">
                        {workers.filter(w => w.status === 'free').map((worker) => (
                          <div 
                            key={worker._id}
                            className="p-4 border border-border rounded-lg flex items-center justify-between hover:border-primary/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{worker.name}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                  <span>{worker.rating.toFixed(1)}</span>
                                  <span>•</span>
                                  <span>{worker.completedJobs} jobs</span>
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleManualAssign(worker._id)}
                              className="btn-brand px-4 py-2 text-sm"
                            >
                              Assign
                            </button>
                          </div>
                        ))}
                        {workers.filter(w => w.status === 'free').length === 0 && (
                          <p className="text-center text-muted-foreground py-8">
                            No available workers at the moment
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-border flex justify-end gap-3">
                <button 
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedBooking(null);
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminWorkforce;
