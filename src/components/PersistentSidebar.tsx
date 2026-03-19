import type { LucideIcon } from "lucide-react";
import { Bell } from "lucide-react";
import { memo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

interface PersistentSidebarProps {
  navItems: NavItem[];
  notificationsPath: string;
  unreadCount: number;
  onNotificationClick: () => void;
}

/**
 * Memoized Sidebar Component - Only re-renders when props change
 * This ensures the sidebar stays persistent during navigation like Claude.ai
 */
export const PersistentSidebar = memo(({ navItems, notificationsPath, unreadCount, onNotificationClick }: PersistentSidebarProps) => {
  const location = useLocation();
  const sidebarScrollRef = useRef<HTMLElement>(null);

  return (
    <>
      {/* Notifications button - fixed at top */}
      <div className="p-4 border-b border-sidebar-border">
        <button
          onClick={onNotificationClick}
          className="relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <Bell className="w-4 h-4 shrink-0" />
          <span className="truncate" title="Notifications">Notifications</span>
          {unreadCount > 0 && (
            <span className="absolute right-3 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Nav items - scrollable section */}
      <nav
        ref={sidebarScrollRef}
        className="flex-1 p-4 space-y-1.5 overflow-y-auto scroll-smooth"
        style={{ scrollBehavior: 'smooth' }}
      >
        {navItems.map((item) => {
          // Match if current path is exactly the item or starts with the item path
          // This ensures nested routes also highlight their parent menu item
          const isActive = location.pathname === item.to ||
            (item.to !== '/change-password' && location.pathname.startsWith(item.to + '/'));
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="truncate" title={item.label}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
});

PersistentSidebar.displayName = "PersistentSidebar";
