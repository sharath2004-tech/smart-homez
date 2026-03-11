import AppLayout from "@/components/AppLayout";
import { authAPI, bookingsAPI } from "@/lib/api";
import { AlertCircle, CheckCircle, Download, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

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

interface CompletedBooking {
  _id: string;
  service?: { name: string };
  totalAmount?: number;
  completedAt?: string;
  createdAt: string;
  bookingDate?: string;
  paymentMethod?: string;
  paymentStatus?: string;
}

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  addresses?: { isDefault: boolean; [key: string]: unknown }[];
}

const PaymentsPage = () => {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<CompletedBooking[]>([]);
  const [stats, setStats] = useState<Stats>({ thisMonth: 0, totalServices: 0, savedAmount: 0 });
  const [profile, setProfile] = useState<UserProfile | null>(null);
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

      const thisMonthBookings = completedBookings.filter((b: CompletedBooking) => {
        const bookingDate = new Date(b.completedAt || b.createdAt);
        return bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear;
      });

      const thisMonthTotal = thisMonthBookings.reduce((sum: number, b: CompletedBooking) => sum + (b.totalAmount || 0), 0);
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
          <h1 className="text-2xl font-bold font-heading text-foreground mb-1">{t('customer.payments.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('customer.payments.subtitle')}</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: CheckCircle, label: t('customer.payments.totalServices'), value: stats.totalServices, color: "text-success", bg: "bg-success-light" },
            { icon: Wallet, label: t('customer.payments.savedSub'), value: `₹${stats.savedAmount}`, color: "text-warning", bg: "bg-warning-light" },
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

        {/* Payment methods - UPI only */}
        <div className="card-elevated p-5">
          <h2 className="text-base font-bold font-heading text-foreground mb-4">{t('customer.payments.paymentMethods')}</h2>
          <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-xl mb-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive font-medium">{t('customer.payments.upiOnly')}</p>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
            <span className="text-2xl">📱</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{t('customer.payments.upiQrCode')}</p>
              <p className="text-xs text-muted-foreground">{t('customer.payments.upiApps')}</p>
            </div>
            <span className="badge-success text-xs">{t('customer.payments.available')}</span>
          </div>
        </div>

        {/* Transaction history */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold font-heading text-foreground">{t('customer.payments.transactionHistory')}</h2>
            <button
              onClick={() => alert(t('customer.payments.exportComingSoon'))}
              className="flex items-center gap-1.5 text-sm text-primary font-medium"
            >
              <Download className="w-3.5 h-3.5" /> {t('customer.payments.export')}
            </button>
          </div>
          {transactions.length === 0 ? (
            <div className="card-elevated p-12 text-center">
              <Wallet className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-bold text-foreground mb-2">{t('customer.payments.noTransactions')}</h3>
              <p className="text-sm text-muted-foreground">{t('customer.payments.noTransactionsDesc')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx: CompletedBooking) => (
                <div key={tx._id} className="card-elevated p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-xl shrink-0">
                    {getServiceEmoji(tx.service?.name || 'Service')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{tx.service?.name || 'Service'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(tx.completedAt || tx.bookingDate)}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {getPaymentMethod(tx.paymentMethod)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">₹{tx.totalAmount}</p>
                    {tx.paymentStatus === 'paid' ? (
                      <span className="badge-success text-xs">{t('customer.payments.paid')}</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning font-medium">{t('customer.payments.pending')}</span>
                    )}
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
