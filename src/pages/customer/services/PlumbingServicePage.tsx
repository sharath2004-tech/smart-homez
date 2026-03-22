import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServiceBookingAvailability } from "@/hooks/useServiceBookingAvailability";
import { authAPI, bookingsAPI, servicesAPI } from "@/lib/api";
import { ChevronLeft, Droplet, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

interface Service {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
}

interface PlumbingDetails {
  issueType: 'leak' | 'blockage' | 'installation' | 'repair' | 'other';
  location: string[];
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  issueDescription: string;
  hasWaterSupplyOff: boolean;
  preferredTimeWindow: string;
  specialInstructions: string;
}

interface BookingProfile {
  role: string;
  name?: string;
  addresses?: Array<{
    isDefault?: boolean;
    apartmentName?: string;
    address?: string;
    area?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    location?: { coordinates?: number[] };
  }>;
}

const PlumbingServicePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [profile, setProfile] = useState<BookingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [plumbingDetails, setPlumbingDetails] = useState<PlumbingDetails>({
    issueType: 'leak',
    location: [],
    urgency: 'medium',
    issueDescription: '',
    hasWaterSupplyOff: false,
    preferredTimeWindow: 'flexible',
    specialInstructions: ''
  });

  const {
    availability,
    checkingAvailability,
    requestingService,
    resolvedLocation,
    hasResolvedLocation,
    isOutOfRegion,
    canBookService,
    requestService,
  } = useServiceBookingAvailability(service?._id, profile);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [serviceData, profileData] = await Promise.all([
        servicesAPI.getById(id!),
        authAPI.getProfile()
      ]);
      setService(serviceData.service);
      setProfile(profileData.user || profileData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load service details');
    } finally {
      setLoading(false);
    }
  };

  const locationOptions = [
    'Kitchen Sink', 'Bathroom Sink', 'Toilet', 'Bathtub/Shower', 
    'Washing Machine', 'Water Heater', 'Main Pipeline', 'Drainage', 'Other'
  ];

  const toggleLocation = (loc: string) => {
    setPlumbingDetails(prev => ({
      ...prev,
      location: prev.location.includes(loc)
        ? prev.location.filter(l => l !== loc)
        : [...prev.location, loc]
    }));
  };

  const calculateTotalPrice = () => {
    if (!service) return 0;
    
    let basePrice = service.price;
    
    // Issue type pricing
    const issueTypeMultipliers = {
      leak: 1,
      blockage: 1.2,
      installation: 1.8,
      repair: 1.3,
      other: 1
    };
    basePrice *= issueTypeMultipliers[plumbingDetails.issueType];
    
    // Multiple locations
    if (plumbingDetails.location.length > 1) {
      basePrice += (plumbingDetails.location.length - 1) * 200;
    }
    
    // Urgency pricing
    const urgencyMultipliers = {
      low: 1,
      medium: 1,
      high: 1.5,
      emergency: 2
    };
    basePrice *= urgencyMultipliers[plumbingDetails.urgency];
    
    return Math.round(basePrice);
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isOutOfRegion) {
      await requestService(service?.name);
      return;
    }

    if (!canBookService) {
      toast.error(
        hasResolvedLocation
          ? 'Checking whether this service is available in your region. Please wait a moment.'
          : 'Please set a service location in your profile or services page before booking.'
      );
      return;
    }

    if (!selectedDate) {
      toast.error('Please select a date');
      return;
    }

    if (plumbingDetails.location.length === 0) {
      toast.error('Please select at least one location');
      return;
    }

    try {
      setBooking(true);
      
      if (!service) {
        toast.error('Service not found. Please go back and try again.');
        return;
      }

      const userLocation = localStorage.getItem('userLocation');
      const location = userLocation ? JSON.parse(userLocation) : null;

      // Calculate end time based on service duration (default 1.5 hours for plumbing)
      const durationMinutes = service?.duration || 90; // 1.5 hours default
      const [startHour, startMinute] = selectedTime.split(':').map(Number);
      const totalMinutes = startHour * 60 + startMinute + durationMinutes;
      const endHour = Math.floor(totalMinutes / 60) % 24;
      const endMinute = totalMinutes % 60;
      const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

      const bookingData = {
        service: service?._id,
        bookingDate: selectedDate,
        startTime: selectedTime,
        endTime: endTime,
        bookingType: 'oneTime',
        serviceDetails: {
          issueType: plumbingDetails.issueType,
          locations: plumbingDetails.location,
          urgency: plumbingDetails.urgency,
          issueDescription: plumbingDetails.issueDescription,
          hasWaterSupplyOff: plumbingDetails.hasWaterSupplyOff,
          preferredTimeWindow: plumbingDetails.preferredTimeWindow,
          specialInstructions: plumbingDetails.specialInstructions
        },
        totalAmount: calculateTotalPrice(),
        estimatedDuration: service?.duration,
        location: location ? {
          type: 'Point',
          coordinates: [location.lng, location.lat],
          address: location.address || '',
          city: location.city || '',
          state: location.state || '',
          zipCode: location.zipCode || ''
        } : undefined
      };

      await bookingsAPI.create(bookingData);
      toast.success('Booking created successfully!');
      navigate('/customer/bookings');
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to create booking');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <AppLayout userType="customer" userName={profile?.name}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading service details...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <AppLayout userType="customer" userName={profile?.name}>
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6">
        <div className="mb-6">
          <Link to="/customer/services" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ChevronLeft className="w-4 h-4" />
            Back to Services
          </Link>
          
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl p-6 border border-blue-100 dark:border-blue-900">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Droplet className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold mb-2">{service?.name}</h1>
                <p className="text-muted-foreground mb-3">{service?.description}</p>
              </div>
            </div>
          </div>
        </div>

        <div className={`mb-6 rounded-2xl border p-4 ${
          isOutOfRegion
            ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20'
            : hasResolvedLocation
            ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20'
            : 'border-slate-300 bg-slate-50 dark:bg-slate-900/40'
        }`}>
          <div className="flex items-start gap-3">
            <MapPin className={`mt-0.5 h-4 w-4 shrink-0 ${isOutOfRegion ? 'text-amber-700' : hasResolvedLocation ? 'text-emerald-700' : 'text-slate-600'}`} />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-foreground">
                {checkingAvailability
                  ? 'Checking service region...'
                  : isOutOfRegion
                  ? 'Plumbing service is outside your region'
                  : hasResolvedLocation
                  ? 'Plumbing service can be booked in your region'
                  : 'Service location needed before booking'}
              </p>
              <p className="text-muted-foreground">
                {checkingAvailability
                  ? 'We are verifying the admin-configured service region for your location.'
                  : isOutOfRegion
                  ? (availability?.reason || 'Bookings are accepted only in regions configured by admin or super admin.')
                  : hasResolvedLocation
                  ? (availability?.reason || 'Your saved location is inside an active service region.')
                  : 'Please set your service location from the services page or save a default address in your profile.'}
              </p>
              {resolvedLocation && (
                <p className="text-xs text-muted-foreground">
                  Location: {[resolvedLocation.area, resolvedLocation.city].filter(Boolean).join(', ') || resolvedLocation.address || 'Saved location'}
                </p>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleBooking} className="space-y-6">
          {/* Schedule Section */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5 md:p-6">
            <h2 className="text-xl font-bold mb-4">Schedule Service</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Select Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  min={minDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="time">Select Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Issue Type */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5 md:p-6">
            <h2 className="text-xl font-bold mb-4">Issue Type</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { value: 'leak', label: 'Water Leak', desc: 'Dripping taps, pipe leaks' },
                { value: 'blockage', label: 'Blockage', desc: '+20% - Clogged drains' },
                { value: 'installation', label: 'Installation', desc: '+80% - New fixtures' },
                { value: 'repair', label: 'Repair', desc: '+30% - Fix broken parts' },
                { value: 'other', label: 'Other', desc: 'Other plumbing issues' }
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setPlumbingDetails(prev => ({ ...prev, issueType: type.value as PlumbingDetails['issueType'] }))}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    plumbingDetails.issueType === type.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-semibold">{type.label}</div>
                  <div className="text-sm text-muted-foreground">{type.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Location Selection */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5 md:p-6">
            <h2 className="text-xl font-bold mb-4">Problem Location(s)</h2>
            <div className="grid md:grid-cols-3 gap-3">
              {locationOptions.map((loc) => (
                <label
                  key={loc}
                  className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={plumbingDetails.location.includes(loc)}
                    onChange={() => toggleLocation(loc)}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-sm">{loc}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">+₹200 for each additional location after the first</p>
          </div>

          {/* Urgency & Details */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5 md:p-6">
            <h2 className="text-xl font-bold mb-4">Additional Details</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="urgency">Urgency Level</Label>
                <select
                  id="urgency"
                  value={plumbingDetails.urgency}
                  onChange={(e) => setPlumbingDetails(prev => ({ ...prev, urgency: e.target.value as PlumbingDetails['urgency'] }))}
                  className="w-full p-2 rounded-lg border border-border bg-background"
                >
                  <option value="low">Low - Can wait a few days</option>
                  <option value="medium">Medium - Within 24 hours</option>
                  <option value="high">High - Same day (+50% fee)</option>
                  <option value="emergency">Emergency - Immediate (+100% fee)</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={plumbingDetails.hasWaterSupplyOff}
                    onChange={(e) => setPlumbingDetails(prev => ({ ...prev, hasWaterSupplyOff: e.target.checked }))}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-sm">Water supply has been turned off</span>
                </label>
              </div>

              <div>
                <Label htmlFor="issueDescription">Issue Description *</Label>
                <textarea
                  id="issueDescription"
                  placeholder="Describe the plumbing issue in detail..."
                  value={plumbingDetails.issueDescription}
                  onChange={(e) => setPlumbingDetails(prev => ({ ...prev, issueDescription: e.target.value }))}
                  className="w-full min-h-[100px] p-3 rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <Label htmlFor="timeWindow">Preferred Time Window</Label>
                <select
                  id="timeWindow"
                  value={plumbingDetails.preferredTimeWindow}
                  onChange={(e) => setPlumbingDetails(prev => ({ ...prev, preferredTimeWindow: e.target.value }))}
                  className="w-full p-2 rounded-lg border border-border bg-background"
                >
                  <option value="flexible">Flexible - Anytime</option>
                  <option value="morning">Morning (8 AM - 12 PM)</option>
                  <option value="afternoon">Afternoon (12 PM - 4 PM)</option>
                  <option value="evening">Evening (4 PM - 8 PM)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="specialInstructions">Special Instructions</Label>
                <textarea
                  id="specialInstructions"
                  placeholder="Any specific requirements or access instructions..."
                  value={plumbingDetails.specialInstructions}
                  onChange={(e) => setPlumbingDetails(prev => ({ ...prev, specialInstructions: e.target.value }))}
                  className="w-full min-h-[80px] p-3 rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border-2 border-primary/20 p-4 sm:p-5 md:p-6">
            <h2 className="text-xl font-bold mb-4">Booking Summary</h2>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Issue Type:</span>
                <span className="font-semibold capitalize">{plumbingDetails.issueType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Locations:</span>
                <span className="font-semibold">{plumbingDetails.location.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Urgency:</span>
                <span className="font-semibold capitalize">{plumbingDetails.urgency}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-primary/20">
                <span className="text-lg font-bold">Total Amount:</span>
                <span className="text-2xl font-bold text-primary">₹{calculateTotalPrice()}</span>
              </div>
            </div>
            
            {isOutOfRegion ? (
              <Button
                type="button"
                onClick={() => requestService(service?.name)}
                disabled={requestingService || checkingAvailability}
                className="w-full h-12 text-lg bg-amber-100 text-amber-900 hover:bg-amber-200"
              >
                {requestingService ? 'Sending request...' : 'Request Service'}
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={booking || checkingAvailability || !canBookService}
                className="w-full h-12 text-lg"
              >
                {checkingAvailability ? 'Checking region...' : booking ? 'Creating Booking...' : !hasResolvedLocation ? 'Set Location First' : 'Confirm Booking'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default PlumbingServicePage;
