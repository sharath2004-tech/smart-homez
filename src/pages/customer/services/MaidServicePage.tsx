import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authAPI, bookingsAPI, servicesAPI } from "@/lib/api";
import { AlertCircle, Calendar as CalendarIcon, ChevronLeft, Clock, UserCheck } from "lucide-react";
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
  pricingPlans?: {
    oneTime: number;
    daily: number;
    weekly: number;
    monthly: number;
  };
}

interface MaidBookingDetails {
  hours: number; // Minimum 1 hour
  bookingType: 'oneTime' | 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate?: string; // For subscription
  preferredTimeSlot: string;
  taskList: string[];
  workerGenderPreference: 'male' | 'female' | 'any';
  specialInstructions: string;
  bringSupplies: boolean;
}

const MaidServicePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  
  const [maidDetails, setMaidDetails] = useState<MaidBookingDetails>({
    hours: 1, // Minimum 1 hour
    bookingType: 'oneTime',
    startDate: '',
    endDate: '',
    preferredTimeSlot: '09:00',
    taskList: [],
    workerGenderPreference: 'any',
    specialInstructions: '',
    bringSupplies: false
  });

  const isSubscription = service?.name?.toLowerCase().includes('subscription') || 
                         service?.name?.toLowerCase().includes('monthly');

  useEffect(() => {
    fetchData();
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
      
      // Set default booking type based on service
      if (serviceData.service.name?.toLowerCase().includes('monthly') || 
          serviceData.service.name?.toLowerCase().includes('subscription')) {
        setMaidDetails(prev => ({ ...prev, bookingType: 'monthly' }));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load service details');
    } finally {
      setLoading(false);
    }
  };

  const taskOptions = [
    'Sweeping and Mopping',
    'Dusting',
    'Kitchen Cleaning',
    'Bathroom Cleaning',
    'Dishwashing',
    'Laundry',
    'Utensil Cleaning',
    'Organizing',
    'Vacuuming',
    'Balcony Cleaning'
  ];

  const toggleTask = (task: string) => {
    setMaidDetails(prev => ({
      ...prev,
      taskList: prev.taskList.includes(task)
        ? prev.taskList.filter(t => t !== task)
        : [...prev.taskList, task]
    }));
  };

  const calculateTotalPrice = () => {
    if (!service) return 0;
    
    const pricePerHour = service.pricingPlans 
      ? service.pricingPlans[maidDetails.bookingType]
      : service.price;
    
    let totalPrice = pricePerHour * maidDetails.hours;
    
    // For subscriptions, calculate based on frequency
    if (maidDetails.bookingType === 'monthly' && maidDetails.startDate && maidDetails.endDate) {
      const days = Math.ceil(
        (new Date(maidDetails.endDate).getTime() - new Date(maidDetails.startDate).getTime()) 
        / (1000 * 60 * 60 * 24)
      );
      totalPrice = pricePerHour * maidDetails.hours * days;
    } else if (maidDetails.bookingType === 'weekly') {
      totalPrice = pricePerHour * maidDetails.hours * 4; // 4 weeks
    } else if (maidDetails.bookingType === 'daily') {
      totalPrice = pricePerHour * maidDetails.hours * 30; // 30 days
    }
    
    // Supply charges
    if (maidDetails.bringSupplies) {
      totalPrice += 100;
    }
    
    return Math.round(totalPrice);
  };

  const calculateTotalHours = () => {
    if (maidDetails.bookingType === 'monthly' && maidDetails.startDate && maidDetails.endDate) {
      const days = Math.ceil(
        (new Date(maidDetails.endDate).getTime() - new Date(maidDetails.startDate).getTime()) 
        / (1000 * 60 * 60 * 24)
      );
      return maidDetails.hours * days;
    } else if (maidDetails.bookingType === 'weekly') {
      return maidDetails.hours * 4;
    } else if (maidDetails.bookingType === 'daily') {
      return maidDetails.hours * 30;
    }
    return maidDetails.hours;
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!maidDetails.startDate) {
      toast.error('Please select a start date');
      return;
    }

    if (maidDetails.hours < 1) {
      toast.error('Minimum 1 hour booking required');
      return;
    }

    if (maidDetails.taskList.length === 0) {
      toast.error('Please select at least one task');
      return;
    }

    if ((maidDetails.bookingType === 'monthly' || maidDetails.bookingType === 'weekly') && !maidDetails.endDate) {
      toast.error('Please select an end date for subscription');
      return;
    }

    try {
      setBooking(true);
      
      const userLocation = localStorage.getItem('userLocation');
      const location = userLocation ? JSON.parse(userLocation) : null;

      const bookingData = {
        service: service?._id,
        bookingDate: maidDetails.startDate,
        startTime: maidDetails.preferredTimeSlot,
        bookingType: maidDetails.bookingType,
        serviceDetails: {
          hours: maidDetails.hours,
          taskList: maidDetails.taskList,
          workerGenderPreference: maidDetails.workerGenderPreference,
          bringSupplies: maidDetails.bringSupplies,
          specialInstructions: maidDetails.specialInstructions,
          subscriptionEndDate: maidDetails.endDate,
          isTimeBasedService: true
        },
        totalAmount: calculateTotalPrice(),
        estimatedDuration: maidDetails.hours * 60, // Convert to minutes
        preferences: {
          workerGenderPreference: maidDetails.workerGenderPreference
        },
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
    } catch (error: any) {
      console.error('Error creating booking:', error);
      toast.error(error.response?.data?.message || 'Failed to create booking');
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
  const minEndDate = maidDetails.startDate || minDate;

  return (
    <AppLayout userType="customer" userName={profile?.name}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link to="/customer/services" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ChevronLeft className="w-4 h-4" />
            Back to Services
          </Link>
          
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-2xl p-6 border border-purple-100 dark:border-purple-900">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <UserCheck className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold mb-2">{service?.name}</h1>
                <p className="text-muted-foreground mb-3">{service?.description}</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <span className="font-semibold">Price:</span>
                    <span className="text-primary font-bold">₹{service?.price}/hour</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="font-semibold">Minimum:</span>
                    <span>1 hour</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleBooking} className="space-y-6">
          {/* Booking Type */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-bold mb-4">Booking Type</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { value: 'oneTime', label: 'One-Time', desc: 'Single session', price: service?.pricingPlans?.oneTime || service?.price },
                { value: 'daily', label: 'Daily', desc: '30 days package', price: service?.pricingPlans?.daily || service?.price },
                { value: 'weekly', label: 'Weekly', desc: '4 weeks package', price: service?.pricingPlans?.weekly || service?.price },
                { value: 'monthly', label: 'Monthly', desc: 'Best value subscription', price: service?.pricingPlans?.monthly || service?.price }
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setMaidDetails(prev => ({ ...prev, bookingType: type.value as any }))}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    maidDetails.bookingType === type.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-semibold">{type.label}</div>
                  <div className="text-sm text-muted-foreground">{type.desc}</div>
                  <div className="text-sm text-primary font-bold mt-1">₹{type.price}/hr</div>
                </button>
              ))}
            </div>
          </div>

          {/* Schedule Section */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-bold mb-4">Schedule</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="startDate" className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  Start Date
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={maidDetails.startDate}
                  min={minDate}
                  onChange={(e) => setMaidDetails(prev => ({ ...prev, startDate: e.target.value }))}
                  required
                />
              </div>
              
              {(maidDetails.bookingType === 'monthly' || maidDetails.bookingType === 'weekly') && (
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={maidDetails.endDate}
                    min={minEndDate}
                    onChange={(e) => setMaidDetails(prev => ({ ...prev, endDate: e.target.value }))}
                    required
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="timeSlot" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Preferred Time
                </Label>
                <Input
                  id="timeSlot"
                  type="time"
                  value={maidDetails.preferredTimeSlot}
                  onChange={(e) => setMaidDetails(prev => ({ ...prev, preferredTimeSlot: e.target.value }))}
                  required
                />
              </div>
            </div>
          </div>

          {/* Hours Selection */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-bold mb-4">Duration (Minimum 1 Hour)</h2>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setMaidDetails(prev => ({ ...prev, hours: Math.max(1, prev.hours - 1) }))}
                disabled={maidDetails.hours <= 1}
              >
                -
              </Button>
              <div className="text-center flex-1">
                <div className="text-4xl font-bold text-primary">{maidDetails.hours}</div>
                <div className="text-sm text-muted-foreground">hour{maidDetails.hours > 1 ? 's' : ''} per session</div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setMaidDetails(prev => ({ ...prev, hours: Math.min(8, prev.hours + 1) }))}
                disabled={maidDetails.hours >= 8}
              >
                +
              </Button>
            </div>
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Maximum 8 hours per session. For longer requirements, please book multiple sessions.
                </p>
              </div>
            </div>
          </div>

          {/* Task Selection */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-bold mb-4">Select Tasks *</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {taskOptions.map((task) => (
                <label
                  key={task}
                  className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={maidDetails.taskList.includes(task)}
                    onChange={() => toggleTask(task)}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-sm">{task}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-xl font-bold mb-4">Preferences</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="gender">Worker Gender Preference</Label>
                <select
                  id="gender"
                  value={maidDetails.workerGenderPreference}
                  onChange={(e) => setMaidDetails(prev => ({ ...prev, workerGenderPreference: e.target.value as any }))}
                  className="w-full p-2 rounded-lg border border-border bg-background"
                >
                  <option value="any">No Preference</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={maidDetails.bringSupplies}
                    onChange={(e) => setMaidDetails(prev => ({ ...prev, bringSupplies: e.target.checked }))}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-sm">Bring cleaning supplies (+₹100)</span>
                </label>
              </div>

              <div>
                <Label htmlFor="specialInstructions">Special Instructions</Label>
                <textarea
                  id="specialInstructions"
                  placeholder="Any specific requirements or instructions..."
                  value={maidDetails.specialInstructions}
                  onChange={(e) => setMaidDetails(prev => ({ ...prev, specialInstructions: e.target.value }))}
                  className="w-full min-h-[80px] p-3 rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border-2 border-primary/20 p-6">
            <h2 className="text-xl font-bold mb-4">Booking Summary</h2>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Booking Type:</span>
                <span className="font-semibold capitalize">{maidDetails.bookingType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hours per Session:</span>
                <span className="font-semibold">{maidDetails.hours} hour{maidDetails.hours > 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Hours:</span>
                <span className="font-semibold">{calculateTotalHours()} hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Selected Tasks:</span>
                <span className="font-semibold">{maidDetails.taskList.length}</span>
              </div>
              {maidDetails.bringSupplies && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Supplies:</span>
                  <span>+₹100</span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-primary/20">
                <span className="text-lg font-bold">Total Amount:</span>
                <span className="text-2xl font-bold text-primary">₹{calculateTotalPrice()}</span>
              </div>
            </div>
            
            <Button
              type="submit"
              disabled={booking}
              className="w-full h-12 text-lg"
            >
              {booking ? 'Creating Booking...' : 'Confirm Booking'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default MaidServicePage;
