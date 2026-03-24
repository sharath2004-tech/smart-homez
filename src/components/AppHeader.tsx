import { ArrowLeft, Home, LogOut, Menu } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";
import { LanguageSelector } from "./LanguageSelector";

interface AppHeaderProps {
  userType: string;
  userName: string;
  initials: string;
  avatarUrl?: string | null;
  dashboardPath: string;
  onMobileMenuToggle: () => void;
  onLogout: () => void;
  onProfileClick?: () => void;
  showBusinessHours: boolean;
  businessHoursText?: string;
}

/**
 * Memoized Header Component - Only re-renders when props change
 */
export const AppHeader = memo(({
  userType,
  userName,
  initials,
  avatarUrl,
  dashboardPath,
  onMobileMenuToggle,
  onLogout,
  onProfileClick,
  showBusinessHours,
  businessHoursText
}: AppHeaderProps) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-card border-b border-border backdrop-blur-sm bg-card/95">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Mobile menu */}
        <button
          className="p-2 rounded-lg hover:bg-accent transition-colors md:hidden"
          onClick={onMobileMenuToggle}
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Back button (mobile only) */}
        <button
          onClick={() => window.history.back()}
          className="p-2 rounded-lg hover:bg-accent transition-colors md:hidden"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Home link (desktop only) */}
        <Link
          to={dashboardPath}
          className="hidden md:flex items-center gap-2 p-2 rounded-lg hover:bg-accent transition-colors"
        >
          <Home className="w-5 h-5" />
        </Link>

        {/* Business hours badge */}
        {showBusinessHours && businessHoursText && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-success-light text-success text-xs font-medium border border-success/20">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            {businessHoursText}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Language Selector */}
        <LanguageSelector />

        {/* User info */}
        <div
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted cursor-pointer hover:bg-accent transition-colors select-none"
          onClick={onProfileClick}
          title="View profile"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onProfileClick?.()}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
          )}
          <span className="text-sm font-medium text-foreground md:max-w-[120px] line-clamp-1 break-words">
            {userName}
          </span>
        </div>

        {/* Mobile user avatar */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={userName}
            className="sm:hidden w-8 h-8 rounded-full object-cover cursor-pointer"
            onClick={onProfileClick}
            title="View profile"
          />
        ) : (
          <div
            className="sm:hidden w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold cursor-pointer hover:opacity-80 transition-opacity select-none"
            onClick={onProfileClick}
            title="View profile"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onProfileClick?.()}
          >
            {initials}
          </div>
        )}

        {/* Logout */}
        <button
          onClick={onLogout}
          className="p-2 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.userName === nextProps.userName &&
    prevProps.initials === nextProps.initials &&
    prevProps.avatarUrl === nextProps.avatarUrl &&
    prevProps.showBusinessHours === nextProps.showBusinessHours &&
    prevProps.businessHoursText === nextProps.businessHoursText
  );
});

AppHeader.displayName = "AppHeader";
