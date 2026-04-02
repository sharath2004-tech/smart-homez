import { API_ORIGIN, api, authAPI, settingsAPI } from "@/lib/api";
import { AlertTriangle, BarChart3, Bell, Building, Calendar, ClipboardCheck, CreditCard, FileText, Grid3x3, HelpCircle, IndianRupee, KeyRound, LayoutDashboard, MapPin, MessageSquare, RefreshCw, Settings, Settings2, TrendingUp, User, UserCircle, Users, Wrench } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../animations.css";
import "../styles/sidebar-enhancements.css";
import { AppHeader } from "./AppHeader";
import { CollapsibleSidebar } from "./CollapsibleSidebar";
import { MobileSidebar } from "./MobileSidebar";
import { PersistentSidebar } from "./PersistentSidebar";
import { ProfilePanel } from "./ProfilePanel";

interface AppLayoutProps {
  children: React.ReactNode;
  userType?: "customer" | "worker" | "admin" | "super_admin";
  userName?: string;
  userImage?: string | null;
}

const AppLayout = ({ children, userType = "customer", userName, userImage }: AppLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}') as {
        name?: string;
        profileImage?: string;
        needsPasswordSetup?: boolean;
        isFirstLogin?: boolean;
        hasCustomPassword?: boolean;
      };
    } catch {
      return {};
    }
  })();

  // Resolve display name: prop > localStorage cached user > "User"
  const resolvedName = useMemo(() =>
    userName ?? (() => {
      return storedUser?.name;
    })() ?? "User"
  , [userName, storedUser]);

  const passwordMenuLabel = useMemo(() => {
    const needsSetup = storedUser.needsPasswordSetup ?? storedUser.isFirstLogin ?? storedUser.hasCustomPassword === false;
    return needsSetup ? 'Add Password' : 'Change Password';
  }, [storedUser]);

  useEffect(() => {
    api.get('/notifications')
      .then((res: { notifications: { isRead: boolean }[] }) => {
        setUnreadCount(res.notifications?.filter((n) => !n.isRead).length ?? 0);
      })
      .catch(() => {});
  }, [location.pathname]);

  // Business hours badge
  const [todayBH, setTodayBH] = useState<{
    isOpen: boolean;
    openFormatted?: string;
    closeFormatted?: string;
    day?: string;
  } | null>(null);

  useEffect(() => {
    settingsAPI.getBusinessHours()
      .then((res: { businessHours: { isOpen: boolean; openFormatted?: string; closeFormatted?: string; day?: string } }) => {
        if (res?.businessHours) setTodayBH(res.businessHours);
      })
      .catch(() => {});
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userLocation');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }, []);

  const handleProfileClick = useCallback(() => {
    setProfilePanelOpen(true);
    setProfileLoading(true);
    authAPI.getProfile()
      .then((res: { user?: Record<string, unknown> }) => {
        setProfileData(res?.user ?? null);
      })
      .catch(() => {
        setProfileData({});
      })
      .finally(() => setProfileLoading(false));
  }, []);

  const notificationsPath = useMemo(() =>
    userType === 'worker' ? '/worker/notifications'
    : userType === 'super_admin' ? '/super-admin/notifications'
    : userType === 'admin' ? '/admin/notifications'
    : '/customer/notifications'
  , [userType]);

  const customerNav = useMemo(() => [
    { to: "/customer/dashboard", icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: "/customer/services", icon: Wrench, label: t('nav.services') },
    { to: "/customer/bookings", icon: Calendar, label: t('nav.myBookings') },
    { to: "/customer/my-quotes", icon: FileText, label: "My Quotes" },
    { to: "/customer/subscriptions", icon: RefreshCw, label: t('nav.mySubscriptions') },
    { to: "/customer/payments", icon: CreditCard, label: t('nav.payments') },
    { to: "/customer/profile", icon: User, label: t('nav.profile') },
    { to: "/customer/help", icon: HelpCircle, label: "Help" },
    { to: "/change-password", icon: KeyRound, label: passwordMenuLabel },
  ], [t, passwordMenuLabel]);

  const workerNav = useMemo(() => [
    { to: "/worker/dashboard", icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: "/worker/tasks", icon: Calendar, label: t('nav.myTasks') },
    { to: "/worker/earnings", icon: IndianRupee, label: "Salary Management" },
    { to: "/worker/salary", icon: IndianRupee, label: "Salary History" },
    { to: "/worker/leaves", icon: Bell, label: t('nav.myLeaves') },
    { to: "/worker/profile", icon: User, label: t('nav.profile') },
    { to: "/worker/help", icon: HelpCircle, label: "Help" },
    { to: "/change-password", icon: KeyRound, label: passwordMenuLabel },
  ], [t, passwordMenuLabel]);

  const adminNav = useMemo(() => [
    { to: "/admin/dashboard",          icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: "/admin/bookings",           icon: Calendar,        label: t('nav.bookings') },
    { to: "/admin/customers",          icon: UserCircle,      label: t('nav.customers') },
    { to: "/admin/expenses",           icon: IndianRupee,     label: "Expenses" },
    { to: "/admin/subscription-sections", icon: Grid3x3,      label: "Subscriptions" },
    { to: "/admin/workers",            icon: User,            label: t('nav.workers') },
    { to: "/admin/worker-requests",    icon: ClipboardCheck,  label: "Worker Requests" },
    { to: "/admin/sos",                icon: AlertTriangle,   label: "SOS Alerts" },
    { to: "/admin/leaves",             icon: Bell,            label: t('nav.leaves') },
    { to: "/admin/worker-schedule",    icon: Calendar,        label: t('nav.workerSchedule') },
    { to: "/admin/workforce",          icon: Users,           label: t('nav.workforce') },
    { to: "/admin/salary-settlements", icon: IndianRupee,     label: "Salary Settlements" },
    { to: "/admin/quotes",             icon: FileText,        label: "Quote Requests" },
    { to: "/admin/help-messages",      icon: MessageSquare,   label: "Help Messages" },
    { to: "/admin/locations",          icon: MapPin,          label: t('nav.locations') },
    { to: "/admin/services",           icon: Wrench,          label: t('nav.services') },
    { to: "/admin/home-config",        icon: LayoutDashboard, label: "Home Screen Config" },
    { to: "/admin/dashboard-preferences", icon: Settings2,    label: "Dashboard Preferences" },
    { to: "/admin/settings",           icon: Settings,        label: t('nav.settings') },
    { to: "/change-password",          icon: KeyRound,        label: passwordMenuLabel },
  ], [t, passwordMenuLabel]);

  // Admin Navigation Sections for Collapsible Sidebar
  const adminNavSections = useMemo(() => [
    {
      id: 'overview',
      title: 'Overview & Analytics',
      icon: TrendingUp,
      defaultOpen: true,
      items: [
        { to: "/admin/dashboard", icon: LayoutDashboard, label: t('nav.dashboard') },
      ]
    },
    {
      id: 'services',
      title: 'Service Management',
      icon: Wrench,
      defaultOpen: false,
      items: [
        { to: "/admin/services", icon: Wrench, label: t('nav.services') },
        { to: "/admin/home-config", icon: LayoutDashboard, label: "Home Screen Config" },
        { to: "/admin/dashboard-preferences", icon: Settings2, label: "Dashboard Preferences" },
      ]
    },
    {
      id: 'workers',
      title: 'Worker Management',
      icon: Users,
      defaultOpen: false,
      items: [
        { to: "/admin/workers", icon: User, label: t('nav.workers') },
        { to: "/admin/worker-requests", icon: ClipboardCheck, label: "Worker Requests" },
        { to: "/admin/leaves", icon: Bell, label: t('nav.leaves') },
        { to: "/admin/worker-schedule", icon: Calendar, label: t('nav.workerSchedule') },
        { to: "/admin/workforce", icon: Users, label: t('nav.workforce') },
        { to: "/admin/salary-settlements", icon: IndianRupee, label: "Salary Settlements" },
      ]
    },
    {
      id: 'business',
      title: 'Business Operations',
      icon: Calendar,
      defaultOpen: false,
      items: [
        { to: "/admin/bookings", icon: Calendar, label: t('nav.bookings') },
        { to: "/admin/customers", icon: UserCircle, label: t('nav.customers') },
        { to: "/admin/expenses", icon: IndianRupee, label: "Expenses" },
        { to: "/admin/subscription-sections", icon: Grid3x3, label: "Subscriptions" },
        { to: "/admin/sos", icon: AlertTriangle, label: "SOS Alerts" },
      ]
    },
    {
      id: 'system',
      title: 'Location & Settings',
      icon: Settings,
      defaultOpen: false,
      items: [
        { to: "/admin/locations", icon: MapPin, label: t('nav.locations') },
        { to: "/admin/settings", icon: Settings, label: t('nav.settings') },
        { to: "/admin/quotes", icon: FileText, label: "Quote Requests" },
        { to: "/admin/help-messages", icon: MessageSquare, label: "Help Messages" },
        { to: "/change-password", icon: KeyRound, label: passwordMenuLabel },
      ]
    }
  ], [t, passwordMenuLabel]);

  const superAdminNav = useMemo(() => [
    { to: "/super-admin/dashboard",          icon: LayoutDashboard, label: "Overview" },
    { to: "/super-admin/demand-requests",    icon: MapPin,          label: "Demand Requests" },
    { to: "/super-admin/bookings",           icon: Calendar,        label: t('nav.bookings') },
    { to: "/admin/customers",                icon: UserCircle,      label: t('nav.customers') },
    { to: "/admin/expenses",                 icon: IndianRupee,     label: "Expenses" },
    { to: "/admin/subscription-sections",    icon: Grid3x3,         label: "Subscriptions" },
    { to: "/super-admin/workers",            icon: User,            label: t('nav.workers') },
    { to: "/super-admin/worker-requests",    icon: ClipboardCheck,  label: "Worker Requests" },
    { to: "/super-admin/sos",                icon: AlertTriangle,   label: "SOS Alerts" },
    { to: "/super-admin/leaves",             icon: Bell,            label: t('nav.leaves') },
    { to: "/super-admin/worker-schedule",    icon: Calendar,        label: t('nav.workerSchedule') },
    { to: "/super-admin/workforce",          icon: Users,           label: t('nav.workforce') },
    { to: "/super-admin/salary-settlements", icon: IndianRupee,     label: "Salary Settlements" },
    { to: "/super-admin/quotes",             icon: FileText,        label: "Quote Requests" },
    { to: "/super-admin/help-messages",      icon: MessageSquare,   label: "Help Messages" },
    { to: "/super-admin/locations",          icon: MapPin,          label: "Locations & Admins" },
    { to: "/super-admin/services",           icon: Wrench,          label: t('nav.services') },
    { to: "/admin/home-config",              icon: LayoutDashboard, label: "Home Screen Config" },
    { to: "/super-admin/heatmap",            icon: BarChart3,       label: "Worker Heatmap" },
    { to: "/super-admin/settings",           icon: Settings,        label: t('nav.settings') },
    { to: "/change-password",                icon: KeyRound,        label: passwordMenuLabel },
  ], [t, passwordMenuLabel]);

  // Super Admin Navigation Sections for Collapsible Sidebar
  const superAdminNavSections = useMemo(() => [
    {
      id: 'overview',
      title: 'Overview & Analytics',
      icon: TrendingUp,
      defaultOpen: true,
      items: [
        { to: "/super-admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { to: "/super-admin/demand-requests", icon: MapPin, label: "Demand Requests" },
        { to: "/super-admin/heatmap", icon: BarChart3, label: "Worker Heatmap" },
      ]
    },
    {
      id: 'services',
      title: 'Service Management',
      icon: Wrench,
      defaultOpen: false,
      items: [
        { to: "/super-admin/services", icon: Wrench, label: t('nav.services') },
        { to: "/admin/home-config", icon: LayoutDashboard, label: "Home Screen Config" },
        { to: "/admin/dashboard-preferences", icon: Settings2, label: "Dashboard Preferences" },
      ]
    },
    {
      id: 'workers',
      title: 'Worker Management',
      icon: Users,
      defaultOpen: false,
      items: [
        { to: "/super-admin/workers", icon: User, label: t('nav.workers') },
        { to: "/super-admin/worker-requests", icon: ClipboardCheck, label: "Worker Requests" },
        { to: "/super-admin/leaves", icon: Bell, label: t('nav.leaves') },
        { to: "/super-admin/worker-schedule", icon: Calendar, label: t('nav.workerSchedule') },
        { to: "/super-admin/workforce", icon: Users, label: t('nav.workforce') },
        { to: "/super-admin/salary-settlements", icon: IndianRupee, label: "Salary Settlements" },
      ]
    },
    {
      id: 'business',
      title: 'Business Operations',
      icon: Calendar,
      defaultOpen: false,
      items: [
        { to: "/super-admin/bookings", icon: Calendar, label: t('nav.bookings') },
        { to: "/admin/customers", icon: UserCircle, label: t('nav.customers') },
        { to: "/admin/expenses", icon: IndianRupee, label: "Expenses" },
        { to: "/admin/subscription-sections", icon: Grid3x3, label: "Subscriptions" },
        { to: "/super-admin/sos", icon: AlertTriangle, label: "SOS Alerts" },
      ]
    },
    {
      id: 'system',
      title: 'System & Settings',
      icon: Building,
      defaultOpen: false,
      items: [
        { to: "/super-admin/locations", icon: MapPin, label: "Locations & Admins" },
        { to: "/super-admin/settings", icon: Settings, label: t('nav.settings') },
        { to: "/super-admin/quotes", icon: FileText, label: "Quote Requests" },
        { to: "/super-admin/help-messages", icon: MessageSquare, label: "Help Messages" },
        { to: "/change-password", icon: KeyRound, label: passwordMenuLabel },
      ]
    }
  ], [t, passwordMenuLabel]);

  const navItems = useMemo(() =>
    userType === "admin" ? adminNav
    : userType === "super_admin" ? superAdminNav
    : userType === "worker" ? workerNav
    : customerNav
  , [userType, adminNav, superAdminNav, workerNav, customerNav]);

  const initials = useMemo(() =>
    resolvedName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
  , [resolvedName]);

  const resolvedAvatarUrl = useMemo(() => {
    const rawImage = userImage ?? storedUser?.profileImage ?? null;
    if (!rawImage) return null;
    if (/^https?:\/\//i.test(rawImage)) return rawImage;
    return `${API_ORIGIN}${rawImage}`;
  }, [storedUser?.profileImage, userImage]);

  const dashboardPath = useMemo(() =>
    userType === "admin" ? "/admin/dashboard"
    : userType === "super_admin" ? "/super-admin/dashboard"
    : userType === "worker" ? "/worker/dashboard"
    : "/customer/dashboard"
  , [userType]);

  // Callbacks for child components
  const handleMobileMenuToggle = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const handleNotificationClick = useCallback(() => {
    navigate(notificationsPath);
  }, [navigate, notificationsPath]);

  // Compute business hours text
  const businessHoursText = useMemo(() => {
    if (!todayBH?.isOpen) return undefined;
    return `${t('bh.open')} ${todayBH.openFormatted}–${todayBH.closeFormatted}`;
  }, [todayBH, t]);

  const showBusinessHours = todayBH !== null && todayBH.isOpen;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border fixed inset-y-0 left-0 z-40">
        {/* Logo */}
        <div className="p-5 border-b border-sidebar-border shrink-0">
          <a href={dashboardPath} className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-bold">HH</span>
            </div>
            <span className="text-base font-bold font-heading text-foreground">Healthy Homez</span>
          </a>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-3 p-3 bg-sidebar-accent rounded-xl">
            <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground line-clamp-2 break-words">{resolvedName}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        {(userType === 'admin' || userType === 'super_admin') ? (
          <div className="flex-1 overflow-y-auto sidebar-scroll">
            {/* Notifications */}
            <div className="p-4 border-b border-sidebar-border">
              <Link
                to={notificationsPath}
                className="sidebar-focusable flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                  <span>Notifications</span>
                </div>
                {unreadCount > 0 && (
                  <span className="notification-badge bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            </div>

            {/* Collapsible Sections */}
            <div className="p-4">
              <CollapsibleSidebar
                sections={userType === 'admin' ? adminNavSections : superAdminNavSections}
                storageKey={userType === 'admin' ? 'admin_sidebar' : 'super_admin_sidebar'}
              />
            </div>
          </div>
        ) : (
          <PersistentSidebar
            navItems={navItems}
            notificationsPath={notificationsPath}
            unreadCount={unreadCount}
            onNotificationClick={handleNotificationClick}
          />
        )}

      </aside>

      {/* Mobile Sidebar */}
      <MobileSidebar
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        brandTitle="Healthy Homez"
        navItems={navItems}
        notificationsPath={notificationsPath}
        unreadCount={unreadCount}
        onNotificationClick={handleNotificationClick}
      />

      {/* Main Content */}
      <div className="flex-1 md:ml-64 flex flex-col">
        {/* Header */}
        <AppHeader
          userType={userType}
          userName={resolvedName}
          initials={initials}
          avatarUrl={resolvedAvatarUrl}
          dashboardPath={dashboardPath}
          onMobileMenuToggle={handleMobileMenuToggle}
          onLogout={handleLogout}
          onProfileClick={handleProfileClick}
          showBusinessHours={showBusinessHours}
          businessHoursText={businessHoursText}
        />

        {/* Page Content - This is the only part that re-renders */}
        <main className="flex-1 overflow-y-auto">
          <div
            key={location.pathname}
            className="page-enter-wrapper"
            onAnimationEnd={(e) => {
              // Remove animation after it completes to release the stacking context,
              // so fixed-position modals inside pages can properly overlay the viewport.
              e.currentTarget.style.animation = 'none';
            }}
          >
            {children}
          </div>
        </main>
      </div>

      {/* Profile Panel */}
      <ProfilePanel
        isOpen={profilePanelOpen}
        onClose={() => setProfilePanelOpen(false)}
        profileData={profileData as Parameters<typeof ProfilePanel>[0]['profileData']}
        loading={profileLoading}
        initials={initials}
        avatarUrl={resolvedAvatarUrl}
        userType={userType}
      />
    </div>
  );
};

export default AppLayout;
