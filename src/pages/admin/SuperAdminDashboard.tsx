import AppLayout from "@/components/AppLayout";
import { adminAPI, authAPI } from "@/lib/api";
import {
    Archive,
    ArchiveRestore,
    BarChart2,
    BookOpen,
    Building2,
    Calendar,
    CheckCircle,
    ChevronRight,
    IndianRupee,
    Loader2,
    MapPin,
    RefreshCw,
    Settings,
    Star,
    TrendingUp,
    User,
    Users
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
  const [userName, setUserName] = useState("Super Admin");
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

  // ── Initial load ──────────────────────────────────────────────────────────

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const [overviewRes, statsRes] = await Promise.all([
        adminAPI.getLocationOverview(),
        adminAPI.getDashboardStats(),
      ]);
      setOverview(overviewRes.locations || []);
      if (statsRes.stats) setGlobalStats(statsRes.stats);
    } catch (err) {
      console.error("Error fetching super admin overview:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    authAPI.getProfile().then(res => {
      const name = res?.user?.name || res?.name;
      if (name) setUserName(name);
    }).catch(() => {});
    fetchOverview();
  }, [fetchOverview]);

  // ── Location-filtered load ─────────────────────────────────────────────────

  const fetchLocationData = useCallback(async (locationId: string) => {
    try {
      setTabLoading(true);
      const [workersRes, bookingsRes, statsRes] = await Promise.all([
        adminAPI.getWorkers(locationId),
        adminAPI.getRecentBookings(30, locationId),
        adminAPI.getDashboardStats(locationId),
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
      await adminAPI.archiveWorker(workerId);
      fetchLocationData(selectedLocationId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to archive worker");
    }
  };

  const handleUnarchiveWorker = async (workerId: string) => {
    if (!confirm("Restore this worker? They will be reactivated.")) return;
    try {
      await adminAPI.unarchiveWorker(workerId);
      fetchLocationData(selectedLocationId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to restore worker");
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

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout userType="super_admin" userName={userName}>
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
    <AppLayout userType="super_admin" userName={userName}>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">

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
                className="pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary min-w-[220px]"
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
            <div className="grid grid-cols-3 gap-4">
              <div className="card-elevated p-4 text-center">
                <p className="text-3xl font-bold font-heading text-foreground">{overview.length}</p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1"><Building2 className="w-3.5 h-3.5" /> Locations</p>
              </div>
              <div className="card-elevated p-4 text-center">
                <p className="text-3xl font-bold font-heading text-foreground">
                  {overview.reduce((s, l) => s + (l.stats?.workerCount || 0), 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1"><Users className="w-3.5 h-3.5" /> Total Workers</p>
              </div>
              <div className="card-elevated p-4 text-center">
                <p className="text-3xl font-bold font-heading text-foreground">
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
                      <div className="grid grid-cols-3 gap-2 bg-muted/50 rounded-xl p-3">
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
                        <p className="text-lg font-bold font-heading text-foreground truncate">
                          {selectedLocation.assignedAdmin?.name || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{selectedLocation.assignedAdmin?.email || "Not assigned"}</p>
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

                    <div className="flex gap-3">
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
                                    {w.isArchived ? (
                                      <button onClick={() => handleUnarchiveWorker(w._id)} className="text-xs text-green-700 hover:underline flex items-center gap-1 whitespace-nowrap">
                                        <ArchiveRestore className="w-3 h-3" /> Restore
                                      </button>
                                    ) : (
                                      <button onClick={() => handleArchiveWorker(w._id)} className="text-xs text-amber-700 hover:underline flex items-center gap-1 whitespace-nowrap">
                                        <Archive className="w-3 h-3" /> Archive
                                      </button>
                                    )}
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
                                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{b.service?.name ?? "Unknown"}</td>
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
                          <Link to="/admin/bookings" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                            View all bookings <ChevronRight className="w-3 h-3" />
                          </Link>
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
