import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QrCode, Clock, CheckCircle, AlertCircle, FileText, Briefcase } from "lucide-react";
import EmbeddedQRScanner from "./EmbeddedQRScanner";

interface ServiceStartModalProps {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  serviceName: string;
  workerName: string;
  workerProfile?: {
    specialization?: string[];
    experience?: number;
  };
  onServiceStarted: () => void;
}

const ServiceStartModal = ({ 
  open, 
  onClose, 
  bookingId,
  serviceName,
  workerName,
  workerProfile,
  onServiceStarted
}: ServiceStartModalProps) => {
  const [qrCode, setQrCode] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [jobDescriptionAcknowledged, setJobDescriptionAcknowledged] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleQRScanned = (scannedCode: string) => {
    setQrCode(scannedCode);
    setShowScanner(false);
    setError("");
  };

  const handleStartService = async () => {
    // Validation
    if (!qrCode) {
      setError("Please scan the worker's QR code");
      return;
    }

    if (!termsAccepted) {
      setError("Please accept the terms and conditions");
      return;
    }

    if (!jobDescriptionAcknowledged) {
      setError("Please acknowledge the job description");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/bookings/${bookingId}/scan-start-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          qrCode,
          termsAccepted,
          jobDescriptionAcknowledged
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to start service');
      }

      const result = await response.json();
      
      setSuccess(true);
      setTimeout(() => {
        onServiceStarted();
        handleClose();
      }, 2000);

    } catch (err) {
      setError((err as Error).message || 'Failed to start service');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQrCode("");
    setTermsAccepted(false);
    setJobDescriptionAcknowledged(false);
    setShowScanner(false);
    setError("");
    setSuccess(false);
    onClose();
  };

  if (success) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
            <h3 className="text-xl font-semibold">Service Started!</h3>
            <p className="text-center text-muted-foreground">
              Timer has been started. The worker can now begin the service.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            Start Service
          </DialogTitle>
          <DialogDescription>
            Scan the worker's QR code and confirm the details to start the service
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Service Details */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="font-medium">Service Details</h4>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Service:</span> <span className="font-medium">{serviceName}</span></p>
              <p><span className="text-muted-foreground">Worker:</span> <span className="font-medium">{workerName}</span></p>
              {workerProfile?.specialization && workerProfile.specialization.length > 0 && (
                <p><span className="text-muted-foreground">Specialization:</span> <span className="font-medium">{workerProfile.specialization.join(', ')}</span></p>
              )}
              {workerProfile?.experience && (
                <p><span className="text-muted-foreground">Experience:</span> <span className="font-medium">{workerProfile.experience} years</span></p>
              )}
            </div>
          </div>

          {/* QR Code Scanner */}
          <div className="space-y-3">
            <Label>1. Scan Worker's QR Code</Label>
            
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

          {/* Job Description Acknowledgment */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              2. Job Description Acknowledgment
            </Label>
            <div className="bg-muted/30 p-4 rounded-lg space-y-3">
              <p className="text-sm">
                <strong>Job Description:</strong> {serviceName}
              </p>
              <p className="text-sm text-muted-foreground">
                The worker will perform the service as described. Please ensure you have discussed any specific requirements or preferences before starting.
              </p>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="job-acknowledged"
                  checked={jobDescriptionAcknowledged}
                  onCheckedChange={(checked) => setJobDescriptionAcknowledged(checked as boolean)}
                  disabled={loading}
                />
                <label
                  htmlFor="job-acknowledged"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  I acknowledge and understand the job description
                </label>
              </div>
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              3. Terms and Conditions
            </Label>
            <div className="bg-muted/30 p-4 rounded-lg space-y-3 max-h-40 overflow-y-auto text-sm">
              <p className="font-medium">Service Agreement:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Service will be provided as per the agreed scope and timeline</li>
                <li>Payment will be processed as per the agreed terms</li>
                <li>Overtime charges may apply if service exceeds scheduled duration</li>
                <li>You have the right to request changes during service with mutual agreement</li>
                <li>Worker safety and respectful conduct are mandatory</li>
                <li>Any damages caused during service will be reported and addressed</li>
                <li>Service quality will be documented with photos (before, during, after)</li>
                <li>You can cancel or reschedule as per the cancellation policy</li>
              </ul>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                disabled={loading}
              />
              <label
                htmlFor="terms"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                I accept the terms and conditions
              </label>
            </div>
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
              onClick={handleStartService}
              disabled={loading || !qrCode || !termsAccepted || !jobDescriptionAcknowledged}
              className="flex-1"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Starting...
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Start Service
                </>
              )}
            </Button>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              Once you start the service, the timer will begin automatically. The worker will document the work with photos throughout the service.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ServiceStartModal;
