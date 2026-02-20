import { bookingsAPI, qrPaymentsAPI } from "@/lib/api";
import { ArrowLeft, Camera, CheckCircle, DollarSign, QrCode, Upload } from "lucide-react";
import QRCodeLib from "qrcode";
import { useCallback, useEffect, useState } from "react";

interface QRPayment {
  _id: string;
  qrCodeData: string;
  amount: number;
  upiId: string;
  status: string;
}

interface PaymentModalProps {
  bookingId: string;
  onClose: () => void;
  onPaymentConfirmed: () => void;
}

const PaymentModal = ({ bookingId, onClose, onPaymentConfirmed }: PaymentModalProps) => {
  const [loading, setLoading] = useState(true);
  const [qrPayment, setQrPayment] = useState<QRPayment | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string>("");
  const [transactionId, setTransactionId] = useState("");
  const [screenshot, setScreenshot] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<'show-qr' | 'upload-proof'>('show-qr');

  const fetchOrGeneratePayment = useCallback(async () => {
    try {
      setLoading(true);
      
      // Try to get existing payment first
      const booking = await bookingsAPI.getById(bookingId);
      
      if (booking.booking.qrPayment) {
        const paymentResponse = await qrPaymentsAPI.getById(booking.booking.qrPayment);
        setQrPayment(paymentResponse.qrPayment);
        generateQRCodeImage(paymentResponse.qrPayment.qrCodeData);
      } else {
        // Generate new payment
        const response = await qrPaymentsAPI.generate(bookingId);
        setQrPayment(response.qrPayment);
        generateQRCodeImage(response.qrPayment.qrCodeData);
      }
    } catch (error) {
      console.error('Error fetching payment:', error);
      alert('Failed to load payment details');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [bookingId, onClose]);

  useEffect(() => {
    fetchOrGeneratePayment();
  }, [fetchOrGeneratePayment]);

  const generateQRCodeImage = async (qrData: string) => {
    try {
      const qrDataUrl = await QRCodeLib.toDataURL(qrData, {
        width: 400,
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshot(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmPayment = async () => {
    if (!transactionId.trim()) {
      alert('Please enter the transaction ID');
      return;
    }

    if (!screenshot) {
      alert('Please upload a payment screenshot');
      return;
    }

    try {
      setUploading(true);
      await qrPaymentsAPI.workerConfirm(qrPayment._id, transactionId, screenshot);
      alert('Payment confirmed successfully! Admin will verify it soon.');
      onPaymentConfirmed();
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert('Failed to confirm payment. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-center mt-4 text-muted-foreground">Loading payment details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-screen p-4 flex items-start justify-center py-8">
        <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-primary text-primary-foreground p-6 rounded-t-2xl flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h2 className="text-xl font-bold">Payment Collection</h2>
              <p className="text-sm opacity-90">Show QR & collect payment</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {step === 'show-qr' ? (
              <>
                {/* Amount Section */}
                <div className="bg-green-50 border-2 border-green-200 p-6 rounded-xl text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <DollarSign className="w-6 h-6 text-green-600" />
                    <p className="text-sm text-green-700 font-medium">Amount to Collect</p>
                  </div>
                  <p className="text-4xl font-bold text-green-600">₹{qrPayment.amount}</p>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <QrCode className="w-5 h-5" />
                    How to collect payment:
                  </h3>
                  <ol className="text-sm text-blue-800 space-y-1 ml-6 list-decimal">
                    <li>Show this QR code to the customer</li>
                    <li>Customer scans and pays via UPI</li>
                    <li>Ask customer for transaction ID</li>
                    <li>Take screenshot of payment confirmation</li>
                    <li>Upload payment proof</li>
                  </ol>
                </div>

                {/* QR Code Display */}
                {qrCodeImage && (
                  <div className="bg-white border-2 border-primary rounded-xl p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-4">Customer scans this QR code to pay</p>
                    <img 
                      src={qrCodeImage} 
                      alt="Payment QR Code" 
                      className="mx-auto w-full max-w-sm"
                    />
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">UPI ID</p>
                      <p className="text-sm font-mono font-semibold">{qrPayment.upiId}</p>
                    </div>
                  </div>
                )}

                {/* Next Button */}
                <button
                  onClick={() => setStep('upload-proof')}
                  className="w-full btn-brand py-3 flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Customer Paid - Upload Proof
                </button>
              </>
            ) : (
              <>
                {/* Upload Screenshot */}
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium text-foreground">Transaction ID *</span>
                    <input
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="Enter UPI transaction ID"
                      className="mt-1 w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-foreground">Payment Screenshot *</span>
                    <div className="mt-2">
                      {screenshot ? (
                        <div className="relative">
                          <img 
                            src={screenshot} 
                            alt="Payment screenshot" 
                            className="w-full rounded-xl border-2 border-green-300"
                          />
                          <button
                            onClick={() => setScreenshot('')}
                            className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded-lg text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted transition-colors">
                          <Upload className="w-12 h-12 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload screenshot</p>
                          <p className="text-xs text-muted-foreground mt-1">Max 5MB, JPG/PNG</p>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('show-qr')}
                    className="flex-1 btn-secondary py-3"
                    disabled={uploading}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirmPayment}
                    disabled={uploading || !transactionId.trim() || !screenshot}
                    className="flex-1 btn-brand py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Confirm Payment
                      </>
                    )}
                  </button>
                </div>

                {/* Info Note */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
                  <p className="font-medium mb-1">⚠️ Important</p>
                  <p>Admin will verify the payment before releasing your earnings. Make sure to upload a clear screenshot.</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
