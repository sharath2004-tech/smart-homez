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
  };
}

interface TaskDetailModalProps {
  taskId: string;
  onClose: () => void;
  onRefresh: () => void;
}

const TaskDetailModal = ({ taskId, onClose, onRefresh }: TaskDetailModalProps) => {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCodeImage, setQrCodeImage] = useState<string>("");
  const [paymentQRImage, setPaymentQRImage] = useState<string>("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [overtimeMinutes, setOvertimeMinutes] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [hasTimeOffset, setHasTimeOffset] = useState(false);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [adminPaymentQR, setAdminPaymentQR] = useState<string>("");
  const [showPaymentProofCapture, setShowPaymentProofCapture] = useState(false);
  const [uploadingPaymentProof, setUploadingPaymentProof] = useState(false);
  
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
      if (!silent) alert('Failed to load task details');
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
  }, [task?.status, task?.actualStartTime, task?.bookingDate, task?.endTime]);

  // Generate payment QR when task is completed and has completion photo
  useEffect(() => {
    if (task?.status === 'completed' && task.completionPhoto && !paymentQRImage) {
      generatePaymentQR();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.status, task?.completionPhoto]);

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
      alert('QR Code generated! Show this to customer to start service.');
    } catch (error) {
      console.error('Error generating QR:', error);
      alert('Failed to generate QR code');
    }
  };

  const handleGenerateEndQR = async () => {
    try {
      const response = await bookingsAPI.generateEndQR(taskId);
      setTask({ ...task!, serviceEndQRCode: response.qrCode });
      generateQRCode(response.qrCode);
      alert('End QR Code generated! Show this to customer to end service and calculate final charges.');
    } catch (error) {
      console.error('Error generating end QR:', error);
      alert('Failed to generate end QR code');
    }
  };

  const handlePhotoCapture = async (file: File) => {
    try {
      setUploadingPhoto(true);
      
      // Use the API utility method
      const result = await bookingsAPI.uploadCompletionPhoto(taskId, file);
      
      // Update task with completion photo
      setTask({ ...task!, completionPhoto: result.completionPhoto });
      setShowPhotoCapture(false);
      
      alert('✅ Completion photo uploaded successfully! Payment QR code is now available.');
      
      // Generate payment QR code
      await generatePaymentQR();
      
      // Refresh task data
      await fetchTaskDetail(true);
    } catch (error) {
      console.error('Error uploading completion photo:', error);
      alert((error as Error).message || 'Failed to upload completion photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePaymentProofCapture = async (file: File) => {
    try {
      setUploadingPaymentProof(true);
      
      // Use the API utility method
      const result = await bookingsAPI.uploadPaymentProof(taskId, file);
      
      // Update task with payment proof
      setTask({ ...task!, paymentProof: result.paymentProof });
      setShowPaymentProofCapture(false);
      
      alert('✅ Payment proof uploaded successfully! Task is now fully documented.');
      
      // Refresh task data
      await fetchTaskDetail(true);
      onRefresh(); // Refresh parent list
    } catch (error) {
      console.error('Error uploading payment proof:', error);
      alert((error as Error).message || 'Failed to upload payment proof');
    } finally {
      setUploadingPaymentProof(false);
    }
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
            <p className="text-sm text-muted-foreground">Task Details</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${getStatusColor(task.status)}`}>
            {task.status === 'in-progress' ? 'In Progress' : 
             task.status === 'completed' ? 'Completed' : 'Scheduled'}
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* Timer for active tasks */}
          {task.status === 'in-progress' && (
            <>
              <div className="card-elevated p-6 text-center bg-primary-light">
                <Timer className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-2">Work in Progress</p>
                <p className="text-3xl font-bold text-primary font-mono">
                  {formatElapsedTime(elapsedTime)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Target: {formatTime(task.startTime)} - {formatTime(task.endTime)}
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
              Customer Details
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Name</span>
                <span className="text-sm font-medium text-foreground">{task.customer.name}</span>
              </div>
              {task.customer.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Phone</span>
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
                  <span className="text-sm text-muted-foreground">Email</span>
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
                  Service Location
                </h3>
                <button
                  onClick={openMapsNavigation}
                  className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
                >
                  <Navigation className="w-4 h-4" />
                  Navigate
                </button>
              </div>
              <div className="space-y-2 text-sm">
                {task.location.apartment && (
                  <div className="flex items-start gap-2">
                    <Home className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-muted-foreground text-xs">House/Flat Number</p>
                      <p className="text-foreground font-medium">{task.location.apartment}</p>
                    </div>
                  </div>
                )}
                {task.location.building && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-muted-foreground text-xs">Building/Society</p>
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
              Schedule
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Date</span>
                <span className="text-sm font-medium text-foreground">{formatDate(task.bookingDate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Time Slot</span>
                <span className="text-sm font-medium text-foreground">
                  {formatTime(task.startTime)} - {formatTime(task.endTime)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Duration</span>
                <span className="text-sm font-medium text-foreground">{task.service.duration} mins</span>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="card-elevated p-5">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Payment
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Base Amount</span>
                <span className="font-medium text-foreground">₹{task.totalAmount}</span>
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

          {/* QR Code Section - Show for confirmed/scheduled tasks */}
          {task.status !== 'completed' && !task.actualStartTime && (
            <div className="card-elevated p-5 text-center">
              <h3 className="font-bold text-foreground mb-3 flex items-center justify-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                Service Start QR Code
              </h3>
              
              {qrCodeImage ? (
                <div>
                  <div className="bg-white p-4 rounded-xl inline-block mb-3">
                    <img src={qrCodeImage} alt="Service Start QR" className="w-64 h-64" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Show this QR code to customer when you arrive
                  </p>
                  <p className="text-xs text-warning bg-warning-light p-3 rounded-lg">
                    ⏱️ Customer will scan this to start the service timer
                  </p>
                </div>
              ) : (
                <div>
                  <button
                    onClick={handleGenerateStartQR}
                    className="btn-brand py-3 px-6"
                  >
                    <QrCode className="w-5 h-5 inline-block mr-2" />
                    Generate Start QR Code
                  </button>
                  <p className="text-sm text-muted-foreground mt-3">
                    Generate QR code when you reach customer location
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
                  Step 1: Service End QR Code
                </h3>
                
                {task.serviceEndQRCode ? (
                  <div>
                    <div className="bg-white p-4 rounded-xl inline-block mb-3 shadow-lg">
                      <img src={qrCodeImage} alt="Service End QR" className="w-64 h-64" />
                    </div>
                    <p className="text-sm font-medium text-green-700 mb-2">
                      ✅ Show this QR code to customer to end service
                    </p>
                    <div className="text-xs bg-green-100 text-green-800 p-3 rounded-lg space-y-1">
                      <p className="font-semibold">Customer will scan this QR to:</p>
                      <p>• Stop the service timer</p>
                      <p>• Calculate final charges including overtime</p>
                      <p>• Complete the booking</p>
                    </div>
                    {overtimeMinutes > 0 && (
                      <div className="mt-3 bg-orange-100 border border-orange-300 rounded-lg p-3">
                        <p className="text-sm font-semibold text-orange-800">
                          ⚠️ Overtime: {overtimeMinutes} minutes
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
                      Generate End QR Code
                    </button>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Customer will scan to end service and calculate charges
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Completion Photo Upload - Show for completed tasks after QR scan */}
          {task.status === 'completed' && task.actualEndTime && (
            <div className="space-y-4">
              {/* Completion Photo Upload Section */}
              <div className="card-elevated p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
                <h3 className="font-bold text-foreground mb-3 flex items-center justify-center gap-2">
                  <Camera className="w-5 h-5 text-blue-600" />
                  Step 2: Upload Completion Photo 📸
                </h3>
                
                {task.completionPhoto ? (
                  <div className="space-y-3">
                    <div className="relative rounded-lg overflow-hidden border-2 border-green-500">
                      <img 
                        src={bookingsAPI.getCompletionPhotoUrl(task.completionPhoto.url)}
                        alt="Completion photo" 
                        className="w-full h-auto max-h-64 object-contain bg-black mx-auto"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2 text-green-700 font-medium">
                      <CheckCircle className="w-5 h-5" />
                      Photo uploaded successfully!
                    </div>
                    <button
                      onClick={() => setShowPhotoCapture(true)}
                      className="w-full py-2 px-4 border-2 border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      Re-upload Photo
                    </button>
                  </div>
                ) : showPhotoCapture ? (
                  <PhotoCapture
                    onPhotoCapture={handlePhotoCapture}
                    onCancel={() => setShowPhotoCapture(false)}
                    showPreview={true}
                  />
                ) : (
                  <div>
                    <button
                      onClick={() => setShowPhotoCapture(true)}
                      disabled={uploadingPhoto}
                      className="btn-brand py-3 px-6 w-full"
                    >
                      <Camera className="w-5 h-5 inline-block mr-2" />
                      {uploadingPhoto ? 'Uploading...' : 'Take Completion Photo'}
                    </button>
                    <div className="mt-3 text-xs bg-blue-100 text-blue-800 p-3 rounded-lg space-y-1">
                      <p className="font-semibold">Why upload a photo?</p>
                      <p>• Proves work was completed</p>
                      <p>• Protects you from disputes</p>
                      <p>• Builds customer trust</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Payment QR Code - Show after photo upload */}
              {task.completionPhoto && (
                <div className="card-elevated p-5 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
                  <h3 className="font-bold text-foreground mb-3 flex items-center justify-center gap-2">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                    Step 3: Payment QR Code 💳
                  </h3>
                  
                  {paymentQRImage ? (
                    <div>
                      <div className="bg-white p-4 rounded-xl inline-block mb-3 shadow-lg">
                        <img src={paymentQRImage} alt="Payment QR" className="w-64 h-64 object-contain" />
                      </div>
                      
                      <div className="text-xs bg-purple-100 text-purple-800 p-3 rounded-lg space-y-1">
                        <p className="font-semibold">Show this QR to customer for payment:</p>
                        <p>• Total Amount: ₹{calculateTotalAmount().toFixed(2)}</p>
                        {overtimeMinutes > 0 && (
                          <p>• Includes ₹{(overtimeMinutes * OVERTIME_RATE).toFixed(2)} overtime charges</p>
                        )}
                        <p>• Customer can scan to complete payment</p>
                        {adminPaymentQR && (
                          <p className="text-green-700 font-medium mt-2">✓ Using admin's payment QR code</p>
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
                        Show Payment QR
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Payment Proof Upload - Show after payment QR is displayed */}
              {task.completionPhoto && paymentQRImage && (
                <div className="card-elevated p-5 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200">
                  <h3 className="font-bold text-foreground mb-3 flex items-center justify-center gap-2">
                    <Camera className="w-5 h-5 text-amber-600" />
                    Step 4: Upload Payment Proof 📸✅
                  </h3>
                  
                  {task.paymentProof ? (
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
                        Payment proof uploaded successfully!
                      </div>
                      <div className="bg-green-100 border border-green-300 rounded-lg p-3 text-center">
                        <p className="text-green-800 font-semibold">🎉 Task Fully Completed!</p>
                        <p className="text-xs text-green-700 mt-1">All documentation has been submitted</p>
                      </div>
                      <button
                        onClick={() => setShowPaymentProofCapture(true)}
                        className="w-full py-2 px-4 border-2 border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
                      >
                        Re-upload Payment Proof
                      </button>
                    </div>
                  ) : showPaymentProofCapture ? (
                    <PhotoCapture
                      onPhotoCapture={handlePaymentProofCapture}
                      onCancel={() => setShowPaymentProofCapture(false)}
                      showPreview={true}
                    />
                  ) : (
                    <div>
                      <button
                        onClick={() => setShowPaymentProofCapture(true)}
                        disabled={uploadingPaymentProof}
                        className="btn-brand py-3 px-6 w-full bg-amber-600 hover:bg-amber-700"
                      >
                        <Camera className="w-5 h-5 inline-block mr-2" />
                        {uploadingPaymentProof ? 'Uploading...' : 'Upload Payment Proof'}
                      </button>
                      <div className="mt-3 text-xs bg-amber-100 text-amber-800 p-3 rounded-lg space-y-1">
                        <p className="font-semibold">After customer makes payment:</p>
                        <p>• Ask customer to show payment confirmation</p>
                        <p>• Take a photo of the payment screen/receipt</p>
                        <p>• Upload as proof of payment completion</p>
                        <p className="text-green-700 font-medium mt-2">✓ Protects both you and the customer</p>
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
                Close
              </button>
            )}
            {task.status !== 'completed' && task.status !== 'in-progress' && (
              <button
                onClick={onClose}
                className="flex-1 py-3 border border-border rounded-lg text-foreground font-medium hover:bg-muted transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
