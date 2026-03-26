import ListPagination from "@/components/admin/ListPagination";
import AppLayout from "@/components/AppLayout";
import BookingOrderPrint from "@/components/BookingOrderPrint";
import { useAdminRole } from "@/hooks/useAdminRole";
import { adminAPI, bookingsAPI, superAdminAPI } from "@/lib/api";
import ExcelJS from "exceljs";
import html2pdf from "html2pdf.js";
import { CheckCircle, Coffee, Crown, Download, Eye, MapPin, Printer, Search, Users, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface ProofPhoto {
  url: string;
  timestamp: string;
  verified: boolean;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  reviewNotes?: string | null;
  reviewedAt?: string;
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
  bookingId?: string;
  customer: { _id: string; name: string; email: string; phone?: string } | null;
  worker?: { _id: string; name: string; email: string; phone?: string } | null;
  supportStaff?: { worker: { _id: string; name: string; email?: string; phone?: string }; name?: string }[];
  service: { _id: string; name: string; category: string; price?: number; duration?: number } | null;
  bookingType?: string;
  assignmentMethod?: string;
  location?: { apartmentName?: string; address?: string; area?: string; city?: string; state?: string; zipCode?: string } | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  paymentStatus?: string;
  subscription?: {
    isSubscription: boolean;
    isPrepaid?: boolean;
    activationStatus?: 'payment_pending' | 'approval_pending' | 'active';
  };
  paymentMethod?: string;
  completionPhoto?: ProofPhoto;
  completionPhotos?: ProofPhoto[];
  paymentProof?: ProofPhoto;
  paymentProofs?: ProofPhoto[];
  actualStartTime?: string;
  actualEndTime?: string;
  actualDurationMinutes?: number;
  overtimeMinutes?: number;
  overtimeCharges?: number;
  cartItems?: Array<{ name: string; qty?: number; unitPrice?: number; totalPrice: number }>;
  notes?: string;
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
  scheduledDurationMinutes?: number;
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

interface AvailableWorker {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  rating: number;
  specialization: string[];
  recommended?: boolean;
  recommendationScore?: number;
  coverageSummary?: string;
  subscriptionCoverage?: {
    totalOccurrences: number;
    coveredOccurrences: number;
    isFullCoverage: boolean;
    conflictCount: number;
  };
  conflictReasons?: Array<{
    date: string;
    startTime: string;
    endTime: string;
    reason: string;
  }>;
  assignedApartments?: Array<{ apartmentName: string; area: string; city: string }>;
}

const AdminBookings = () => {
  const BOOKINGS_PER_PAGE = 12;
  const { role, name, isSuperAdmin } = useAdminRole();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
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
  const [workersLoading, setWorkersLoading] = useState(false);
  const [workerListError, setWorkerListError] = useState<string | null>(null);
  const [reassignBooking, setReassignBooking] = useState<Booking | null>(null);

  // New filters for enhanced export
  const [selectedWorker, setSelectedWorker] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [availableWorkers, setAvailableWorkers] = useState<AvailableWorker[]>([]);
  const [availableWorkersLoading, setAvailableWorkersLoading] = useState(false);
  const [reassignReason, setReassignReason] = useState('Admin reassignment');

  // Print state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Workforce state
  const [workforceBooking, setWorkforceBooking] = useState<Booking | null>(null);
  const [workforceForm, setWorkforceForm] = useState({ workerCount: 1, scheduledDurationMinutes: 180 });
  const [workforceLoading, setWorkforceLoading] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      superAdminAPI.getLocations().then((res: { locations: Location[] }) => {
        setLocations(res.locations || []);
      }).catch(console.error);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    // Fetch workers for filter dropdown
    const fetchWorkersForFilter = async () => {
      if (!isSuperAdmin) return;
      try {
        const res = await superAdminAPI.getWorkers(selectedLocation || undefined);
        setAllWorkers(res.workers || []);
      } catch (e) {
        console.error('Error fetching workers for filter:', e);
      }
    };
    fetchWorkersForFilter();
  }, [isSuperAdmin, selectedLocation]);

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

  const filtered = useMemo(() => bookings.filter((b) => {
    const serviceName = b.service?.name || (b.bookingType === 'deep-cleaning-cart' ? 'deep cleaning' : '');
    const matchSearch =
      (b.customer?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      b._id.toLowerCase().includes(search.toLowerCase()) ||
      serviceName.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || b.status === filter;

    // Worker filter
    const matchWorker = !selectedWorker || b.worker?._id === selectedWorker;

    // Date range filter
    const bookingDate = new Date(b.bookingDate);
    const matchStartDate = !startDate || bookingDate >= new Date(startDate);
    const matchEndDate = !endDate || bookingDate <= new Date(endDate);

    return matchSearch && matchFilter && matchWorker && matchStartDate && matchEndDate;
  }), [bookings, filter, search, selectedWorker, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / BOOKINGS_PER_PAGE));
  const paginatedBookings = useMemo(() => {
    const startIndex = (currentPage - 1) * BOOKINGS_PER_PAGE;
    return filtered.slice(startIndex, startIndex + BOOKINGS_PER_PAGE);
  }, [currentPage, filtered]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter, selectedLocation, isSuperAdmin, selectedWorker, startDate, endDate]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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

  const formatCurrency = (amount?: number | null) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

  const formatMinutes = (minutes?: number | null) => {
    const safeMinutes = Number(minutes ?? 0);
    if (!Number.isFinite(safeMinutes) || safeMinutes <= 0) return '—';
    if (safeMinutes < 60) return `${safeMinutes} min`;
    const hours = Math.floor(safeMinutes / 60);
    const remaining = safeMinutes % 60;
    return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  const getServiceName = (booking: Booking) => booking.service?.name || (booking.bookingType === 'deep-cleaning-cart' ? 'Deep Cleaning' : 'Unknown');

  const getWorkerWage = (booking: Booking) => Number(booking.workforce?.totalWorkerWage || 0);

  const getEstimatedRevenue = (booking: Booking) => Math.round((Number(booking.totalAmount || 0) - getWorkerWage(booking)) * 100) / 100;

  const getSupportStaffNames = (booking: Booking) => (booking.supportStaff || [])
    .map((member) => member.worker?.name || member.name)
    .filter(Boolean)
    .join(', ');

  const getPaymentProofs = (booking: Booking) => (
    booking.paymentProofs && booking.paymentProofs.length > 0
      ? booking.paymentProofs
      : booking.paymentProof?.url
        ? [booking.paymentProof]
        : []
  );

  const getLatestPaymentProof = (booking: Booking) => {
    const proofs = getPaymentProofs(booking);
    return proofs.length > 0 ? proofs[proofs.length - 1] : undefined;
  };

  const isPrepaidSubscription = (booking: Booking) => Boolean(
    booking.subscription?.isSubscription
    && (booking.subscription?.isPrepaid || booking.paymentStatus === 'paid')
  );

  const hasProofs = (b: Booking) => !!(b.completionPhoto?.url || getPaymentProofs(b).length > 0 || (b.completionPhotos && b.completionPhotos.length > 0));

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
      scheduledDurationMinutes: booking.scheduledDurationMinutes ?? booking.actualDurationMinutes ?? 180,
    });
  };

  const handleUpdateWorkforce = async () => {
    if (!workforceBooking) return;
    try {
      setWorkforceLoading(true);
      const payload: { workerCount?: number; scheduledDurationMinutes?: number } = { workerCount: workforceForm.workerCount };
      if (workforceBooking.bookingType === 'deep-cleaning-cart') {
        payload.scheduledDurationMinutes = workforceForm.scheduledDurationMinutes;
      }
      const res = await bookingsAPI.updateWorkforce(workforceBooking._id, payload);
      setWorkforceBooking(prev => prev ? { ...prev, workforce: res.workforce, actualDurationMinutes: res.actualDurationMinutes, scheduledDurationMinutes: res.scheduledDurationMinutes, endTime: res.endTime } : prev);
      setBookings(prev => prev.map(b => b._id === workforceBooking._id
        ? { ...b, workforce: res.workforce, actualDurationMinutes: res.actualDurationMinutes, scheduledDurationMinutes: res.scheduledDurationMinutes, endTime: res.endTime }
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
    setWorkerListError(null);
    if (allWorkers.length === 0) {
      try {
        setWorkersLoading(true);
        const res = isSuperAdmin
          ? await superAdminAPI.getWorkers(selectedLocation || undefined)
          : await adminAPI.getWorkers();
        setAllWorkers(res.workers || []);
        if (res.noRegionAssigned) {
          setWorkerListError('No region is assigned to this admin, so workers cannot be loaded yet.');
        }
      } catch (e) {
        console.error(e);
        setWorkerListError((e as Error).message || 'Failed to load workers');
      } finally {
        setWorkersLoading(false);
      }
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

  const openReassignModal = async (booking: Booking) => {
    try {
      setReassignBooking(booking);
      setReassignReason('Admin reassignment');
      setAvailableWorkers([]);
      setAvailableWorkersLoading(true);
      const res = await adminAPI.getAvailableWorkersForBooking(booking._id);
      setAvailableWorkers(res.workers || []);
    } catch (e) {
      alert((e as Error).message || 'Failed to load available workers for this booking');
      setReassignBooking(null);
    } finally {
      setAvailableWorkersLoading(false);
    }
  };

  const handleReassignWorker = async (workerId: string) => {
    if (!reassignBooking) return;

    try {
      setTeamActionLoading(true);
      await adminAPI.manualAssign(reassignBooking._id, workerId, reassignReason);
      await fetchBookings();
      setReassignBooking(null);
      setAvailableWorkers([]);
      alert('Worker reassigned successfully');
    } catch (e) {
      alert((e as Error).message || 'Failed to reassign worker');
    } finally {
      setTeamActionLoading(false);
    }
  };

  const handlePrintToPDF = () => {
    if (!isSuperAdmin || !printRef.current || !selectedProofBooking) return;

    const filename = `booking-revenue-bill-${selectedProofBooking.bookingId || selectedProofBooking._id.slice(-8)}.pdf`;

    const opt = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    };

    // @ts-expect-error - html2pdf types are incomplete for the chained builder API
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
    if (!isSuperAdmin) return;

    try {
      setExporting(true);
      const wb = new ExcelJS.Workbook();
      const summaryWs = wb.addWorksheet('Revenue Summary');
      const ws = wb.addWorksheet('Bookings');
      const workerRevenueWs = wb.addWorksheet('Worker Revenue Analysis');

      const totalCustomerAmount = filtered.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0);
      const totalWorkerWage = filtered.reduce((sum, booking) => sum + getWorkerWage(booking), 0);
      const totalRevenue = filtered.reduce((sum, booking) => sum + getEstimatedRevenue(booking), 0);
      const totalOvertime = filtered.reduce((sum, booking) => sum + Number(booking.overtimeCharges || 0), 0);

      // Revenue Summary Sheet
      summaryWs.columns = [
        { header: 'Metric', key: 'metric', width: 32 },
        { header: 'Value', key: 'value', width: 26 },
      ];
      const selectedLocationLabel = selectedLocation
        ? locations.find((location) => location._id === selectedLocation)?.apartmentName || selectedLocation
        : 'All Locations';
      const selectedWorkerLabel = selectedWorker
        ? allWorkers.find((w) => w._id === selectedWorker)?.name || 'Selected Worker'
        : 'All Workers';
      const dateRangeLabel = startDate || endDate
        ? `${startDate || 'Start'} to ${endDate || 'End'}`
        : 'All Dates';

      [
        { metric: 'Location Filter', value: selectedLocationLabel },
        { metric: 'Worker Filter', value: selectedWorkerLabel },
        { metric: 'Date Range', value: dateRangeLabel },
        { metric: 'Status Filter', value: filter },
        { metric: 'Bookings Exported', value: filtered.length },
        { metric: 'Customer Billed Amount', value: totalCustomerAmount },
        { metric: 'Worker Wage Total', value: totalWorkerWage },
        { metric: 'Estimated Revenue', value: totalRevenue },
        { metric: 'Overtime Charges', value: totalOvertime },
        { metric: 'Generated At', value: new Date().toLocaleString('en-IN') },
      ].forEach((row) => summaryWs.addRow(row));

      // Bookings Detail Sheet
      ws.columns = [
        { header: 'Booking ID', key: 'id', width: 15 },
        { header: 'Booking Type', key: 'bookingType', width: 20 },
        { header: 'Assignment Method', key: 'assignmentMethod', width: 18 },
        { header: 'Customer', key: 'customer', width: 22 },
        { header: 'Customer Phone', key: 'customerPhone', width: 16 },
        { header: 'Customer Email', key: 'customerEmail', width: 28 },
        { header: 'Worker', key: 'worker', width: 22 },
        { header: 'Support Staff', key: 'supportStaff', width: 28 },
        { header: 'Worker Count', key: 'workerCount', width: 14 },
        { header: 'Service', key: 'service', width: 28 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Start Time', key: 'startTime', width: 12 },
        { header: 'End Time', key: 'endTime', width: 12 },
        { header: 'Scheduled Duration', key: 'scheduledDuration', width: 18 },
        { header: 'Actual Duration', key: 'actualDuration', width: 18 },
        { header: 'Actual Start', key: 'actualStart', width: 22 },
        { header: 'Actual End', key: 'actualEnd', width: 22 },
        { header: 'Address', key: 'address', width: 34 },
        { header: 'Area', key: 'area', width: 18 },
        { header: 'City', key: 'city', width: 18 },
        { header: 'Customer Billed (₹)', key: 'amount', width: 18 },
        { header: 'Worker Wage (₹)', key: 'workerWage', width: 16 },
        { header: 'Estimated Revenue (₹)', key: 'estimatedRevenue', width: 20 },
        { header: 'Overtime Charges (₹)', key: 'overtimeCharges', width: 20 },
        { header: 'Payment Status', key: 'paymentStatus', width: 16 },
        { header: 'Transaction ID', key: 'transactionId', width: 22 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Notes', key: 'notes', width: 42 },
        { header: 'Created At', key: 'createdAt', width: 22 },
      ];
      filtered.forEach(b => ws.addRow({
        id: b._id.slice(-8).toUpperCase(),
        bookingType: b.bookingType || 'adhoc',
        assignmentMethod: b.assignmentMethod || '—',
        customer: b.customer?.name || 'Unknown',
        customerPhone: b.customer?.phone || '—',
        customerEmail: b.customer?.email || '—',
        worker: b.worker?.name || '—',
        supportStaff: getSupportStaffNames(b) || '—',
        workerCount: b.workforce?.workerCount || (b.worker ? 1 : 0),
        service: getServiceName(b),
        date: b.bookingDate ? new Date(b.bookingDate).toLocaleDateString('en-IN') : '—',
        startTime: b.startTime,
        endTime: b.endTime,
        scheduledDuration: formatMinutes(b.scheduledDurationMinutes),
        actualDuration: formatMinutes(b.actualDurationMinutes),
        actualStart: formatDateTime(b.actualStartTime || ''),
        actualEnd: formatDateTime(b.actualEndTime || ''),
        address: b.location ? [b.location.apartmentName, b.location.address].filter(Boolean).join(', ') : '—',
        area: b.location?.area || '—',
        city: b.location ? [b.location.city, b.location.state].filter(Boolean).join(', ') : '—',
        amount: b.totalAmount,
        workerWage: getWorkerWage(b),
        estimatedRevenue: getEstimatedRevenue(b),
        overtimeCharges: b.overtimeCharges || 0,
        paymentStatus: b.paymentStatus || 'pending',
        transactionId: getLatestPaymentProof(b)?.transactionId || '—',
        status: b.status.charAt(0).toUpperCase() + b.status.slice(1).replace('-', ' '),
        notes: b.notes || '—',
        createdAt: formatDateTime(b.createdAt),
      }));

      // Worker Revenue Analysis Sheet
      const workerStats = new Map<string, {
        name: string;
        bookingCount: number;
        totalRevenue: number;
        totalWage: number;
        totalCustomerAmount: number;
        completedBookings: number;
        avgRevenuePerBooking: number;
      }>();

      filtered.forEach(b => {
        const workerId = b.worker?._id || 'unassigned';
        const workerName = b.worker?.name || 'Unassigned';

        if (!workerStats.has(workerId)) {
          workerStats.set(workerId, {
            name: workerName,
            bookingCount: 0,
            totalRevenue: 0,
            totalWage: 0,
            totalCustomerAmount: 0,
            completedBookings: 0,
            avgRevenuePerBooking: 0,
          });
        }

        const stats = workerStats.get(workerId)!;
        stats.bookingCount++;
        stats.totalCustomerAmount += Number(b.totalAmount || 0);
        stats.totalWage += getWorkerWage(b);
        stats.totalRevenue += getEstimatedRevenue(b);
        if (b.status === 'completed') stats.completedBookings++;
      });

      // Calculate averages and sort by revenue
      const workerStatsArray = Array.from(workerStats.values()).map(stats => ({
        ...stats,
        avgRevenuePerBooking: stats.bookingCount > 0 ? stats.totalRevenue / stats.bookingCount : 0,
      })).sort((a, b) => b.totalRevenue - a.totalRevenue);

      workerRevenueWs.columns = [
        { header: 'Worker Name', key: 'name', width: 25 },
        { header: 'Total Bookings', key: 'bookingCount', width: 15 },
        { header: 'Completed', key: 'completedBookings', width: 15 },
        { header: 'Customer Billed (₹)', key: 'totalCustomerAmount', width: 20 },
        { header: 'Worker Wage (₹)', key: 'totalWage', width: 18 },
        { header: 'Revenue Generated (₹)', key: 'totalRevenue', width: 22 },
        { header: 'Avg Revenue/Booking (₹)', key: 'avgRevenuePerBooking', width: 24 },
      ];

      workerStatsArray.forEach(stats => workerRevenueWs.addRow({
        name: stats.name,
        bookingCount: stats.bookingCount,
        completedBookings: stats.completedBookings,
        totalCustomerAmount: stats.totalCustomerAmount.toFixed(2),
        totalWage: stats.totalWage.toFixed(2),
        totalRevenue: stats.totalRevenue.toFixed(2),
        avgRevenuePerBooking: stats.avgRevenuePerBooking.toFixed(2),
      }));

      // Style headers
      summaryWs.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      summaryWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0f766e' } };
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e293b' } };
      workerRevenueWs.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      workerRevenueWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563eb' } };

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const dateLabel = startDate && endDate ? `_${startDate}_to_${endDate}` : '';
      link.download = `revenue-report${dateLabel}_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!isSuperAdmin) return;

    try {
      setExporting(true);

      // Calculate statistics
      const totalCustomerAmount = filtered.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0);
      const totalWorkerWage = filtered.reduce((sum, booking) => sum + getWorkerWage(booking), 0);
      const totalRevenue = filtered.reduce((sum, booking) => sum + getEstimatedRevenue(booking), 0);
      const totalOvertime = filtered.reduce((sum, booking) => sum + Number(booking.overtimeCharges || 0), 0);

      // Worker statistics
      const workerStats = new Map<string, {
        name: string;
        bookingCount: number;
        totalRevenue: number;
        totalWage: number;
        completedBookings: number;
      }>();

      filtered.forEach(b => {
        const workerId = b.worker?._id || 'unassigned';
        const workerName = b.worker?.name || 'Unassigned';

        if (!workerStats.has(workerId)) {
          workerStats.set(workerId, {
            name: workerName,
            bookingCount: 0,
            totalRevenue: 0,
            totalWage: 0,
            completedBookings: 0,
          });
        }

        const stats = workerStats.get(workerId)!;
        stats.bookingCount++;
        stats.totalWage += getWorkerWage(b);
        stats.totalRevenue += getEstimatedRevenue(b);
        if (b.status === 'completed') stats.completedBookings++;
      });

      const workerStatsArray = Array.from(workerStats.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);

      const selectedLocationLabel = selectedLocation
        ? locations.find((location) => location._id === selectedLocation)?.apartmentName || selectedLocation
        : 'All Locations';
      const selectedWorkerLabel = selectedWorker
        ? allWorkers.find((w) => w._id === selectedWorker)?.name || 'Selected Worker'
        : 'All Workers';
      const dateRangeLabel = startDate || endDate
        ? `${startDate || 'Start'} to ${endDate || 'End'}`
        : 'All Dates';

      // Create PDF content
      const content = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Revenue Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            h1 { color: #0f766e; border-bottom: 3px solid #0f766e; padding-bottom: 10px; }
            h2 { color: #1e293b; margin-top: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
            .report-info { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .report-info p { margin: 5px 0; }
            .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
            .summary-card { background: #fff; border: 2px solid #e2e8f0; border-radius: 8px; padding: 15px; }
            .summary-card h3 { margin: 0 0 10px 0; color: #64748b; font-size: 14px; }
            .summary-card .value { font-size: 24px; font-weight: bold; color: #0f766e; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background: #1e293b; color: white; padding: 12px; text-align: left; font-weight: 600; }
            td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
            tr:hover { background: #f8fafc; }
            .footer { margin-top: 40px; text-align: center; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>📊 Revenue Report</h1>

          <div class="report-info">
            <p><strong>Location:</strong> ${selectedLocationLabel}</p>
            <p><strong>Worker:</strong> ${selectedWorkerLabel}</p>
            <p><strong>Date Range:</strong> ${dateRangeLabel}</p>
            <p><strong>Status Filter:</strong> ${filter === 'all' ? 'All Statuses' : filter}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString('en-IN')}</p>
          </div>

          <h2>Overall Summary</h2>
          <div class="summary-grid">
            <div class="summary-card">
              <h3>Total Bookings</h3>
              <div class="value">${filtered.length}</div>
            </div>
            <div class="summary-card">
              <h3>Customer Billed Amount</h3>
              <div class="value">₹${totalCustomerAmount.toFixed(2)}</div>
            </div>
            <div class="summary-card">
              <h3>Worker Wages Paid</h3>
              <div class="value">₹${totalWorkerWage.toFixed(2)}</div>
            </div>
            <div class="summary-card">
              <h3>Net Revenue</h3>
              <div class="value">₹${totalRevenue.toFixed(2)}</div>
            </div>
          </div>

          ${workerStatsArray.length > 0 ? `
            <h2>Worker Performance Analysis</h2>
            <table>
              <thead>
                <tr>
                  <th>Worker Name</th>
                  <th>Bookings</th>
                  <th>Completed</th>
                  <th>Wages (₹)</th>
                  <th>Revenue Generated (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${workerStatsArray.map(w => `
                  <tr>
                    <td>${w.name}</td>
                    <td>${w.bookingCount}</td>
                    <td>${w.completedBookings}</td>
                    <td>₹${w.totalWage.toFixed(2)}</td>
                    <td>₹${w.totalRevenue.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          <div class="footer">
            <p>This is an automated revenue report generated by the system.</p>
          </div>
        </body>
        </html>
      `;

      // Create temporary element for PDF generation
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);

      const opt = {
        margin: 10,
        filename: `revenue-report_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // @ts-expect-error - html2pdf types are incomplete for the chained builder API
      await html2pdf().set(opt).from(tempDiv).save();

      document.body.removeChild(tempDiv);
    } catch (err) {
      console.error('PDF Export error:', err);
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
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">
              {isSuperAdmin
                ? selectedLocation
                  ? `${locations.find(l => l._id === selectedLocation)?.apartmentName || 'Location'} Bookings`
                  : 'All Bookings'
                : 'My Region Bookings'}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {bookings.length} total bookings • {filtered.length} filtered
            </p>
          </div>
          {isSuperAdmin && (
            <div className="flex gap-2">
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="flex items-center gap-2 btn-outline text-sm py-2.5 px-4 disabled:opacity-60"
              >
                <Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'PDF Report'}
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2 btn-brand text-sm py-2.5 px-4 disabled:opacity-60"
              >
                <Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Excel Report'}
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* First Row: Search, Location, Status */}
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

          {/* Second Row: Worker Filter and Date Range (Super Admin Only) */}
          {isSuperAdmin && (
            <div className="flex flex-col sm:flex-row gap-3 bg-muted/30 p-3 rounded-lg">
              <div className="relative flex-1">
                <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <select
                  className="input-clean pl-10"
                  value={selectedWorker}
                  onChange={(e) => setSelectedWorker(e.target.value)}
                >
                  <option value="">All Workers</option>
                  {allWorkers.map((worker) => (
                    <option key={worker._id} value={worker._id}>
                      {worker.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 flex-1">
                <input
                  type="date"
                  className="input-clean flex-1"
                  placeholder="Start Date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <input
                  type="date"
                  className="input-clean flex-1"
                  placeholder="End Date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              {(selectedWorker || startDate || endDate) && (
                <button
                  onClick={() => {
                    setSelectedWorker("");
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="btn-outline text-sm px-3 whitespace-nowrap"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
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
                {paginatedBookings.map((b) => (
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
                        {['pending', 'confirmed', 'in-progress'].includes(b.status) && (
                          <button
                            onClick={() => openReassignModal(b)}
                            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-sky-100 text-sky-700 hover:bg-sky-200 transition-colors"
                          >
                            <Users className="w-3.5 h-3.5" />
                            {b.worker ? 'Reassign' : 'Assign'}
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
                            onClick={() => {
                              setSelectedProofBooking(b);
                            }}
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
                                  {[
                                    b.completionPhotos && b.completionPhotos.length > 0 && `📸×${b.completionPhotos.length}`,
                                    getPaymentProofs(b).length > 0 && `💳×${getPaymentProofs(b).length}`
                                  ].filter(Boolean).join(' ')}
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

        {!noRegionAssigned && filtered.length > 0 && (
          <ListPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={BOOKINGS_PER_PAGE}
            itemLabel="bookings"
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* Reassign Worker Modal */}
      {reassignBooking && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card rounded-2xl max-w-xl w-full my-8 shadow-2xl">
            <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="font-bold text-foreground text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-600" /> {reassignBooking.worker ? 'Reassign Worker' : 'Assign Worker'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {reassignBooking.service?.name || 'Booking'} · {formatDate(reassignBooking.bookingDate)} · {formatTime(reassignBooking.startTime)} - {formatTime(reassignBooking.endTime)}
                </p>
              </div>
              <button onClick={() => setReassignBooking(null)} className="p-2 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">
                <p><span className="font-semibold text-sky-800">Current worker:</span> {reassignBooking.worker?.name || 'Unassigned'}</p>
                <p className="text-muted-foreground mt-1">
                  {reassignBooking.subscription?.isSubscription
                    ? 'Workers are ranked by how many upcoming subscription visits they can cover before you approve the plan.'
                    : 'Only workers available for this booking time and location are shown.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Reason</label>
                <input
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  className="input-clean text-sm w-full"
                  placeholder="Why are you reassigning this booking?"
                  maxLength={300}
                />
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {availableWorkersLoading && (
                  <p className="text-sm text-muted-foreground text-center py-6">Loading available workers...</p>
                )}

                {!availableWorkersLoading && availableWorkers.map((worker) => (
                  <div key={worker._id} className="flex items-center justify-between p-3 bg-muted/40 border border-border rounded-xl">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{worker.name}</p>
                        {worker.recommended && (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">⭐ {worker.rating.toFixed(1)} · {worker.specialization?.join(', ') || 'General'}</p>
                      {worker.coverageSummary && (
                        <p className={`text-xs mt-1 ${worker.subscriptionCoverage?.isFullCoverage ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {worker.coverageSummary}
                        </p>
                      )}
                      {worker.conflictReasons && worker.conflictReasons.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          First issue: {new Date(worker.conflictReasons[0].date).toLocaleDateString('en-IN')} {worker.conflictReasons[0].startTime}-{worker.conflictReasons[0].endTime} — {worker.conflictReasons[0].reason}
                        </p>
                      )}
                      {worker.assignedApartments?.[0] && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {worker.assignedApartments[0].apartmentName}, {worker.assignedApartments[0].area}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleReassignWorker(worker._id)}
                      disabled={teamActionLoading}
                      className="px-3 py-2 text-xs font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60"
                    >
                      {teamActionLoading ? 'Saving…' : reassignBooking.subscription?.isSubscription ? 'Approve & Assign' : 'Assign'}
                    </button>
                  </div>
                ))}

                {!availableWorkersLoading && availableWorkers.length === 0 && (
                  <div className="border-2 border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
                    No eligible workers are available for this booking time.
                  </div>
                )}
              </div>

              <button
                onClick={() => setReassignBooking(null)}
                className="w-full py-3 border border-border rounded-xl text-foreground font-medium hover:bg-muted transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Viewer Modal */}
      {selectedProofBooking && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card rounded-2xl max-w-2xl w-full my-8 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90 border-b border-border p-4 flex items-start justify-between gap-3 rounded-t-2xl shrink-0">
              <div className="min-w-0 flex-1 pr-2">
                <h2 className="font-bold text-foreground text-lg">Worker Proof Documents</h2>
                <p className="text-sm text-muted-foreground break-words leading-relaxed mt-1">
                  {selectedProofBooking.service?.name} · {selectedProofBooking.worker?.name || 'Unknown worker'} · {formatDate(selectedProofBooking.bookingDate)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isSuperAdmin && (
                  <button
                    onClick={() => setShowPrintModal(true)}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    title="Open revenue bill"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedProofBooking(null)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 overscroll-contain">
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
                  <p className="font-semibold text-foreground">{formatCurrency(selectedProofBooking.totalAmount)}</p>
                </div>
                {isSuperAdmin && (
                  <>
                    <div>
                      <p className="text-muted-foreground text-xs">Worker Wage</p>
                      <p className="font-medium text-foreground">{formatCurrency(getWorkerWage(selectedProofBooking))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Estimated Revenue</p>
                      <p className="font-medium text-emerald-700">{formatCurrency(getEstimatedRevenue(selectedProofBooking))}</p>
                    </div>
                  </>
                )}
                <div>
                  <p className="text-muted-foreground text-xs">Payment</p>
                  <p className="font-medium text-foreground">{selectedProofBooking.paymentStatus || 'pending'}</p>
                </div>
                {selectedProofBooking.subscription?.isSubscription && (
                  <div>
                    <p className="text-muted-foreground text-xs">Subscription Approval</p>
                    <p className="font-medium text-foreground">{selectedProofBooking.subscription.activationStatus || '—'}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs">Timing</p>
                  <p className="font-medium text-foreground">{formatMinutes(selectedProofBooking.scheduledDurationMinutes)}</p>
                </div>
              </div>

              {isSuperAdmin && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-emerald-800 font-semibold">Finance Snapshot</p>
                    <p className="text-muted-foreground mt-1">Customer billed: {formatCurrency(selectedProofBooking.totalAmount)}</p>
                    <p className="text-muted-foreground">Worker wage: {formatCurrency(getWorkerWage(selectedProofBooking))}</p>
                    <p className="text-muted-foreground">Estimated revenue: {formatCurrency(getEstimatedRevenue(selectedProofBooking))}</p>
                  </div>
                  <div>
                    <p className="text-emerald-800 font-semibold">Team Snapshot</p>
                    <p className="text-muted-foreground mt-1">Team head: {selectedProofBooking.worker?.name || '—'}</p>
                    <p className="text-muted-foreground">Support staff: {getSupportStaffNames(selectedProofBooking) || '—'}</p>
                    <p className="text-muted-foreground">Worker count: {selectedProofBooking.workforce?.workerCount || (selectedProofBooking.worker ? 1 : 0)}</p>
                  </div>
                </div>
              )}

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
                {getPaymentProofs(selectedProofBooking).length > 0 ? (
                  <div className="space-y-3">
                    {getPaymentProofs(selectedProofBooking).length > 1 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Customer uploaded {getPaymentProofs(selectedProofBooking).length} proofs. The latest one is used for confirmation; earlier uploads stay visible for reference.
                      </div>
                    )}
                    <div className="grid gap-3 md:grid-cols-2">
                      {getPaymentProofs(selectedProofBooking).map((proof, index) => {
                        const isLatestProof = index === getPaymentProofs(selectedProofBooking).length - 1;

                        return (
                          <div key={`${proof.url}-${proof.timestamp}-${index}`} className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                            <div className="rounded-xl overflow-hidden border-2 border-amber-200 bg-black">
                              <img
                                src={bookingsAPI.getCompletionPhotoUrl(proof.url)}
                                alt={`Payment proof ${index + 1}`}
                                className="w-full max-h-72 object-contain mx-auto"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-medium text-amber-800">Proof {index + 1}</span>
                              {isLatestProof && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">Latest</span>
                              )}
                            </div>
                            <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-2 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-amber-700 font-medium">Review status:</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  proof.reviewStatus === 'approved'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : proof.reviewStatus === 'rejected'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {proof.reviewStatus || (proof.verified ? 'approved' : 'pending')}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-amber-700 font-medium">Uploaded at:</span>
                                <span className="text-foreground">{formatDateTime(proof.timestamp)}</span>
                              </div>
                              {proof.reviewNotes && (
                                <div className="border-t border-amber-200 pt-2">
                                  <span className="text-amber-700 font-medium">Review note:</span>
                                  <p className="text-foreground mt-1 whitespace-pre-wrap">{proof.reviewNotes}</p>
                                </div>
                              )}
                              {proof.reviewedAt && (
                                <div className="flex items-center justify-between border-t border-amber-200 pt-2">
                                  <span className="text-amber-700 font-medium">Reviewed at:</span>
                                  <span className="text-foreground">{formatDateTime(proof.reviewedAt)}</span>
                                </div>
                              )}
                              {proof.transactionId && (
                                <div className="flex items-center justify-between border-t border-amber-200 pt-2">
                                  <span className="text-amber-700 font-medium">Transaction ID:</span>
                                  <span className="font-mono font-semibold text-foreground bg-white px-2 py-0.5 rounded border border-amber-200">
                                    {proof.transactionId}
                                  </span>
                                </div>
                              )}
                              {proof.transactionTime && (
                                <div className="flex items-center justify-between border-t border-amber-200 pt-2">
                                  <span className="text-amber-700 font-medium">Transaction Time:</span>
                                  <span className="text-foreground">{formatDateTime(proof.transactionTime)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : isPrepaidSubscription(selectedProofBooking) ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    This subscription visit is already prepaid. No payment proof is required for admin approval.
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
                  {!isPrepaidSubscription(selectedProofBooking) && !getLatestPaymentProof(selectedProofBooking)?.url && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-center">
                      <p className="text-red-700 font-semibold mb-1">⚠️ Payment Proof Required</p>
                      <p className="text-sm text-red-600">Payment proof must be uploaded before approval</p>
                    </div>
                  )}
                  <button
                    onClick={() => handleApproveBooking(selectedProofBooking._id)}
                    disabled={approvingBookingId === selectedProofBooking._id || (!isPrepaidSubscription(selectedProofBooking) && !getLatestPaymentProof(selectedProofBooking)?.url)}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                    title={!isPrepaidSubscription(selectedProofBooking) && !getLatestPaymentProof(selectedProofBooking)?.url ? 'Payment proof must be uploaded first' : 'Approve and mark as completed'}
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
                    {workersLoading && (
                      <p className="text-sm text-muted-foreground text-center py-4">Loading workers...</p>
                    )}
                    {!workersLoading && workerListError && (
                      <p className="text-sm text-red-600 text-center py-4">{workerListError}</p>
                    )}
                    {!workersLoading && !workerListError &&
                      allWorkers
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
                    {!workersLoading && !workerListError && allWorkers.filter(w => {
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
                    <span className="text-muted-foreground">Scheduled (mins):</span>
                    <span className="font-medium">{workforceBooking.scheduledDurationMinutes ?? '—'}</span>
                    <span className="text-muted-foreground font-semibold">Total Wage:</span>
                    <span className="font-bold text-emerald-700 text-base">₹{workforceBooking.workforce.totalWorkerWage}</span>
                  </div>
                </div>
              )}

              {/* Edit fields */}
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Wage and actual duration are locked after booking. Start/end scans and break approvals control actual duration. For deep cleaning, admin and super admin can still extend the scheduled time if the work is bigger than expected.
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
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Scheduled Duration (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={workforceForm.scheduledDurationMinutes}
                    onChange={e => setWorkforceForm(f => ({ ...f, scheduledDurationMinutes: Math.max(1, parseInt(e.target.value) || 180) }))}
                    disabled={workforceBooking.bookingType !== 'deep-cleaning-cart'}
                    className="input-clean text-sm w-full disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {workforceBooking.bookingType === 'deep-cleaning-cart'
                      ? 'Editable only for deep-cleaning bookings. The assigned team stays blocked for the full scheduled time window.'
                      : 'Duration changes are available only for deep-cleaning bookings.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleUpdateWorkforce}
                  disabled={workforceLoading}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-60"
                >
                  {workforceLoading ? 'Saving…' : 'Save workforce details'}
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

