import LocationSelector, { type LocationData } from "@/components/LocationSelector";
import { setStoredCustomerLocation } from "@/lib/api";
import { MapPin, PencilLine } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface ResolvedBookingLocationLike {
  latitude: number;
  longitude: number;
  apartmentName?: string;
  address?: string;
  area?: string;
  city?: string;
}

interface Props {
  serviceLabel?: string;
  checkingAvailability: boolean;
  hasResolvedLocation: boolean;
  isOutOfRegion: boolean;
  availabilityReason?: string;
  resolvedLocation?: ResolvedBookingLocationLike | null;
  className?: string;
}

const formatLocationLabel = (location?: ResolvedBookingLocationLike | null) => {
  if (!location) return "";

  return [location.apartmentName, location.area, location.city]
    .filter(Boolean)
    .join(", ") || location.address || "Selected location";
};

const ServiceLocationCard = ({
  serviceLabel = "This service",
  checkingAvailability,
  hasResolvedLocation,
  isOutOfRegion,
  availabilityReason,
  resolvedLocation,
  className = "",
}: Props) => {
  const [showLocationSelector, setShowLocationSelector] = useState(false);

  const styles = isOutOfRegion
    ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20"
    : hasResolvedLocation
    ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"
    : "border-slate-300 bg-slate-50 dark:bg-slate-900/40";

  const iconColor = isOutOfRegion
    ? "text-amber-700"
    : hasResolvedLocation
    ? "text-emerald-700"
    : "text-slate-600";

  const title = useMemo(() => {
    if (checkingAvailability) return "Checking service region...";
    if (isOutOfRegion) return `${serviceLabel} is outside your region`;
    if (hasResolvedLocation) return `${serviceLabel} can be booked in your region`;
    return "Service location needed before booking";
  }, [checkingAvailability, hasResolvedLocation, isOutOfRegion, serviceLabel]);

  const description = useMemo(() => {
    if (checkingAvailability) {
      return "We are verifying the admin-configured service region for your selected location.";
    }

    if (isOutOfRegion) {
      return availabilityReason || "Bookings are accepted only in regions configured by admin or super admin.";
    }

    if (hasResolvedLocation) {
      return availabilityReason || "Your selected location is inside an active service region.";
    }

    return "Please pin your location on the map or use auto location before booking.";
  }, [availabilityReason, checkingAvailability, hasResolvedLocation, isOutOfRegion]);

  const handleLocationConfirmed = (location: LocationData) => {
    setStoredCustomerLocation(location, "selected");
    setShowLocationSelector(false);
    toast.success("Service location updated.");
  };

  return (
    <>
      <div className={`rounded-2xl border p-4 ${styles} ${className}`.trim()}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <MapPin className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
            <div className="min-w-0 space-y-1 text-sm">
              <p className="font-semibold text-foreground">{title}</p>
              <p className="text-muted-foreground">{description}</p>
              {resolvedLocation && (
                <p className="break-words text-xs text-muted-foreground">
                  Location: {formatLocationLabel(resolvedLocation)}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowLocationSelector(true)}
            className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted sm:w-auto"
          >
            <PencilLine className="h-4 w-4" />
            {hasResolvedLocation ? "Change" : "Set location"}
          </button>
        </div>
      </div>

      {showLocationSelector && (
        <LocationSelector
          onLocationConfirmed={handleLocationConfirmed}
          onClose={() => setShowLocationSelector(false)}
          defaultLocation={resolvedLocation
            ? { lat: resolvedLocation.latitude, lng: resolvedLocation.longitude }
            : undefined}
          showCloseButton
          allowUnavailableConfirmation
          unavailableConfirmLabel="Use this location"
        />
      )}
    </>
  );
};

export default ServiceLocationCard;
