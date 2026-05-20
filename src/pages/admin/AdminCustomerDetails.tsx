import AppLayout from "@/components/AppLayout";
import { useAdminRole } from "@/hooks/useAdminRole";
import { adminAPI, superAdminAPI } from "@/lib/api";
import { ArrowLeft, Calendar, CheckCircle, Loader2, Mail, MapPin, Phone, ShoppingBag, User, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

interface Address {
  label?: string;
  street?: string;
  flatNo?: string;
  apartment?: string;
  area?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  isDefault?: boolean;
  location?: {
    coordinates: [number, number];
  };
}

interface PreferredWorker {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  specialization?: string[];
  rating?: number;
}

interface Booking {
  _id: string;
  bookingDate: string;
  status: string;
  totalAmount: number;
  service?: {
    name: string;
  };
  worker?: {
    name: string;
  };
  createdAt: string;
}

interface CustomerDetails {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  addresses?: Address[];
  preferences?: {
    workerGenderPreference?: string;
    languagePreference?: string[];
    religionPreference?: string;
    specialInstructions?: string;
  };
  isActive?: boolean;
  isVerified?: boolean;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  joinedAt?: string;
  createdAt?: string;
  monthsActive?: number;
  stats?: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    preferredWorkers?: PreferredWorker[];
    recentBookings?: Booking[];
  };
}

