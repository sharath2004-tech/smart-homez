/**
 * Service Availability Checker Component
 * Handles geolocation permission, availability check, and fallback options
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useGeolocation } from '@/hooks/useGeolocation';
import { checkServiceAvailability, LocationCheck } from '@/utils/serviceAvailability';
import { AlertCircle, CheckCircle2, Loader2, MapPin, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ServiceAvailabilityCheckerProps {
  onAvailabilityConfirmed: (serviceArea: string, coordinates: { lat: number; lng: number }) => void;
  children: React.ReactNode;
}

interface GeocodingResult {
  lat: string;
  lon: string;
  display_name: string;
}

const ServiceAvailabilityChecker = ({
  onAvailabilityConfirmed,
  children,
}: ServiceAvailabilityCheckerProps) => {
  const { latitude, longitude, error: geoError, loading: geoLoading } = useGeolocation({
    enableHighAccuracy: true,
    timeout: 10000,
  });

  const [availabilityCheck, setAvailabilityCheck] = useState<LocationCheck | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geocodingError, setGeocodingError] = useState('');
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySubmitted, setNotifySubmitted] = useState(false);

  // Check availability when geolocation is obtained
  useEffect(() => {
    if (latitude && longitude) {
      const check = checkServiceAvailability(latitude, longitude);
      setAvailabilityCheck(check);

      if (check.isAvailable && check.serviceArea) {
        onAvailabilityConfirmed(check.serviceArea.id, { lat: latitude, lng: longitude });
      }
    }
  }, [latitude, longitude, onAvailabilityConfirmed]);

  // Handle geolocation error - show fallback
  useEffect(() => {
    if (geoError) {
      setShowFallback(true);
    }
  }, [geoError]);

  // Manual address search using Nominatim
  const handleManualSearch = async () => {
    if (!manualAddress.trim()) {
      setGeocodingError('Please enter an address');
      return;
    }

    setGeocoding(true);
    setGeocodingError('');

    try {
      // Using Nominatim (OpenStreetMap) for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          manualAddress
        )}&countrycodes=in&limit=1`,
        {
          headers: {
            'User-Agent': 'PureAppWeave/1.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }

      const results: GeocodingResult[] = await response.json();

      if (results.length === 0) {
        setGeocodingError('Location not found. Please try a more specific address.');
        return;
      }

      const result = results[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);

      const check = checkServiceAvailability(lat, lng);
      setAvailabilityCheck(check);

      if (check.isAvailable && check.serviceArea) {
        onAvailabilityConfirmed(check.serviceArea.id, { lat, lng });
        setShowFallback(false);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setGeocodingError('Failed to search location. Please try again.');
    } finally {
      setGeocoding(false);
    }
  };

  // Handle notification signup
  const handleNotifySignup = async () => {
    if (!notifyEmail.trim() || !notifyEmail.includes('@')) {
      toast.warning('Please enter a valid email address');
      return;
    }

    // Store in localStorage for now (in production, send to backend)
    const notifications = JSON.parse(localStorage.getItem('serviceNotifications') || '[]');
    notifications.push({
      email: notifyEmail,
      location: availabilityCheck?.nearestArea?.area.name || 'Unknown',
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem('serviceNotifications', JSON.stringify(notifications));

    setNotifySubmitted(true);
    setTimeout(() => {
      setShowNotifyDialog(false);
      setNotifySubmitted(false);
      setNotifyEmail('');
    }, 2000);
  };

  // Loading state
  if (geoLoading && !showFallback) {
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-heading text-foreground mb-2">
              Checking Service Availability
            </h3>
            <p className="text-sm text-muted-foreground">
              Please allow location access to continue
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Not available overlay
  if (availabilityCheck && !availabilityCheck.isAvailable) {
    return (
      <>
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full card-elevated p-6 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-warning-light rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-warning" />
              </div>
              <h3 className="text-xl font-bold font-heading text-foreground mb-2">
                Service Not Available Yet
              </h3>
              <p className="text-sm text-muted-foreground">
                {availabilityCheck.message}
              </p>
            </div>

            {availabilityCheck.nearestArea && (
              <Alert>
                <MapPin className="h-4 w-4" />
                <AlertDescription>
                  We're expanding! Services are available in{' '}
                  <strong>{availabilityCheck.nearestArea.area.name}</strong>, just{' '}
                  {availabilityCheck.nearestArea.distance.toFixed(1)} km away.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <Button
                onClick={() => setShowNotifyDialog(true)}
                className="w-full"
                variant="default"
              >
                Notify Me When Available
              </Button>
              <Button
                onClick={() => setShowFallback(true)}
                className="w-full"
                variant="outline"
              >
                <Search className="w-4 h-4 mr-2" />
                Try Different Address
              </Button>
            </div>
          </div>
        </div>

        {/* Notification Dialog */}
        <Dialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Get Notified</DialogTitle>
              <DialogDescription>
                Enter your email and we'll notify you when services become available in your area.
              </DialogDescription>
            </DialogHeader>
            {notifySubmitted ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
                <p className="text-sm text-foreground">Thank you! We'll notify you soon.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                />
                <Button onClick={handleNotifySignup} className="w-full">
                  Submit
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Fallback manual search
  if (showFallback && !availabilityCheck?.isAvailable) {
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full card-elevated p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold font-heading text-foreground">
                Search Your Location
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your address to check service availability
              </p>
            </div>
            <button
              onClick={() => setShowFallback(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            <Input
              placeholder="Enter area, apartment, or landmark"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
            />
            
            {geocodingError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{geocodingError}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleManualSearch}
              disabled={geocoding}
              className="w-full"
            >
              {geocoding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Check Availability
                </>
              )}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Example: "Andheri West, Mumbai" or "Whitefield, Bengaluru"
          </div>
        </div>
      </div>
    );
  }

  // Service available - show children
  return <>{children}</>;
};

export default ServiceAvailabilityChecker;
