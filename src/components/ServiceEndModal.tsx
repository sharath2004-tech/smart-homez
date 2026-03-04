import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QrCode, Clock, CheckCircle, AlertCircle, Timer, DollarSign } from "lucide-react";
import EmbeddedQRScanner from "./EmbeddedQRScanner";

interface ServiceEndModalProps {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  serviceName: string;
  actualStartTime: string;
  scheduledDuration: number; // in hours
  totalAmount: number;
  onServiceEnded: (overtimeData?: { overtimeMinutes: number; overtimeCharges: number; totalAmount: number }) => void;
}

const ServiceEndModal = ({ 
  open, 
  onClose, 
  bookingId,
  serviceName,
  actualStartTime,
  scheduledDuration,
  totalAmount,
  onServiceEnded
}: ServiceEndModalProps) => {
  const [qrCode, setQrCode] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [completionData, setCompletionData] = useState<{ actualDurationMinutes: number; scheduledDurationMinutes: number; overtimeMinutes: number; overtimeCharges: number; totalAmount: number } | null>(null);

  const handleQRScanned = (scannedCode: string) => {
    setQrCode(scannedCode);
    setShowScanner(false);
    setError("");
  };

  const calculateCurrentDuration = () => {
    if (!actualStartTime) return 0;
    const start = new Date(actualStartTime);
    const now = new Date();
    const durationMs = now.getTime() - start.getTime();
    return Math.floor(durationMs / (1000 * 60)); // minutes
  };

  const currentDuration = calculateCurrentDuration();
  const scheduledMinutes = scheduledDuration * 60;
  const estimatedOvertime = Math.max(0, currentDuration - scheduledMinutes);

  const handleEndService = async () => {
    if (!qrCode) {
      setError("Please scan the worker's end-of-service QR code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/bookings/${bookingId}/scan-end-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          qrCode
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to end service');
      }

      const result = await response.json();
      
      setCompletionData(result.booking);
      setSuccess(true);
      
      setTimeout(() => {
        onServiceEnded(result.booking);
        handleClose();
      }, 3000);

    } catch (err) {
      setError((err as Error).message || 'Failed to end service');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQrCode("");
    setShowScanner(false);
    setError("");
    setSuccess(false);
    setCompletionData(null);
    onClose();
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (success && completionData) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
            <h3 className="text-xl font-semibold">Service Completed!</h3>
            
            <div className="w-full space-y-3 bg-muted/50 p-4 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-medium">{formatDuration(completionData.actualDurationMinutes)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Scheduled:</span>
                <span className="font-medium">{formatDuration(completionData.scheduledDurationMinutes)}</span>
              </div>
              {completionData.overtimeMinutes > 0 && (
                <>
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Overtime:</span>
                    <span className="font-medium">{formatDuration(completionData.overtimeMinutes)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Overtime Charge:</span>
                    <span className="font-medium">₹{completionData.overtimeCharges?.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total Amount:</span>
                    <span>₹{completionData.totalAmount?.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Thank you for using our service!
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            End Service
          </DialogTitle>
          <DialogDescription>
            Scan the worker's end-of-service QR code to complete and calculate final charges
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Service Summary */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <h4 className="font-medium">Service Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service:</span>
                <span className="font-medium">{serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Started At:</span>
                <span className="font-medium">
                  {new Date(actualStartTime).toLocaleString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: 'short'
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Duration:</span>
                <span className="font-medium">{formatDuration(currentDuration)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scheduled Duration:</span>
                <span className="font-medium">{formatDuration(scheduledMinutes)}</span>
              </div>
              {estimatedOvertime > 0 && (
                <div className="flex justify-between text-orange-600 font-medium pt-2 border-t">
                  <span>Estimated Overtime:</span>
                  <span>{formatDuration(estimatedOvertime)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Overtime Warning */}
          {estimatedOvertime > 0 && (
            <Alert>
              <Timer className="h-4 w-4" />
              <AlertDescription>
                This service is running overtime. Additional charges may apply at 1.5x the hourly rate.
              </AlertDescription>
            </Alert>
          )}

          {/* QR Code Scanner */}
          <div className="space-y-3">
            <Label>Scan End-of-Service QR Code</Label>
            
            {showScanner ? (
              <div className="space-y-3">
                <EmbeddedQRScanner
                  onScanSuccess={handleQRScanned}
                  onClose={() => setShowScanner(false)}
                />
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setShowScanner(false)}
                >
                  Cancel Scanning
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="QR Code (or scan using camera)"
                    value={qrCode}
                    onChange={(e) => setQrCode(e.target.value)}
                    disabled={loading}
                  />
                  <Button
                    variant="outline"
                    onClick={() => setShowScanner(true)}
                    disabled={loading}
                  >
                    <QrCode className="w-4 h-4" />
                  </Button>
                </div>
                {qrCode && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    QR Code scanned successfully
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Estimated Charges */}
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="w-4 h-4" />
              Estimated Final Charges
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Amount:</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>
              {estimatedOvertime > 0 && (
                <>
                  <div className="flex justify-between text-orange-600">
                    <span>Estimated Overtime Charge:</span>
                    <span>₹{((estimatedOvertime / 60) * (totalAmount / scheduledDuration) * 1.5).toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-1 flex justify-between font-semibold">
                    <span>Estimated Total:</span>
                    <span>₹{(totalAmount + ((estimatedOvertime / 60) * (totalAmount / scheduledDuration) * 1.5)).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              * Final charges will be calculated when you scan the end QR code
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEndService}
              disabled={loading || !qrCode}
              className="flex-1"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete Service
                </>
              )}
            </Button>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              Scanning the end QR code will stop the timer and calculate the final charges including any overtime. You'll be able to rate and review the service after completion.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ServiceEndModal;
