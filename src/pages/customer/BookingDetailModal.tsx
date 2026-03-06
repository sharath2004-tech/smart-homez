import EmbeddedQRScanner from "@/components/EmbeddedQRScanner";
import { bookingsAPI } from "@/lib/api";
import { ArrowLeft, Calendar, Camera, CheckCircle, DollarSign, Phone, QrCode, Timer, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReviewModal from "./ReviewModal";

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
  _id: string;
  address?: string;
  apartment?: string;
  building?: string;
  area?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

interface Booking {
  _id: string;
  service: Service;
  worker?: Worker;
  customer: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  location: Location;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  totalAmount: number;
  actualStartTime?: string;
  actualEndTime?: string;
  serviceStartQRCode?: string;
  serviceEndQRCode?: string;
  overtimeCharges?: number;
  rating?: number;
  review?: string;
  paymentStatus?: string;
  completionPhoto?: {
    url: string;
    timestamp: string;
    verified: boolean;
  };
}

interface BookingDetailModalProps {
  bookingId: string;
  onClose: () => void;
  onRefresh: () => void;
}

const BookingDetailModal = ({ bookingId, onClose, onRefresh }: BookingDetailModalProps) => {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showEndScanner, setShowEndScanner] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [overtimeMinutes, setOvertimeMinutes] = useState(0);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [endingService, setEndingService] = useState(false);
  const OVERTIME_RATE = 2.5; // ₹2.5 per minute

  // Use refs to persist values across renders
  const timeOffsetRef = useRef<number>(0);
  const offsetCalculatedRef = useRef<boolean>(false);
  const actualStartTimeRef = useRef<string | null>(null);

  const fetchBookingDetail = useCallback(async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await bookingsAPI.getById(bookingId);
      setBooking(response.booking);
    } catch (error) {
      console.error('Error fetching booking detail:', error);
      if (!silent) alert('Failed to load booking details');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchBookingDetail(false); // Initial load with loading spinner
    
    // Auto-refresh every 5 seconds for real-time updates (silent refresh)
    const interval = setInterval(() => {
      fetchBookingDetail(true); // Silent refresh without loading spinner
    }, 5000);
    
    return () => clearInterval(interval);
  }, [fetchBookingDetail]);

  // Timer for active bookings
  useEffect(() => {
    if (booking?.status === 'in-progress' && booking.actualStartTime) {
      // Only calculate offset once when actualStartTime first appears or changes
      if (booking.actualStartTime !== actualStartTimeRef.current) {
        actualStartTimeRef.current = booking.actualStartTime;
        offsetCalculatedRef.current = false;
      }
      
      if (!offsetCalculatedRef.current) {
        const startTime = new Date(booking.actualStartTime!).getTime();
        const initialNow = Date.now();
        const initialElapsed = Math.floor((initialNow - startTime) / 1000);
        
        // If time is significantly negative (more than 5 minutes), likely a timezone issue
        timeOffsetRef.current = initialElapsed < -300 ? -initialElapsed : 0;
        offsetCalculatedRef.current = true;
        
        // Only show info in development
        if (timeOffsetRef.current > 0 && import.meta.env.DEV) {
          console.info('Timer adjusted for timezone offset:', timeOffsetRef.current, 'seconds');
        }
      }
      
      const interval = setInterval(() => {
        const start = new Date(booking.actualStartTime!).getTime();
        const now = Date.now();
        const rawElapsed = Math.floor((now - start) / 1000);
        const elapsed = Math.max(0, rawElapsed + timeOffsetRef.current);
        
        setElapsedTime(elapsed);

        // Calculate overtime
        const scheduledEnd = new Date(`${booking.bookingDate}T${booking.endTime}`).getTime();
        if (now > scheduledEnd) {
          const overtimeMs = now - scheduledEnd;
          const overtimeMins = Math.ceil(overtimeMs / 60000);
          setOvertimeMinutes(Math.max(0, overtimeMins));
        } else {
          setOvertimeMinutes(0);
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      // Reset timers when booking is not in progress
      setElapsedTime(0);
      setOvertimeMinutes(0);
      actualStartTimeRef.current = null;
      offsetCalculatedRef.current = false;
      timeOffsetRef.current = 0;
    }
  }, [booking?.status, booking?.actualStartTime, booking?.bookingDate, booking?.endTime]);

  const handleScanStartQR = useCallback(async (qrCode: string) => {
    try {
      const response = await bookingsAPI.scanStartQR(bookingId, qrCode, true);
      alert('Service started successfully! Timer has begun.');
      setShowScanner(false);
      fetchBookingDetail();
      onRefresh();
    } catch (error) {
      console.error('Error scanning QR:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to scan QR code';
      alert(errorMessage);
      setShowScanner(false);
    }
  }, [bookingId, fetchBookingDetail, onRefresh]);

  const handleScanEndQR = useCallback(async (qrCode: string) => {
    try {
      const response = await bookingsAPI.scanEndQR(bookingId, qrCode);
      const result = response.booking;
      
      let message = 'Service completed successfully!';
      if (result.overtimeMinutes > 0) {
        message += `\n\nOvertime: ${result.overtimeMinutes} minutes\nOvertime Charge: ₹${result.overtimeCharges.toFixed(2)}\nTotal Amount: ₹${result.totalAmount.toFixed(2)}`;
      }
      
      alert(message);
      setShowEndScanner(false);
      fetchBookingDetail();
      onRefresh();
    } catch (error) {
      console.error('Error scanning end QR:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to end service';
      alert(errorMessage);
      setShowEndScanner(false);
    }
  }, [bookingId, fetchBookingDetail, onRefresh]);

  const handleDirectEndService = useCallback(async () => {
    if (!confirm('Are you sure you want to end the service now?\n\nNote: If worker has generated an end QR code, it\'s better to scan it for verification.')) {
      return;
    }

    try {
      setEndingService(true);
      // Generate end QR automatically if worker hasn't done it yet
      let endQRCode = booking?.serviceEndQRCode;
      
      if (!endQRCode) {
        // If worker hasn't generated end QR, we'll create one automatically
        endQRCode = `END-${bookingId}-${Date.now()}-AUTO`;
      }
      
      const response = await bookingsAPI.scanEndQR(bookingId, endQRCode);
      const result = response.booking;
      
      let message = '✅ Service completed successfully!';
      if (result.overtimeMinutes > 0) {
        message += `\n\n⏰ Overtime: ${result.overtimeMinutes} minutes\n💰 Overtime Charge: ₹${result.overtimeCharges.toFixed(2)}\n💵 Total Amount: ₹${result.totalAmount.toFixed(2)}`;
      } else {
        message += `\n\n💵 Total Amount: ₹${result.totalAmount.toFixed(2)}`;
      }
      
      alert(message);
      fetchBookingDetail();
      onRefresh();
    } catch (error) {
      console.error('Error ending service:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to end service';
      alert(errorMessage);
    } finally {
      setEndingService(false);
    }
  }, [bookingId, booking?.serviceEndQRCode, fetchBookingDetail, onRefresh]);

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatElapsedTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      weekday: 'short',
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const calculateTotalAmount = () => {
    if (!booking) return 0;
    const baseAmount = booking.totalAmount;
    const overtimeAmount = overtimeMinutes > 0 ? overtimeMinutes * OVERTIME_RATE : 0;
    return baseAmount + overtimeAmount;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-center mt-4 text-muted-foreground">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (!booking) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-screen p-4 flex items-start justify-center py-8">
        <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-primary text-primary-foreground p-6 rounded-t-2xl flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h2 className="text-xl font-bold">Booking Details</h2>
              <p className="text-sm opacity-90">ID: {booking._id.slice(-8)}</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Service Info */}
            <div className="bg-primary-light p-4 rounded-xl">
              <h3 className="text-lg font-bold text-foreground mb-1">{booking.service.name}</h3>
              <p className="text-sm text-muted-foreground capitalize">{booking.service.category}</p>
            </div>

            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                booking.status === 'in-progress' ? 'bg-purple-100 text-purple-800' :
                booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {booking.status === 'in-progress' ? 'In Progress' : booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
              </span>
            </div>

            {/* Schedule Section */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Schedule
              </h3>
              <div className="bg-muted p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium text-foreground">{formatDate(booking.bookingDate)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Time Slot</span>
                  <span className="font-medium text-foreground">
                    {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                  </span>
                </div>
              </div>
            </div>

            {/* Worker Info */}
            {booking.worker && (
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Worker Details
                </h3>
                <div className="bg-muted p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                      {booking.worker.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{booking.worker.name}</p>
                      {booking.worker.email && (
                        <p className="text-sm text-muted-foreground">{booking.worker.email}</p>
                      )}
                    </div>
                  </div>
                  {booking.worker.phone && (
                    <a
                      href={`tel:${booking.worker.phone}`}
                      className="flex items-center gap-2 p-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      <span className="text-sm font-medium">{booking.worker.phone}</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* QR Code Scanner Section */}
            {booking.status === 'confirmed' && booking.serviceStartQRCode && !booking.actualStartTime && (
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-primary" />
                  Service Start QR Code
                </h3>
                <div className="bg-teal-50 border-2 border-teal-200 p-4 rounded-xl text-center space-y-3">
                  <p className="text-sm text-muted-foreground mb-3">
                    When worker arrives, scan their QR code to start the service and timer
                  </p>
                  <button
                    onClick={() => setShowScanner(true)}
                    className="btn-brand w-full py-3 flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-5 h-5" />
                    Scan Worker's QR Code
                  </button>
                </div>
              </div>
            )}

            {/* Active Timer Section */}
            {booking.status === 'in-progress' && booking.actualStartTime && (
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Timer className="w-5 h-5 text-primary" />
                  Service In Progress
                </h3>
                <div className="bg-purple-50 border-2 border-purple-200 p-6 rounded-xl text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Elapsed Time</p>
                  <p className="text-4xl font-bold text-purple-600 font-mono">
                    {formatElapsedTime(elapsedTime)}
                  </p>
                  {overtimeMinutes > 0 && (
                    <div className="mt-4 p-3 bg-orange-100 border border-orange-300 rounded-lg">
                      <p className="text-sm font-semibold text-orange-800">
                        ⚠️ Overtime: {overtimeMinutes} minutes
                      </p>
                      <p className="text-xs text-orange-700 mt-1">
                        Additional ₹{(overtimeMinutes * OVERTIME_RATE).toFixed(2)} will be charged
                      </p>
                    </div>
                  )}
                </div>

                {/* End Service Options */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 p-4 rounded-xl space-y-3">
                  <h4 className="font-semibold text-green-800 text-center flex items-center justify-center gap-2">
                    <QrCode className="w-5 h-5" />
                    End Service Options
                  </h4>
                  
                  <p className="text-xs text-green-700 text-center">
                    Choose how you want to end the service:
                  </p>

                  {/* Option 1: Scan Worker's End QR */}
                  <button
                    onClick={() => setShowEndScanner(true)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-5 h-5" />
                    Scan Worker's End QR Code
                  </button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-green-300"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-gradient-to-br from-green-50 to-emerald-50 px-2 text-green-600">OR</span>
                    </div>
                  </div>

                  {/* Option 2: Direct End Service */}
                  <button
                    onClick={handleDirectEndService}
                    disabled={endingService}
                    className="w-full bg-white hover:bg-green-50 text-green-700 font-semibold py-3 px-4 rounded-lg border-2 border-green-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {endingService ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                        Ending Service...
                      </>
                    ) : (
                      <>
                        <Timer className="w-5 h-5" />
                        End Service Now
                      </>
                    )}
                  </button>

                  <p className="text-xs text-green-600 text-center italic">
                    💡 Tip: Scanning worker's QR is recommended for verification
                  </p>
                </div>
              </div>
            )}

            {/* Completion Photo Section */}
            {booking.status === 'completed' && booking.completionPhoto && (
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Camera className="w-5 h-5 text-primary" />
                  Completion Photo
                  {booking.completionPhoto.verified && (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  )}
                </h3>
                <div className="bg-muted p-4 rounded-xl space-y-3">
                  <div className="relative rounded-lg overflow-hidden border-2 border-green-500">
                    <img 
                      src={bookingsAPI.getCompletionPhotoUrl(booking.completionPhoto.url)}
                      alt="Service completion verification" 
                      className="w-full h-auto max-h-96 object-contain bg-black"
                      onError={(e) => {
                        // Fallback if image fails to load
                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23ddd" width="400" height="300"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage not available%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      Verified completion photo
                    </span>
                    {booking.completionPhoto.timestamp && (
                      <span>
                        {new Date(booking.completionPhoto.timestamp).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Payment Section */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Payment
              </h3>
              <div className="bg-muted p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Base Amount</span>
                  <span className="font-medium text-foreground">₹{booking.totalAmount}</span>
                </div>
                {overtimeMinutes > 0 && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-orange-600">Overtime ({overtimeMinutes} min × ₹{OVERTIME_RATE})</span>
                      <span className="font-medium text-orange-600">₹{(overtimeMinutes * OVERTIME_RATE).toFixed(2)}</span>
                    </div>
                    <div className="border-t border-border pt-2"></div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Total Amount</span>
                  <span className="text-2xl font-bold text-primary">₹{calculateTotalAmount().toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Review Section - Show for completed bookings without rating */}
            {booking.status === 'completed' && !booking.rating && booking.worker && (
              <div className="space-y-3">
                <div className="bg-purple-50 border-2 border-purple-200 p-4 rounded-xl text-center">
                  <p className="text-sm text-purple-800 mb-3">
                    How was your experience with {booking.worker.name}?
                  </p>
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="btn-brand w-full py-3"
                  >
                    ⭐ Write a Review
                  </button>
                </div>
              </div>
            )}

            {/* Show Rating if already reviewed */}
            {booking.rating && (
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground">Your Review</h3>
                <div className="bg-muted p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className={star <= booking.rating! ? 'text-yellow-400' : 'text-gray-300'}>
                        ⭐
                      </span>
                    ))}
                  </div>
                  {booking.review && (
                    <p className="text-sm text-foreground mt-2">{booking.review}</p>
                  )}
                </div>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-full btn-secondary py-3"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && booking.worker && (
        <ReviewModal
          bookingId={bookingId}
          workerId={typeof booking.worker === 'string' ? booking.worker : booking.worker._id}
          workerName={booking.worker.name}
          onClose={() => setShowReviewModal(false)}
          onReviewSubmitted={() => {
            setShowReviewModal(false);
            fetchBookingDetail();
            onRefresh();
          }}
        />
      )}

      {/* Embedded QR Scanner for Start */}
      {showScanner && (
        <EmbeddedQRScanner
          onScanSuccess={handleScanStartQR}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Embedded QR Scanner for End */}
      {showEndScanner && (
        <EmbeddedQRScanner
          onScanSuccess={handleScanEndQR}
          onClose={() => setShowEndScanner(false)}
        />
      )}
    </div>
  );
};

export default BookingDetailModal;
