import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Camera, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface PhotoCaptureProps {
  onPhotoCapture: (file: File) => void;
  onCancel?: () => void;
  showPreview?: boolean;
  autoUpload?: boolean; // If true, uploads immediately after capture without preview
}

const PhotoCapture = ({ onPhotoCapture, onCancel, showPreview = true, autoUpload = false }: PhotoCaptureProps) => {
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useCamera, setUseCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Use back camera on mobile
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setUseCamera(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please check permissions or use file upload instead.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setUseCamera(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `completion-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
          const photoUrl = URL.createObjectURL(blob);
          
          if (autoUpload) {
            // Immediately upload without preview
            stopCamera();
            onPhotoCapture(file);
          } else {
            // Show preview for confirmation
            setCapturedPhoto(photoUrl);
            setCapturedFile(file);
            stopCamera();
          }
        }
      }, 'image/jpeg', 0.8);
    }
  }, [stopCamera, autoUpload, onPhotoCapture]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      
      if (autoUpload) {
        // Immediately upload without preview
        setError(null);
        onPhotoCapture(file);
      } else {
        // Show preview for confirmation
        const photoUrl = URL.createObjectURL(file);
        setCapturedPhoto(photoUrl);
        setCapturedFile(file);
        setError(null);
      }
    }
  };

  const handleConfirmPhoto = () => {
    if (capturedFile) {
      onPhotoCapture(capturedFile);
    }
  };

  const handleRetake = () => {
    if (capturedPhoto) {
      URL.revokeObjectURL(capturedPhoto);
    }
    setCapturedPhoto(null);
    setCapturedFile(null);
    setError(null);
  };

  const handleCancelAll = () => {
    stopCamera();
    if (capturedPhoto) {
      URL.revokeObjectURL(capturedPhoto);
    }
    setCapturedPhoto(null);
    setCapturedFile(null);
    setError(null);
    onCancel?.();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (capturedPhoto) {
        URL.revokeObjectURL(capturedPhoto);
      }
    };
  }, [capturedPhoto, stopCamera]);

  return (
    <div className="space-y-4">
      {/* Photo Preview */}
      {capturedPhoto && showPreview ? (
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden border-2 border-primary">
            <img 
              src={capturedPhoto} 
              alt="Captured completion photo" 
              className="w-full h-auto max-h-96 object-contain bg-black"
            />
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={handleRetake}
            >
              <X className="w-4 h-4 mr-1" />
              Retake
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCancelAll}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPhoto}
              className="flex-1"
            >
              Confirm Photo
            </Button>
          </div>
        </div>
      ) : useCamera ? (
        /* Camera View */
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden border-2 border-primary bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-auto max-h-96 object-contain"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={stopCamera}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={capturePhoto}
              className="flex-1"
            >
              <Camera className="w-4 h-4 mr-2" />
              Capture Photo
            </Button>
          </div>
        </div>
      ) : (
        /* Selection View */
        <div className="space-y-3">
          <div className="bg-muted/50 p-6 rounded-lg border-2 border-dashed border-muted-foreground/25 text-center space-y-4">
            <Camera className="w-12 h-12 mx-auto text-muted-foreground" />
            <div>
              <h4 className="font-medium mb-1">Take or Upload Photo</h4>
              <p className="text-sm text-muted-foreground">
                Capture a photo to verify service completion
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={startCamera}
                className="flex-1"
              >
                <Camera className="w-4 h-4 mr-2" />
                Use Camera
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Photo
              </Button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          
          {onCancel && (
            <Button
              variant="ghost"
              onClick={handleCancelAll}
              className="w-full"
            >
              Skip Photo (Not Recommended)
            </Button>
          )}
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Info Message */}
      {!capturedPhoto && !useCamera && (
        <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
          <strong>Why take a photo?</strong>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Proves service was completed</li>
            <li>Protects both customer and worker</li>
            <li>Helps resolve any disputes</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default PhotoCapture;
