import PhotoCapture from "@/components/PhotoCapture";
import { bookingsAPI, settingsAPI } from "@/lib/api";
import {
    ArrowLeft, Calendar,
    Camera,
    CheckCircle,
    DollarSign,
    Home,
    MapPin,
    Navigation,
    Phone,
    QrCode, Timer, User
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
interface Task {
  _id: string;
  service: {
    _id: string;
    name: string;
    description?: string;
    price: number;
    duration: number;
  };
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
  
  const OVERTIME_RATE = 2.5; // ₹2.5 per minute

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

  // Generate payment QR when task is completed
  useEffect(() => {
    if (task?.status === 'completed' && task?.actualEndTime && !paymentQRImage) {
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
      default: return 'bg-warning-light text-warning';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-6 max-w-lg w-full">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!task) return null;

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
            <h2 className="font-bold text-foreground text-lg">{task.service.name}</h2>
            <p className="text-sm text-muted-foreground">{t('worker.taskDetail.title')}</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${getStatusColor(task.status)}`}>
            {task.status === 'in-progress' ? t('worker.taskDetail.inProgress') : 
             task.status === 'completed' ? t('worker.taskDetail.completed') : t('worker.taskDetail.scheduled')}
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* Timer for active tasks */}
          {task.status === 'in-progress' && (
            <>
              <div className="card-elevated p-6 text-center bg-primary-light">
                <Timer className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-2">{t('worker.taskDetail.workInProgress')}</p>
                <p className="text-3xl font-bold text-primary font-mono">
                  {formatElapsedTime(elapsedTime)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {t('worker.taskDetail.target')}: {formatTime(task.startTime)} - {formatTime(task.endTime)}
                </p>
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
                <span className="text-sm font-medium text-foreground">{task.service.duration} {t('worker.taskDetail.mins')}</span>
              </div>
            </div>
          </div>

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

          {/* QR Code Section - Show for confirmed/scheduled tasks */}
          {task.status !== 'completed' && !task.actualStartTime && (
            <div className="card-elevated p-5 text-center">
              <h3 className="font-bold text-foreground mb-3 flex items-center justify-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                {t('worker.taskDetail.serviceStartQR')}
              </h3>
              
              {qrCodeImage ? (
                <div>
                  <div className="bg-white p-4 rounded-xl inline-block mb-3">
                    <img src={qrCodeImage} alt="Service Start QR" className="w-64 h-64" />
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
          )}

          {/* End QR Code Section - Show for in-progress tasks */}
          {task.status === 'in-progress' && task.actualStartTime && (
            <div className="space-y-4">
              {/* Step 1: End QR Code Section */}
              <div className="card-elevated p-5 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
                <h3 className="font-bold text-foreground mb-3 flex items-center justify-center gap-2">
                  <QrCode className="w-5 h-5 text-green-600" />
                  {t('worker.taskDetail.step1ServiceEnd')}
                </h3>
                
                {task.serviceEndQRCode ? (
                  <div>
                    <div className="bg-white p-4 rounded-xl inline-block mb-3 shadow-lg">
                      <img src={qrCodeImage} alt="Service End QR" className="w-64 h-64" />
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
                      className="font-semibold py-3 px-6 rounded-lg transition-colors shadow-md w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      <QrCode className="w-5 h-5 inline-block mr-2" />
                      {t('worker.taskDetail.generateEndQR')}
                    </button>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      {t('worker.taskDetail.customerScanEndCalc')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment QR and proof - shown once task is completed */}
          {task.status === 'completed' && task.actualEndTime && (
            <div className="space-y-4">
              {/* Step 2: Payment QR Code */}
              <div className="card-elevated p-5 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
                  <h3 className="font-bold text-foreground mb-3 flex items-center justify-center gap-2">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                    {t('worker.taskDetail.step2PaymentQR')} 💳
                  </h3>
                  
                  {paymentQRImage ? (
                    <div>
                      <div className="bg-white p-4 rounded-xl inline-block mb-3 shadow-lg">
                        <img src={paymentQRImage} alt="Payment QR" className="w-64 h-64 object-contain" />
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
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {task.status === 'in-progress' && (
              <button
                onClick={onClose}
                className="flex-1 py-3 border-2 border-green-600 text-green-600 rounded-lg font-medium hover:bg-green-50 transition-colors"
              >
                {t('worker.taskDetail.close')}
              </button>
            )}
            {task.status !== 'completed' && task.status !== 'in-progress' && (
              <button
                onClick={onClose}
                className="flex-1 py-3 border border-border rounded-lg text-foreground font-medium hover:bg-muted transition-colors"
              >
                {t('worker.taskDetail.close')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
