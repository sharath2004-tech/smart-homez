import { api, settingsAPI } from "@/lib/api";
import { AlertTriangle, ArrowLeft, BarChart3, Bell, Calendar, ClipboardCheck, Clock, CreditCard, FileText, HelpCircle, Home, IndianRupee, KeyRound, LayoutDashboard, LogOut, MapPin, Menu, MessageSquare, RefreshCw, Settings, Sparkles, User, Users, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LanguageSelector } from "./LanguageSelector";

interface AppLayoutProps {
  children: React.ReactNode;
  userType?: "customer" | "worker" | "admin" | "super_admin";
  userName?: string;
}

const AppLayout = ({ children, userType = "customer", userName }: AppLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Resolve display name: prop > localStorage cached user > "User"
  const resolvedName = userName ?? (() => {
    try { return (JSON.parse(localStorage.getItem('user') || '{}') as { name?: string })?.name; }
    catch { return undefined; }
  })() ?? "User";

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userLocation');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const notificationsPath =
    userType === 'worker' ? '/worker/notifications'
    : userType === 'super_admin' ? '/super-admin/notifications'
    : userType === 'admin' ? '/admin/notifications'
    : '/customer/notifications';

  const customerNav = [
    { to: "/customer/dashboard", icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: "/customer/services", icon: Wrench, label: t('nav.services') },
    { to: "/customer/bookings", icon: Calendar, label: t('nav.myBookings') },
    { to: "/customer/my-quotes", icon: FileText, label: "My Quotes" },
    { to: "/customer/subscriptions", icon: RefreshCw, label: t('nav.mySubscriptions') },
    { to: "/customer/payments", icon: CreditCard, label: t('nav.payments') },
    { to: "/customer/profile", icon: User, label: t('nav.profile') },
    { to: "/customer/help", icon: HelpCircle, label: "Help" },
    { to: "/change-password", icon: KeyRound, label: "Change Password" },
  ];

  const workerNav = [
    { to: "/worker/dashboard", icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: "/worker/tasks", icon: Calendar, label: t('nav.myTasks') },
    { to: "/worker/earnings", icon: IndianRupee, label: "Salary Management" },
    { to: "/worker/salary", icon: IndianRupee, label: "Salary History" },
    { to: "/worker/leaves", icon: Bell, label: t('nav.myLeaves') },
    { to: "/worker/profile", icon: User, label: t('nav.profile') },
    { to: "/worker/help", icon: HelpCircle, label: "Help" },
    { to: "/change-password", icon: KeyRound, label: "Change Password" },
  ];

  const adminNav = [
    { to: "/admin/dashboard",          icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: "/admin/bookings",           icon: Calendar,        label: t('nav.bookings') },
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
    { to: "/admin/settings",           icon: Settings,        label: t('nav.settings') },
    { to: "/change-password",          icon: KeyRound,        label: "Change Password" },
  ];

  const superAdminNav = [
    { to: "/super-admin/dashboard",          icon: LayoutDashboard, label: "Overview" },
    { to: "/super-admin/bookings",           icon: Calendar,        label: t('nav.bookings') },
    { to: "/super-admin/workers",            icon: User,            label: t('nav.workers') },
    { to: "/super-admin/worker-requests",    icon: ClipboardCheck,  label: "Worker Requests" },
    { to: "/super-admin/sos",                icon: AlertTriangle,   label: "SOS Alerts" },
    { to: "/super-admin/leaves",             icon: Bell,            label: t('nav.leaves') },
    { to: "/super-admin/worker-schedule",    icon: Calendar,        label: t('nav.workerSchedule') },
    { to: "/super-admin/workforce",          icon: Users,           label: t('nav.workforce') },
    { to: "/super-admin/salary-settlements", icon: IndianRupee,     label: "Salary Settlements" },
    { to: "/super-admin/quotes",             icon: FileText,        label: "Quote Requests" },
    { to: "/super-admin/help-messages",      icon: MessageSquare,   label: "Help Messages" },
    { to: "/super-admin/locations",          icon: MapPin,          label: t('nav.locations') },
    { to: "/super-admin/services",           icon: Wrench,          label: t('nav.services') },
    { to: "/super-admin/deep-cleaning-config", icon: Sparkles,      label: "Deep Clean Config" },
    { to: "/super-admin/heatmap",            icon: BarChart3,       label: "Worker Heatmap" },
    { to: "/super-admin/settings",           icon: Settings,        label: t('nav.settings') },
    { to: "/change-password",                icon: KeyRound,        label: "Change Password" },
  ];

  const navItems = userType === "admin" ? adminNav : userType === "super_admin" ? superAdminNav : userType === "worker" ? workerNav : customerNav;
  const initials = resolvedName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  const dashboardPath = userType === "admin" ? "/admin/dashboard" : userType === "super_admin" ? "/super-admin/dashboard" : userType === "worker" ? "/worker/dashboard" : "/customer/dashboard";

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border fixed inset-y-0 left-0 z-40">
        {/* Logo */}
        <div className="p-5 border-b border-sidebar-border shrink-0">
          <Link to={dashboardPath} className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Home className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-base font-bold font-heading text-foreground">Healthy Homez</span>
          </Link>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-3 p-3 bg-sidebar-accent rounded-xl">
            <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{resolvedName}</p>
              <p className="text-xs text-muted-foreground capitalize">{userType === 'super_admin' ? 'Super Admin' : t(`nav.${userType}`)}</p>
            </div>
          </div>
          {/* Business hours chip */}
          {todayBH !== null && (
            <div className={`mt-2.5 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
              todayBH.isOpen
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-muted text-muted-foreground border border-border'
            }`}>
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {todayBH.isOpen
                ? <span>{t('bh.open')} <span className="font-semibold">{todayBH.openFormatted}&#8211;{todayBH.closeFormatted}</span></span>
                : <span>{t('bh.closedToday')}</span>
              }
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-brand"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Super admin role preview */}
        {userType === 'super_admin' && (
          <div className="px-4 py-3 border-t border-sidebar-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">View As</p>
            <div className="flex gap-1.5">
              <Link to="/customer/dashboard" className="flex-1 text-center text-xs py-1.5 rounded-lg bg-sidebar-accent hover:bg-primary/10 hover:text-primary transition-colors font-medium text-sidebar-foreground">Customer</Link>
              <Link to="/admin/dashboard" className="flex-1 text-center text-xs py-1.5 rounded-lg bg-sidebar-accent hover:bg-primary/10 hover:text-primary transition-colors font-medium text-sidebar-foreground">Admin</Link>
              <Link to="/worker/dashboard" className="flex-1 text-center text-xs py-1.5 rounded-lg bg-sidebar-accent hover:bg-primary/10 hover:text-primary transition-colors font-medium text-sidebar-foreground">Worker</Link>
            </div>
          </div>
        )}

        {/* Bottom actions */}
        <div className="p-4 border-t border-sidebar-border space-y-1 shrink-0">
          <Link
            to={notificationsPath}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
          >
            <span className="relative">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
            {t('nav.notifications')}
            {unreadCount > 0 && (
              <span className="ml-auto bg-destructive text-destructive-foreground text-xs font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </Link>
          <LanguageSelector variant="full" />
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            {t('nav.signOut')}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border px-3 py-3 flex items-center gap-2">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-foreground" />
        </button>
        {location.pathname !== dashboardPath ? (
          <button
            onClick={() => window.history.length > 1 ? navigate(-1) : navigate(dashboardPath)}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
        ) : (
          <Link to={dashboardPath} className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Home className="w-4 h-4 text-primary-foreground" />
            </div>
          </Link>
        )}
        <Link to={dashboardPath} className="flex-1 font-bold text-foreground text-sm truncate">
          Healthy Homez
        </Link>
        <div className="flex items-center gap-1">
          <LanguageSelector />
          <button
            onClick={handleLogout}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-destructive/10 text-destructive transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="md:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-sidebar shadow-xl">
            {/* Drawer header */}
            <div className="p-4 border-b border-sidebar-border shrink-0 flex items-center justify-between">
              <Link to={dashboardPath} onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Home className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-bold text-foreground">Healthy Homez</span>
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-sidebar-accent transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5 text-sidebar-foreground" />
              </button>
            </div>
            {/* User info */}
            <div className="p-4 border-b border-sidebar-border shrink-0">
              <div className="flex items-center gap-3 p-3 bg-sidebar-accent rounded-xl">
                <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{resolvedName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{userType === 'super_admin' ? 'Super Admin' : t(`nav.${userType}`)}</p>
                </div>
              </div>
              {/* Business hours chip */}
              {todayBH !== null && (
                <div className={`mt-2.5 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                  todayBH.isOpen
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}>
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  {todayBH.isOpen
                    ? <span>Open <span className="font-semibold">{todayBH.openFormatted}&#8211;{todayBH.closeFormatted}</span></span>
                    : <span>Closed today</span>
                  }
                </div>
              )}
            </div>
            {/* Nav items - scrollable */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-brand"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                    }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            {/* Super admin role preview - mobile */}
            {userType === 'super_admin' && (
              <div className="px-4 py-3 border-t border-sidebar-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">View As</p>
                <div className="flex gap-1.5">
                  <Link to="/customer/dashboard" onClick={() => setMobileOpen(false)} className="flex-1 text-center text-xs py-1.5 rounded-lg bg-sidebar-accent hover:bg-primary/10 hover:text-primary transition-colors font-medium text-sidebar-foreground">Customer</Link>
                  <Link to="/admin/dashboard" onClick={() => setMobileOpen(false)} className="flex-1 text-center text-xs py-1.5 rounded-lg bg-sidebar-accent hover:bg-primary/10 hover:text-primary transition-colors font-medium text-sidebar-foreground">Admin</Link>
                  <Link to="/worker/dashboard" onClick={() => setMobileOpen(false)} className="flex-1 text-center text-xs py-1.5 rounded-lg bg-sidebar-accent hover:bg-primary/10 hover:text-primary transition-colors font-medium text-sidebar-foreground">Worker</Link>
                </div>
              </div>
            )}
            {/* Drawer bottom */}
            <div className="p-4 border-t border-sidebar-border space-y-1 shrink-0">
              <LanguageSelector variant="full" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
              >
                <LogOut className="w-4 h-4" />
                {t('nav.signOut')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0">
        {/* Super admin preview mode banner */}
        {userType !== 'super_admin' && (() => {
          try { return (JSON.parse(localStorage.getItem('user') || '{}') as { role?: string })?.role === 'super_admin'; }
          catch { return false; }
        })() && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-amber-800">👁️ Previewing as {userType} — you are still logged in as Super Admin</p>
            <Link to="/super-admin/dashboard" className="text-xs font-bold text-amber-900 underline hover:no-underline shrink-0">← Return to Super Admin</Link>
          </div>
        )}
        {/* Desktop back button — shown on all non-dashboard pages */}
        {location.pathname !== dashboardPath && (
          <div className="hidden md:flex items-center px-6 md:px-8 pt-5 pb-0">
            <button
              onClick={() => window.history.length > 1 ? navigate(-1) : navigate(dashboardPath)}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Back
            </button>
          </div>
        )}
        <div className="p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
