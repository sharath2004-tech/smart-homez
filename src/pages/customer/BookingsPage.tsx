import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { bookingsAPI } from "@/lib/api";
import { Calendar, Clock, MapPin, Phone, QrCode, RefreshCw, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import BookingDetailModal from "./BookingDetailModal";

interface Worker {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  rating?: number;
  gender?: string;
  religion?: string;
  workerProfile?: {
    experience?: number;
    languages?: string[];
    rating?: number;
  };
}

interface Service {
  _id: string;
  name: string;
  category: string;
}

interface Location {
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

interface Booking {
  _id: string;
  service: Service;
  worker?: Worker;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  totalAmount: number;
  location?: Location;
  paymentStatus?: string;
  createdAt: string;
  serviceStartQRCode?: string;
  actualStartTime?: string;
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending", bg: "bg-yellow-100", text: "text-yellow-800" },
  confirmed: { label: "Confirmed", bg: "bg-blue-100", text: "text-blue-800" },
  "in-progress": { label: "In Progress", bg: "bg-purple-100", text: "text-purple-800" },
  completed: { label: "Completed", bg: "bg-green-100", text: "text-green-800" },
  cancelled: { label: "Cancelled", bg: "bg-red-100", text: "text-red-800" },
};

const BookingsPage = () => {
  const [activeTab, setActiveTab] = useState<"upcoming" | "ongoing" | "past">("upcoming");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const fetchBookings = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setRefreshing(true);
      
      let response;
      if (activeTab === 'upcoming') {
        response = await bookingsAPI.getUpcoming();
      } else if (activeTab === 'ongoing') {
        response = await bookingsAPI.getOngoing();
      } else {
        response = await bookingsAPI.getPast();
      }
      setBookings(response.bookings || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchBookings();
    
    // Auto-refresh bookings every 15 seconds for real-time updates
    const intervalId = setInterval(() => {
      fetchBookings(true); // Silent refresh
    }, 15000);

    return () => clearInterval(intervalId);
  }, [activeTab, fetchBookings]);

  const handleManualRefresh = () => {
    fetchBookings();
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
      await bookingsAPI.update(bookingId, { status: 'cancelled' });
      await fetchBookings();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Failed to cancel booking. Please try again.');
    }
  };

  const handleReschedule = async (bookingId: string) => {
    const newDate = prompt('Enter new date (YYYY-MM-DD):');
    const newTime = prompt('Enter new time (HH:MM):');
    
    if (!newDate || !newTime) return;

    try {
      await bookingsAPI.update(bookingId, {
        bookingDate: newDate,
        startTime: newTime
      });
      await fetchBookings();
      alert('Booking rescheduled successfully!');
    } catch (error) {
      console.error('Error rescheduling booking:', error);
      alert('Failed to reschedule booking. Please try again.');
    }
  };

  const handleTrackWorker = (booking: Booking) => {
    if (!booking.worker) {
      alert('Worker not yet assigned to this booking.');
      return;
    }
    
    // In a real app, this would open a map view showing worker's real-time location
    alert(`Tracking ${booking.worker.name}. Real-time tracking coming soon!`);
  };

  const handleContactWorker = (worker: Worker) => {
    if (!worker.phone) {
      alert('Worker phone number not available.');
      return;
    }
    window.open(`tel:${worker.phone}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStatusInfo = (status: string) => {
    return statusConfig[status] || statusConfig.pending;
  };

  return (
    <AppLayout userType="customer" userName="Customer">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">
        {/* Header */}
        <div className="card-elevated p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold font-heading text-foreground mb-1">My Bookings</h1>
              <p className="text-sm text-muted-foreground">Track and manage your service bookings</p>
            </div>
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Refresh bookings"
            >
              <RefreshCw className={`w-5 h-5 text-primary ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {lastRefresh && (
            <p className="text-xs text-muted-foreground mt-2">
              Last updated: {lastRefresh.toLocaleTimeString()} • Auto-refreshes every 15s
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="card-elevated p-1.5 flex gap-1">
          {(["upcoming", "ongoing", "past"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold capitalize transition-all ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Helpful instruction for upcoming bookings */}
        {activeTab === 'upcoming' && bookings.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <QrCode className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Tap any booking to view details and scan QR code</p>
              <p className="text-xs text-blue-700 mt-1">When your worker arrives, tap the booking and scan their QR code to start the service timer.</p>
            </div>
          </div>
        )}

        {/* Bookings List */}
        <div className="space-y-4">
          {loading ? (
            <div className="card-elevated p-12 text-center">
              <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-4">Loading bookings...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="card-elevated p-12 text-center">
              <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-bold text-foreground mb-2">No {activeTab} bookings</h3>
              <p className="text-sm text-muted-foreground">
                {activeTab === "upcoming" && "Book a service to get started!"}
                {activeTab === "ongoing" && "No services currently in progress."}
                {activeTab === "past" && "Your completed bookings will appear here."}
              </p>
            </div>
          ) : (
            bookings.map((booking) => {
              const statusInfo = getStatusInfo(booking.status);
              const isUpcoming = activeTab === "upcoming";
              const isOngoing = activeTab === "ongoing";
              const isPast = activeTab === "past";

              return (
                <div 
                  key={booking._id} 
                  className="card-elevated p-5 space-y-4 cursor-pointer hover:shadow-lg transition-shadow relative"
                  onClick={() => setSelectedBookingId(booking._id)}
                >
                  {/* Ready to Start Indicator */}
                  {booking.status === 'confirmed' && booking.serviceStartQRCode && !booking.actualStartTime && (
                    <div className="absolute top-3 right-3 px-3 py-1 bg-teal-500 text-white text-xs font-semibold rounded-full animate-pulse">
                      👆 Tap to scan QR
                    </div>
                  )}
                  
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold font-heading text-foreground mb-1">
                        {booking.service.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Booking ID: {booking._id.slice(-8)}
                      </p>
                    </div>
                    <Badge className={`${statusInfo.bg} ${statusInfo.text} border-0`}>
                      {statusInfo.label}
                    </Badge>
                  </div>

                  {/* Date & Time */}
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-foreground">{formatDate(booking.bookingDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="text-foreground">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</span>
                    </div>
                  </div>

                  {/* Address */}
                  {booking.location && (
                    <div className="flex items-start gap-2 p-3 bg-muted rounded-xl">
                      <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground">
                        {[booking.location.address, booking.location.city, booking.location.state, booking.location.zipCode]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>
                  )}

                  {/* Worker Info */}
                  {booking.worker ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-primary-light rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-bold">
                            {booking.worker.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{booking.worker.name}</p>
                            {(booking.worker.rating || booking.worker.workerProfile?.rating) && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Star className="w-3 h-3 fill-warning text-warning" />
                                <span className="text-xs text-muted-foreground">
                                  {(booking.worker.workerProfile?.rating || booking.worker.rating)?.toFixed(1)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        {isOngoing && booking.worker.phone && (
                          <button
                            onClick={() => handleContactWorker(booking.worker!)}
                            className="p-2 bg-primary rounded-lg text-primary-foreground hover:bg-primary/90 transition-colors"
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      {/* Worker Details */}
                      <div className="p-3 bg-muted/50 rounded-xl space-y-2 text-xs">
                        {booking.worker.email && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Email:</span>
                            <span className="text-foreground font-medium">{booking.worker.email}</span>
                          </div>
                        )}
                        {booking.worker.phone && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Phone:</span>
                            <span className="text-foreground font-medium">{booking.worker.phone}</span>
                          </div>
                        )}
                        {booking.worker.workerProfile?.experience && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Experience:</span>
                            <span className="text-foreground font-medium">{booking.worker.workerProfile.experience} years</span>
                          </div>
                        )}
                        {booking.worker.workerProfile?.languages && booking.worker.workerProfile.languages.length > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Languages:</span>
                            <span className="text-foreground font-medium">{booking.worker.workerProfile.languages.join(', ')}</span>
                          </div>
                        )}
                        {booking.worker.religion && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Religion:</span>
                            <span className="text-foreground font-medium capitalize">{booking.worker.religion}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-muted rounded-xl text-sm text-muted-foreground text-center">
                      Worker will be assigned soon
                    </div>
                  )}

                  {/* Price */}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="text-sm text-muted-foreground">Total Amount</span>
                    <span className="text-lg font-bold text-primary">₹{booking.totalAmount}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    {isUpcoming && booking.status !== 'cancelled' && (
                      <>
                        <button
                          onClick={() => handleReschedule(booking._id)}
                          className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleCancelBooking(booking._id)}
                          disabled={booking.status === 'confirmed' || booking.status === 'in-progress'}
                          className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={booking.status === 'confirmed' || booking.status === 'in-progress' ? 'Cannot cancel confirmed or ongoing services' : ''}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    
                    {isOngoing && (
                      <button
                        onClick={() => handleTrackWorker(booking)}
                        className="flex-1 btn-brand py-2.5 text-sm"
                      >
                        Track Worker
                      </button>
                    )}
                    
                    {isPast && booking.status === 'completed' && (
                      <button
                        onClick={() => alert('Review feature coming soon!')}
                        className="flex-1 btn-brand py-2.5 text-sm"
                      >
                        Write Review
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Booking Detail Modal */}
      {selectedBookingId && (
        <BookingDetailModal
          bookingId={selectedBookingId}
          onClose={() => setSelectedBookingId(null)}
          onRefresh={fetchBookings}
        />
      )}
    </AppLayout>
  );
};

export default BookingsPage;
