import AppLayout from "@/components/AppLayout";
import BookingOrderPrint from "@/components/BookingOrderPrint";
import { useAdminRole } from "@/hooks/useAdminRole";
import { bookingsAPI, superAdminAPI } from "@/lib/api";
import ExcelJS from "exceljs";
import { CheckCircle, Clock, Coffee, Crown, Download, Eye, MapPin, Pause, Play, Printer, Search, Users, Wallet, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import html2pdf from "html2pdf.js";

interface ProofPhoto {
  url: string;
  timestamp: string;
  verified: boolean;
  transactionId?: string;
  transactionTime?: string;
}

interface BreakRequest {
  _id: string;
  requestedBy: string;
  requestedByName?: string;
  reason?: string;
  requestedAt: string;
  startedAt?: string;
  endedAt?: string;
  durationMinutes: number;
  status: 'pending' | 'approved' | 'active' | 'completed' | 'rejected';
}

interface Booking {
  _id: string;
  customer: { _id: string; name: string; email: string } | null;
  worker?: { _id: string; name: string; email: string } | null;
  supportStaff?: { worker: { _id: string; name: string }; name?: string }[];
  service: { _id: string; name: string; category: string } | null;
  bookingType?: string;
  location?: { address?: string; city?: string; state?: string; zipCode?: string } | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  completionPhoto?: ProofPhoto;
  completionPhotos?: ProofPhoto[];
  paymentProof?: ProofPhoto;
  actualDurationMinutes?: number;
  breakRequests?: BreakRequest[];
  isOnBreak?: boolean;
  totalBreakMinutes?: number;
  workforce?: {
    workerCount: number;
    wageType: 'per_hour' | 'per_session';
    wageRate: number;
    totalWorkerWage: number;
    updatedAt?: string;
  };
}

const statusConfig: Record<string, string> = {
  pending: "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-muted text-muted-foreground",
  confirmed: "badge-primary",
  'in-progress': "badge-warning",
  'pending-review': "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-orange-100 text-orange-700",
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
  const [approvingBookingId, setApprovingBookingId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [noRegionAssigned, setNoRegionAssigned] = useState(false);

  // Manage Team state
  const [selectedTeamBooking, setSelectedTeamBooking] = useState<Booking | null>(null);
  const [allWorkers, setAllWorkers] = useState<{ _id: string; name: string; email: string }[]>([]);
  const [workerSearch, setWorkerSearch] = useState('');
  const [teamActionLoading, setTeamActionLoading] = useState(false);

  // Print state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Workforce state
  const [workforceBooking, setWorkforceBooking] = useState<Booking | null>(null);
  const [workforceForm, setWorkforceForm] = useState({ workerCount: 1 });
  const [workforceLoading, setWorkforceLoading] = useState(false);

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
        if (response.noRegionAssigned) {
          setNoRegionAssigned(true);
          setBookings([]);
        } else {
          setNoRegionAssigned(false);
          setBookings(response.bookings || []);
        }
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = bookings.filter((b) => {
    const serviceName = b.service?.name || (b.bookingType === 'deep-cleaning-cart' ? 'deep cleaning' : '');
    const matchSearch =
      (b.customer?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      b._id.toLowerCase().includes(search.toLowerCase()) ||
      serviceName.toLowerCase().includes(search.toLowerCase());
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

  const hasProofs = (b: Booking) => !!(b.completionPhoto?.url || b.paymentProof?.url || (b.completionPhotos && b.completionPhotos.length > 0));

  const handleApproveBooking = async (bookingId: string) => {
    try {
      setApprovingBookingId(bookingId);
      await bookingsAPI.adminApproveBooking(bookingId);
      setSelectedProofBooking(null);
      await fetchBookings();
    } catch (error) {
      console.error('Approve error:', error);
      alert((error as Error).message || 'Failed to approve booking');
    } finally {
      setApprovingBookingId(null);
    }
  };

  const openWorkforce = (booking: Booking) => {
    setWorkforceBooking(booking);
    setWorkforceForm({
      workerCount: booking.workforce?.workerCount ?? 1,
    });
  };

  const handleUpdateWorkforce = async () => {
    if (!workforceBooking) return;
    try {
      setWorkforceLoading(true);
      const res = await bookingsAPI.updateWorkforce(workforceBooking._id, { workerCount: workforceForm.workerCount });
      setWorkforceBooking(prev => prev ? { ...prev, workforce: res.workforce, actualDurationMinutes: res.actualDurationMinutes } : prev);
      setBookings(prev => prev.map(b => b._id === workforceBooking._id
        ? { ...b, workforce: res.workforce, actualDurationMinutes: res.actualDurationMinutes }
        : b));
    } catch (e) {
      alert((e as Error).message || 'Failed to update workforce');
    } finally {
      setWorkforceLoading(false);
    }
  };

  const openManageTeam = async (booking: Booking) => {
    setSelectedTeamBooking(booking);
    setWorkerSearch('');
    if (allWorkers.length === 0) {
      try {
        const res = await superAdminAPI.getWorkers();
        setAllWorkers(res.workers || []);
      } catch (e) { console.error(e); }
    }
  };

  const handleAddSupportStaff = async (workerId: string) => {
    if (!selectedTeamBooking) return;
    try {
      setTeamActionLoading(true);
      const res = await bookingsAPI.addSupportStaff(selectedTeamBooking._id, workerId);
      setSelectedTeamBooking(prev => prev ? { ...prev, supportStaff: res.supportStaff } : prev);
      setBookings(prev => prev.map(b => b._id === selectedTeamBooking._id ? { ...b, supportStaff: res.supportStaff } : b));
    } catch (e) {
      alert((e as Error).message || 'Failed to add support staff');
    } finally {
      setTeamActionLoading(false);
    }
  };

  const handleRemoveSupportStaff = async (workerId: string) => {
    if (!selectedTeamBooking) return;
    try {
      setTeamActionLoading(true);
      const res = await bookingsAPI.removeSupportStaff(selectedTeamBooking._id, workerId);
      setSelectedTeamBooking(prev => prev ? { ...prev, supportStaff: res.supportStaff } : prev);
      setBookings(prev => prev.map(b => b._id === selectedTeamBooking._id ? { ...b, supportStaff: res.supportStaff } : b));
    } catch (e) {
      alert((e as Error).message || 'Failed to remove support staff');
    } finally {
      setTeamActionLoading(false);
    }
  };

  const handleSetTeamHead = async (workerId: string) => {
    if (!selectedTeamBooking) return;
    try {
      setTeamActionLoading(true);
      const res = await bookingsAPI.setTeamHead(selectedTeamBooking._id, workerId);
      setSelectedTeamBooking(prev => prev ? { ...prev, worker: res.worker, supportStaff: res.supportStaff } : prev);
      setBookings(prev => prev.map(b => b._id === selectedTeamBooking._id ? { ...b, worker: res.worker, supportStaff: res.supportStaff } : b));
    } catch (e) {
      alert((e as Error).message || 'Failed to set team head');
    } finally {
      setTeamActionLoading(false);
    }
  };

  const handlePrintToPDF = () => {
    if (!printRef.current || !selectedProofBooking) return;

    const filename = `booking-order-${selectedProofBooking.bookingId || selectedProofBooking._id.slice(-8)}.pdf`;

    const opt = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    };

    // @ts-ignore - html2pdf types not perfect
    html2pdf().set(opt).from(printRef.current).save();
  };

  const handlePrintToPrinter = () => {
    if (!printRef.current) return;

    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Booking Order</title>');
      printWindow.document.write('<style>body { font-family: Arial, sans-serif; } @media print { body { margin: 0; } }</style>');
      printWindow.document.write('</head><body>');
      printWindow.document.write(printRef.current.innerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

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
        service: b.service?.name || (b.bookingType === 'deep-cleaning-cart' ? 'Deep Cleaning' : 'Unknown'),
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
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 space-y-6 animate-fade-in">
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
            <option value="pending-review">Pending Review</option>
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
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{b.service?.name || (b.bookingType === 'deep-cleaning-cart' ? '✨ Deep Cleaning' : 'Unknown')}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(b.bookingDate)} · {formatTime(b.startTime)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {b.location ? [b.location.city, b.location.state].filter(Boolean).join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-foreground whitespace-nowrap">₹{b.totalAmount}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={statusConfig[b.status] || statusConfig.pending}>
                          {b.status.charAt(0).toUpperCase() + b.status.slice(1).replace('-', ' ')}
                        </span>
                        {b.isOnBreak && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 w-fit">
                            <Coffee className="w-3 h-3" /> On Break
                          </span>
                        )}
                        {b.totalBreakMinutes && b.totalBreakMinutes > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            Break: {b.totalBreakMinutes}m
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {b.bookingType === 'deep-cleaning-cart' && (
                          <button
                            onClick={() => openManageTeam(b)}
                            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
                          >
                            <Users className="w-3.5 h-3.5" />
                            Team ({(b.supportStaff?.length ?? 0) + (b.worker ? 1 : 0)})
                          </button>
                        )}
                        {['confirmed', 'in-progress', 'pending-review', 'completed'].includes(b.status) && (
                          <button
                            onClick={() => openWorkforce(b)}
                            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                          >
                            <Wallet className="w-3.5 h-3.5" />
                            {b.workforce?.totalWorkerWage ? `₹${b.workforce.totalWorkerWage}` : 'Wages'}
                          </button>
                        )}
                        {(b.status === 'completed' || b.status === 'pending-review') ? (
                          <button
                            onClick={() => setSelectedProofBooking(b)}
                            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                              hasProofs(b)
                                ? b.status === 'pending-review' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                : 'bg-muted text-muted-foreground hover:bg-muted/70'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {b.status === 'pending-review' ? '⏳ Review' : (
                              hasProofs(b) ? (
                                <span>
                                  {[b.completionPhotos && b.completionPhotos.length > 0 && `📸×${b.completionPhotos.length}`, b.paymentProof?.url && '💳'].filter(Boolean).join(' ')}
                                </span>
                              ) : 'No proofs'
                            )}
                          </button>
                        ) : (
                          b.bookingType !== 'deep-cleaning-cart' && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {noRegionAssigned && (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-3">🗺️</div>
              <p className="font-semibold text-foreground">No region assigned</p>
              <p className="text-sm mt-1">Contact your super admin to assign you to a location region.</p>
            </div>
          )}
          {!noRegionAssigned && filtered.length === 0 && (
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                  title="Print booking order"
                >
                  <Printer className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setSelectedProofBooking(null)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Booking summary */}
              <div className="bg-muted/40 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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

              {/* Completion Photos */}
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  📸 Work Completion Proof
                  {selectedProofBooking.completionPhotos && selectedProofBooking.completionPhotos.length > 0 && (
                    <span className="text-xs font-normal text-muted-foreground">({selectedProofBooking.completionPhotos.length} photo{selectedProofBooking.completionPhotos.length > 1 ? 's' : ''})</span>
                  )}
                </h3>
                {selectedProofBooking.completionPhotos && selectedProofBooking.completionPhotos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedProofBooking.completionPhotos.map((photo, i) => (
                      <div key={i} className="space-y-1">
                        <div className="rounded-xl overflow-hidden border-2 border-blue-200 bg-black aspect-square">
                          <img
                            src={bookingsAPI.getCompletionPhotoUrl(photo.url)}
                            alt={`Completion photo ${i + 1}`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground text-center">Photo {i + 1} · {formatDateTime(photo.timestamp)}</p>
                      </div>
                    ))}
                  </div>
                ) : selectedProofBooking.completionPhoto?.url ? (
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
                    <p className="text-sm">No completion photos uploaded</p>
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

              {/* Approve Button for pending-review bookings */}
              {selectedProofBooking.status === 'pending-review' && (
                <>
                  {!selectedProofBooking.paymentProof?.url && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-center">
                      <p className="text-red-700 font-semibold mb-1">⚠️ Payment Proof Required</p>
                      <p className="text-sm text-red-600">Payment proof must be uploaded before approval</p>
                    </div>
                  )}
                  <button
                    onClick={() => handleApproveBooking(selectedProofBooking._id)}
                    disabled={approvingBookingId === selectedProofBooking._id || !selectedProofBooking.paymentProof?.url}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                    title={!selectedProofBooking.paymentProof?.url ? 'Payment proof must be uploaded first' : 'Approve and mark as completed'}
                  >
                    <CheckCircle className="w-5 h-5" />
                    {approvingBookingId === selectedProofBooking._id ? 'Approving…' : 'Approve & Mark Complete'}
                  </button>
                </>
              )}

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
      {/* Manage Team Modal */}
      {selectedTeamBooking && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card rounded-2xl max-w-lg w-full my-8 shadow-2xl">
            <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="font-bold text-foreground text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-violet-600" /> Manage Team
                </h2>
                <p className="text-sm text-muted-foreground">
                  Deep Cleaning · {formatDate(selectedTeamBooking.bookingDate)} · {selectedTeamBooking.customer?.name}
                </p>
              </div>
              <button onClick={() => setSelectedTeamBooking(null)} className="p-2 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Current Team */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Current Team ({(selectedTeamBooking.supportStaff?.length ?? 0) + (selectedTeamBooking.worker ? 1 : 0)} members)</h3>
                <div className="space-y-2">
                  {selectedTeamBooking.worker && (
                    <div className="flex items-center justify-between p-3 bg-violet-50 border border-violet-200 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-500" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{selectedTeamBooking.worker.name}</p>
                          <p className="text-xs text-muted-foreground">{selectedTeamBooking.worker.email}</p>
                        </div>
                      </div>
                      <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">Team Head</span>
                    </div>
                  )}
                  {!selectedTeamBooking.worker && (
                    <p className="text-sm text-amber-600 italic bg-amber-50 border border-amber-200 rounded-xl p-3">No team head assigned — select one from the workers below</p>
                  )}
                  {(selectedTeamBooking.supportStaff ?? []).map((s) => (
                    <div key={s.worker._id} className="flex items-center justify-between p-3 bg-muted/40 border border-border rounded-xl">
                      <div className="flex items-center gap-2">
                        <span>👷</span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{s.worker.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleSetTeamHead(s.worker._id)}
                          disabled={teamActionLoading}
                          className="text-xs text-violet-600 hover:text-violet-700 font-medium px-2 py-1 rounded hover:bg-violet-50 transition-colors disabled:opacity-50"
                          title="Promote to Team Head"
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveSupportStaff(s.worker._id)}
                          disabled={teamActionLoading}
                          className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  {(selectedTeamBooking.supportStaff?.length ?? 0) < 4 && (
                    <p className="text-xs text-muted-foreground pl-1">
                      {4 - (selectedTeamBooking.supportStaff?.length ?? 0)} support staff slot{4 - (selectedTeamBooking.supportStaff?.length ?? 0) !== 1 ? 's' : ''} remaining
                    </p>
                  )}
                </div>
              </div>

              {/* Add Support Staff / Team Head */}
              {(selectedTeamBooking.supportStaff?.length ?? 0) < 4 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    {!selectedTeamBooking.worker ? 'Assign Team Head & Support Staff' : 'Add Support Staff'}
                  </h3>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      className="input-clean pl-9 text-sm"
                      placeholder="Search worker by name..."
                      value={workerSearch}
                      onChange={(e) => setWorkerSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-xl p-2">
                    {allWorkers
                      .filter(w => {
                        const alreadyTeamHead = selectedTeamBooking.worker?._id === w._id;
                        const alreadySupport = selectedTeamBooking.supportStaff?.some(s => s.worker._id === w._id);
                        const matchSearch = w.name.toLowerCase().includes(workerSearch.toLowerCase());
                        return !alreadyTeamHead && !alreadySupport && matchSearch;
                      })
                      .slice(0, 10)
                      .map(w => (
                        <div
                          key={w._id}
                          className="w-full p-2.5 rounded-lg hover:bg-muted transition-colors text-sm flex items-center justify-between group"
                        >
                          <span className="font-medium text-foreground">{w.name}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!selectedTeamBooking.worker && (
                              <button
                                onClick={() => handleSetTeamHead(w._id)}
                                disabled={teamActionLoading}
                                className="text-xs text-violet-600 font-medium px-2 py-1 rounded hover:bg-violet-50 transition-colors disabled:opacity-50 flex items-center gap-1"
                              >
                                <Crown className="w-3 h-3" /> Head
                              </button>
                            )}
                            <button
                              onClick={() => handleAddSupportStaff(w._id)}
                              disabled={teamActionLoading}
                              className="text-xs text-primary font-medium px-2 py-1 rounded hover:bg-primary/10 transition-colors disabled:opacity-50"
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                      ))}
                    {allWorkers.filter(w => {
                      const alreadyTeamHead = selectedTeamBooking.worker?._id === w._id;
                      const alreadySupport = selectedTeamBooking.supportStaff?.some(s => s.worker._id === w._id);
                      const matchSearch = w.name.toLowerCase().includes(workerSearch.toLowerCase());
                      return !alreadyTeamHead && !alreadySupport && matchSearch;
                    }).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No workers to add</p>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedTeamBooking(null)}
                className="w-full py-3 border border-border rounded-xl text-foreground font-medium hover:bg-muted transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workforce & Wages Modal */}
      {workforceBooking && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card rounded-2xl max-w-md w-full my-8 shadow-2xl">
            <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="font-bold text-foreground text-lg flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-600" /> Workforce Snapshot
                </h2>
                <p className="text-sm text-muted-foreground">
                  {workforceBooking.service?.name || 'Booking'} · {formatDate(workforceBooking.bookingDate)} · {workforceBooking.customer?.name}
                </p>
              </div>
              <button onClick={() => setWorkforceBooking(null)} className="p-2 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Current wage summary */}
              {workforceBooking.workforce && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Current Snapshot</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Workers:</span>
                    <span className="font-medium">{workforceBooking.workforce.workerCount}</span>
                    <span className="text-muted-foreground">Wage type:</span>
                    <span className="font-medium">{workforceBooking.workforce.wageType === 'per_hour' ? 'Per Hour' : 'Per Session'}</span>
                    <span className="text-muted-foreground">Rate:</span>
                    <span className="font-medium">₹{workforceBooking.workforce.wageRate}{workforceBooking.workforce.wageType === 'per_hour' ? '/hr' : '/session'}</span>
                    <span className="text-muted-foreground">Duration (mins):</span>
                    <span className="font-medium">{workforceBooking.actualDurationMinutes ?? '—'}</span>
                    <span className="text-muted-foreground font-semibold">Total Wage:</span>
                    <span className="font-bold text-emerald-700 text-base">₹{workforceBooking.workforce.totalWorkerWage}</span>
                  </div>
                </div>
              )}

              {/* Edit fields */}
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Wage and duration are locked after booking. Start/end scans and break approvals control duration, and any wage change must go through super-admin service price approval. Only extra worker count can be increased here.
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Workers Needed</label>
                  <input
                    type="number"
                    min={workforceBooking.workforce?.workerCount ?? 1}
                    value={workforceForm.workerCount}
                    onChange={e => setWorkforceForm(f => ({ ...f, workerCount: Math.max(workforceBooking.workforce?.workerCount ?? 1, parseInt(e.target.value) || 1) }))}
                    className="input-clean text-sm w-full"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleUpdateWorkforce}
                  disabled={workforceLoading}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-60"
                >
                  {workforceLoading ? 'Saving…' : 'Save worker count'}
                </button>
                <button
                  onClick={() => setWorkforceBooking(null)}
                  className="flex-1 py-2.5 border border-border rounded-xl font-medium text-sm hover:bg-muted transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && selectedProofBooking && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh]">
            {/* Print Modal Header */}
            <div className="bg-primary text-primary-foreground px-6 py-4 rounded-t-2xl flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold">Booking Order</h2>
              <button
                onClick={() => setShowPrintModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Print Preview */}
            <div className="overflow-y-auto flex-1">
              <BookingOrderPrint ref={printRef} booking={selectedProofBooking} />
            </div>

            {/* Print Modal Actions */}
            <div className="border-t border-border px-6 py-4 flex gap-3 shrink-0">
              <button
                onClick={handlePrintToPDF}
                className="flex-1 btn btn-primary flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
              <button
                onClick={handlePrintToPrinter}
                className="flex-1 btn btn-secondary flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Print
              </button>
              <button
                onClick={() => setShowPrintModal(false)}
                className="flex-1 btn btn-ghost"
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

