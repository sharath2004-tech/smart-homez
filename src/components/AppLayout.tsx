import { Bell, Calendar, ClipboardCheck, CreditCard, Home, IndianRupee, LayoutDashboard, LogOut, MapPin, RefreshCw, Settings, User, Users, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { LanguageSelector } from "./LanguageSelector";

interface AppLayoutProps {
  children: React.ReactNode;
  userType?: "customer" | "worker" | "admin" | "super_admin";
  userName?: string;
}

const AppLayout = ({ children, userType = "customer", userName = "User" }: AppLayoutProps) => {
  const location = useLocation();
  const { t } = useTranslation();

  const handleLogout = () => {
    // Clear authentication data
    localStorage.removeItem('token');
    localStorage.removeItem('userLocation');
    localStorage.removeItem('user');
    // Redirect to login
    window.location.href = '/login';
  };

  const customerNav = [
    { to: "/customer/dashboard", icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: "/customer/services", icon: Wrench, label: t('nav.services') },
    { to: "/customer/bookings", icon: Calendar, label: t('nav.myBookings') },
    { to: "/customer/subscriptions", icon: RefreshCw, label: t('nav.mySubscriptions') },
    { to: "/customer/payments", icon: CreditCard, label: t('nav.payments') },
    { to: "/customer/profile", icon: User, label: t('nav.profile') },
  ];

  const workerNav = [
    { to: "/worker/dashboard", icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: "/worker/tasks", icon: Calendar, label: t('nav.myTasks') },
    { to: "/worker/salary", icon: IndianRupee, label: "Salary Request" },
    { to: "/worker/leaves", icon: Bell, label: t('nav.myLeaves') },
    { to: "/worker/profile", icon: User, label: t('nav.profile') },
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
    { to: "/admin/settings", icon: Settings, label: t('nav.settings') },
  ];

  const navItems = userType === "admin" ? adminNav : userType === "super_admin" ? superAdminNav : userType === "worker" ? workerNav : customerNav;
  const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const dashboardPath = userType === "admin" ? "/admin/dashboard" : userType === "super_admin" ? "/super-admin/dashboard" : userType === "worker" ? "/worker/dashboard" : "/customer/dashboard";

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border fixed inset-y-0 left-0 z-40">
        {/* Logo */}
        <div className="p-5 border-b border-sidebar-border">
          <Link to={dashboardPath} className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Home className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-base font-bold font-heading text-foreground">Smart Homez</span>
          </Link>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3 p-3 bg-sidebar-accent rounded-xl">
            <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
              <p className="text-xs text-muted-foreground capitalize">{userType === 'super_admin' ? 'Super Admin' : t(`nav.${userType}`)}</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-4 space-y-1">
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
        <div className="p-4 border-t border-sidebar-border space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all">
            <Bell className="w-4 h-4" />
            {t('nav.notifications')}
          </button>
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
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <Link to={dashboardPath} className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Home className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground text-sm">Smart Homez</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs font-bold">
            {initials}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0">
        <div className="p-6 md:p-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border px-2 py-2 flex">
        {navItems.slice(0, 5).map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default AppLayout;
