import { Html5Qrcode } from "html5-qrcode";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface EmbeddedQRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

const EmbeddedQRScanner = ({ onScanSuccess, onClose }: EmbeddedQRScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScannedRef = useRef(false);

  useEffect(() => {
    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader-embedded");
        scannerRef.current = scanner;

        // Using rear camera by default (better for scanning)
        const config = { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        };

        await scanner.start(
          { facingMode: "environment" }, // Use rear camera
          config,
          (decodedText) => {
            // Prevent multiple scans
            if (!hasScannedRef.current) {
              hasScannedRef.current = true;
              setIsScanning(false);
              
              // Stop scanner before calling callback
              scanner.stop().then(() => {
                onScanSuccess(decodedText);
              }).catch(console.error);
            }
          },
          (errorMessage) => {
            // Ignore individual frame errors
            console.debug("QR scan frame error:", errorMessage);
          }
        );

        setIsScanning(true);
        setError(null);
      } catch (err) {
        console.error("Error starting scanner:", err);
        setError("Failed to start camera. Please ensure camera permissions are granted.");
      }
    };

    startScanner();

    // Cleanup function
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScanSuccess]);

  const handleClose = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().then(() => {
        onClose();
      }).catch((err) => {
        console.error("Error stopping scanner:", err);
        onClose();
      });
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="text-white">
            <h3 className="text-lg font-semibold">Scan QR Code</h3>
            <p className="text-sm text-white/80">Position QR code within frame</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Camera View with Overlay */}
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Camera Feed */}
        <div id="qr-reader-embedded" className="w-full h-full"></div>

        {/* Scanning Frame Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Dark overlay with cutout effect */}
          <div className="absolute inset-0 bg-black/50"></div>
          
          {/* Scanning frame */}
          <div className="relative z-10">
            <div className="relative w-64 h-64">
              {/* Scanning box with corners */}
              <div className="absolute inset-0 border-2 border-white/30 rounded-2xl">
                {/* Corner decorations */}
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl"></div>
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl"></div>
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl"></div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl"></div>
                
                {/* Scanning line animation */}
                {isScanning && (
                  <div className="absolute inset-0 overflow-hidden rounded-2xl">
                    <div className="scanning-line"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-6">
        {error ? (
          <div className="bg-red-500/90 text-white p-4 rounded-xl text-center">
            <p className="text-sm font-medium">{error}</p>
            <button
              onClick={handleClose}
              className="mt-3 btn-secondary w-full py-2"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="text-center text-white">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <p className="text-sm font-medium">Camera Active</p>
            </div>
            <p className="text-xs text-white/70">
              Align the QR code within the frame for automatic scanning
            </p>
          </div>
        )}
      </div>

      {/* CSS for scanning line animation */}
      <style>{`
        .scanning-line {
          position: absolute;
          width: 100%;
          height: 3px;
          background: linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.8), transparent);
          box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
          animation: scan 2s ease-in-out infinite;
        }
        
        @keyframes scan {
          0%, 100% {
            top: 0;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }

        /* Hide html5-qrcode default UI elements */
        #qr-reader-embedded > div:first-child {
          display: none !important;
        }
        
        /* Make video fill the container */
        #qr-reader-embedded video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
};

export default EmbeddedQRScanner;
