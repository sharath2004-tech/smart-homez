import type { LucideIcon } from "lucide-react";
import { Bell, X } from "lucide-react";
import { memo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  brandTitle: string;
  navItems: NavItem[];
  notificationsPath: string;
  unreadCount: number;
  onNotificationClick: () => void;
}

/**
 * Memoized Mobile Sidebar Component - Only re-renders when props change
 */
export const MobileSidebar = memo(({ isOpen, onClose, brandTitle, navItems, notificationsPath, unreadCount, onNotificationClick }: MobileSidebarProps) => {
  const location = useLocation();
  const mobileScrollRef = useRef<HTMLElement>(null);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-sidebar-border shadow-2xl z-50 md:hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <h2 className="text-lg font-bold text-sidebar-foreground">{brandTitle}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
          >
            <X className="w-5 h-5 text-sidebar-foreground" />
          </button>
        </div>

        {/* Notifications button */}
        <div className="p-4 border-b border-sidebar-border">
          <button
            onClick={() => {
              onNotificationClick();
              onClose();
            }}
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

        {/* Nav items - scrollable */}
        <nav
          ref={mobileScrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-1.5 scroll-smooth"
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
                onClick={onClose}
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
      </div>
    </>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.unreadCount === nextProps.unreadCount &&
    prevProps.navItems === nextProps.navItems &&
    prevProps.brandTitle === nextProps.brandTitle
  );
});

MobileSidebar.displayName = "MobileSidebar";
