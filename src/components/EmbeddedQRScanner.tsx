import { Html5Qrcode } from "html5-qrcode";
import { Camera, QrCode, X, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface EmbeddedQRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

const EmbeddedQRScanner = ({ onScanSuccess, onClose }: EmbeddedQRScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScannedRef = useRef(false);

  useEffect(() => {
    const startScanner = async () => {
      try {
        setIsLoading(true);
        const scanner = new Html5Qrcode("qr-reader-embedded");
        scannerRef.current = scanner;

        // Using rear camera by default (better for scanning) with compact box
        const config = { 
          fps: 10, 
          qrbox: { width: 250, height: 250 }, // Compact size to fit frame
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
        setIsLoading(false);
        setError(null);
      } catch (err) {
        console.error("Error starting scanner:", err);
        setIsLoading(false);
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
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm">
      {/* Modern Header with Glassmorphism */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/90 via-black/60 to-transparent backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30">
                <QrCode className="w-5 h-5 text-white" />
              </div>
              <div className="text-white">
                <h3 className="text-lg font-bold tracking-tight">QR Scanner</h3>
                <p className="text-xs text-white/70 flex items-center gap-1.5">
                  <Camera className="w-3 h-3" />
                  Position code within frame
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all duration-200 hover:scale-105 border border-white/20"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Camera View with Enhanced Overlay */}
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Camera Feed */}
        <div id="qr-reader-embedded" className="w-full h-full"></div>

        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-10">
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-primary/30"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                <Camera className="absolute inset-0 m-auto w-6 h-6 text-primary" />
              </div>
              <p className="text-white font-semibold text-base">Initializing Camera</p>
              <p className="text-white/60 text-sm mt-1">Please wait...</p>
            </div>
          </div>
        )}

        {/* Enhanced Scanning Frame Overlay */}
        {!isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Dark overlay with smooth gradient cutout */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70"></div>
            
            {/* Main Scanning frame */}
            <div className="relative z-10">
              <div className="relative w-72 h-72 md:w-80 md:h-80">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-blue-500/20 rounded-3xl blur-2xl animate-pulse"></div>
                
                {/* Main scanning box with modern design */}
                <div className="absolute inset-0 rounded-3xl backdrop-blur-sm bg-white/5 border-2 border-white/20 shadow-2xl">
                  {/* Animated Corner decorations - smaller */}
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-3xl animate-pulse shadow-lg shadow-primary/50"></div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-3xl animate-pulse shadow-lg shadow-primary/50" style={{ animationDelay: '0.2s' }}></div>
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-3xl animate-pulse shadow-lg shadow-primary/50" style={{ animationDelay: '0.4s' }}></div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-3xl animate-pulse shadow-lg shadow-primary/50" style={{ animationDelay: '0.6s' }}></div>
                  
                  {/* Scanning line animation */}
                  {isScanning && (
                    <div className="absolute inset-0 overflow-hidden rounded-3xl">
                      <div className="scanning-line"></div>
                    </div>
                  )}
                  
                  {/* Center Guide Icon - smaller */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-20">
                    <QrCode className="w-16 h-16 text-white" strokeWidth={1} />
                  </div>
                </div>
                
                {/* Guide lines */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-full w-px bg-gradient-to-b from-transparent via-white/30 to-transparent"></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modern Instructions at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent backdrop-blur-md pb-safe">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {error ? (
            <div className="bg-gradient-to-r from-red-500/90 to-red-600/90 backdrop-blur-sm text-white p-4 rounded-2xl shadow-2xl border border-red-400/30">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold mb-1">Camera Access Required</p>
                  <p className="text-xs text-white/90">{error}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="mt-3 w-full py-2.5 px-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl text-sm font-semibold transition-all duration-200"
              >
                Close Scanner
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center justify-center gap-2 mb-3 px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-sm rounded-full border border-green-400/30">
                <div className="relative">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                </div>
                <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  Camera Active
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-2 max-w-xl mx-auto">
                <div className="bg-white/5 backdrop-blur-sm rounded-lg p-2.5 border border-white/10">
                  <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center mx-auto mb-1.5">
                    <span className="text-lg">📱</span>
                  </div>
                  <p className="text-white/90 text-xs font-medium">Hold Steady</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-lg p-2.5 border border-white/10">
                  <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center mx-auto mb-1.5">
                    <span className="text-lg">💡</span>
                  </div>
                  <p className="text-white/90 text-xs font-medium">Good Light</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-lg p-2.5 border border-white/10">
                  <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center mx-auto mb-1.5">
                    <span className="text-lg">🎯</span>
                  </div>
                  <p className="text-white/90 text-xs font-medium">Center Code</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced CSS for animations */}
      <style>{`
        .scanning-line {
          position: absolute;
          width: 100%;
          height: 4px;
          background: linear-gradient(
            90deg, 
            transparent, 
            rgba(59, 130, 246, 0.3),
            rgba(34, 197, 94, 0.9),
            rgba(59, 130, 246, 0.3),
            transparent
          );
          box-shadow: 
            0 0 20px rgba(34, 197, 94, 0.8),
            0 0 40px rgba(34, 197, 94, 0.4);
          animation: scan 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes scan {
          0%, 100% {
            top: -4px;
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          95% {
            opacity: 1;
          }
          100% {
            top: calc(100% + 4px);
            opacity: 0;
          }
        }

        /* Hide html5-qrcode default UI elements */
        #qr-reader-embedded > div:first-child {
          display: none !important;
        }
        
        /* Make video fill the container with better quality */
        #qr-reader-embedded video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border: none !important;
          filter: brightness(1.1) contrast(1.1);
        }
        
        /* Enhance canvas rendering */
        #qr-reader-embedded canvas {
          display: none !important;
        }
      `}</style>
    </div>
  );
};

export default EmbeddedQRScanner;
