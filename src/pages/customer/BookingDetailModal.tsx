import { bookingsAPI } from "@/lib/api";
import { Html5QrcodeScanner } from "html5-qrcode";
import { ArrowLeft, Calendar, DollarSign, Phone, QrCode, Timer, User } from "lucide-react";
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
  const [elapsedTime, setElapsedTime] = useState(0);
  const [overtimeMinutes, setOvertimeMinutes] = useState(0);  const [showReviewModal, setShowReviewModal] = useState(false);  const OVERTIME_RATE = 2.5; // ₹2.5 per minute

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
        
        if (timeOffsetRef.current > 0) {
          console.warn('⚠️ Time sync issue detected. Adjusting for timezone offset:', timeOffsetRef.current, 'seconds');
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
      fetchBookingDetail();
      onRefresh();
    } catch (error) {
      console.error('Error scanning QR:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to scan QR code';
      alert(errorMessage);
      setShowScanner(false);
    }
  }, [bookingId, fetchBookingDetail, onRefresh]);

  // Initialize QR Scanner
  useEffect(() => {
    if (showScanner && booking?.serviceStartQRCode && !booking.actualStartTime) {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: 250 },
        false
      );

      scanner.render(
        async (decodedText) => {
          scanner.clear();
          setShowScanner(false);
          await handleScanStartQR(decodedText);
        },
        (error) => {
          console.log("QR Scan error:", error);
        }
      );

      return () => {
        scanner.clear().catch(console.error);
      };
    }
  }, [showScanner, booking, handleScanStartQR]);

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
                  {!showScanner ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      <div id="qr-reader" className="w-full"></div>
                      <button
                        onClick={() => setShowScanner(false)}
                        className="btn-secondary w-full py-2 text-sm"
                      >
                        Cancel Scanning
                      </button>
                    </>
                  )}
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
          workerName={booking.worker.name}
          onClose={() => setShowReviewModal(false)}
          onReviewSubmitted={() => {
            setShowReviewModal(false);
            fetchBookingDetail();
            onRefresh();
          }}
        />
      )}
    </div>
  );
};

export default BookingDetailModal;
