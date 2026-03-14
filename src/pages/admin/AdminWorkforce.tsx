import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAdminRole } from "@/hooks/useAdminRole";
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
  customer: { name: string } | null;
  worker?: { _id: string; name: string } | null;
  service: { name: string } | null;
  location: Location | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
}

const AdminWorkforce = () => {
  const { role, name } = useAdminRole();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, free: 0, working: 0, onLeave: 0, offline: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [unassignedBookings, setUnassignedBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [noRegionAssigned, setNoRegionAssigned] = useState(false);

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
      setNoRegionAssigned(!!workforceRes.noRegionAssigned);
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
        return <Badge className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold shadow-sm">Free</Badge>;
      case 'working':
        return <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-sm">Working</Badge>;
      case 'scheduled':
        return <Badge className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-semibold shadow-sm">Scheduled</Badge>;
      case 'on-leave':
        return <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold shadow-sm">On Leave</Badge>;
      case 'offline':
        return <Badge className="bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white font-semibold shadow-sm">Offline</Badge>;
      default:
        return <Badge variant="outline" className="font-semibold">{status}</Badge>;
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
      <AppLayout userType={role} userName={name}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground font-medium">Loading workforce data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType={role} userName={name}>
      <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20 md:pb-0">
        {/* Header with gradient */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl -z-10"></div>
          <div className="p-6">
            <h1 className="text-3xl font-bold font-heading text-foreground mb-2">Workforce Status</h1>
            <p className="text-muted-foreground">Real-time worker availability and assignments</p>
          </div>
        </div>

        {/* Summary Cards - Enhanced with gradients */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <Users className="w-8 h-8 text-slate-600" />
              <div className="w-10 h-10 bg-slate-200/50 rounded-full"></div>
            </div>
            <p className="text-sm font-medium text-slate-700 mb-1">Total Workers</p>
            <p className="text-3xl font-bold text-slate-900">{summary.total}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <UserCheck className="w-8 h-8 text-green-600" />
              <div className="w-10 h-10 bg-green-200/50 rounded-full"></div>
            </div>
            <p className="text-sm font-medium text-green-700 mb-1">Available</p>
            <p className="text-3xl font-bold text-green-900">{summary.free}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <Clock className="w-8 h-8 text-blue-600" />
              <div className="w-10 h-10 bg-blue-200/50 rounded-full"></div>
            </div>
            <p className="text-sm font-medium text-blue-700 mb-1">Working</p>
            <p className="text-3xl font-bold text-blue-900">{summary.working}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border border-purple-200 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <Calendar className="w-8 h-8 text-purple-600" />
              <div className="w-10 h-10 bg-purple-200/50 rounded-full"></div>
            </div>
            <p className="text-sm font-medium text-purple-700 mb-1">On Leave</p>
            <p className="text-3xl font-bold text-purple-900">{summary.onLeave}</p>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <UserX className="w-8 h-8 text-gray-600" />
              <div className="w-10 h-10 bg-gray-200/50 rounded-full"></div>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">Offline</p>
            <p className="text-3xl font-bold text-gray-900">{summary.offline}</p>
          </div>
        </div>

        {/* Unassigned Bookings Alert - Enhanced */}
        {unassignedBookings.length > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl shadow-md overflow-hidden">
            <div className="p-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1">⚠️ Unassigned Bookings</h3>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-orange-600">{unassignedBookings.length}</span> booking(s) need worker assignment
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAssignModal(true)}
                className="px-6 py-3 font-semibold rounded-xl bg-gradient-to-r from-primary to-primary/90 text-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
              >
                Assign Workers
              </button>
            </div>
          </div>
        )}

        {/* Filters - Enhanced */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input 
              className="w-full pl-12 pr-4 py-3.5 text-sm bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all" 
              placeholder="Search by name, email, or skill..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          <select 
            className="px-4 py-3.5 text-sm font-medium bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all sm:w-48" 
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

        {/* Workers List - Enhanced */}
        <div className="space-y-4">
          {noRegionAssigned ? (
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-dashed border-slate-200 rounded-2xl text-center py-16">
              <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No Region Assigned</h3>
              <p className="text-muted-foreground">Contact your super admin to assign you to a location region.</p>
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-dashed border-slate-200 rounded-2xl text-center py-16">
              <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No Workers Found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filters.</p>
            </div>
          ) : (
            filteredWorkers.map((worker) => (
              <div key={worker._id} className="bg-white rounded-2xl border-2 border-gray-100 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center flex-shrink-0 shadow-md">
                        <User className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-foreground truncate">{worker.name}</h3>
                          {getStatusBadge(worker.status)}
                        </div>
                        <div className="space-y-1 mb-3">
                          <p className="text-sm text-muted-foreground">{worker.email}</p>
                          {worker.phone && (
                            <p className="text-sm text-muted-foreground">{worker.phone}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <div className="flex items-center gap-1.5 bg-yellow-50 px-3 py-1.5 rounded-lg">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            <span className="font-semibold text-yellow-700">{worker.rating.toFixed(1)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg">
                            <span className="font-semibold text-blue-700">{worker.completedJobs}</span>
                            <span className="text-blue-600 text-xs">jobs</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {worker.specialization.map((skill, idx) => (
                              <span key={idx} className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-primary/10 to-primary/20 text-primary border border-primary/20">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 bg-slate-50 px-4 py-3 rounded-xl">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Current Status</p>
                      <p className="text-sm font-bold text-foreground">{worker.statusDetail}</p>
                    </div>
                  </div>

                  {/* Current Task - Enhanced */}
                  {worker.currentTask && (
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-4">
                      <p className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Clock className="w-4 h-4 text-blue-600" />
                        </div>
                        Current Assignment
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div className="bg-white/60 px-3 py-2 rounded-lg">
                          <span className="text-blue-700 font-semibold block mb-1">Customer</span>
                          <span className="text-blue-900">{worker.currentTask.customer}</span>
                        </div>
                        <div className="bg-white/60 px-3 py-2 rounded-lg">
                          <span className="text-blue-700 font-semibold block mb-1">Service</span>
                          <span className="text-blue-900">{worker.currentTask.service}</span>
                        </div>
                        <div className="bg-white/60 px-3 py-2 rounded-lg">
                          <span className="text-blue-700 font-semibold block mb-1">Time</span>
                          <span className="text-blue-900">{formatTime(worker.currentTask.startTime)} - {formatTime(worker.currentTask.endTime)}</span>
                        </div>
                        {worker.currentTask.location && (
                          <div className="md:col-span-3 bg-white/60 px-3 py-2 rounded-lg flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="text-blue-700 font-semibold block mb-1">Location</span>
                              <span className="text-blue-900">{worker.currentTask.location.apartmentName}, {worker.currentTask.location.area}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Today's Schedule - Enhanced */}
                  {worker.todayBookings.length > 0 && (
                    <div className="border-t-2 border-gray-100 pt-4">
                      <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        Today's Schedule ({worker.todayBookings.length})
                      </p>
                      <div className="space-y-2">
                        {worker.todayBookings.map((booking, idx) => (
                          <div key={idx} className="bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200 rounded-xl p-3 text-sm flex items-center justify-between hover:shadow-md transition-shadow">
                            <div className="flex-1">
                              <span className="font-semibold text-foreground">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</span>
                              <span className="text-muted-foreground mx-2">•</span>
                              <span className="text-foreground">{booking.service}</span>
                            </div>
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm ${
                              booking.status === 'in-progress' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 
                              booking.status === 'confirmed' ? 'bg-green-100 text-green-800 border border-green-200' : 
                              'bg-gray-100 text-gray-800 border border-gray-200'
                            }`}>
                              {booking.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assigned Locations - Enhanced */}
                  {worker.assignedApartments.length > 0 && (
                    <div className="border-t-2 border-gray-100 pt-4">
                      <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        Assigned Locations
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {worker.assignedApartments.map((apt, idx) => (
                          <div key={idx} className="inline-flex items-center gap-1.5 text-xs bg-gradient-to-r from-slate-100 to-gray-100 border border-slate-200 px-3 py-2 rounded-lg font-medium hover:shadow-md transition-shadow">
                            <MapPin className="w-3.5 h-3.5 text-primary" />
                            <span>{apt.apartmentName}, {apt.area}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Manual Assignment Modal - Enhanced */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b-2 border-gray-100 bg-gradient-to-r from-primary/5 to-transparent">
                <h2 className="text-2xl font-bold text-foreground mb-1">Manual Worker Assignment</h2>
                <p className="text-sm text-muted-foreground">Select a booking and assign an available worker</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Clock className="w-4 h-4 text-orange-600" />
                      </div>
                      Unassigned Bookings
                    </h3>
                    <div className="space-y-3">
                      {unassignedBookings.map((booking) => (
                        <div 
                          key={booking._id}
                          onClick={() => setSelectedBooking(booking._id)}
                          className={`p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                            selectedBooking === booking._id 
                              ? 'border-primary bg-gradient-to-r from-primary/10 to-primary/5 shadow-md' 
                              : 'border-gray-200 hover:border-primary/50 hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="font-bold text-foreground">{booking.customer?.name || 'Unknown Customer'}</p>
                              <p className="text-sm text-muted-foreground font-medium">{booking.service?.name || 'Unknown Service'}</p>
                              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                              </p>
                            </div>
                            {selectedBooking === booking._id && (
                              <div className="bg-primary text-white font-bold px-4 py-2 rounded-lg shadow-md">Selected ✓</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedBooking && (
                    <div>
                      <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                          <UserCheck className="w-4 h-4 text-green-600" />
                        </div>
                        Available Workers
                      </h3>
                      <div className="space-y-3">
                        {workers.filter(w => w.status === 'free').map((worker) => (
                          <div 
                            key={worker._id}
                            className="p-5 border-2 border-gray-200 rounded-xl flex items-center justify-between hover:border-primary/50 hover:shadow-md transition-all duration-200"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
                                <User className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                <p className="font-bold text-foreground">{worker.name}</p>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                  <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded">
                                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                                    <span className="font-semibold text-yellow-700">{worker.rating.toFixed(1)}</span>
                                  </div>
                                  <span>•</span>
                                  <span className="font-medium">{worker.completedJobs} jobs</span>
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleManualAssign(worker._id)}
                              className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-primary to-primary/90 text-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                            >
                              Assign Worker
                            </button>
                          </div>
                        ))}
                        {workers.filter(w => w.status === 'free').length === 0 && (
                          <div className="text-center py-12 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border-2 border-dashed border-slate-200">
                            <UserX className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                            <p className="text-slate-600 font-medium">No available workers at the moment</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t-2 border-gray-100 flex justify-end gap-3 bg-gradient-to-r from-slate-50/50 to-transparent">
                <button 
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedBooking(null);
                  }}
                  className="px-6 py-2.5 text-sm font-semibold rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 transition-all duration-200 hover:shadow-md"
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
