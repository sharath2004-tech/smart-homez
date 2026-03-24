import { API_ORIGIN } from "@/lib/api";
import { Briefcase, Mail, MapPin, Phone, Shield, Star, UserCheck, X } from "lucide-react";
import { useEffect, useRef } from "react";

interface Address {
  street?: string;
  area?: string;
  city?: string;
  isDefault?: boolean;
  label?: string;
}

interface ProfileData {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  profileImage?: string;
  addresses?: Address[];
  specialization?: string;
  rating?: number;
  totalReviews?: number;
  reviewCount?: number;
  status?: string;
  location?: { name?: string };
  assignedLocation?: { name?: string };
  assignedLocations?: { name?: string }[];
  skills?: string[];
  bio?: string;
}

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  profileData: ProfileData | null;
  loading?: boolean;
  initials: string;
  avatarUrl?: string | null;
  userType: string;
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  customer: { label: "Customer", color: "bg-blue-100 text-blue-700 border-blue-200", icon: UserCheck },
  worker: { label: "Worker", color: "bg-green-100 text-green-700 border-green-200", icon: Briefcase },
  admin: { label: "Admin", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Shield },
  super_admin: { label: "Super Admin", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Shield },
};

export const ProfilePanel = ({
  isOpen,
  onClose,
  profileData,
  loading,
  initials,
  avatarUrl,
  userType,
}: ProfilePanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);

  const roleConfig = ROLE_CONFIG[userType] ?? {
    label: userType,
    color: "bg-gray-100 text-gray-700 border-gray-200",
    icon: UserCheck,
  };
  const RoleIcon = roleConfig.icon;

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const resolvedImage = (() => {
    const raw = profileData?.profileImage ?? null;
    if (!raw) return avatarUrl ?? null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${API_ORIGIN}${raw}`;
  })();

  const displayName = profileData?.name ?? "User";
  const reviewCount = profileData?.totalReviews ?? profileData?.reviewCount ?? 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Profile"
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-background shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header gradient with avatar */}
        <div className="relative bg-gradient-to-br from-primary to-primary/70 pt-10 pb-6 px-6 flex flex-col items-center text-center shrink-0">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/20 transition-colors"
            aria-label="Close profile"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Avatar */}
          <div className="relative mb-3">
            {resolvedImage ? (
              <img
                src={resolvedImage}
                alt={displayName}
                className="w-24 h-24 rounded-full object-cover border-4 border-white/30 shadow-lg"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className={`w-24 h-24 rounded-full bg-white/20 border-4 border-white/30 shadow-lg items-center justify-center text-2xl font-bold text-primary-foreground ${
                resolvedImage ? "hidden" : "flex"
              }`}
            >
              {initials}
            </div>
          </div>

          {/* Name */}
          <h2 className="text-xl font-bold text-primary-foreground mb-2 break-words max-w-full">
            {displayName}
          </h2>

          {/* Role badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${roleConfig.color} bg-white`}
          >
            <RoleIcon className="w-3 h-3" />
            {roleConfig.label}
          </span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {loading && !profileData ? (
            <div className="flex flex-col gap-4 p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-muted rounded w-1/3" />
                    <div className="h-4 bg-muted rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 space-y-2">
              {/* Contact Info section */}
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-3 mt-1">
                Contact Info
              </p>

              {profileData?.email && (
                <InfoRow icon={Mail} label="Email" value={profileData.email} />
              )}
              {profileData?.phone && (
                <InfoRow icon={Phone} label="Phone" value={profileData.phone} />
              )}

              {/* Worker-specific */}
              {userType === "worker" && (
                <>
                  {profileData?.specialization && (
                    <InfoRow icon={Briefcase} label="Specialization" value={profileData.specialization} />
                  )}
                  {profileData?.skills && profileData.skills.length > 0 && (
                    <InfoRow icon={Briefcase} label="Skills" value={profileData.skills.join(", ")} />
                  )}
                  {typeof profileData?.rating === "number" && (
                    <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Star className="w-4 h-4 fill-current" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">Rating</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {profileData.rating.toFixed(1)}
                          </span>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3.5 h-3.5 ${
                                  s <= Math.round(profileData.rating ?? 0)
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground"
                                }`}
                              />
                            ))}
                          </div>
                          {reviewCount > 0 && (
                            <span className="text-xs text-muted-foreground">({reviewCount})</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {profileData?.status && (
                    <InfoRow
                      icon={UserCheck}
                      label="Status"
                      value={profileData.status}
                      valueClass={
                        profileData.status === "active"
                          ? "text-green-600 capitalize"
                          : "text-muted-foreground capitalize"
                      }
                    />
                  )}
                  {profileData?.location?.name && (
                    <InfoRow icon={MapPin} label="Location" value={profileData.location.name} />
                  )}
                </>
              )}

              {/* Customer addresses */}
              {userType === "customer" &&
                profileData?.addresses &&
                profileData.addresses.length > 0 && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-3 mt-5">
                      Saved Addresses
                    </p>
                    <div className="space-y-2">
                      {profileData.addresses.map((addr, i) => {
                        const parts = [addr.street, addr.area, addr.city].filter(Boolean);
                        const text = addr.label
                          ? `${addr.label}: ${parts.join(", ")}`
                          : parts.join(", ");
                        return (
                          <div
                            key={i}
                            className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-muted/50"
                          >
                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground mb-0.5">
                                Address {i + 1}
                                {addr.isDefault && (
                                  <span className="ml-1.5 text-xs font-medium text-primary">
                                    (Default)
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-foreground break-words">{text || "—"}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

              {/* Admin/super_admin location(s) */}
              {(userType === "admin" || userType === "super_admin") && (
                <>
                  {profileData?.assignedLocation?.name && (
                    <InfoRow icon={MapPin} label="Assigned Location" value={profileData.assignedLocation.name} />
                  )}
                  {profileData?.assignedLocations && profileData.assignedLocations.length > 0 && (
                    <InfoRow
                      icon={MapPin}
                      label="Locations"
                      value={profileData.assignedLocations.map((l) => l.name).filter(Boolean).join(", ")}
                    />
                  )}
                </>
              )}

              {/* Bio */}
              {profileData?.bio && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-3 mt-5">
                    About
                  </p>
                  <p className="text-sm text-foreground px-3 py-2.5 rounded-xl bg-muted/50 break-words">
                    {profileData.bio}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

interface InfoRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClass?: string;
}

const InfoRow = ({ icon: Icon, label, value, valueClass }: InfoRowProps) => (
  <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors">
    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm font-medium break-words ${valueClass ?? "text-foreground"}`}>{value}</p>
    </div>
  </div>
);
