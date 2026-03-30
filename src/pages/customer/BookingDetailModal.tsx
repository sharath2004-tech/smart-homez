import BookingOrderPrint from "@/components/BookingOrderPrint";
import ChatModal from "@/components/ChatModal";
import EmbeddedQRScanner from "@/components/EmbeddedQRScanner";
import SubscriptionPaymentStep from "@/components/SubscriptionPaymentStep";
import WorkerProfilePreviewDialog from "@/components/WorkerProfilePreviewDialog";
import { useConfirm } from "@/hooks/useConfirm";
import { API_BASE_URL, bookingsAPI } from "@/lib/api";
import { getCustomerBookingPaymentSummary } from "@/pages/customer/bookingPaymentSummary";
import html2pdf from "html2pdf.js";
import { ArrowLeft, Calendar, Camera, CheckCircle, ClipboardCheck, Clock3, Coffee, Download, IndianRupee, MapPin, MessageCircle, Pause, Phone, Play, Printer, QrCode, Timer, User, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ReviewModal from "./ReviewModal";

interface Worker {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  profileImage?: string;
  rating?: number;
  gender?: string;
  religion?: string;
  workerProfile?: {
    experience?: number;
    languages?: string[];
    rating?: number;
    specialization?: string[] | string;
    totalReviews?: number;
    totalJobsCompleted?: number;
    completedJobs?: number;
    completedBookings?: number;
    availability?: boolean;
  };
}

interface SupportStaffMember {
  worker?: Worker | null;
  name?: string;
}

interface Service {
  _id: string;
  name: string;
  category: string;
  allowBreakRequests?: boolean;
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

interface BreakRequest {
  _id: string;
  requestedBy: string;
  requestedByName?: string;
  reason?: string;
  requestedAt: string;
  startedAt?: string;
  endedAt?: string;
  durationMinutes: number;
  status: 'pending' | 'approved' | 'active' | 'completed' | 'rejected';
}

interface Booking {
  _id: string;
  parentBooking?: string | null;
  service?: Service | null;
  bookingType?: string;
  subscription?: {
    isSubscription: boolean;
    isPrepaid?: boolean;
    activationStatus?: 'payment_pending' | 'approval_pending' | 'active';
  };
  cartItems?: { name: string; qty?: number; totalPrice: number }[];
  worker?: Worker;
  supportStaff?: SupportStaffMember[];
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
  paymentMethod?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  serviceStartQRCode?: string;
  serviceEndQRCode?: string;
  overtimeCharges?: number;
  rating?: number;
  review?: string;
  paymentStatus?: string;
  paymentProof?: {
    url?: string | null;
    verified?: boolean;
    reviewStatus?: 'pending' | 'approved' | 'rejected';
    reviewNotes?: string | null;
    transactionId?: string | null;
    transactionTime?: string | null;
  };
  breakRequests?: BreakRequest[];
  isOnBreak?: boolean;
  totalBreakMinutes?: number;
  completionPhoto?: {
    url: string;
    timestamp: string;
    verified: boolean;
  };
  arrivalPhoto?: {
    url: string;
    timestamp: string;
  };
}

interface BookingDetailModalProps {
  bookingId: string;
  onClose: () => void;
  onRefresh: () => void;
}

const getBreakDurationSeconds = (
  breakRequests: BreakRequest[] = [],
  now: number,
) => {
  return (breakRequests || []).reduce((total, breakRequest) => {
    if (breakRequest.status === 'active' && breakRequest.startedAt) {
      const startedAt = new Date(breakRequest.startedAt).getTime();
      if (Number.isFinite(startedAt)) {
        return total + Math.max(0, Math.floor((now - startedAt) / 1000));
      }
    }

    if (breakRequest.status === 'completed') {
      if (breakRequest.startedAt && breakRequest.endedAt) {
        const startedAt = new Date(breakRequest.startedAt).getTime();
        const endedAt = new Date(breakRequest.endedAt).getTime();

        if (Number.isFinite(startedAt) && Number.isFinite(endedAt)) {
          return total + Math.max(0, Math.floor((endedAt - startedAt) / 1000));
        }
      }

      if (breakRequest.durationMinutes > 0) {
        return total + (breakRequest.durationMinutes * 60);
      }
    }

    return total;
  }, 0);
};

const getScheduledDurationSeconds = (bookingDate: string, startTime: string, endTime: string) => {
  const bookingDay = bookingDate.includes('T') ? bookingDate.split('T')[0] : bookingDate;
  const scheduledStart = new Date(`${bookingDay}T${startTime}`).getTime();
  let scheduledEnd = new Date(`${bookingDay}T${endTime}`).getTime();

  if (!Number.isFinite(scheduledStart) || !Number.isFinite(scheduledEnd)) {
    return 0;
  }

  if (scheduledEnd < scheduledStart) {
    scheduledEnd += 24 * 60 * 60 * 1000;
  }

  return Math.max(0, Math.floor((scheduledEnd - scheduledStart) / 1000));
};

const STATUS_STEPS = [
  { key: 'pending',        label: 'Booking Placed',   icon: ClipboardCheck },
  { key: 'confirmed',      label: 'Worker Assigned',  icon: User },
  { key: 'in-progress',    label: 'In Progress',      icon: Clock3 },
  { key: 'pending-review', label: 'Pending Review',   icon: Camera },
  { key: 'completed',      label: 'Completed',        icon: CheckCircle },
];

const STATUS_ORDER: Record<string, number> = {
  pending: 0, confirmed: 1, 'in-progress': 2, 'pending-review': 3, completed: 4,
};

const DEFAULT_PAYMENT_METHOD = 'qr-upi';

const BookingStatusStepper = ({ status }: { status: string }) => {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
        <XCircle className="w-6 h-6 text-red-500 shrink-0" />
        <div>
          <p className="font-semibold text-red-700">Booking Cancelled</p>
          <p className="text-xs text-red-500">This booking has been cancelled.</p>
        </div>
      </div>
    );
  }

  const currentStep = STATUS_ORDER[status] ?? 0;

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <MapPin className="w-5 h-5 text-primary" />
        Booking Progress
      </h3>
      <div className="bg-muted rounded-xl p-4">
        <div className="flex items-start justify-between relative">
          {/* connecting line */}
          <div className="absolute top-4 left-0 right-0 h-0.5 bg-border mx-6" />
          {STATUS_STEPS.map((step, index) => {
            const Icon = step.icon;
            const done = index < currentStep;
            const active = index === currentStep;
            return (
              <div key={step.key} className="flex flex-col items-center gap-1 z-10 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  done    ? 'bg-primary border-primary text-primary-foreground' :
                  active  ? 'bg-white border-primary text-primary ring-4 ring-primary/20' :
                            'bg-white border-border text-muted-foreground'
                }`}>
                  {done ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] text-center leading-tight max-w-[52px] font-medium ${
                  active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const BookingDetailModal = ({ bookingId, onClose, onRefresh }: BookingDetailModalProps) => {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showEndScanner, setShowEndScanner] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [overtimeMinutes, setOvertimeMinutes] = useState(0);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [endingService, setEndingService] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [breakActionLoading, setBreakActionLoading] = useState(false);
  const [showWorkerProfile, setShowWorkerProfile] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
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
      if (!silent) alert(t('customer.bookings.failedToLoadDetails'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [bookingId, t]);

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
        const breakDurationSeconds = getBreakDurationSeconds(booking.breakRequests, now);
        const rawElapsed = Math.floor((now - start) / 1000) - breakDurationSeconds;
        const elapsed = Math.max(0, rawElapsed + timeOffsetRef.current);
        
        setElapsedTime(elapsed);

        // Calculate overtime
        const scheduledDurationSeconds = getScheduledDurationSeconds(booking.bookingDate, booking.startTime, booking.endTime);
        if (elapsed > scheduledDurationSeconds) {
          const overtimeMins = Math.ceil((elapsed - scheduledDurationSeconds) / 60);
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
  }, [booking?.status, booking?.actualStartTime, booking?.bookingDate, booking?.startTime, booking?.endTime, booking?.breakRequests]);

  const handleScanStartQR = useCallback(async (qrCode: string) => {
    try {
      const response = await bookingsAPI.scanStartQR(bookingId, qrCode, true);
      alert(t('customer.bookings.serviceStartedSuccess'));
      setShowScanner(false);
      fetchBookingDetail();
      onRefresh();
    } catch (error) {
      console.error('Error scanning QR:', error);
      const errorMessage = error instanceof Error ? error.message : t('customer.bookings.failedToScanQR');
      alert(errorMessage);
      setShowScanner(false);
    }
  }, [bookingId, fetchBookingDetail, onRefresh, t]);

  const handleScanEndQR = useCallback(async (qrCode: string) => {
    try {
      const response = await bookingsAPI.scanEndQR(bookingId, qrCode);
      const result = response.booking;
      
      let message = t('customer.bookings.serviceCompletedSuccess');
      if (result.overtimeMinutes > 0) {
        message += `\n\nOvertime: ${result.overtimeMinutes} minutes\nOvertime Charge: ₹${result.overtimeCharges.toFixed(2)}\nTotal Amount: ₹${result.totalAmount.toFixed(2)}`;
      }
      
      alert(message);
      setShowEndScanner(false);
      fetchBookingDetail();
      onRefresh();
    } catch (error) {
      console.error('Error scanning end QR:', error);
      const errorMessage = error instanceof Error ? error.message : t('customer.bookings.failedToEndService');
      alert(errorMessage);
      setShowEndScanner(false);
    }
  }, [bookingId, fetchBookingDetail, onRefresh, t]);

  const handleDirectEndService = useCallback(async () => {
    if (!await confirm(t('customer.bookings.confirmEndService'))) {
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
  }, [bookingId, booking?.serviceEndQRCode, fetchBookingDetail, onRefresh, t]);

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

  const handleApproveBreak = async (breakId: string) => {
    if (!booking) return;
    try {
      setBreakActionLoading(true);
      const res = await bookingsAPI.approveBreak(booking._id, breakId);
      setBooking(prev => prev ? { ...prev, breakRequests: res.breakRequests, isOnBreak: res.isOnBreak } : prev);
    } catch (e) {
      alert((e as Error).message || 'Failed to approve break');
    } finally {
      setBreakActionLoading(false);
    }
  };

  const handleResumeFromBreak = async (breakId: string) => {
    if (!booking) return;
    try {
      setBreakActionLoading(true);
      const res = await bookingsAPI.resumeFromBreak(booking._id, breakId);
      setBooking(prev => prev ? { ...prev, breakRequests: res.breakRequests, isOnBreak: res.isOnBreak, totalBreakMinutes: res.totalBreakMinutes } : prev);
    } catch (e) {
      alert((e as Error).message || 'Failed to resume work');
    } finally {
      setBreakActionLoading(false);
    }
  };

  const handleRejectBreak = async (breakId: string) => {
    if (!booking) return;
    try {
      setBreakActionLoading(true);
      const res = await bookingsAPI.rejectBreak(booking._id, breakId);
      setBooking(prev => prev ? { ...prev, breakRequests: res.breakRequests, isOnBreak: res.isOnBreak } : prev);
    } catch (e) {
      alert((e as Error).message || 'Failed to reject break');
    } finally {
      setBreakActionLoading(false);
    }
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

  const paymentSummary = booking
    ? getCustomerBookingPaymentSummary(booking, calculateTotalAmount())
    : null;
  const isSubscriptionChildVisit = Boolean(
    booking?.subscription?.isSubscription
    && booking?.parentBooking
  );
  const isSubscriptionPaymentSettled = Boolean(
    booking?.subscription?.isSubscription
    && (
      booking.paymentStatus === 'paid'
      || booking.paymentProof?.reviewStatus === 'approved'
      || booking.subscription?.activationStatus === 'approval_pending'
      || booking.subscription?.activationStatus === 'active'
    )
  );
  const isBookingPaymentSettled = Boolean(
    booking
    && (
      booking.paymentStatus === 'paid'
      || booking.paymentProof?.reviewStatus === 'approved'
      || isSubscriptionPaymentSettled
    )
  );
  const shouldShowPaymentProofStep = Boolean(
    booking
    && !isBookingPaymentSettled
    && !isSubscriptionChildVisit
    && booking.status !== 'cancelled'
    && booking.status !== 'completed'
    && paymentSummary?.pendingAmount !== null
  );

  const handlePrintToPDF = () => {
    if (!printRef.current || !booking) return;

    const filename = `booking-order-${booking.bookingId || booking._id.slice(-8)}.pdf`;

    const opt = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    };

    // @ts-expect-error - html2pdf types are incomplete for the chained builder API
    html2pdf().set(opt).from(printRef.current).save();
  };

  const handlePrintToPrinter = () => {
    if (!printRef.current) return;

    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Booking Order</title>');
      printWindow.document.write('<style>body { font-family: Arial, sans-serif; } @media print { body { margin: 0; } }</style>');
      printWindow.document.write('</head><body>');
      printWindow.document.write(printRef.current.innerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-center mt-4 text-muted-foreground">{t('customer.bookings.loadingDetails')}</p>
        </div>
      </div>
    );
  }

  if (!booking) return null;

  const assignedReviewWorkers = [
    booking.worker ? { id: booking.worker._id, name: booking.worker.name } : null,
    ...((booking.supportStaff || [])
      .map(member => member.worker?._id ? {
        id: member.worker._id,
        name: member.worker.name || member.name || 'Support Staff'
      } : null))
  ].filter((worker): worker is { id: string; name: string } => Boolean(worker));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-6 py-4 rounded-t-2xl flex items-center gap-4 shrink-0">
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{t('customer.bookings.bookingDetails')}</h2>
              <p className="text-sm opacity-90">ID: {booking._id.slice(-8)}</p>
            </div>
            <button
              onClick={() => setShowPrintModal(true)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Print or download booking order"
            >
              <Printer className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-6 space-y-6">
            {/* Service Info */}
            <div className="bg-primary-light p-4 rounded-xl">
              <h3 className="text-lg font-bold text-foreground mb-1">
                {booking.service?.name ?? (booking.bookingType === 'deep-cleaning-cart' ? '✨ Deep Cleaning' : 'Booking')}
              </h3>
              {booking.service?.category && (
                <p className="text-sm text-muted-foreground capitalize">{booking.service.category}</p>
              )}
              {booking.bookingType === 'deep-cleaning-cart' && booking.cartItems && booking.cartItems.length > 0 && (
                <div className="mt-2 space-y-1">
                  {booking.cartItems.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs text-muted-foreground">
                      <span>{item.name}{item.qty && item.qty > 1 ? ` ×${item.qty}` : ''}</span>
                      <span>₹{item.totalPrice}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Booking Status Stepper */}
            <BookingStatusStepper status={booking.status} />

            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('customer.bookings.status')}</span>
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
                {t('customer.bookings.schedule')}
              </h3>
              <div className="bg-muted p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('customer.bookings.date')}</span>
                  <span className="font-medium text-foreground">{formatDate(booking.bookingDate)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('customer.bookings.timeSlot')}</span>
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
                  {t('customer.bookings.workerDetails')}
                </h3>
                <div className="bg-muted p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    {booking.worker.profileImage ? (
                      <img
                        src={`${API_BASE_URL.replace('/api', '')}${booking.worker.profileImage}`}
                        alt={booking.worker.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-border shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold shrink-0">
                        {booking.worker.name.split(' ').map(n => n[0]).join('')}
                      </div>
                    )}
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
                  <button
                    type="button"
                    onClick={() => setShowWorkerProfile(true)}
                    className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors w-full"
                  >
                    <User className="w-4 h-4 text-primary" />
                    View worker profile
                  </button>
                  {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                    <button
                      onClick={() => setShowChat(true)}
                      className="flex items-center gap-2 p-3 bg-muted hover:bg-muted/70 text-foreground rounded-lg transition-colors w-full"
                    >
                      <MessageCircle className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Chat with Worker</span>
                    </button>
                  )}
                  {booking.supportStaff && booking.supportStaff.length > 0 && (
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Deep cleaning team</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          Team Head: {booking.worker.name}
                        </span>
                        {booking.supportStaff.map((member, index) => (
                          <span
                            key={`${member.worker?._id || member.name || 'support'}-${index}`}
                            className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
                          >
                            {member.worker?.name || member.name || 'Support Staff'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Arrival Photo - shown when worker has arrived */}
            {booking.arrivalPhoto?.url && (
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Camera className="w-5 h-5 text-primary" />
                  Worker Arrival Confirmed
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                  <img
                    src={bookingsAPI.getCompletionPhotoUrl(booking.arrivalPhoto.url)}
                    alt="Worker arrival"
                    className="w-full max-h-48 object-cover rounded-lg border border-blue-300"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <p className="text-xs text-blue-700 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Worker photo verified at arrival
                    {booking.arrivalPhoto.timestamp && (
                      <span className="ml-auto text-muted-foreground">
                        {new Date(booking.arrivalPhoto.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* QR Code Scanner Section */}
            {booking.status === 'confirmed' && booking.serviceStartQRCode && !booking.actualStartTime && (
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-primary" />
                  {t('customer.bookings.serviceStartQRCode')}
                </h3>
                <div className="bg-teal-50 border-2 border-teal-200 p-4 rounded-xl text-center space-y-3">
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('customer.bookings.scanQRToStart')}
                  </p>
                  <button
                    onClick={() => setShowScanner(true)}
                    className="btn-brand w-full py-3 flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-5 h-5" />
                    {t('customer.bookings.scanWorkerQR')}
                  </button>
                </div>
              </div>
            )}

            {/* Active Timer Section */}
            {booking.status === 'in-progress' && booking.actualStartTime && (
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Timer className="w-5 h-5 text-primary" />
                  {t('customer.bookings.serviceInProgress')}
                </h3>
                <div className="bg-purple-50 border-2 border-purple-200 p-6 rounded-xl text-center space-y-2">
                  <p className="text-sm text-muted-foreground">{t('customer.bookings.elapsedTime')}</p>
                  <p className="text-4xl font-bold text-purple-600 font-mono">
                    {formatElapsedTime(elapsedTime)}
                  </p>
                  {booking.isOnBreak && (
                    <div className="mt-2 flex items-center justify-center gap-2 text-amber-700">
                      <Coffee className="w-4 h-4" />
                      <span className="text-sm font-semibold">Service Paused — Workers on Break</span>
                    </div>
                  )}
                  {booking.totalBreakMinutes && booking.totalBreakMinutes > 0 ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Total break time: {booking.totalBreakMinutes} min
                    </p>
                  ) : null}
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

                {/* Break Management Section */}
                {booking.service?.allowBreakRequests === true && booking.breakRequests && booking.breakRequests.length > 0 && (
                  <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-xl space-y-3">
                    <h4 className="font-semibold text-amber-800 flex items-center gap-2">
                      <Coffee className="w-5 h-5" />
                      Break Requests
                    </h4>
                    <div className="space-y-2">
                      {booking.breakRequests.map((br) => (
                        <div key={br._id} className={`p-3 rounded-lg border ${
                          br.status === 'pending' ? 'bg-yellow-50 border-yellow-300' :
                          br.status === 'active' ? 'bg-amber-100 border-amber-400' :
                          br.status === 'completed' ? 'bg-green-50 border-green-300' :
                          br.status === 'rejected' ? 'bg-red-50 border-red-300' :
                          'bg-muted border-border'
                        }`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">
                                {br.requestedByName || 'Worker'} requested a break
                              </p>
                              {br.reason && (
                                <p className="text-xs text-muted-foreground mt-0.5">Reason: {br.reason}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {new Date(br.requestedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                {br.durationMinutes > 0 && ` · ${br.durationMinutes} min`}
                              </p>
                            </div>
                            <div className="shrink-0">
                              {br.status === 'pending' && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleApproveBreak(br._id)}
                                    disabled={breakActionLoading}
                                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                                  >
                                    <Pause className="w-3 h-3" /> Approve
                                  </button>
                                  <button
                                    onClick={() => handleRejectBreak(br._id)}
                                    disabled={breakActionLoading}
                                    className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    Deny
                                  </button>
                                </div>
                              )}
                              {br.status === 'active' && (
                                <button
                                  onClick={() => handleResumeFromBreak(br._id)}
                                  disabled={breakActionLoading}
                                  className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                                >
                                  <Play className="w-3 h-3" /> Resume Work
                                </button>
                              )}
                              {br.status === 'completed' && (
                                <span className="text-xs text-green-700 font-medium bg-green-100 px-2 py-1 rounded-full">
                                  Completed
                                </span>
                              )}
                              {br.status === 'rejected' && (
                                <span className="text-xs text-red-700 font-medium bg-red-100 px-2 py-1 rounded-full">
                                  Denied
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* End Service Options */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 p-4 rounded-xl space-y-3">
                  <h4 className="font-semibold text-green-800 text-center flex items-center justify-center gap-2">
                    <QrCode className="w-5 h-5" />
                    {t('customer.bookings.endService')}
                  </h4>

                  <p className="text-xs text-green-700 text-center">
                    {t('customer.bookings.scanQRToEnd')}
                  </p>

                  {/* Scan Worker's End QR */}
                  <button
                    onClick={() => setShowEndScanner(true)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-5 h-5" />
                    {t('customer.bookings.scanWorkerEndQR')}
                  </button>
                </div>
              </div>
            )}

            {/* Completion Photo Section */}
            {booking.status === 'completed' && booking.completionPhoto && (
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Camera className="w-5 h-5 text-primary" />
                  {t('customer.bookings.completionPhoto')}
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
                      {t('customer.bookings.verifiedCompletionPhoto')}
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
                <IndianRupee className="w-5 h-5 text-primary" />
                {t('customer.bookings.payment')}
              </h3>

              {booking.subscription?.isSubscription && booking.subscription.activationStatus === 'approval_pending' && (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <p className="text-sm font-semibold text-orange-900">Subscription setup under review</p>
                  <p className="text-xs text-orange-700 mt-1">
                    Admin or super admin is reviewing the schedule or worker setup for this subscription.
                  </p>
                </div>
              )}

              {paymentSummary && (
                <div className={`rounded-2xl border p-4 ${
                  paymentSummary.tone === 'success'
                    ? 'border-green-200 bg-green-50'
                    : paymentSummary.tone === 'danger'
                    ? 'border-red-200 bg-red-50'
                    : paymentSummary.tone === 'info'
                    ? 'border-sky-200 bg-sky-50'
                    : 'border-amber-200 bg-amber-50'
                }`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">Payment status</p>
                      <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        paymentSummary.tone === 'success'
                          ? 'bg-green-100 text-green-700'
                          : paymentSummary.tone === 'danger'
                          ? 'bg-red-100 text-red-700'
                          : paymentSummary.tone === 'info'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {paymentSummary.label}
                      </div>
                      <p className="text-xs text-muted-foreground">{paymentSummary.description}</p>
                    </div>

                    <div className="min-w-[140px] text-left sm:text-right">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {paymentSummary.pendingAmount !== null ? 'Pending payment' : 'Amount settled'}
                      </p>
                      <p className="text-xl font-bold text-foreground">
                        ₹{(paymentSummary.pendingAmount ?? calculateTotalAmount()).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-background/70 px-3 py-2">
                      <span>Payment method</span>
                      <span className="font-medium text-foreground uppercase">{booking.paymentMethod || DEFAULT_PAYMENT_METHOD}</span>
                    </div>
                    {booking.paymentProof?.transactionId && (
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-background/70 px-3 py-2">
                        <span>Transaction ID</span>
                        <span className="font-medium text-foreground">{booking.paymentProof.transactionId}</span>
                      </div>
                    )}
                    {booking.paymentProof?.transactionTime && (
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-background/70 px-3 py-2 sm:col-span-2">
                        <span>Payment time</span>
                        <span className="font-medium text-foreground">
                          {new Date(booking.paymentProof.transactionTime).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {shouldShowPaymentProofStep && (
                <SubscriptionPaymentStep
                  bookingId={booking._id}
                  amount={booking.totalAmount}
                  amountLabel={booking.subscription?.isSubscription ? 'Subscription amount' : 'Booking amount'}
                  title={booking.paymentProof?.reviewStatus === 'rejected'
                    ? 'Re-upload payment proof'
                    : 'Upload payment proof'}
                  description={booking.paymentProof?.reviewStatus === 'rejected'
                    ? 'Your previous payment proof was rejected. Please upload a clear payment screenshot so admin can verify it.'
                    : booking.subscription?.isSubscription
                      ? 'This subscription is waiting for payment proof. Complete the payment and upload the screenshot here so your region admin or super admin can review it and continue the activation process.'
                      : 'Payment is pending for this booking. Complete the payment and upload the screenshot here so admin can verify it.'}
                  successLabel={booking.paymentProof?.reviewStatus === 'rejected'
                    ? 'Updated payment proof uploaded. Waiting for admin review'
                    : 'Payment proof uploaded. Waiting for admin review'}
                  onPaymentSubmitted={() => {
                    fetchBookingDetail();
                    onRefresh();
                  }}
                />
              )}

              <div className="bg-muted p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('customer.bookings.baseAmount')}</span>
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
                  <span className="font-semibold text-foreground">{t('customer.bookings.totalAmount')}</span>
                  <span className="text-2xl font-bold text-primary">₹{calculateTotalAmount().toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Review Section - Show for completed bookings without rating */}
            {booking.status === 'completed' && !booking.rating && booking.worker && (
              <div className="space-y-3">
                <div className="bg-purple-50 border-2 border-purple-200 p-4 rounded-xl text-center">
                  <p className="text-sm text-purple-800 mb-3">
                    {t('customer.bookings.howWasExperience', { workerName: booking.worker.name })}
                  </p>
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="btn-brand w-full py-3"
                  >
                    ⭐ {t('customer.bookings.writeReview')}
                  </button>
                </div>
              </div>
            )}

            {/* Show Rating if already reviewed */}
            {booking.rating && (
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground">{t('customer.bookings.yourReview')}</h3>
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
              {t('customer.bookings.close')}
            </button>
          </div>
        </div>

      {/* Review Modal */}
      {showReviewModal && assignedReviewWorkers.length > 0 && (
        <ReviewModal
          bookingId={bookingId}
          workers={assignedReviewWorkers}
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

      {/* Chat Modal */}
      {showChat && booking.worker && (
        <ChatModal
          bookingId={bookingId}
          currentUserId={booking.customer._id}
          currentUserRole="customer"
          otherPartyName={booking.worker.name}
          onClose={() => setShowChat(false)}
        />
      )}

      <WorkerProfilePreviewDialog
        open={showWorkerProfile}
        onOpenChange={setShowWorkerProfile}
        worker={booking.worker || null}
      />

      {/* Print Modal */}
      {showPrintModal && booking && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh]">
            {/* Print Modal Header */}
            <div className="bg-primary text-primary-foreground px-6 py-4 rounded-t-2xl flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold">Booking Order</h2>
              <button
                onClick={() => setShowPrintModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Print Preview */}
            <div className="overflow-y-auto flex-1">
              <BookingOrderPrint ref={printRef} booking={booking} />
            </div>

            {/* Print Modal Actions */}
            <div className="border-t border-border px-6 py-4 flex gap-3 shrink-0">
              <button
                onClick={handlePrintToPDF}
                className="flex-1 btn btn-primary flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
              <button
                onClick={handlePrintToPrinter}
                className="flex-1 btn btn-secondary flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Print
              </button>
              <button
                onClick={() => setShowPrintModal(false)}
                className="flex-1 btn btn-ghost"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingDetailModal;