const AdminCustomerDetails = () => {
  const { role, name, isSuperAdmin } = useAdminRole();
  const { customerId } = useParams<{ customerId: string }>();
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendingResetOtp, setSendingResetOtp] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchCustomerDetails = useCallback(async () => {
    if (!customerId) return;

    setLoading(true);
    setError("");
    try {
      const response = await adminAPI.getCustomerDetails(customerId);
      if (response.success) {
        setCustomer(response.customer);
      }
    } catch (err) {
      console.error("Failed to fetch customer details:", err);
      setError("Failed to load customer details");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void fetchCustomerDetails();
  }, [fetchCustomerDetails]);

  const formatDate = (dateString?: string): string => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'confirmed':
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const handleSendResetOtp = async () => {
    if (!customer || !isSuperAdmin) return;

    try {
      setSendingResetOtp(true);
      const response = await superAdminAPI.sendCustomerResetOtp(customer._id, customer.phone ? 'both' : 'email');
      const deliverySummary = response.deliveryResults
        ? Object.entries(response.deliveryResults).map(([key, value]) => `${key}: ${value}`).join(', ')
        : 'queued';
      toast.success(`Reset OTP sent successfully (${deliverySummary})`);
    } catch (err) {
      console.error("Failed to send customer reset OTP:", err);
      toast.error(err instanceof Error ? err.message : 'Failed to send reset OTP');
    } finally {
      setSendingResetOtp(false);
    }
  };

  const handleToggleCustomerStatus = async () => {
    if (!customer || !isSuperAdmin) return;

    try {
      setUpdatingStatus(true);
      const nextStatus = !customer.isActive;
      await superAdminAPI.updateCustomerStatus(customer._id, nextStatus);
      setCustomer((current) => current ? { ...current, isActive: nextStatus } : current);
      toast.success(`Customer account ${nextStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      console.error("Failed to update customer status:", err);
      toast.error(err instanceof Error ? err.message : 'Failed to update customer status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <AppLayout userType={role} userName={name}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error || !customer) {
    return (
      <AppLayout userType={role} userName={name}>
        <div className="p-6">
          <Link to="/admin/customers" className="inline-flex items-center gap-2 text-primary hover:underline mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Customers
          </Link>
          <div className="text-center py-12">
            <p className="text-destructive">{error || "Customer not found"}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType={role} userName={name}>
      <div className="px-4 py-6 sm:px-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link to="/admin/customers" className="inline-flex items-center gap-2 text-primary hover:underline mb-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Customers
            </Link>
            <h1 className="text-3xl font-bold text-foreground">{customer.name}</h1>
            <p className="text-muted-foreground mt-1">Customer ID: {customer._id}</p>
          </div>
          <div className="flex gap-2">
            {typeof customer.isActive === 'boolean' && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${customer.isActive ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                {customer.isActive ? 'Account Active' : 'Account Inactive'}
              </span>
            )}
            {customer.isVerified && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                Verified
              </span>
            )}
            {isSuperAdmin && (
              <>
                <button
                  type="button"
                  onClick={handleSendResetOtp}
                  disabled={sendingResetOtp}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sendingResetOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Send Reset OTP
                </button>
                <button
                  type="button"
                  onClick={handleToggleCustomerStatus}
                  disabled={updatingStatus}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {customer.isActive ? 'Deactivate Account' : 'Activate Account'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Information */}
            <div className="bg-card rounded-lg border border-border p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-foreground">{customer.email}</p>
                    {customer.isEmailVerified && (
                      <span className="text-xs text-green-600">Verified</span>
                    )}
                  </div>
                </div>
                {customer.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="text-foreground">{customer.phone}</p>
                      {customer.isPhoneVerified && (
                        <span className="text-xs text-green-600">Verified</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {customer.gender && (
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Gender</p>
                      <p className="text-foreground capitalize">{customer.gender}</p>
                    </div>
                  </div>
                )}
                {customer.dateOfBirth && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Date of Birth</p>
                      <p className="text-foreground">{formatDate(customer.dateOfBirth)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Addresses */}
            <div className="bg-card rounded-lg border border-border p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Addresses</h2>
              {customer.addresses && customer.addresses.length > 0 ? (
                <div className="space-y-3">
                  {customer.addresses.map((address, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                      <MapPin className="h-5 w-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-foreground">{address.label || 'Address'}</p>
                          {address.isDefault && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Default</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {[
                            address.flatNo,
                            address.apartment,
                            address.street,
                            address.area,
                            address.city,
                            address.state,
                            address.zipCode
                          ].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No addresses on file</p>
              )}
            </div>

            {/* Preferences */}
            {customer.preferences && (
              <div className="bg-card rounded-lg border border-border p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Preferences</h2>
                <div className="space-y-3">
                  {customer.preferences.workerGenderPreference && (
                    <div>
                      <p className="text-sm text-muted-foreground">Worker Gender Preference</p>
                      <p className="text-foreground capitalize">{customer.preferences.workerGenderPreference}</p>
                    </div>
                  )}
                  {customer.preferences.languagePreference && customer.preferences.languagePreference.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">Language Preference</p>
                      <p className="text-foreground">{customer.preferences.languagePreference.join(', ')}</p>
                    </div>
                  )}
                  {customer.preferences.religionPreference && (
                    <div>
                      <p className="text-sm text-muted-foreground">Religion Preference</p>
                      <p className="text-foreground">{customer.preferences.religionPreference}</p>
                    </div>
                  )}
                  {customer.preferences.specialInstructions && (
                    <div>
                      <p className="text-sm text-muted-foreground">Special Instructions</p>
                      <p className="text-foreground">{customer.preferences.specialInstructions}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recent Bookings */}
            {customer.stats?.recentBookings && customer.stats.recentBookings.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Recent Bookings</h2>
                <div className="space-y-3">
                  {customer.stats.recentBookings.map((booking) => (
                    <div key={booking._id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{booking.service?.name || 'Service'}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(booking.bookingDate)} • Worker: {booking.worker?.name || 'Not assigned'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">₹{booking.totalAmount}</p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(booking.status)}`}>
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-card rounded-lg border border-border p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Statistics</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Total Bookings</span>
                  </div>
                  <span className="font-semibold text-foreground">{customer.stats?.totalBookings || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-muted-foreground">Completed</span>
                  </div>
                  <span className="font-semibold text-foreground">{customer.stats?.completedBookings || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="text-muted-foreground">Cancelled</span>
                  </div>
                  <span className="font-semibold text-foreground">{customer.stats?.cancelledBookings || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Member Since</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {customer.monthsActive ? `${customer.monthsActive} mo` : formatDate(customer.joinedAt || customer.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Preferred Workers */}
            {customer.stats?.preferredWorkers && customer.stats.preferredWorkers.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Preferred Workers</h2>
                <div className="space-y-3">
                  {customer.stats.preferredWorkers.map((worker) => (
                    <div key={worker._id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{worker.name}</p>
                        {worker.specialization && worker.specialization.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">{worker.specialization.join(', ')}</p>
                        )}
                      </div>
                      {worker.rating && (
                        <span className="text-sm font-semibold text-foreground">⭐ {worker.rating.toFixed(1)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminCustomerDetails;
