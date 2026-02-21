import { bookingsAPI } from "@/lib/api";
import {
    ArrowLeft, Calendar, CheckCircle,
    DollarSign,
    Home,
    MapPin,
    Navigation,
    Phone,
    QrCode, Timer, User
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import PaymentModal from "./PaymentModal";
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
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [hasTimeOffset, setHasTimeOffset] = useState(false);
  
  // Use refs to persist values across renders
  const timeOffsetRef = useRef<number>(0);
  const offsetCalculatedRef = useRef<boolean>(false);
  const actualStartTimeRef = useRef<string | null>(null);

  const fetchTaskDetail = async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await bookingsAPI.getById(taskId);
      setTask(response.booking);
      
      // Generate QR code if service is ready to start
      if (response.booking.serviceStartQRCode && !response.booking.actualStartTime) {
        generateQRCode(response.booking.serviceStartQRCode);
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
      // Only calculate offset once when actualStartTime first appears or changes
      if (task.actualStartTime !== actualStartTimeRef.current) {
        actualStartTimeRef.current = task.actualStartTime;
        offsetCalculatedRef.current = false;
      }
      
      if (!offsetCalculatedRef.current) {
        const startTime = new Date(task.actualStartTime!).getTime();
        const initialNow = Date.now();
        const initialElapsed = Math.floor((initialNow - startTime) / 1000);
        
        // If time is significantly negative (more than 5 minutes), likely a timezone issue
        timeOffsetRef.current = initialElapsed < -300 ? -initialElapsed : 0;
        offsetCalculatedRef.current = true;
        
        // Only show info in development
        if (timeOffsetRef.current > 0 && import.meta.env.DEV) {
          console.info('Timer adjusted for timezone offset:', timeOffsetRef.current, 'seconds');
        }
        setHasTimeOffset(timeOffsetRef.current > 0);
      }
      
      const interval = setInterval(() => {
        const start = new Date(task.actualStartTime!).getTime();
        const now = Date.now();
        const rawElapsed = Math.floor((now - start) / 1000);
        const elapsed = Math.max(0, rawElapsed + timeOffsetRef.current);
        
        setElapsedTime(elapsed);
      }, 1000);

      return () => clearInterval(interval);
    } else {
      // Reset when task is not in progress
      setElapsedTime(0);
      setHasTimeOffset(false);
      actualStartTimeRef.current = null;
      offsetCalculatedRef.current = false;
      timeOffsetRef.current = 0;
    }
  }, [task?.status, task?.actualStartTime]);

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

  const handleCompleteTask = async () => {
    if (!confirm('Mark this task as completed and collect payment?')) {
      return;
    }

    try {
      await bookingsAPI.update(taskId, { 
        status: 'completed', 
        actualEndTime: new Date().toISOString() 
      });
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Failed to complete task');
    }
  };

  const handlePaymentConfirmed = () => {
    setShowPaymentModal(false);
    alert('Payment submitted successfully! You can now close this screen.');
    onRefresh();
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
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Amount</span>
              <span className="text-2xl font-bold text-primary">₹{task.totalAmount}</span>
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

          {/* Action Buttons */}
          <div className="flex gap-3">
            {task.status === 'in-progress' && (
              <button
                onClick={handleCompleteTask}
                className="flex-1 btn-brand py-3 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Complete Task
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

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          bookingId={taskId}
          onClose={() => {
            setShowPaymentModal(false);
            onClose();
          }}
          onPaymentConfirmed={handlePaymentConfirmed}
        />
      )}
    </div>
  );
};

export default TaskDetailModal;
