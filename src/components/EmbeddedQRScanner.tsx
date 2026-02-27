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

        // Using rear camera by default (better for scanning) with larger box
        const config = { 
          fps: 10, 
          qrbox: { width: 300, height: 300 }, // Increased from 250
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
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30">
                <QrCode className="w-6 h-6 text-white" />
              </div>
              <div className="text-white">
                <h3 className="text-xl font-bold tracking-tight">QR Code Scanner</h3>
                <p className="text-sm text-white/70 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  Position code within the frame
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all duration-200 hover:scale-105 border border-white/20"
            >
              <X className="w-6 h-6 text-white" />
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
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-primary/30"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                <Camera className="absolute inset-0 m-auto w-8 h-8 text-primary" />
              </div>
              <p className="text-white font-semibold text-lg">Initializing Camera</p>
              <p className="text-white/60 text-sm mt-2">Please wait...</p>
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
              <div className="relative w-80 h-80 md:w-96 md:h-96">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-blue-500/20 rounded-3xl blur-2xl animate-pulse"></div>
                
                {/* Main scanning box with modern design */}
                <div className="absolute inset-0 rounded-3xl backdrop-blur-sm bg-white/5 border-2 border-white/20 shadow-2xl">
                  {/* Animated Corner decorations */}
                  <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-3xl animate-pulse shadow-lg shadow-primary/50"></div>
                  <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-3xl animate-pulse shadow-lg shadow-primary/50" style={{ animationDelay: '0.2s' }}></div>
                  <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-3xl animate-pulse shadow-lg shadow-primary/50" style={{ animationDelay: '0.4s' }}></div>
                  <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-3xl animate-pulse shadow-lg shadow-primary/50" style={{ animationDelay: '0.6s' }}></div>
                  
                  {/* Scanning line animation */}
                  {isScanning && (
                    <div className="absolute inset-0 overflow-hidden rounded-3xl">
                      <div className="scanning-line"></div>
                    </div>
                  )}
                  
                  {/* Center Guide Icon */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-30">
                    <QrCode className="w-24 h-24 text-white" strokeWidth={1} />
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
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {error ? (
            <div className="bg-gradient-to-r from-red-500/90 to-red-600/90 backdrop-blur-sm text-white p-6 rounded-2xl shadow-2xl border border-red-400/30">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <X className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold mb-1">Camera Access Required</p>
                  <p className="text-sm text-white/90">{error}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="mt-4 w-full py-3 px-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl font-semibold transition-all duration-200"
              >
                Close Scanner
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center justify-center gap-3 mb-4 px-6 py-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-sm rounded-full border border-green-400/30">
                <div className="relative">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                </div>
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Camera Active - Ready to Scan
                </p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mx-auto mb-2">
                    <span className="text-2xl">📱</span>
                  </div>
                  <p className="text-white/90 text-sm font-medium">Hold Steady</p>
                  <p className="text-white/60 text-xs mt-1">Keep device stable</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mx-auto mb-2">
                    <span className="text-2xl">💡</span>
                  </div>
                  <p className="text-white/90 text-sm font-medium">Good Lighting</p>
                  <p className="text-white/60 text-xs mt-1">Ensure proper light</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mx-auto mb-2">
                    <span className="text-2xl">🎯</span>
                  </div>
                  <p className="text-white/90 text-sm font-medium">Center Code</p>
                  <p className="text-white/60 text-xs mt-1">Align within frame</p>
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
