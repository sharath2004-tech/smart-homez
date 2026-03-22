import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServiceBookingAvailability } from "@/hooks/useServiceBookingAvailability";
import { authAPI, bookingsAPI, servicesAPI } from "@/lib/api";
import { AlertCircle, ChevronLeft, MapPin, Wind } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

interface Service {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration: number;
}

interface ACServiceDetails {
  numberOfUnits: number;
  acTypes: Array<{
    type: 'window' | 'split' | 'central' | 'cassette';
    tonnage: string;
    brand: string;
  }>;
  serviceType: 'cleaning' | 'repair' | 'installation' | 'gas-refill';
  lastServiceDate: string;
  issueDescription: string;
  urgency: 'low' | 'medium' | 'high';
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

const ACServicingPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [profile, setProfile] = useState<BookingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [acDetails, setACDetails] = useState<ACServiceDetails>({
    numberOfUnits: 1,
    acTypes: [{ type: 'split', tonnage: '1.5', brand: '' }],
    serviceType: 'cleaning',
    lastServiceDate: '',
    issueDescription: '',
    urgency: 'medium',
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

  const updateACUnit = (index: number, field: string, value: string) => {
    const newACTypes = [...acDetails.acTypes];
    newACTypes[index] = { ...newACTypes[index], [field]: value };
    setACDetails(prev => ({ ...prev, acTypes: newACTypes }));
  };

  const addACUnit = () => {
    setACDetails(prev => ({
      ...prev,
      numberOfUnits: prev.numberOfUnits + 1,
      acTypes: [...prev.acTypes, { type: 'split', tonnage: '1.5', brand: '' }]
    }));
  };

  const removeACUnit = (index: number) => {
    if (acDetails.numberOfUnits === 1) return;
    const newACTypes = acDetails.acTypes.filter((_, i) => i !== index);
    setACDetails(prev => ({
      ...prev,
      numberOfUnits: prev.numberOfUnits - 1,
      acTypes: newACTypes
    }));
  };

  const calculateTotalPrice = () => {
    if (!service) return 0;
    
    let basePrice = service.price;
    
    // Price based on service type
    const serviceTypeMultipliers = {
      cleaning: 1,
      repair: 1.5,
      installation: 2.5,
      'gas-refill': 1.3
    };
    basePrice *= serviceTypeMultipliers[acDetails.serviceType];
    
    // Add cost for additional units
    if (acDetails.numberOfUnits > 1) {
      basePrice += (acDetails.numberOfUnits - 1) * service.price * 0.8;
    }
    
    // AC type pricing
    const typePricing = {
      window: 1,
      split: 1.2,
      central: 2,
      cassette: 1.5
    };
    
    const typeMultiplier = acDetails.acTypes.reduce((sum, ac) => sum + typePricing[ac.type], 0) / acDetails.numberOfUnits;
    basePrice *= typeMultiplier;
    
    // Urgency surcharge
    if (acDetails.urgency === 'high') {
      basePrice *= 1.3;
    }
    
    return Math.round(basePrice);
  };

  const calculateDuration = () => {
    if (!service) return 0;
    
    let duration = service.duration;
    
    // Add time for additional units
    duration += (acDetails.numberOfUnits - 1) * 45;
    
    // Service type duration adjustments
    const serviceDurations = {
      cleaning: 1,
      repair: 1.5,
      installation: 2,
      'gas-refill': 1.2
    };
    duration *= serviceDurations[acDetails.serviceType];
    
    return Math.round(duration);
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

    if (!service) {
      toast.error('Service not found. Please go back and try again.');
      return;
    }

    if (!selectedDate) {
      toast.error('Please select a date');
      return;
    }

    try {
      setBooking(true);
      
      const userLocation = localStorage.getItem('userLocation');
      const location = userLocation ? JSON.parse(userLocation) : null;

      // Calculate end time based on service duration (default 2 hours for AC servicing)
      const durationMinutes = service?.duration || 120; // 2 hours default
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
          serviceType: acDetails.serviceType,
          numberOfUnits: acDetails.numberOfUnits,
          acUnits: acDetails.acTypes,
          lastServiceDate: acDetails.lastServiceDate,
          issueDescription: acDetails.issueDescription,
          urgency: acDetails.urgency,
          specialInstructions: acDetails.specialInstructions
        },
        totalAmount: calculateTotalPrice(),
        estimatedDuration: calculateDuration(),
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
          
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 rounded-2xl p-6 border border-cyan-100 dark:border-cyan-900">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Wind className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold mb-2">{service?.name}</h1>
                <p className="text-muted-foreground mb-3">{service?.description}</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <span className="font-semibold">Base Price:</span>
                    <span className="text-primary font-bold">₹{service?.price}</span>
                  </span>
                </div>
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
                  ? 'AC service is outside your region'
                  : hasResolvedLocation
                  ? 'AC service can be booked in your region'
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

          {/* Service Type */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5 md:p-6">
            <h2 className="text-xl font-bold mb-4">Service Type</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { value: 'cleaning', label: 'AC Cleaning', desc: 'Deep cleaning & maintenance' },
                { value: 'repair', label: 'AC Repair', desc: '+50% - Fix issues' },
                { value: 'installation', label: 'AC Installation', desc: '+150% - New installation' },
                { value: 'gas-refill', label: 'Gas Refill', desc: '+30% - Refrigerant refill' }
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setACDetails(prev => ({ ...prev, serviceType: type.value as ACServiceDetails['serviceType'] }))}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    acDetails.serviceType === type.value
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

          {/* AC Units */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5 md:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">AC Unit Details</h2>
              <Button type="button" onClick={addACUnit} variant="outline" size="sm">
                + Add Unit
              </Button>
            </div>
            
            <div className="space-y-4">
              {acDetails.acTypes.map((ac, index) => (
                <div key={index} className="p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Unit {index + 1}</h3>
                    {acDetails.numberOfUnits > 1 && (
                      <button
                        type="button"
                        onClick={() => removeACUnit(index)}
                        className="text-destructive hover:bg-destructive/10 p-1 rounded"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-3">
                    <div>
                      <Label>AC Type</Label>
                      <select
                        value={ac.type}
                        onChange={(e) => updateACUnit(index, 'type', e.target.value)}
                        className="w-full p-2 rounded-lg border border-border bg-background"
                        required
                      >
                        <option value="split">Split AC</option>
                        <option value="window">Window AC</option>
                        <option value="central">Central AC</option>
                        <option value="cassette">Cassette AC</option>
                      </select>
                    </div>
                    
                    <div>
                      <Label>Tonnage</Label>
                      <select
                        value={ac.tonnage}
                        onChange={(e) => updateACUnit(index, 'tonnage', e.target.value)}
                        className="w-full p-2 rounded-lg border border-border bg-background"
                        required
                      >
                        <option value="0.75">0.75 Ton</option>
                        <option value="1">1 Ton</option>
                        <option value="1.5">1.5 Ton</option>
                        <option value="2">2 Ton</option>
                        <option value="2.5">2.5 Ton</option>
                        <option value="3">3 Ton</option>
                      </select>
                    </div>
                    
                    <div>
                      <Label>Brand (Optional)</Label>
                      <Input
                        type="text"
                        placeholder="e.g., LG, Samsung"
                        value={ac.brand}
                        onChange={(e) => updateACUnit(index, 'brand', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Details */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5 md:p-6">
            <h2 className="text-xl font-bold mb-4">Additional Information</h2>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lastService">Last Service Date (Optional)</Label>
                  <Input
                    id="lastService"
                    type="date"
                    value={acDetails.lastServiceDate}
                    onChange={(e) => setACDetails(prev => ({ ...prev, lastServiceDate: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="urgency">Urgency Level</Label>
                  <select
                    id="urgency"
                    value={acDetails.urgency}
                    onChange={(e) => setACDetails(prev => ({ ...prev, urgency: e.target.value as ACServiceDetails['urgency'] }))}
                    className="w-full p-2 rounded-lg border border-border bg-background"
                  >
                    <option value="low">Low - Regular service</option>
                    <option value="medium">Medium - Soon needed</option>
                    <option value="high">High - Urgent (+30% fee)</option>
                  </select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="issueDescription">Issue Description</Label>
                <textarea
                  id="issueDescription"
                  placeholder="Describe any issues with your AC..."
                  value={acDetails.issueDescription}
                  onChange={(e) => setACDetails(prev => ({ ...prev, issueDescription: e.target.value }))}
                  className="w-full min-h-[80px] p-3 rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              
              <div>
                <Label htmlFor="specialInstructions">Special Instructions</Label>
                <textarea
                  id="specialInstructions"
                  placeholder="Any specific requirements..."
                  value={acDetails.specialInstructions}
                  onChange={(e) => setACDetails(prev => ({ ...prev, specialInstructions: e.target.value }))}
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
                <span className="text-muted-foreground">Number of Units:</span>
                <span className="font-semibold">{acDetails.numberOfUnits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service Type:</span>
                <span className="font-semibold capitalize">{acDetails.serviceType.replace('-', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated Duration:</span>
                <span className="font-semibold">{calculateDuration()} minutes</span>
              </div>
              {acDetails.urgency === 'high' && (
                <div className="flex items-center gap-2 p-2 bg-orange-100 dark:bg-orange-900/20 rounded text-sm text-orange-700 dark:text-orange-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>High urgency +30% surcharge applied</span>
                </div>
              )}
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

export default ACServicingPage;
