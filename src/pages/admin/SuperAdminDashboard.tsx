import AppLayout from "@/components/AppLayout";
import { useAdminRole } from "@/hooks/useAdminRole";
import { superAdminAPI } from "@/lib/api";
import ExcelJS from "exceljs";
import {
  Archive,
  ArchiveRestore,
  BarChart2,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  IndianRupee,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Settings,
  Star,
  Trash2,
  TrendingUp,
  User,
  Users
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface LocationStats {
  workerCount: number;
  onlineWorkers: number;
  activeBookings: number;
  completedBookings: number;
  revenue: number;
}

interface LocationOverview {
  _id: string;
  apartmentName: string;
  area: string;
  city: string;
  isServiceAvailable: boolean;
  assignedAdmin: { name: string; email: string } | null;
  stats: LocationStats;
}

interface Worker {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  isActive?: boolean;
  isArchived?: boolean;
  workerProfile?: {
    specialization?: string[];
    rating?: number;
    completedJobs?: number;
    totalEarnings?: number;
    availability?: boolean;
    assignedApartments?: { apartmentName: string; area: string }[];
  };
}

interface Booking {
  _id: string;
  customer: { name: string } | null;
  worker: { name: string } | null;
  service: { name: string } | null;
  bookingType?: string;
  startTime: string;
  endTime: string;
  status: string;
  totalAmount: number;
  bookingDate?: string;
  createdAt: string;
}

interface GlobalStats {
  todayBookings: number;
  bookingsChange: string;
  activeWorkers: number;
  workersOnlineInfo: string;
  todayRevenue: number;
  revenueChange: string;
  fulfillmentRate: number;
  fulfillmentChange: string;
}

// ─── Business Hours Types ─────────────────────────────────────────────────────

interface BreakPeriod {
  start: string;
  end: string;
  label?: string;
}

interface DaySchedule {
  day: string;
  isActive: boolean;
  openTime: string;
  closeTime: string;
  breaks: BreakPeriod[];
}

interface BusinessHoursConfig {
  schedule: DaySchedule[];
  holidays: Array<{ date: string; label: string }>;
  timezone: string;
  slotDurationMinutes: number;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const statusBadge: Record<string, string> = {
  "in-progress": "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800",
  ongoing: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800",
  confirmed: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800",
  pending: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700",
  completed: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800",
  cancelled: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-800",
};

// ─── Component ────────────────────────────────────────────────────────────────

const SuperAdminDashboard = () => {
  const { t } = useTranslation();
  const { name } = useAdminRole();
  const [overview, setOverview] = useState<LocationOverview[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    todayBookings: 0,
    bookingsChange: "+0%",
    activeWorkers: 0,
    workersOnlineInfo: "0 online",
    todayRevenue: 0,
    revenueChange: "+0%",
    fulfillmentRate: 0,
    fulfillmentChange: "+0%",
  });

  const [selectedLocationId, setSelectedLocationId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"overview" | "workers" | "bookings">("overview");

  const [locationStats, setLocationStats] = useState<GlobalStats | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Business Hours state
  const [businessHours, setBusinessHours] = useState<BusinessHoursConfig | null>(null);
  const [bhLoading, setBhLoading] = useState(false);
  const [bhSaving, setBhSaving] = useState(false);
  const [bhDraft, setBhDraft] = useState<BusinessHoursConfig | null>(null);
  // Holiday form state
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayLabel, setNewHolidayLabel] = useState('');
  // Break add form: tracks which day idx has the form open
  const [addBreakIdx, setAddBreakIdx] = useState<number | null>(null);
  const [newBreak, setNewBreak] = useState({ start: '13:00', end: '14:00', label: 'Break' });

  // ── Initial load ──────────────────────────────────────────────────────────

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const [overviewRes, statsRes] = await Promise.all([
        superAdminAPI.getOverview(),
        superAdminAPI.getStats(),
      ]);
      setOverview(overviewRes.locations || []);
      if (statsRes.stats) setGlobalStats(statsRes.stats);
    } catch (err) {
      console.error("❌ SuperAdmin: Error fetching overview:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // ── Business Hours fetch ─────────────────────────────────────────────────

  useEffect(() => {
    setBhLoading(true);
    superAdminAPI.getBusinessHours()
      .then((res: { businessHours: BusinessHoursConfig }) => {
        if (res.businessHours) {
          setBusinessHours(res.businessHours);
          setBhDraft(JSON.parse(JSON.stringify(res.businessHours)));
        }
      })
      .catch(console.error)
      .finally(() => setBhLoading(false));
  }, []);

  // ── Location-filtered load ─────────────────────────────────────────────────

  const fetchLocationData = useCallback(async (locationId: string) => {
    try {
      setTabLoading(true);
      const [workersRes, bookingsRes, statsRes] = await Promise.all([
        superAdminAPI.getWorkers(locationId),
        superAdminAPI.getBookings({ locationId, limit: 30 }),
        superAdminAPI.getStats(locationId),
      ]);
      setWorkers(workersRes.workers || []);
      setBookings(bookingsRes.bookings || []);
      if (statsRes.stats) setLocationStats(statsRes.stats);
    } catch (err) {
      console.error("Error fetching location data:", err);
    } finally {
      setTabLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLocationId !== "all") {
      fetchLocationData(selectedLocationId);
    } else {
      setLocationStats(null);
      setWorkers([]);
      setBookings([]);
    }
  }, [selectedLocationId, fetchLocationData]);

  const handleArchiveWorker = async (workerId: string) => {
    if (!confirm("Archive this worker? They will be deactivated but their history is preserved.")) return;
    try {
      await superAdminAPI.archiveWorker(workerId);
      fetchLocationData(selectedLocationId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to archive worker");
    }
  };

  const handleUnarchiveWorker = async (workerId: string) => {
    if (!confirm("Restore this worker? They will be reactivated.")) return;
    try {
      await superAdminAPI.unarchiveWorker(workerId);
      fetchLocationData(selectedLocationId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to restore worker");
    }
  };

  const handleUpdateWorkerAvailability = async (workerId: string, availability: boolean) => {
    try {
      await superAdminAPI.updateWorkerAvailability(workerId, availability);
      fetchLocationData(selectedLocationId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update worker availability');
    }
  };

  // Business Hours helpers
  const updateDayField = (idx: number, field: keyof DaySchedule, value: unknown) => {
    if (!bhDraft) return;
    const next = { ...bhDraft, schedule: bhDraft.schedule.map((d, i) => i === idx ? { ...d, [field]: value } : d) };
    setBhDraft(next);
  };

  const saveBh = async () => {
    if (!bhDraft) return;
    setBhSaving(true);
    try {
      const res = await superAdminAPI.updateBusinessHours(bhDraft) as { businessHours: BusinessHoursConfig };
      if (res.businessHours) {
        setBusinessHours(res.businessHours);
        setBhDraft(JSON.parse(JSON.stringify(res.businessHours)));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save business hours');
    } finally {
      setBhSaving(false);
    }
  };

  // Break helpers
  const removeBreak = (dayIdx: number, breakIdx: number) => {
    if (!bhDraft) return;
    const schedule = bhDraft.schedule.map((d, i) => {
      if (i !== dayIdx) return d;
      return { ...d, breaks: d.breaks.filter((_, bi) => bi !== breakIdx) };
    });
    setBhDraft({ ...bhDraft, schedule });
  };

  const commitAddBreak = (dayIdx: number) => {
    if (!bhDraft) return;
    if (!newBreak.start || !newBreak.end) return;
    if (newBreak.start >= newBreak.end) {
      alert(t('bh.breakEndBeforeStart'));
      return;
    }
    const schedule = bhDraft.schedule.map((d, i) => {
      if (i !== dayIdx) return d;
      return { ...d, breaks: [...d.breaks, { ...newBreak }] };
    });
    setBhDraft({ ...bhDraft, schedule });
    setAddBreakIdx(null);
    setNewBreak({ start: '13:00', end: '14:00', label: 'Break' });
  };

  // Holiday helpers
  const addHoliday = () => {
    if (!bhDraft || !newHolidayDate) return;
    const already = bhDraft.holidays?.some(h => h.date === newHolidayDate);
    if (already) { alert(t('bh.alreadyHoliday')); return; }
    setBhDraft({
      ...bhDraft,
      holidays: [...(bhDraft.holidays ?? []), { date: newHolidayDate, label: newHolidayLabel || 'Holiday' }]
        .sort((a, b) => a.date.localeCompare(b.date))
    });
    setNewHolidayDate('');
    setNewHolidayLabel('');
  };

  const removeHoliday = (date: string) => {
    if (!bhDraft) return;
    setBhDraft({ ...bhDraft, holidays: (bhDraft.holidays ?? []).filter(h => h.date !== date) });
  };

  // Export bookings for selected location
  const handleExportBookings = async () => {
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
        { header: 'Amount (₹)', key: 'amount', width: 14 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created At', key: 'createdAt', width: 22 },
      ];
      bookings.forEach(b => ws.addRow({
        id: b._id.slice(-8).toUpperCase(),
        customer: b.customer?.name || 'Unknown',
        worker: b.worker?.name || '—',
        service: b.service?.name || (b.bookingType === 'deep-cleaning-cart' ? 'Deep Cleaning' : 'Unknown'),
        date: b.bookingDate ? new Date(b.bookingDate).toLocaleDateString('en-IN') : '—',
        startTime: b.startTime,
        endTime: b.endTime,
        amount: b.totalAmount,
        status: b.status.charAt(0).toUpperCase() + b.status.slice(1),
        createdAt: new Date(b.createdAt).toLocaleString('en-IN'),
      }));
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e293b' } };
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const locName = selectedLocation?.apartmentName?.replace(/\s+/g, '-') ?? 'location';
      link.download = `bookings-${locName}-${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedLocation = overview.find((l) => l._id === selectedLocationId);
  const displayStats = selectedLocationId !== "all" && locationStats ? locationStats : globalStats;

  const formatDate = () =>
    new Date().toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const formatDisplayTime = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return value;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout userType="super_admin" userName={name}>
        <div className="max-w-6xl mx-auto flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Loading platform data…</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppLayout userType="super_admin" userName={name}>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 space-y-6 md:space-y-6 animate-fade-in pb-20 md:pb-0">

        {/* ── Header bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Super Admin Portal</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{formatDate()} · Platform-wide operations</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOverview}
              title="Refresh"
              className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <select
                value={selectedLocationId}
                onChange={(e) => {
                  setSelectedLocationId(e.target.value);
                  setActiveTab("overview");
                }}
                className="pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary w-full sm:min-w-[220px]"
              >
                <option value="all">All Locations</option>
                {overview.map((loc) => (
                  <option key={loc._id} value={loc._id}>
                    {loc.apartmentName} — {loc.area}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ══════════════════ ALL LOCATIONS VIEW ══════════════════ */}
        {selectedLocationId === "all" ? (
          <>
            {/* Platform KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Today's Bookings", value: displayStats.todayBookings, sub: displayStats.bookingsChange, icon: Calendar, color: "text-primary", bg: "bg-primary-light" },
                { label: "Active Workers", value: displayStats.activeWorkers, sub: displayStats.workersOnlineInfo, icon: Users, color: "text-success", bg: "bg-success-light" },
                { label: "Revenue Today", value: `₹${displayStats.todayRevenue.toLocaleString()}`, sub: displayStats.revenueChange, icon: IndianRupee, color: "text-warning", bg: "bg-warning-light" },
                { label: "Fulfillment", value: `${displayStats.fulfillmentRate}%`, sub: displayStats.fulfillmentChange, icon: CheckCircle, color: "text-primary", bg: "bg-primary-light" },
              ].map((card) => (
                <div key={card.label} className="card-elevated p-5">
                  <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center mb-3`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
                  <p className="text-2xl font-bold font-heading text-foreground">{card.value}</p>
                  <p className="text-xs font-medium mt-1 text-muted-foreground">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Platform summary numbers */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
              <div className="card-elevated p-3 sm:p-4 text-center">
                <p className="text-2xl sm:text-3xl font-bold font-heading text-foreground">{overview.length}</p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1"><Building2 className="w-3.5 h-3.5" /> Locations</p>
              </div>
              <div className="card-elevated p-3 sm:p-4 text-center">
                <p className="text-2xl sm:text-3xl font-bold font-heading text-foreground">
                  {overview.reduce((s, l) => s + (l.stats?.workerCount || 0), 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1"><Users className="w-3.5 h-3.5" /> Total Workers</p>
              </div>
              <div className="card-elevated p-3 sm:p-4 text-center col-span-2 sm:col-span-1">
                <p className="text-2xl sm:text-3xl font-bold font-heading text-foreground">
                  ₹{overview.reduce((s, l) => s + (l.stats?.revenue || 0), 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Total Revenue</p>
              </div>
            </div>

            {/* Quick nav */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { to: "/admin/locations", icon: MapPin, label: "Manage Locations", value: `${overview.length} locations` },
                { to: "/admin/workers", icon: Users, label: "All Workers", value: `${overview.reduce((s, l) => s + (l.stats?.workerCount || 0), 0)} workers` },
                { to: "/admin/bookings", icon: Calendar, label: "All Bookings", value: "View & manage" },
                { to: "/admin/settings", icon: Settings, label: "Settings", value: "Configure app" },
              ].map((item) => (
                <Link key={item.to} to={item.to} className="card-elevated-hover p-4 group">
                  <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center mb-3 group-hover:bg-primary transition-colors">
                    <item.icon className="w-4 h-4 text-accent-foreground group-hover:text-primary-foreground transition-colors" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.value}</p>
                </Link>
              ))}
            </div>

            {/* ── Business Hours Settings ── */}
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-primary-light rounded-xl flex items-center justify-center">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold font-heading text-foreground">{t('bh.title')}</h2>
                    <p className="text-xs text-muted-foreground">{t('bh.subtitle')}</p>
                  </div>
                </div>
                {bhDraft && (
                  <button
                    onClick={saveBh}
                    disabled={bhSaving}
                    className="btn-brand text-sm py-2 px-4 disabled:opacity-60"
                  >
                    {bhSaving ? t('bh.saving') : t('bh.saveChanges')}
                  </button>
                )}
              </div>

              {bhLoading || !bhDraft ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Slot duration + timezone row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                        {t('bh.slotDuration')}
                      </label>
                      <select
                        value={bhDraft.slotDurationMinutes}
                        onChange={e => setBhDraft({ ...bhDraft, slotDurationMinutes: parseInt(e.target.value) })}
                        className="input-clean w-full"
                      >
                        {[15, 30, 45, 60, 90, 120].map(m => (
                          <option key={m} value={m}>{m} min</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                        {t('bh.timezone')}
                      </label>
                      <input
                        value={bhDraft.timezone}
                        onChange={e => setBhDraft({ ...bhDraft, timezone: e.target.value })}
                        className="input-clean w-full"
                        placeholder="Asia/Kolkata"
                      />
                    </div>
                  </div>

                  {/* Day schedule table with inline break editor */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t('bh.weeklySchedule')}</h3>
                    <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
                      <div className="min-w-[600px] rounded-xl border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b border-border">
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20">{t('bh.colDay')}</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16">{t('bh.colActive')}</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-32">{t('bh.colOpens')}</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-32">{t('bh.colCloses')}</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('bh.colBreaks')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bhDraft.schedule.map((day, idx) => (
                            <tr key={day.day} className="border-b border-border last:border-0 align-top">
                              <td className="px-4 py-3">
                                <span className="font-medium text-foreground capitalize">{day.day.slice(0, 3)}</span>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => updateDayField(idx, 'isActive', !day.isActive)}
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${day.isActive ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                                >
                                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${day.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="time"
                                  value={day.openTime}
                                  disabled={!day.isActive}
                                  onChange={e => updateDayField(idx, 'openTime', e.target.value)}
                                  className="input-clean py-1.5 w-28 disabled:opacity-40"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="time"
                                  value={day.closeTime}
                                  disabled={!day.isActive}
                                  onChange={e => updateDayField(idx, 'closeTime', e.target.value)}
                                  className="input-clean py-1.5 w-28 disabled:opacity-40"
                                />
                              </td>
                              <td className="px-4 py-3 min-w-[200px]">
                                <div className="flex flex-col gap-1.5">
                                  {day.breaks.map((br, bi) => (
                                    <div key={bi} className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-700 text-xs rounded-lg px-3 py-1.5 whitespace-nowrap w-fit max-w-full">
                                      <span className="font-medium shrink-0">{formatDisplayTime(br.start)}–{formatDisplayTime(br.end)}</span>
                                      {br.label && <span className="text-orange-500 shrink-0">·</span>}
                                      {br.label && <span className="truncate">{br.label}</span>}
                                      <button
                                        onClick={() => removeBreak(idx, bi)}
                                        className="ml-auto shrink-0 hover:text-red-600 transition-colors"
                                        title="Remove break"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}

                                  {/* Inline add-break form */}
                                  {addBreakIdx === idx ? (
                                    <div className="flex flex-col gap-1.5 mt-1">
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="time"
                                          value={newBreak.start}
                                          onChange={e => setNewBreak({ ...newBreak, start: e.target.value })}
                                          className="input-clean py-1 text-xs w-[100px]"
                                        />
                                        <span className="text-muted-foreground text-xs shrink-0">to</span>
                                        <input
                                          type="time"
                                          value={newBreak.end}
                                          onChange={e => setNewBreak({ ...newBreak, end: e.target.value })}
                                          className="input-clean py-1 text-xs w-[100px]"
                                        />
                                      </div>
                                      <input
                                        type="text"
                                        placeholder="Label (e.g. Lunch)"
                                        value={newBreak.label}
                                        onChange={e => setNewBreak({ ...newBreak, label: e.target.value })}
                                        className="input-clean py-1 text-xs w-full max-w-[220px]"
                                      />
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => commitAddBreak(idx)}
                                          className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-lg hover:opacity-90"
                                        >
                                          {t('common.save')}
                                        </button>
                                        <button
                                          onClick={() => setAddBreakIdx(null)}
                                          className="text-xs text-muted-foreground hover:text-foreground px-1"
                                        >
                                          {t('common.cancel')}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    day.isActive && (
                                      <button
                                        onClick={() => { setAddBreakIdx(idx); setNewBreak({ start: '13:00', end: '14:00', label: 'Break' }); }}
                                        className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary border border-dashed border-muted-foreground/40 hover:border-primary rounded-full px-2 py-0.5 transition-colors"
                                      >
                                        <Plus className="w-3 h-3" /> {t('bh.addBreak')}
                                      </button>
                                    )
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  </div>

                  {/* ── Holiday Declarations ── */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t('bh.holidayDeclarations')}</h3>

                    {/* Add holiday form */}
                    <div className="flex flex-wrap items-end gap-2 mb-4">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">{t('bh.holidayDate')}</label>
                        <input
                          type="date"
                          value={newHolidayDate}
                          onChange={e => setNewHolidayDate(e.target.value)}
                          className="input-clean py-1.5 text-sm"
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">{t('bh.holidayLabel')}</label>
                        <input
                          type="text"
                          placeholder={t('bh.holidayLabelPlaceholder')}
                          value={newHolidayLabel}
                          onChange={e => setNewHolidayLabel(e.target.value)}
                          className="input-clean py-1.5 text-sm w-48"
                          onKeyDown={e => { if (e.key === 'Enter') addHoliday(); }}
                        />
                      </div>
                      <button
                        onClick={addHoliday}
                        disabled={!newHolidayDate}
                        className="btn-brand text-sm py-1.5 px-4 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" /> {t('bh.addHoliday')}
                      </button>
                    </div>

                    {/* Holiday list */}
                    {(bhDraft.holidays ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground/60 italic">{t('bh.noHolidays')}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {(bhDraft.holidays ?? []).map(h => {
                          const isPast = h.date < new Date().toISOString().split('T')[0];
                          return (
                            <div
                              key={h.date}
                              className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${isPast ? 'opacity-50 bg-muted/30 border-border' : 'bg-red-50 border-red-200'}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${isPast ? 'bg-muted-foreground' : 'bg-red-400'}`} />
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{h.label}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => removeHoliday(h.date)}
                                className="text-muted-foreground hover:text-red-600 transition-colors p-1 rounded-lg hover:bg-red-50"
                                title="Remove holiday"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {t('bh.slotsNote')}
                  </p>
                </div>
              )}
            </div>

            {/* Location cards grid */}
            <div>
              <h2 className="text-base font-bold font-heading text-foreground mb-4">Locations Overview</h2>
              {overview.length === 0 ? (
                <div className="card-elevated p-12 text-center">
                  <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                  <p className="text-muted-foreground">No locations yet. <Link to="/admin/locations" className="text-primary underline">Add one</Link>.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {overview.map((loc) => (
                    <div key={loc._id} className="card-elevated p-5 flex flex-col gap-4">
                      {/* Location header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-foreground">{loc.apartmentName}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{loc.area}, {loc.city}
                          </p>
                        </div>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${loc.isServiceAvailable ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                          {loc.isServiceAvailable ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {/* Assigned admin */}
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-7 h-7 bg-accent rounded-full flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        {loc.assignedAdmin ? (
                          <div>
                            <p className="font-medium text-foreground text-xs">{loc.assignedAdmin.name}</p>
                            <p className="text-xs text-muted-foreground">{loc.assignedAdmin.email}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">No admin assigned</p>
                        )}
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-muted/50 rounded-xl p-3">
                        <div className="text-center">
                          <p className="text-lg font-bold font-heading text-foreground">{loc.stats?.workerCount ?? 0}</p>
                          <p className="text-xs text-muted-foreground">Workers</p>
                        </div>
                        <div className="text-center border-x border-border">
                          <p className="text-lg font-bold font-heading text-primary">{loc.stats?.activeBookings ?? 0}</p>
                          <p className="text-xs text-muted-foreground">Active</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold font-heading text-success">₹{(loc.stats?.revenue ?? 0).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Revenue</p>
                        </div>
                      </div>

                      {/* View details button */}
                      <button
                        onClick={() => { setSelectedLocationId(loc._id); setActiveTab("overview"); }}
                        className="w-full text-sm text-primary font-medium flex items-center justify-center gap-1 hover:underline"
                      >
                        View Details <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* ══════════════════ SINGLE LOCATION VIEW ══════════════════ */
          <>
            {/* Location header card */}
            {selectedLocation && (
              <div className="card-elevated p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary-light rounded-2xl flex items-center justify-center shrink-0">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold font-heading text-foreground">{selectedLocation.apartmentName}</h2>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5" /> {selectedLocation.area}, {selectedLocation.city}
                      </p>
                      {selectedLocation.assignedAdmin && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Admin: <span className="font-medium text-foreground">{selectedLocation.assignedAdmin.name}</span>
                          {" "}· {selectedLocation.assignedAdmin.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${selectedLocation.isServiceAvailable ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                      {selectedLocation.isServiceAvailable ? "Service Active" : "Service Inactive"}
                    </span>
                    <Link to="/admin/locations" className="text-xs text-primary font-medium hover:underline">
                      Manage →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Location KPI cards */}
            {locationStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Today's Bookings", value: locationStats.todayBookings, sub: locationStats.bookingsChange, icon: Calendar, color: "text-primary", bg: "bg-primary-light" },
                  { label: "Active Workers", value: locationStats.activeWorkers, sub: locationStats.workersOnlineInfo, icon: Users, color: "text-success", bg: "bg-success-light" },
                  { label: "Revenue Today", value: `₹${locationStats.todayRevenue.toLocaleString()}`, sub: locationStats.revenueChange, icon: IndianRupee, color: "text-warning", bg: "bg-warning-light" },
                  { label: "Fulfillment", value: `${locationStats.fulfillmentRate}%`, sub: locationStats.fulfillmentChange, icon: CheckCircle, color: "text-primary", bg: "bg-primary-light" },
                ].map((card) => (
                  <div key={card.label} className="card-elevated p-4">
                    <div className={`w-9 h-9 ${card.bg} rounded-xl flex items-center justify-center mb-2`}>
                      <card.icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-xl font-bold font-heading text-foreground">{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="border-b border-border">
              <div className="flex gap-1">
                {(["overview", "workers", "bookings"] as const).map((tab) => {
                  const icon = tab === "overview" ? BarChart2 : tab === "workers" ? Users : BookOpen;
                  const Icon = icon;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                        activeTab === tab
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab === "overview" ? "Overview" : tab === "workers" ? `Workers (${workers.length})` : `Bookings (${bookings.length})`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab content */}
            {tabLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* ── Overview tab ── */}
                {activeTab === "overview" && selectedLocation && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="card-elevated p-4">
                        <p className="text-xs text-muted-foreground mb-1">Total Workers</p>
                        <p className="text-2xl font-bold font-heading text-foreground">{selectedLocation.stats?.workerCount ?? 0}</p>
                        <p className="text-xs text-muted-foreground mt-1">{selectedLocation.stats?.onlineWorkers ?? 0} currently available</p>
                      </div>
                      <div className="card-elevated p-4">
                        <p className="text-xs text-muted-foreground mb-1">Active Bookings</p>
                        <p className="text-2xl font-bold font-heading text-primary">{selectedLocation.stats?.activeBookings ?? 0}</p>
                        <p className="text-xs text-muted-foreground mt-1">In progress / confirmed</p>
                      </div>
                      <div className="card-elevated p-4">
                        <p className="text-xs text-muted-foreground mb-1">Completed Bookings</p>
                        <p className="text-2xl font-bold font-heading text-success">{selectedLocation.stats?.completedBookings ?? 0}</p>
                        <p className="text-xs text-muted-foreground mt-1">All time</p>
                      </div>
                      <div className="card-elevated p-4">
                        <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
                        <p className="text-2xl font-bold font-heading text-warning">₹{(selectedLocation.stats?.revenue ?? 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-1">Completed bookings</p>
                      </div>
                      <div className="card-elevated p-4">
                        <p className="text-xs text-muted-foreground mb-1">Assigned Admin</p>
                        <p className="text-lg font-bold font-heading text-foreground line-clamp-2 break-words">
                          {selectedLocation.assignedAdmin?.name || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1 break-words" title={selectedLocation.assignedAdmin?.email || "Not assigned"}>{selectedLocation.assignedAdmin?.email || "Not assigned"}</p>
                      </div>
                      <div className="card-elevated p-4">
                        <p className="text-xs text-muted-foreground mb-1">Service Status</p>
                        <p className={`text-lg font-bold font-heading ${selectedLocation.isServiceAvailable ? "text-success" : "text-muted-foreground"}`}>
                          {selectedLocation.isServiceAvailable ? "Active" : "Inactive"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedLocation.area}, {selectedLocation.city}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button onClick={() => setActiveTab("workers")} className="btn-brand flex items-center gap-2 text-sm py-2.5 px-5">
                        <Users className="w-4 h-4" /> View Workers
                      </button>
                      <button onClick={() => setActiveTab("bookings")} className="flex items-center gap-2 text-sm py-2.5 px-5 border border-border rounded-xl hover:bg-muted transition-colors font-medium">
                        <Calendar className="w-4 h-4" /> View Bookings
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Workers tab ── */}
                {activeTab === "workers" && (
                  <div>
                    {workers.length === 0 ? (
                      <div className="card-elevated p-12 text-center">
                        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                        <p className="text-muted-foreground">No workers assigned to this location.</p>
                      </div>
                    ) : (
                      <div className="card-elevated overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-border bg-muted/50">
                                {["Worker", "Contact", "Specialization", "Rating", "Jobs", "Status", "Action"].map((h) => (
                                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {workers.map((w) => (
                                <tr key={w._id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                        {w.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                      </div>
                                      <span className="text-sm font-medium text-foreground whitespace-nowrap">{w.name}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="text-xs text-muted-foreground">{w.email}</p>
                                    {w.phone && <p className="text-xs text-muted-foreground">{w.phone}</p>}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                      {(w.workerProfile?.specialization || []).slice(0, 2).map((s) => (
                                        <span key={s} className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-lg">{s}</span>
                                      ))}
                                      {(w.workerProfile?.specialization || []).length > 2 && (
                                        <span className="text-xs text-muted-foreground">+{(w.workerProfile?.specialization || []).length - 2}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-sm font-medium text-foreground flex items-center gap-1 whitespace-nowrap">
                                      <Star className="w-3.5 h-3.5 fill-warning text-warning" />
                                      {w.workerProfile?.rating?.toFixed(1) ?? "—"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-muted-foreground">{w.workerProfile?.completedJobs ?? 0}</td>
                                  <td className="px-4 py-3">
                                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${w.isArchived ? "bg-amber-100 text-amber-700" : w.workerProfile?.availability ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                                      {w.isArchived ? "Archived" : w.workerProfile?.availability ? "Available" : "Offline"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col items-start gap-2">
                                      {!w.isArchived && (
                                        <button
                                          onClick={() => handleUpdateWorkerAvailability(w._id, !w.workerProfile?.availability)}
                                          className={`text-xs hover:underline flex items-center gap-1 whitespace-nowrap ${w.workerProfile?.availability ? 'text-slate-700' : 'text-green-700'}`}
                                        >
                                          <CheckCircle className="w-3 h-3" /> {w.workerProfile?.availability ? 'Set Inactive' : 'Set Active'}
                                        </button>
                                      )}
                                      {w.isArchived ? (
                                        <button onClick={() => handleUnarchiveWorker(w._id)} className="text-xs text-green-700 hover:underline flex items-center gap-1 whitespace-nowrap">
                                          <ArchiveRestore className="w-3 h-3" /> Restore
                                        </button>
                                      ) : (
                                        <button onClick={() => handleArchiveWorker(w._id)} className="text-xs text-amber-700 hover:underline flex items-center gap-1 whitespace-nowrap">
                                          <Archive className="w-3 h-3" /> Archive
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Bookings tab ── */}
                {activeTab === "bookings" && (
                  <div>
                    {bookings.length === 0 ? (
                      <div className="card-elevated p-12 text-center">
                        <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                        <p className="text-muted-foreground">No bookings found for this location.</p>
                      </div>
                    ) : (
                      <div className="card-elevated overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-border bg-muted/50">
                                {["ID", "Customer", "Worker", "Service", "Date", "Time", "Amount", "Status"].map((h) => (
                                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {bookings.map((b, i) => (
                                <tr key={b._id} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">{b._id.slice(-8)}</td>
                                  <td className="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">{b.customer?.name ?? "Unknown"}</td>
                                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{b.worker?.name ?? "—"}</td>
                                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{b.service?.name ?? (b.bookingType === 'deep-cleaning-cart' ? '✨ Deep Cleaning' : 'Unknown')}</td>
                                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                    {b.bookingDate ? new Date(b.bookingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{b.startTime} – {b.endTime}</td>
                                  <td className="px-4 py-3 text-sm font-semibold text-foreground whitespace-nowrap">₹{b.totalAmount}</td>
                                  <td className="px-4 py-3">
                                    <span className={statusBadge[b.status] ?? statusBadge.pending}>
                                      {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="px-4 py-3 border-t border-border bg-muted/30 flex justify-between items-center">
                          <p className="text-xs text-muted-foreground">{bookings.length} bookings shown</p>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={handleExportBookings}
                              disabled={exporting}
                              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-60"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              {exporting ? 'Exporting…' : 'Export Excel'}
                            </button>
                            <Link to="/admin/bookings" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                              View all bookings <ChevronRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default SuperAdminDashboard;
