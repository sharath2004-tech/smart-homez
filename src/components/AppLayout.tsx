import { api, settingsAPI } from "@/lib/api";
import { ArrowLeft, Bell, Calendar, ClipboardCheck, Clock, CreditCard, HelpCircle, Home, IndianRupee, LayoutDashboard, LogOut, MapPin, Menu, MessageSquare, RefreshCw, Settings, User, Users, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LanguageSelector } from "./LanguageSelector";

interface AppLayoutProps {
  children: React.ReactNode;
  userType?: "customer" | "worker" | "admin" | "super_admin";
  userName?: string;
}

const AppLayout = ({ children, userType = "customer", userName = "User" }: AppLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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
    : userType === 'admin' || userType === 'super_admin' ? '/admin/notifications'
    : '/customer/notifications';

  const customerNav = [
    { to: "/customer/dashboard", icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: "/customer/services", icon: Wrench, label: t('nav.services') },
    { to: "/customer/bookings", icon: Calendar, label: t('nav.myBookings') },
    { to: "/customer/subscriptions", icon: RefreshCw, label: t('nav.mySubscriptions') },
    { to: "/customer/payments", icon: CreditCard, label: t('nav.payments') },
    { to: "/customer/profile", icon: User, label: t('nav.profile') },
    { to: "/customer/help", icon: HelpCircle, label: "Help" },
  ];

  const workerNav = [
    { to: "/worker/dashboard", icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: "/worker/tasks", icon: Calendar, label: t('nav.myTasks') },
    { to: "/worker/earnings", icon: IndianRupee, label: "Salary Management" },
    { to: "/worker/salary", icon: IndianRupee, label: "Salary History" },
    { to: "/worker/leaves", icon: Bell, label: t('nav.myLeaves') },
    { to: "/worker/profile", icon: User, label: t('nav.profile') },
    { to: "/worker/help", icon: HelpCircle, label: "Help" },
  ];

  const adminNav = [
    { to: "/admin/dashboard", icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: "/admin/bookings", icon: Calendar, label: t('nav.bookings') },
    { to: "/admin/workforce", icon: Users, label: t('nav.workforce') },
    { to: "/admin/worker-schedule", icon: Calendar, label: t('nav.workerSchedule') },
    { to: "/admin/salary-settlements", icon: IndianRupee, label: "Salary Settlements" },
    { to: "/admin/leaves", icon: Bell, label: t('nav.leaves') },
    { to: "/admin/services", icon: Wrench, label: t('nav.services') },
    { to: "/admin/workers", icon: User, label: t('nav.workers') },
    { to: "/admin/worker-requests", icon: ClipboardCheck, label: "Worker Requests" },
    { to: "/admin/locations", icon: MapPin, label: t('nav.locations') },
    { to: "/admin/help-messages", icon: MessageSquare, label: "Help Messages" },
    { to: "/admin/settings", icon: Settings, label: t('nav.settings') },
  ];

  const superAdminNav = [
    { to: "/super-admin/dashboard", icon: LayoutDashboard, label: "Overview" },
    { to: "/admin/bookings", icon: Calendar, label: t('nav.bookings') },
    { to: "/admin/workforce", icon: Users, label: t('nav.workforce') },
    { to: "/admin/worker-schedule", icon: Calendar, label: t('nav.workerSchedule') },
    { to: "/admin/salary-settlements", icon: IndianRupee, label: "Salary Settlements" },
    { to: "/admin/leaves", icon: Bell, label: t('nav.leaves') },
    { to: "/admin/workers", icon: User, label: t('nav.workers') },
    { to: "/admin/worker-requests", icon: ClipboardCheck, label: "Worker Requests" },
    { to: "/admin/locations", icon: MapPin, label: t('nav.locations') },
    { to: "/admin/services", icon: Wrench, label: t('nav.services') },
    { to: "/admin/help-messages", icon: MessageSquare, label: "Help Messages" },
    { to: "/admin/settings", icon: Settings, label: t('nav.settings') },
  ];

  const navItems = userType === "admin" ? adminNav : userType === "super_admin" ? superAdminNav : userType === "worker" ? workerNav : customerNav;
  const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
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
            <span className="text-base font-bold font-heading text-foreground">Smart Homez</span>
          </Link>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-3 p-3 bg-sidebar-accent rounded-xl">
            <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
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
        {location.pathname !== dashboardPath ? (
          <button
            onClick={() => navigate(-1)}
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
          Smart Homez
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
          <button
            onClick={() => setMobileOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-foreground" />
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
                <span className="font-bold text-foreground">Smart Homez</span>
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
                  <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
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
        {/* Desktop back button — shown on all non-dashboard pages */}
        {location.pathname !== dashboardPath && (
          <div className="hidden md:flex items-center px-6 md:px-8 pt-5 pb-0">
            <button
              onClick={() => navigate(-1)}
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
