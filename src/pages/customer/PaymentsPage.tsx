import AppLayout from "@/components/AppLayout";
import { authAPI, bookingsAPI } from "@/lib/api";
import { CheckCircle, CreditCard, Download, TrendingUp, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

interface Payment {
  _id: string;
  booking: {
    service: {
      name: string;
    };
    totalAmount: number;
  };
  paymentDate: string;
  paymentMethod: string;
  status: string;
  amount: number;
}

interface Stats {
  thisMonth: number;
  totalServices: number;
  savedAmount: number;
}

const PaymentsPage = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats>({ thisMonth: 0, totalServices: 0, savedAmount: 0 });
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentData();
  }, []);

  const fetchPaymentData = async () => {
    try {
      setLoading(true);
      const [profileData, bookingsData] = await Promise.all([
        authAPI.getProfile(),
        bookingsAPI.getAll({ status: 'completed' })
      ]);

      setProfile(profileData.user || profileData);
      
      const completedBookings = bookingsData.bookings || [];
      setTransactions(completedBookings.slice(0, 10));

      // Calculate stats
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const thisMonthBookings = completedBookings.filter((b: any) => {
        const bookingDate = new Date(b.completedAt || b.createdAt);
        return bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear;
      });

      const thisMonthTotal = thisMonthBookings.reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0);
      const totalServices = completedBookings.length;

      setStats({
        thisMonth: thisMonthTotal,
        totalServices,
        savedAmount: 0 // TODO: Calculate from subscription savings
      });
    } catch (error) {
      console.error('Error fetching payment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const getServiceEmoji = (serviceName: string) => {
    if (serviceName.toLowerCase().includes('deep clean')) return '✨';
    if (serviceName.toLowerCase().includes('kitchen')) return '🍳';
    if (serviceName.toLowerCase().includes('bathroom')) return '🚿';
    if (serviceName.toLowerCase().includes('monthly') || serviceName.toLowerCase().includes('subscription')) return '📅';
    return '🧹';
  };

  const getPaymentMethod = (method?: string) => {
    if (!method) return 'Cash';
    if (method.toLowerCase().includes('upi')) return 'UPI';
    if (method.toLowerCase().includes('card')) return 'Card';
    if (method.toLowerCase().includes('cash')) return 'Cash';
    return method;
  };

  if (loading) {
    return (
      <AppLayout userType="customer" userName={profile?.name || "Loading..."}>
        <div className="max-w-3xl mx-auto flex items-center justify-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="customer" userName={profile?.name || "Customer"}>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground mb-1">Payments</h1>
          <p className="text-muted-foreground text-sm">Track your spending and payment history</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { icon: TrendingUp, label: "This Month", value: `₹${stats.thisMonth.toLocaleString()}`, color: "text-primary", bg: "bg-primary-light" },
            { icon: CheckCircle, label: "Total Services", value: stats.totalServices, color: "text-success", bg: "bg-success-light" },
            { icon: Wallet, label: "Saved (Sub.)", value: `₹${stats.savedAmount}`, color: "text-warning", bg: "bg-warning-light" },
          ].map((card) => (
            <div key={card.label} className="card-elevated p-4">
              <div className={`w-9 h-9 ${card.bg} rounded-xl flex items-center justify-center mb-3`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-xl font-bold font-heading text-foreground mt-0.5">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Payment methods */}
        <div className="card-elevated p-5">
          <h2 className="text-base font-bold font-heading text-foreground mb-4">Payment Methods</h2>
          <div className="space-y-3">
            {[
              { icon: "💳", name: "Credit/Debit Card", detail: "Pay with card", isDefault: false },
              { icon: "📱", name: "UPI", detail: "PhonePe, Google Pay, Paytm", isDefault: true },
              { icon: "💵", name: "Cash", detail: "Pay after service", isDefault: false },
            ].map((method) => (
              <div key={method.name} className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <span className="text-2xl">{method.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{method.name}</p>
                  <p className="text-xs text-muted-foreground">{method.detail}</p>
                </div>
                {method.isDefault && <span className="badge-success text-xs">Available</span>}
              </div>
            ))}
            <button
              onClick={() => alert('Payment method management coming soon!')}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <CreditCard className="w-4 h-4" /> Add payment method
            </button>
          </div>
        </div>

        {/* Transaction history */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold font-heading text-foreground">Transaction History</h2>
            <button
              onClick={() => alert('Export feature coming soon!')}
              className="flex items-center gap-1.5 text-sm text-primary font-medium"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
          {transactions.length === 0 ? (
            <div className="card-elevated p-12 text-center">
              <Wallet className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-bold text-foreground mb-2">No transactions yet</h3>
              <p className="text-sm text-muted-foreground">Your completed service payments will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((t: any) => (
                <div key={t._id} className="card-elevated p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-xl shrink-0">
                    {getServiceEmoji(t.service?.name || 'Service')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.service?.name || 'Service'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(t.completedAt || t.bookingDate)}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {getPaymentMethod(t.paymentMethod)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">₹{t.totalAmount}</p>
                    <span className="badge-success text-xs">Paid</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default PaymentsPage;
