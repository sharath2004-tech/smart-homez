import ChatModal from "@/components/ChatModal";
import PhotoCapture from "@/components/PhotoCapture";
import { bookingsAPI, settingsAPI } from "@/lib/api";
import {
    ArrowLeft, Calendar,
    Camera,
    CheckCircle,
    Coffee,
    DollarSign,
    Home,
    MapPin,
    MessageCircle,
    Navigation,
    Phone,
    QrCode, Timer, User
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
interface Task {
  _id: string;
  worker?: { _id: string; name: string };
  supportStaff?: { worker: { _id: string; name: string }; name?: string }[];
  service?: {
    _id: string;
    name: string;
    description?: string;
    price: number;
    duration: number;
    allowBreakRequests?: boolean;
  };
  bookingType?: string;
  cartItems?: { name: string; qty?: number; totalPrice: number }[];
  customer: {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  location?: {
    address?: string;
    apartment?: string;
    building?: string;
    area?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  totalAmount: number;
  actualStartTime?: string;
  actualEndTime?: string;
  serviceStartQRCode?: string;
  serviceEndQRCode?: string;
  completionPhoto?: {
    url: string;
    timestamp: string;
    verified: boolean;
  };
  completionPhotos?: {
    url: string;
    timestamp: string;
    verified: boolean;
  }[];
  arrivalPhoto?: {
    url: string;
    timestamp: string;
  };
  workerChecklist?: { _id: string; text: string; completed: boolean; completedAt?: string }[];
  breakRequests?: {
    _id: string;
    requestedBy: string;
    requestedByName?: string;
    reason?: string;
    requestedAt: string;
    startedAt?: string;
    endedAt?: string;
    durationMinutes: number;
    status: 'pending' | 'approved' | 'active' | 'completed' | 'rejected';
  }[];
  isOnBreak?: boolean;
  totalBreakMinutes?: number;
  paymentProof?: {
    url: string;
    timestamp: string;
    verified: boolean;
    transactionId?: string;
    transactionTime?: string;
  };
}

interface TaskDetailModalProps {
  taskId: string;
  onClose: () => void;
  onRefresh: () => void;
}

const TaskDetailModal = ({ taskId, onClose, onRefresh }: TaskDetailModalProps) => {
  const { t } = useTranslation();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCodeImage, setQrCodeImage] = useState<string>("");
  const [paymentQRImage, setPaymentQRImage] = useState<string>("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [overtimeMinutes, setOvertimeMinutes] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [hasTimeOffset, setHasTimeOffset] = useState(false);

  const [adminPaymentQR, setAdminPaymentQR] = useState<string>("");
  const [showPaymentProofCapture, setShowPaymentProofCapture] = useState(false);
  const [uploadingPaymentProof, setUploadingPaymentProof] = useState(false);
  const [paymentTransactionId, setPaymentTransactionId] = useState('');
  const [paymentTransactionTime, setPaymentTransactionTime] = useState('');
  const [showCompletionCapture, setShowCompletionCapture] = useState(false);
  const [uploadingCompletionPhoto, setUploadingCompletionPhoto] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [breakReason, setBreakReason] = useState('');
  const [requestingBreak, setRequestingBreak] = useState(false);
  const [showBreakForm, setShowBreakForm] = useState(false);

  const OVERTIME_RATE = 2.5; // ₹2.5 per minute

  // Parse worker ID from stored JWT
  const getCurrentUserId = (): string => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return '';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id || payload._id || payload.userId || '';
    } catch { return ''; }
  };

  const fetchTaskDetail = async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await bookingsAPI.getById(taskId);
      setTask(response.booking);
      
      // Generate QR code if service is ready to start
      if (response.booking.serviceStartQRCode && !response.booking.actualStartTime) {
        generateQRCode(response.booking.serviceStartQRCode);
      }
      
      // Generate end QR code if service is in progress and end QR exists
      if (response.booking.serviceEndQRCode && response.booking.actualStartTime && !response.booking.actualEndTime) {
        generateQRCode(response.booking.serviceEndQRCode);
      }
    } catch (error) {
      console.error('Error fetching task detail:', error);
      if (!silent) alert(t('worker.taskDetail.failedLoadTask'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskDetail(false); // Initial load with loading spinner
    fetchPaymentSettings(); // Fetch admin payment QR
    
    // Auto-refresh every 5 seconds for real-time updates (silent refresh)
    const interval = setInterval(() => {
      fetchTaskDetail(true); // Silent refresh without loading spinner
    }, 5000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Timer for active tasks
  useEffect(() => {
    if (task?.status === 'in-progress' && task.actualStartTime) {
      console.log('🔄 Worker Timer Starting:', {
        taskId: task._id,
        actualStartTime: task.actualStartTime,
        browserTime: new Date().toISOString(),
        difference: Math.floor((Date.now() - new Date(task.actualStartTime).getTime()) / 1000) + ' seconds'
      });

      // Calculate real elapsed time immediately and update
      const updateElapsedTime = () => {
        const startTime = new Date(task.actualStartTime!).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const elapsed = Math.max(0, elapsedSeconds);
        
        console.log('⏱️ Timer Update:', {
          start: new Date(task.actualStartTime!).toISOString(),
          now: new Date().toISOString(),
          elapsed: elapsed + 's',
          formatted: Math.floor(elapsed / 60) + 'm ' + (elapsed % 60) + 's'
        });
        
        setElapsedTime(elapsed);

        // Calculate overtime
        const scheduledEnd = new Date(`${task.bookingDate}T${task.endTime}`).getTime();
        if (now > scheduledEnd) {
          const overtimeMs = now - scheduledEnd;
          const overtimeMins = Math.ceil(overtimeMs / 60000);
          setOvertimeMinutes(Math.max(0, overtimeMins));
        } else {
          setOvertimeMinutes(0);
        }
      };

      // Update immediately
      updateElapsedTime();

      // Then update every second
      const interval = setInterval(updateElapsedTime, 1000);

      return () => clearInterval(interval);
    } else {
      // Reset when task is not in progress
      setElapsedTime(0);
      setOvertimeMinutes(0);
      setHasTimeOffset(false);
    }
  }, [task?.status, task?.actualStartTime, task?.bookingDate, task?.endTime, task?._id]);

  // Generate payment QR when task is completed or pending-review
  useEffect(() => {
    if ((task?.status === 'completed' || task?.status === 'pending-review') && task?.actualEndTime && !paymentQRImage) {
      generatePaymentQR();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.status, task?.actualEndTime]);

  const generateQRCode = async (code: string) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(code, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeImage(qrDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleGenerateStartQR = async () => {
    try {
      const response = await bookingsAPI.generateStartQR(taskId, true);
      setTask({ ...task!, serviceStartQRCode: response.qrCode });
      generateQRCode(response.qrCode);
      alert(t('worker.taskDetail.qrGenerated'));
    } catch (error) {
      console.error('Error generating QR:', error);
      alert(t('worker.taskDetail.failedGenerateQR'));
    }
  };

  const handleGenerateEndQR = async () => {
    try {
      const response = await bookingsAPI.generateEndQR(taskId);
      setTask({ ...task!, serviceEndQRCode: response.qrCode });
      generateQRCode(response.qrCode);
      alert(t('worker.taskDetail.endQRGenerated'));
    } catch (error) {
      console.error('Error generating end QR:', error);
      alert(t('worker.taskDetail.failedEndQR'));
    }
  };

  const handleCompletionPhotoCapture = async (file: File) => {
    try {
      setShowCompletionCapture(false);
      setUploadingCompletionPhoto(true);
      const result = await bookingsAPI.addCompletionPhoto(taskId, file);
      setTask({ ...task!, completionPhotos: result.completionPhotos });
      await fetchTaskDetail(true);
    } catch (error) {
      console.error('Error uploading completion photo:', error);
      alert((error as Error).message || 'Failed to upload completion photo');
    } finally {
      setUploadingCompletionPhoto(false);
    }
  };



  const handlePaymentProofCapture = async (file: File) => {
    try {
      // Close photo capture view immediately
      setShowPaymentProofCapture(false);
      setUploadingPaymentProof(true);
      
      // Use the API utility method with transaction ID and time
      const txnTime = paymentTransactionTime || new Date().toISOString();
      const result = await bookingsAPI.uploadPaymentProof(taskId, file, paymentTransactionId.trim() || undefined, txnTime);
      
      // Update task with payment proof
      setTask({ ...task!, paymentProof: result.paymentProof });
      setPaymentTransactionId('');
      setPaymentTransactionTime('');
      
      alert(t('worker.taskDetail.proofUploadSuccess'));
      
      // Refresh task data
      await fetchTaskDetail(true);
      onRefresh(); // Refresh parent list
    } catch (error) {
      console.error('Error uploading payment proof:', error);
      alert((error as Error).message || t('worker.taskDetail.failedUploadProof'));
    } finally {
      setUploadingPaymentProof(false);
    }
  };

  const handleOpenPaymentProofCapture = () => {
    if (!paymentTransactionId.trim()) {
      alert(t('worker.taskDetail.pleaseEnterTxnId'));
      return;
    }
    setPaymentTransactionTime(new Date().toISOString());
    setShowPaymentProofCapture(true);
  };

  const fetchPaymentSettings = async () => {
    try {
      const response = await settingsAPI.getSettings();
      if (response.settings?.payment?.qrCodeImage) {
        setAdminPaymentQR(response.settings.payment.qrCodeImage);
      }
    } catch (error) {
      console.error('Error fetching payment settings:', error);
    }
  };

  const generatePaymentQR = async () => {
    // If admin has uploaded a payment QR, use that
    if (adminPaymentQR) {
      setPaymentQRImage(adminPaymentQR);
      return;
    }
    
    // Otherwise generate a dynamic one (fallback)
    try {
      const paymentData = JSON.stringify({
        type: 'payment',
        bookingId: taskId,
        amount: calculateTotalAmount(),
        timestamp: new Date().toISOString()
      });
      
      const qrDataUrl = await QRCode.toDataURL(paymentData, {
        width: 256,
        margin: 2,
        errorCorrectionLevel: 'H'
      });
      
      setPaymentQRImage(qrDataUrl);
    } catch (error) {
      console.error('Error generating payment QR:', error);
    }
  };

  const openMapsNavigation = () => {
    if (!task?.location) return;
    
    const address = [
      task.location.apartment,
      task.location.building,
      task.location.address,
      task.location.area,
      task.location.city,
      task.location.state,
      task.location.zipCode
    ].filter(Boolean).join(', ');

    // Open Google Maps with directions
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    window.open(mapsUrl, '_blank');
  };

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

  const handleRequestBreak = async () => {
    if (!task) return;
    try {
      setRequestingBreak(true);
      const res = await bookingsAPI.requestBreak(task._id, breakReason);
      setTask(prev => prev ? { ...prev, breakRequests: res.breakRequests } : prev);
      setBreakReason('');
      setShowBreakForm(false);
    } catch (e) {
      alert((e as Error).message || 'Failed to request break');
    } finally {
      setRequestingBreak(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      weekday: 'short'
    });
  };

  const calculateTotalAmount = () => {
    if (!task) return 0;
    const baseAmount = task.totalAmount;
    const overtimeAmount = overtimeMinutes > 0 ? overtimeMinutes * OVERTIME_RATE : 0;
    return baseAmount + overtimeAmount;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in-progress': return 'bg-primary-light text-primary';
      case 'completed': return 'bg-success-light text-success';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'pending-review': return 'bg-orange-100 text-orange-700';
      default: return 'bg-warning-light text-warning';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-3 sm:p-4 md:p-5 lg:p-6 max-w-lg w-full">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!task) return null;

  // Team head is the primary assigned worker; support staff see timer but can't generate QR
  const currentUserId = getCurrentUserId();
  const isTeamHead = !task.worker || task.worker._id === currentUserId;
  const isDeepCleaning = task.bookingType === 'deep-cleaning-cart';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card rounded-2xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center gap-3 rounded-t-2xl">
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h2 className="font-bold text-foreground text-lg">
              {task.service?.name ?? (task.bookingType === 'deep-cleaning-cart' ? '✨ Deep Cleaning' : 'Task')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('worker.taskDetail.title')}</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${getStatusColor(task.status)}`}>
            {task.status === 'in-progress' ? t('worker.taskDetail.inProgress') : 
             task.status === 'completed' ? t('worker.taskDetail.completed') :
             task.status === 'pending-review' ? '⏳ Pending Review' :
             t('worker.taskDetail.scheduled')}
          </span>
        </div>

        <div className="p-3 sm:p-4 md:p-5 lg:p-6 space-y-6">
          {/* Timer for active tasks */}
          {task.status === 'in-progress' && (
            <>
              <div className="card-elevated p-4 sm:p-5 md:p-6 text-center bg-primary-light">
                <Timer className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-2">{t('worker.taskDetail.workInProgress')}</p>
                <p className="text-3xl font-bold text-primary font-mono">
                  {formatElapsedTime(elapsedTime)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {t('worker.taskDetail.target')}: {formatTime(task.startTime)} - {formatTime(task.endTime)}
                </p>
                {task.isOnBreak && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-amber-700 bg-amber-50 rounded-lg p-2">
                    <Coffee className="w-4 h-4" />
                    <span className="text-sm font-semibold">On Break — Waiting for customer to resume</span>
                  </div>
                )}
                {task.totalBreakMinutes && task.totalBreakMinutes > 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Total break time: {task.totalBreakMinutes} min
                  </p>
                ) : null}
                {overtimeMinutes > 0 && (
                  <div className="mt-4 p-3 bg-orange-100 border border-orange-300 rounded-lg">
                    <p className="text-sm font-semibold text-orange-800">
                      ⚠️ {t('worker.taskDetail.overtimeMinutes', { minutes: overtimeMinutes })}
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      {t('worker.taskDetail.additionalCharge', { amount: (overtimeMinutes * OVERTIME_RATE).toFixed(2) })}
                    </p>
                  </div>
                )}
              </div>

              {/* Break Request Section */}
              {!task.isOnBreak && task.service?.allowBreakRequests !== false && (
                <div className="card-elevated p-4">
                  {!showBreakForm ? (
                    <button
                      onClick={() => setShowBreakForm(true)}
                      disabled={task.breakRequests?.some(b => b.status === 'pending')}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Coffee className="w-4 h-4" />
                      {task.breakRequests?.some(b => b.status === 'pending') ? 'Break Request Pending...' : 'Request Break'}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-foreground">Request a Break</p>
                      <input
                        type="text"
                        placeholder="Reason (e.g., Lunch break, Water break)"
                        value={breakReason}
                        onChange={(e) => setBreakReason(e.target.value)}
                        className="input-clean text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleRequestBreak}
                          disabled={requestingBreak}
                          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 rounded-lg transition-colors text-sm disabled:opacity-50"
                        >
                          {requestingBreak ? 'Requesting...' : 'Send Request'}
                        </button>
                        <button
                          onClick={() => { setShowBreakForm(false); setBreakReason(''); }}
                          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Customer needs to approve the break request. Service timer will pause.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Break Status */}
              {task.breakRequests && task.breakRequests.length > 0 && (
                <div className="card-elevated p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Coffee className="w-4 h-4 text-amber-600" /> Break History
                  </h4>
                  {task.breakRequests.slice(-3).map((br) => (
                    <div key={br._id} className={`text-xs p-2 rounded-lg ${
                      br.status === 'pending' ? 'bg-yellow-50 text-yellow-800' :
                      br.status === 'active' ? 'bg-amber-50 text-amber-800 font-medium' :
                      br.status === 'completed' ? 'bg-green-50 text-green-700' :
                      br.status === 'rejected' ? 'bg-red-50 text-red-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {br.status === 'pending' && 'Pending approval...'}
                      {br.status === 'active' && 'Break active — waiting for customer to resume'}
                      {br.status === 'completed' && `Break completed (${br.durationMinutes} min)`}
                      {br.status === 'rejected' && 'Break request denied'}
                      {br.reason && ` — ${br.reason}`}
                    </div>
                  ))}
                </div>
              )}
              {hasTimeOffset && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                  ℹ️ Timer adjusted for timezone difference. The displayed time is accurate.
                </div>
              )}
            </>
          )}

          {/* Customer Information */}
          <div className="card-elevated p-5">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              {t('worker.taskDetail.customerDetails')}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('worker.taskDetail.name')}</span>
                <span className="text-sm font-medium text-foreground">{task.customer.name}</span>
              </div>
              {task.customer.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('worker.taskDetail.phone')}</span>
                  <a 
                    href={`tel:${task.customer.phone}`}
                    className="text-sm font-medium text-primary flex items-center gap-1.5 hover:underline"
                  >
                    <Phone className="w-4 h-4" />
                    {task.customer.phone}
                  </a>
                </div>
              )}
              {task.customer.email && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('worker.taskDetail.email')}</span>
                  <span className="text-sm font-medium text-foreground">{task.customer.email}</span>
                </div>
              )}
              {task.status !== 'completed' && task.status !== 'cancelled' && (
                <button
                  onClick={() => setShowChat(true)}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-muted hover:bg-muted/70 text-foreground rounded-lg transition-colors text-sm font-medium"
                >
                  <MessageCircle className="w-4 h-4 text-primary" />
                  Chat with Customer
                </button>
              )}
            </div>
          </div>

          {/* Location Information */}
          {task.location && (
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  {t('worker.taskDetail.serviceLocation')}
                </h3>
                <button
                  onClick={openMapsNavigation}
                  className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
                >
                  <Navigation className="w-4 h-4" />
                  {t('worker.taskDetail.navigate')}
                </button>
              </div>
              <div className="space-y-2 text-sm">
                {task.location.apartment && (
                  <div className="flex items-start gap-2">
                    <Home className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-muted-foreground text-xs">{t('worker.taskDetail.houseFlatNumber')}</p>
                      <p className="text-foreground font-medium">{task.location.apartment}</p>
                    </div>
                  </div>
                )}
                {task.location.building && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-muted-foreground text-xs">{t('worker.taskDetail.buildingSociety')}</p>
                      <p className="text-foreground font-medium">{task.location.building}</p>
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t border-border">
                  <p className="text-foreground">
                    {[
                      task.location.address,
                      task.location.area,
                      task.location.city,
                      task.location.state,
                      task.location.zipCode
                    ].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Schedule Information */}
          <div className="card-elevated p-5">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {t('worker.taskDetail.schedule')}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('worker.taskDetail.date')}</span>
                <span className="text-sm font-medium text-foreground">{formatDate(task.bookingDate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('worker.taskDetail.timeSlot')}</span>
                <span className="text-sm font-medium text-foreground">
                  {formatTime(task.startTime)} - {formatTime(task.endTime)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('worker.taskDetail.duration')}</span>
                <span className="text-sm font-medium text-foreground">{task.service?.duration ?? '—'} {task.service ? t('worker.taskDetail.mins') : ''}</span>
              </div>
            </div>
          </div>

          {/* Team Members (Deep Cleaning) */}
          {isDeepCleaning && task.worker && (
            <div className="card-elevated p-5">
              <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Team Members
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">👑</span>
                    <span className="text-sm font-medium text-foreground">{task.worker.name}</span>
                  </div>
                  <span className="text-xs bg-primary-light text-primary px-2 py-0.5 rounded-full font-medium">Team Head</span>
                </div>
                {task.supportStaff && task.supportStaff.length > 0 && (
                  task.supportStaff.map((s, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">👷</span>
                        <span className="text-sm text-foreground">{s.worker.name}</span>
                      </div>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Support Staff</span>
                    </div>
                  ))
                )}
                {(!task.supportStaff || task.supportStaff.length === 0) && (
                  <p className="text-xs text-muted-foreground">No support staff assigned yet</p>
                )}
              </div>
            </div>
          )}

          {/* Payment Information */}
          <div className="card-elevated p-5">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              {t('worker.taskDetail.amountToCollect')}
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('worker.taskDetail.serviceCharge')}</span>
                <span className="font-medium text-foreground">₹{task.totalAmount}</span>
              </div>
              {overtimeMinutes > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-orange-600">{t('worker.taskDetail.overtime')} ({overtimeMinutes} min × ₹{OVERTIME_RATE})</span>
                    <span className="font-medium text-orange-600">₹{(overtimeMinutes * OVERTIME_RATE).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-border pt-2"></div>
                </>
              )}
              <div className="flex items-center justify-between p-3 bg-primary-light rounded-xl mt-2">
                <span className="font-semibold text-foreground">{t('worker.taskDetail.collectFromCustomer')}</span>
                <span className="text-2xl font-bold text-primary">₹{calculateTotalAmount().toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* QR Code Section - Only team head generates start QR */}
          {task.status !== 'completed' && !task.actualStartTime && (
            isTeamHead ? (
            <div className="card-elevated p-5 text-center">
              <h3 className="font-bold text-foreground mb-3 flex items-center justify-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                {t('worker.taskDetail.serviceStartQR')}
              </h3>

              {qrCodeImage ? (
                <div>
                  <div className="bg-white p-4 rounded-xl inline-block mb-3 max-w-full">
                    <img src={qrCodeImage} alt="Service Start QR" className="w-64 h-64 max-w-full" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {t('worker.taskDetail.showQRToCustomer')}
                  </p>
                  <p className="text-xs text-warning bg-warning-light p-3 rounded-lg">
                    ⏱️ {t('worker.taskDetail.customerWillScanStart')}
                  </p>
                </div>
              ) : (
                <div>
                  <button
                    onClick={handleGenerateStartQR}
                    className="btn-brand py-3 px-6"
                  >
                    <QrCode className="w-5 h-5 inline-block mr-2" />
                    {t('worker.taskDetail.generateStartQR')}
                  </button>
                  <p className="text-sm text-muted-foreground mt-3">
                    {t('worker.taskDetail.generateWhenReach')}
                  </p>
                </div>
              )}
            </div>
            ) : (
            <div className="card-elevated p-5 text-center bg-blue-50 border-2 border-blue-200">
              <p className="text-2xl mb-2">⏳</p>
              <p className="font-semibold text-blue-800">Waiting for Team Head to start service</p>
              <p className="text-sm text-blue-600 mt-1">
                The timer will begin once <strong>{task.worker?.name || 'the team head'}</strong> generates and the customer scans the start QR.
              </p>
            </div>
            )
          )}

          {/* End QR Code Section - Only team head can end service */}
          {task.status === 'in-progress' && task.actualStartTime && isTeamHead && (
            <div className="space-y-4">
              {/* Step 1: Upload Completion Photos (min 2 required) */}
              <div className="card-elevated p-5 bg-gradient-to-br from-teal-50 to-cyan-50 border-2 border-teal-200">
                <h3 className="font-bold text-foreground mb-3 flex items-center justify-center gap-2">
                  <Camera className="w-5 h-5 text-teal-600" />
                  Step 1: Upload Proof Photos ({task.completionPhotos?.length ?? 0}/2 min)
                </h3>
                {/* Photo thumbnails grid */}
                {task.completionPhotos && task.completionPhotos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {task.completionPhotos.map((p, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-teal-400">
                        <img
                          src={bookingsAPI.getCompletionPhotoUrl(p.url)}
                          alt={`Proof ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-0 right-0 bg-teal-600 text-white text-xs px-1 rounded-tl">
                          {i + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {uploadingCompletionPhoto ? (
                  <div className="text-center py-4">
                    <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-teal-700 text-sm font-medium">Uploading photo...</p>
                  </div>
                ) : showCompletionCapture ? (
                  <PhotoCapture
                    onPhotoCapture={handleCompletionPhotoCapture}
                    onCancel={() => setShowCompletionCapture(false)}
                    showPreview={false}
                    autoUpload={true}
                  />
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowCompletionCapture(true)}
                      className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                      {task.completionPhotos && task.completionPhotos.length > 0 ? 'Add Another Photo' : 'Take Completion Photo'}
                    </button>
                    {(task.completionPhotos?.length ?? 0) < 2 && (
                      <p className="text-xs text-teal-700 text-center">
                        ⚠️ Minimum 2 photos required before ending service
                      </p>
                    )}
                    {(task.completionPhotos?.length ?? 0) >= 2 && (
                      <p className="text-xs text-green-700 text-center flex items-center justify-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> {task.completionPhotos!.length} photos uploaded — you can end service
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="card-elevated p-5 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
                <h3 className="font-bold text-foreground mb-3 flex items-center justify-center gap-2">
                  <QrCode className="w-5 h-5 text-green-600" />
                  Step 2: {t('worker.taskDetail.step1ServiceEnd')}
                </h3>
                
                {task.serviceEndQRCode ? (
                  <div>
                    <div className="bg-white p-4 rounded-xl inline-block mb-3 shadow-lg max-w-full">
                      <img src={qrCodeImage} alt="Service End QR" className="w-64 h-64 max-w-full" />
                    </div>
                    <p className="text-sm font-medium text-green-700 mb-2">
                      ✅ {t('worker.taskDetail.showEndQR')}
                    </p>
                    <div className="text-xs bg-green-100 text-green-800 p-3 rounded-lg space-y-1">
                      <p className="font-semibold">{t('worker.taskDetail.customerWillScanEnd')}</p>
                      <p>• {t('worker.taskDetail.stopTimer')}</p>
                      <p>• {t('worker.taskDetail.calculateCharges')}</p>
                      <p>• {t('worker.taskDetail.completeBooking')}</p>
                    </div>
                    {overtimeMinutes > 0 && (
                      <div className="mt-3 bg-orange-100 border border-orange-300 rounded-lg p-3">
                        <p className="text-sm font-semibold text-orange-800">
                          ⚠️ {t('worker.taskDetail.overtimeMinutes', { minutes: overtimeMinutes })}
                        </p>
                        <p className="text-xs text-orange-700">
                          Extra ₹{(overtimeMinutes * OVERTIME_RATE).toFixed(2)} will be added to final bill
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={handleGenerateEndQR}
                      disabled={(task.completionPhotos?.length ?? 0) < 2}
                      className={`font-semibold py-3 px-6 rounded-lg transition-colors shadow-md w-full text-white ${
                        (task.completionPhotos?.length ?? 0) < 2
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      <QrCode className="w-5 h-5 inline-block mr-2" />
                      {t('worker.taskDetail.generateEndQR')}
                    </button>
                    {(task.completionPhotos?.length ?? 0) < 2 ? (
                      <p className="text-xs text-orange-600 mt-2 text-center font-medium">
                        ⚠️ Upload at least 2 completion photos first (Step 1)
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        {t('worker.taskDetail.customerScanEndCalc')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment QR and proof - shown for pending-review and completed tasks */}
          {(task.status === 'pending-review' || task.status === 'completed') && task.actualEndTime && (
            <div className="space-y-4">
              {/* Review Banner - only for pending-review */}
              {task.status === 'pending-review' && (
                <div className="card-elevated p-4 bg-orange-50 border-2 border-orange-300 text-center">
                  <p className="text-lg font-bold text-orange-700">⏳ Awaiting Admin Review</p>
                  <p className="text-sm text-orange-600 mt-1">
                    Your work photos have been submitted. The admin will review and confirm payment received.
                  </p>
                </div>
              )}
            <div className="space-y-4">
              {/* Step 2: Payment QR Code */}
              <div className="card-elevated p-5 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
                  <h3 className="font-bold text-foreground mb-3 flex items-center justify-center gap-2">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                    {t('worker.taskDetail.step2PaymentQR')} 💳
                  </h3>
                  
                  {paymentQRImage ? (
                    <div>
                      <div className="bg-white p-4 rounded-xl inline-block mb-3 shadow-lg max-w-full">
                        <img src={paymentQRImage} alt="Payment QR" className="w-64 h-64 object-contain max-w-full" />
                      </div>
                      
                      <div className="text-xs bg-purple-100 text-purple-800 p-3 rounded-lg space-y-1">
                        <p className="font-semibold">{t('worker.taskDetail.showQRForPayment')}</p>
                        <p>• {t('worker.taskDetail.collect')}: ₹{calculateTotalAmount().toFixed(2)}</p>
                        {overtimeMinutes > 0 && (
                          <p>• {t('worker.taskDetail.includesOvertime', { amount: (overtimeMinutes * OVERTIME_RATE).toFixed(2) })}</p>
                        )}
                        <p>• {t('worker.taskDetail.customerCanScan')}</p>
                        {adminPaymentQR && (
                          <p className="text-green-700 font-medium mt-2">✓ {t('worker.taskDetail.usingAdminQR')}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <button
                        onClick={generatePaymentQR}
                        className="btn-brand py-3 px-6"
                      >
                        <DollarSign className="w-5 h-5 inline-block mr-2" />
                        {t('worker.taskDetail.showPaymentQR')}
                      </button>
                    </div>
                  )}
                </div>

              {/* Step 3: Payment Proof Upload - Show after payment QR is displayed */}
              {paymentQRImage && (
                <div className="card-elevated p-5 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200">
                  <h3 className="font-bold text-foreground mb-3 flex items-center justify-center gap-2">
                    <Camera className="w-5 h-5 text-amber-600" />
                    {t('worker.taskDetail.step3PaymentProof')} 📸✅
                  </h3>
                  
                  {task.paymentProof && !showPaymentProofCapture ? (
                    <div className="space-y-3">
                      <div className="relative rounded-lg overflow-hidden border-2 border-green-500">
                        <img 
                          src={bookingsAPI.getCompletionPhotoUrl(task.paymentProof.url)}
                          alt="Payment proof" 
                          className="w-full h-auto max-h-64 object-contain bg-black mx-auto"
                        />
                      </div>
                      <div className="flex items-center justify-center gap-2 text-green-700 font-medium">
                        <CheckCircle className="w-5 h-5" />
                        {t('worker.taskDetail.paymentProofUploaded')}
                      </div>
                      {task.paymentProof.transactionId && (
                        <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-amber-700 font-medium">{t('worker.taskDetail.transactionIdLabel')}</span>
                            <span className="font-mono font-semibold text-foreground">{task.paymentProof.transactionId}</span>
                          </div>
                          {task.paymentProof.transactionTime && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-amber-700 font-medium">{t('worker.taskDetail.transactionTimeLabel')}</span>
                              <span className="text-foreground">{new Date(task.paymentProof.transactionTime).toLocaleString('en-IN')}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="bg-green-100 border border-green-300 rounded-lg p-3 text-center">
                        <p className="text-green-800 font-semibold">🎉 {t('worker.taskDetail.taskFullyCompleted')}</p>
                        <p className="text-xs text-green-700 mt-1">{t('worker.taskDetail.allDocumented')}</p>
                      </div>
                      <button
                        onClick={() => { setPaymentTransactionId(''); setPaymentTransactionTime(new Date().toISOString()); setShowPaymentProofCapture(true); }}
                        className="w-full py-2 px-4 border-2 border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
                      >
                        {t('worker.taskDetail.reuploadPaymentProof')}
                      </button>
                    </div>
                  ) : showPaymentProofCapture ? (
                    <PhotoCapture
                      onPhotoCapture={handlePaymentProofCapture}
                      onCancel={() => { setShowPaymentProofCapture(false); }}
                      showPreview={false}
                      autoUpload={true}
                    />
                  ) : uploadingPaymentProof ? (
                    <div className="text-center py-8">
                      <div className="animate-spin w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                      <p className="text-amber-700 font-medium">{t('worker.taskDetail.uploadingProof')}</p>
                      <p className="text-xs text-muted-foreground mt-2">{t('worker.taskDetail.pleaseWait')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Transaction ID input - required before upload */}
                      <div>
                        <label className="block text-sm font-semibold text-amber-800 mb-1">
                          {t('worker.taskDetail.transactionId')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={paymentTransactionId}
                          onChange={(e) => setPaymentTransactionId(e.target.value)}
                          placeholder={t('worker.taskDetail.enterUPIRef')}
                          className="w-full px-3 py-2.5 border-2 border-amber-200 rounded-lg focus:border-amber-500 focus:outline-none text-sm bg-white"
                        />
                        <p className="text-xs text-amber-600 mt-1">
                          🕐 {t('worker.taskDetail.autoTimestamp')}
                        </p>
                      </div>
                      <button
                        onClick={handleOpenPaymentProofCapture}
                        disabled={uploadingPaymentProof}
                        className="btn-brand py-3 px-6 w-full bg-amber-600 hover:bg-amber-700"
                      >
                        <Camera className="w-5 h-5 inline-block mr-2" />
                        {t('worker.taskDetail.takeUploadProof')}
                      </button>
                      <div className="text-xs bg-amber-100 text-amber-800 p-3 rounded-lg space-y-1">
                        <p className="font-semibold">{t('worker.taskDetail.afterPayment')}</p>
                        <p>• {t('worker.taskDetail.enterRef')}</p>
                        <p>• {t('worker.taskDetail.takePhoto')}</p>
                        <p>• {t('worker.taskDetail.recordedWithProof')}</p>
                        <p className="text-green-700 font-medium mt-2">✓ {t('worker.taskDetail.protectsBoth')}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {(task.status as string) !== 'completed' && (
              <button
                onClick={onClose}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                  (task.status as string) === 'in-progress'
                    ? 'border-2 border-green-600 text-green-600 hover:bg-green-50'
                    : 'border border-border text-foreground hover:bg-muted'
                }`}
              >
                {t('worker.taskDetail.close')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      {showChat && (
        <ChatModal
          bookingId={taskId}
          currentUserId={getCurrentUserId()}
          currentUserRole="worker"
          otherPartyName={task.customer.name}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
};

export default TaskDetailModal;
