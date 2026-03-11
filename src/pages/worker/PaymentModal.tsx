import { bookingsAPI, locationsAPI, qrPaymentsAPI } from "@/lib/api";
import { ArrowLeft, Camera, CheckCircle, DollarSign, MapPin, QrCode, Upload } from "lucide-react";
import QRCodeLib from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface QRPayment {
  _id: string;
  qrCodeData: string;
  amount: number;
  upiId: string;
  status: string;
}

interface LocationPaymentQR {
  upiId?: string;
  upiName?: string;
  qrCodeImage?: string;
  phoneNumber?: string;
  isGlobal?: boolean;
}

interface LocationInfo {
  id: string;
  name: string;
  area: string;
  city: string;
}

interface PaymentModalProps {
  bookingId: string;
  onClose: () => void;
  onPaymentConfirmed: () => void;
}

const PaymentModal = ({ bookingId, onClose, onPaymentConfirmed }: PaymentModalProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [qrPayment, setQrPayment] = useState<QRPayment | null>(null);
  const [locationPaymentQR, setLocationPaymentQR] = useState<LocationPaymentQR | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string>("");
  const [transactionId, setTransactionId] = useState("");
  const [screenshot, setScreenshot] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<'show-qr' | 'upload-proof'>('show-qr');
  const [usingLocationQR, setUsingLocationQR] = useState(false);

  const fetchOrGeneratePayment = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch the booking to get location and amount info
      const booking = await bookingsAPI.getById(bookingId);
      const bookingData = booking.booking;
      
      // Try to fetch location-specific payment QR if location exists
      if (bookingData.location && (typeof bookingData.location === 'object' && '_id' in bookingData.location)) {
        try {
          const locationId = typeof bookingData.location === 'string' ? bookingData.location : bookingData.location._id;
          const locationQRResponse = await locationsAPI.getPaymentQR(locationId);
          
          if (locationQRResponse.success && locationQRResponse.paymentQR) {
            setLocationPaymentQR(locationQRResponse.paymentQR);
            setLocationInfo(locationQRResponse.location);
            
            // Use location QR if available
            if (locationQRResponse.paymentQR.qrCodeImage) {
              setQrCodeImage(locationQRResponse.paymentQR.qrCodeImage);
              setUsingLocationQR(true);
              
              // Create a mock QRPayment object for the amount
              setQrPayment({
                _id: 'location-qr',
                qrCodeData: '',
                amount: bookingData.totalAmount || 0,
                upiId: locationQRResponse.paymentQR.upiId || 'N/A',
                status: 'pending'
              });
              
              setLoading(false);
              return;
            }
          }
        } catch (error) {
          console.log('No location-specific QR found, falling back to generated QR');
        }
      }
      
      // Fallback to original QR payment generation
      if (bookingData.qrPayment) {
        const paymentResponse = await qrPaymentsAPI.getById(bookingData.qrPayment);
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
      alert(t('worker.paymentModal.failedLoadPayment'));
      onClose();
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    fetchOrGeneratePayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

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
      alert(t('worker.paymentModal.fileTooLarge'));
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert(t('worker.paymentModal.invalidFileType'));
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
      alert(t('worker.paymentModal.enterTxnId'));
      return;
    }

    if (!screenshot) {
      alert(t('worker.paymentModal.uploadScreenshot'));
      return;
    }

    try {
      setUploading(true);
      
      if (usingLocationQR) {
        // For location QR, we need to create a payment record first, then confirm
        const response = await qrPaymentsAPI.generate(bookingId);
        await qrPaymentsAPI.workerConfirm(response.qrPayment._id, transactionId, screenshot);
      } else {
        // Normal flow with existing QRPayment
        await qrPaymentsAPI.workerConfirm(qrPayment!._id, transactionId, screenshot);
      }
      
      alert(t('worker.paymentModal.paymentConfirmed'));
      onPaymentConfirmed();
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert(t('worker.paymentModal.failedConfirmPayment'));
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-center mt-4 text-muted-foreground">{t('worker.paymentModal.loadingPayment')}</p>
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
              <h2 className="text-xl font-bold">{t('worker.paymentModal.title')}</h2>
              <p className="text-sm opacity-90">{t('worker.paymentModal.subtitle')}</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {step === 'show-qr' ? (
              <>
                {/* Amount Section */}
                <div className="bg-green-50 border-2 border-green-200 p-6 rounded-xl text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <DollarSign className="w-6 h-6 text-green-600" />
                    <p className="text-sm text-green-700 font-medium">{t('worker.paymentModal.amountToCollect')}</p>
                  </div>
                  <p className="text-4xl font-bold text-green-600">₹{qrPayment.amount}</p>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <QrCode className="w-5 h-5" />
                    {t('worker.paymentModal.howToCollect')}
                  </h3>
                  <ol className="text-sm text-blue-800 space-y-1 ml-6 list-decimal">
                    <li>{t('worker.paymentModal.step1')}</li>
                    <li>{t('worker.paymentModal.step2')}</li>
                    <li>{t('worker.paymentModal.step3')}</li>
                    <li>{t('worker.paymentModal.step4')}</li>
                    <li>{t('worker.paymentModal.step5')}</li>
                  </ol>
                </div>

                {/* Location Info - Show when using location-specific QR */}
                {usingLocationQR && locationInfo && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-5 h-5 text-purple-600" />
                      <h3 className="font-semibold text-purple-900">
                        {t('worker.paymentModal.adminQRLocation')}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-purple-700">
                      <span className="font-medium">{locationInfo.name}</span>
                      <span>•</span>
                      <span>{locationInfo.area}, {locationInfo.city}</span>
                    </div>
                    {locationPaymentQR?.upiName && (
                      <p className="text-xs text-purple-600 mt-1">
                        {t('worker.paymentModal.payee')}: {locationPaymentQR.upiName}
                      </p>
                    )}
                  </div>
                )}

                {/* QR Code Display */}
                {qrCodeImage && (
                  <div className="bg-white border-2 border-primary rounded-xl p-6 text-center">
                    {usingLocationQR ? (
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-purple-700 mb-1 flex items-center justify-center gap-2">
                          <QrCode className="w-4 h-4" />
                          {t('worker.paymentModal.adminCustomQR')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('worker.paymentModal.qrAssignedToLocation')}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mb-4">{t('worker.paymentModal.customerScansQR')}</p>
                    )}
                    <img 
                      src={qrCodeImage} 
                      alt="Payment QR Code" 
                      className="mx-auto w-full max-w-sm rounded-lg shadow-lg"
                    />
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      {locationPaymentQR?.upiName && usingLocationQR ? (
                        <>
                          <p className="text-xs text-muted-foreground">{t('worker.paymentModal.payeeName')}</p>
                          <p className="text-sm font-semibold">{locationPaymentQR.upiName}</p>
                        </>
                      ) : null}
                      {qrPayment?.upiId && qrPayment.upiId !== 'N/A' ? (
                        <div className={locationPaymentQR?.upiName && usingLocationQR ? 'mt-2 pt-2 border-t border-border' : ''}>
                          <p className="text-xs text-muted-foreground">{t('worker.paymentModal.upiId')}</p>
                          <p className="text-sm font-mono font-semibold">{qrPayment.upiId}</p>
                        </div>
                      ) : null}
                      {locationPaymentQR?.phoneNumber && usingLocationQR && (
                        <div className="mt-2 pt-2 border-t border-border">
                          <p className="text-xs text-muted-foreground">{t('worker.paymentModal.contact')}</p>
                          <p className="text-sm font-semibold">{locationPaymentQR.phoneNumber}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Next Button */}
                <button
                  onClick={() => setStep('upload-proof')}
                  className="w-full btn-brand py-3 flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  {t('worker.paymentModal.customerPaidUpload')}
                </button>
              </>
            ) : (
              <>
                {/* Upload Screenshot */}
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium text-foreground">{t('worker.paymentModal.transactionId')}</span>
                    <input
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder={t('worker.paymentModal.enterTransactionId')}
                      className="mt-1 w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-foreground">{t('worker.paymentModal.paymentScreenshot')}</span>
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
                            {t('worker.paymentModal.remove')}
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted transition-colors">
                          <Upload className="w-12 h-12 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">{t('worker.paymentModal.clickToUpload')}</p>
                          <p className="text-xs text-muted-foreground mt-1">{t('worker.paymentModal.maxSize')}</p>
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
                        {t('worker.paymentModal.uploading')}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        {t('worker.paymentModal.confirmPayment')}
                      </>
                    )}
                  </button>
                </div>

                {/* Info Note */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
                  <p className="font-medium mb-1">⚠️ {t('worker.paymentModal.important')}</p>
                  <p>{t('worker.paymentModal.adminWillVerify')}</p>
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
