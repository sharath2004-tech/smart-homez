import AppLayout from "@/components/AppLayout";
import { useAdminRole } from "@/hooks/useAdminRole";
import { bookingsAPI, superAdminAPI } from "@/lib/api";
import ExcelJS from "exceljs";
import { Download, Eye, MapPin, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

interface ProofPhoto {
  url: string;
  timestamp: string;
  verified: boolean;
  transactionId?: string;
  transactionTime?: string;
}

interface Booking {
  _id: string;
  customer: { _id: string; name: string; email: string } | null;
  worker?: { _id: string; name: string; email: string } | null;
  service: { _id: string; name: string; category: string } | null;
  location?: { address?: string; city?: string; state?: string; zipCode?: string } | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  completionPhoto?: ProofPhoto;
  paymentProof?: ProofPhoto;
}

const statusConfig: Record<string, string> = {
  pending: "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-muted text-muted-foreground",
  confirmed: "badge-primary",
  'in-progress': "badge-warning",
  completed: "badge-success",
  cancelled: "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-destructive/10 text-destructive",
};

interface Location {
  _id: string;
  apartmentName: string;
  area: string;
  city: string;
}

const AdminBookings = () => {
  const { role, name, isSuperAdmin } = useAdminRole();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedProofBooking, setSelectedProofBooking] = useState<Booking | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");

  useEffect(() => {
    if (isSuperAdmin) {
      superAdminAPI.getLocations().then((res: { locations: Location[] }) => {
        setLocations(res.locations || []);
      }).catch(console.error);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchBookings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, selectedLocation]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      if (isSuperAdmin) {
        const response = await superAdminAPI.getBookings({
          locationId: selectedLocation || undefined,
          limit: 1000,
        });
        setBookings(response.bookings || []);
      } else {
        // admin role — backend scopes to their assigned locations automatically
        const response = await bookingsAPI.getAll({ limit: 1000 });
        setBookings(response.bookings || []);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = bookings.filter((b) => {
    const matchSearch =
      (b.customer?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      b._id.toLowerCase().includes(search.toLowerCase()) ||
      (b.service?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || b.status === filter;
    return matchSearch && matchFilter;
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const hasProofs = (b: Booking) => !!(b.completionPhoto?.url || b.paymentProof?.url);

  const handleExport = async () => {
    try {
      setExporting(true);
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Bookings');
      ws.columns = [
        { header: 'Booking ID', key: 'id', width: 15 },
        { header: 'Customer', key: 'customer', width: 22 },
        { header: 'Worker', key: 'worker', width: 22 },
        { header: 'Service', key: 'service', width: 28 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Start Time', key: 'startTime', width: 12 },
        { header: 'End Time', key: 'endTime', width: 12 },
        { header: 'City', key: 'city', width: 18 },
        { header: 'Amount (₹)', key: 'amount', width: 14 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created At', key: 'createdAt', width: 22 },
      ];
      filtered.forEach(b => ws.addRow({
        id: b._id.slice(-8).toUpperCase(),
        customer: b.customer?.name || 'Unknown',
        worker: b.worker?.name || '—',
        service: b.service?.name || 'Unknown',
        date: b.bookingDate ? new Date(b.bookingDate).toLocaleDateString('en-IN') : '—',
        startTime: b.startTime,
        endTime: b.endTime,
        city: b.location ? [b.location.city, b.location.state].filter(Boolean).join(', ') : '—',
        amount: b.totalAmount,
        status: b.status.charAt(0).toUpperCase() + b.status.slice(1).replace('-', ' '),
        createdAt: formatDateTime(b.createdAt),
      }));
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e293b' } };
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `bookings-${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout userType={role} userName={name}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading bookings...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType={role} userName={name}>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">
              {isSuperAdmin
                ? selectedLocation
                  ? `${locations.find(l => l._id === selectedLocation)?.apartmentName || 'Location'} Bookings`
                  : 'All Bookings'
                : 'My Region Bookings'}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{bookings.length} total bookings</p>
          </div>
          <button onClick={handleExport} disabled={exporting} className="flex items-center gap-2 btn-brand text-sm py-2.5 px-4 disabled:opacity-60">
            <Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input className="input-clean pl-10" placeholder="Search by customer, ID, or service..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {isSuperAdmin && (
            <div className="relative sm:w-56">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <select
                className="input-clean pl-10"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc._id} value={loc._id}>
                    {loc.apartmentName}, {loc.city}
                  </option>
                ))}
              </select>
            </div>
          )}
          <select className="input-clean sm:w-48" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Table */}
        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {["ID", "Customer", "Worker", "Service", "Date & Time", "Location", "Amount", "Status", "Proofs"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b._id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{b._id.slice(-6).toUpperCase()}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">{b.customer?.name || 'Unknown'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{b.worker?.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{b.service?.name || 'Unknown'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(b.bookingDate)} · {formatTime(b.startTime)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {b.location ? [b.location.city, b.location.state].filter(Boolean).join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-foreground whitespace-nowrap">₹{b.totalAmount}</td>
                    <td className="px-4 py-3">
                      <span className={statusConfig[b.status] || statusConfig.pending}>
                        {b.status.charAt(0).toUpperCase() + b.status.slice(1).replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {b.status === 'completed' ? (
                        <button
                          onClick={() => setSelectedProofBooking(b)}
                          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                            hasProofs(b)
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              : 'bg-muted text-muted-foreground hover:bg-muted/70'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {hasProofs(b) ? (
                            <span>
                              {[b.completionPhoto?.url && '📸', b.paymentProof?.url && '💳'].filter(Boolean).join(' ')}
                            </span>
                          ) : 'No proofs'}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-3">📭</div>
              <p>No bookings found</p>
            </div>
          )}
        </div>
      </div>

      {/* Proof Viewer Modal */}
      {selectedProofBooking && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card rounded-2xl max-w-2xl w-full my-8 shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="font-bold text-foreground text-lg">Worker Proof Documents</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedProofBooking.service?.name} · {selectedProofBooking.worker?.name || 'Unknown worker'} · {formatDate(selectedProofBooking.bookingDate)}
                </p>
              </div>
              <button
                onClick={() => setSelectedProofBooking(null)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Booking summary */}
              <div className="bg-muted/40 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Customer</p>
                  <p className="font-medium">{selectedProofBooking.customer?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Worker</p>
                  <p className="font-medium">{selectedProofBooking.worker?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Service</p>
                  <p className="font-medium">{selectedProofBooking.service?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Amount</p>
                  <p className="font-semibold text-foreground">₹{selectedProofBooking.totalAmount}</p>
                </div>
              </div>

              {/* Completion Photo */}
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  📸 Work Completion Proof
                </h3>
                {selectedProofBooking.completionPhoto?.url ? (
                  <div className="space-y-2">
                    <div className="rounded-xl overflow-hidden border-2 border-blue-200 bg-black">
                      <img
                        src={bookingsAPI.getCompletionPhotoUrl(selectedProofBooking.completionPhoto.url)}
                        alt="Work completion proof"
                        className="w-full max-h-72 object-contain mx-auto"
                      />
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-blue-700 font-medium">Uploaded at:</span>
                        <span className="text-foreground">{formatDateTime(selectedProofBooking.completionPhoto.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-muted rounded-xl p-8 text-center text-muted-foreground">
                    <p className="text-2xl mb-2">📷</p>
                    <p className="text-sm">No completion photo uploaded</p>
                  </div>
                )}
              </div>

              {/* Payment Proof */}
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  💳 Payment Proof
                </h3>
                {selectedProofBooking.paymentProof?.url ? (
                  <div className="space-y-2">
                    <div className="rounded-xl overflow-hidden border-2 border-amber-200 bg-black">
                      <img
                        src={bookingsAPI.getCompletionPhotoUrl(selectedProofBooking.paymentProof.url)}
                        alt="Payment proof"
                        className="w-full max-h-72 object-contain mx-auto"
                      />
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-amber-700 font-medium">Uploaded at:</span>
                        <span className="text-foreground">{formatDateTime(selectedProofBooking.paymentProof.timestamp)}</span>
                      </div>
                      {selectedProofBooking.paymentProof.transactionId && (
                        <div className="flex items-center justify-between border-t border-amber-200 pt-2">
                          <span className="text-amber-700 font-medium">Transaction ID:</span>
                          <span className="font-mono font-semibold text-foreground bg-white px-2 py-0.5 rounded border border-amber-200">
                            {selectedProofBooking.paymentProof.transactionId}
                          </span>
                        </div>
                      )}
                      {selectedProofBooking.paymentProof.transactionTime && (
                        <div className="flex items-center justify-between border-t border-amber-200 pt-2">
                          <span className="text-amber-700 font-medium">Transaction Time:</span>
                          <span className="text-foreground">{formatDateTime(selectedProofBooking.paymentProof.transactionTime)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-muted rounded-xl p-8 text-center text-muted-foreground">
                    <p className="text-2xl mb-2">🧾</p>
                    <p className="text-sm">No payment proof uploaded</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedProofBooking(null)}
                className="w-full py-3 border border-border rounded-xl text-foreground font-medium hover:bg-muted transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default AdminBookings;

