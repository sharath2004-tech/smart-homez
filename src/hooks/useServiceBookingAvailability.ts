import {
  getStoredCustomerLocation,
  locationsAPI,
  serviceAreasAPI,
  USER_LOCATION_EVENT_NAME,
} from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface AddressEntry {
  isDefault?: boolean;
  apartmentName?: string;
  address?: string;
  area?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  location?: {
    coordinates?: number[];
  };
}

export interface BookingAvailabilityProfile {
  addresses?: AddressEntry[];
}

export interface ResolvedBookingLocation {
  latitude: number;
  longitude: number;
  apartmentName?: string;
  address?: string;
  area?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  source: "stored" | "profile";
}

export interface ServiceBookingAvailability {
  available: boolean;
  reason: string;
  workersCount: number;
  serviceLocation?: {
    id?: string;
    apartmentName?: string;
    area?: string;
    city?: string;
    distanceMeters?: number;
    serviceRadiusMeters?: number;
  };
  nearbyLocations?: Array<{
    apartmentName?: string;
    area?: string;
    city?: string;
    distance?: number;
  }>;
}

const hasValidCoordinates = (coordinates?: number[]) => (
  Array.isArray(coordinates)
  && coordinates.length === 2
  && typeof coordinates[0] === "number"
  && typeof coordinates[1] === "number"
  && !Number.isNaN(coordinates[0])
  && !Number.isNaN(coordinates[1])
);

const getStoredLocation = (): ResolvedBookingLocation | null => {
  const parsed = getStoredCustomerLocation();
  if (!parsed) return null;

  return {
    latitude: parsed.latitude ?? parsed.lat!,
    longitude: parsed.longitude ?? parsed.lng!,
    apartmentName: parsed.apartmentName,
    address: parsed.address,
    area: parsed.area,
    city: parsed.city,
    state: parsed.state,
    zipCode: parsed.zipCode,
    source: "stored",
  };
};

const getProfileLocation = (profile?: BookingAvailabilityProfile | null): ResolvedBookingLocation | null => {
  const addresses = profile?.addresses || [];
  const address = addresses.find((entry) => entry.isDefault) || addresses[0];
  if (!address || !hasValidCoordinates(address.location?.coordinates)) return null;

  const [longitude, latitude] = address.location!.coordinates!;

  return {
    latitude,
    longitude,
    apartmentName: address.apartmentName,
    address: address.address,
    area: address.area,
    city: address.city,
    state: address.state,
    zipCode: address.zipCode,
    source: "profile",
  };
};

export const resolveBookingLocation = (profile?: BookingAvailabilityProfile | null) => (
  getStoredLocation() || getProfileLocation(profile)
);

export const useServiceBookingAvailability = (
  serviceId?: string | null,
  profile?: BookingAvailabilityProfile | null,
) => {
  const [availability, setAvailability] = useState<ServiceBookingAvailability | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [requestingService, setRequestingService] = useState(false);
  const [storedLocation, setStoredLocation] = useState<ResolvedBookingLocation | null>(() => getStoredLocation());

  useEffect(() => {
    const syncLocation = () => {
      setStoredLocation(getStoredLocation());
    };

    syncLocation();

    if (typeof window === "undefined") {
      return undefined;
    }

    window.addEventListener("storage", syncLocation);
    window.addEventListener(USER_LOCATION_EVENT_NAME, syncLocation as EventListener);

    return () => {
      window.removeEventListener("storage", syncLocation);
      window.removeEventListener(USER_LOCATION_EVENT_NAME, syncLocation as EventListener);
    };
  }, []);

  const resolvedLocation = useMemo(
    () => storedLocation || getProfileLocation(profile),
    [profile, storedLocation],
  );

  const refreshAvailability = useCallback(async () => {
    if (!serviceId || !resolvedLocation) {
      setAvailability(null);
      return;
    }

    try {
      setCheckingAvailability(true);
      const response = await locationsAPI.checkAvailability({
        serviceId,
        longitude: resolvedLocation.longitude,
        latitude: resolvedLocation.latitude,
        apartmentName: resolvedLocation.apartmentName,
      });

      const data = response?.data ?? response;
      setAvailability({
        available: Boolean(data?.available),
        reason: data?.reason || (data?.available ? "Service available in your area." : "Service not available in your area."),
        workersCount: Number(data?.workersCount || 0),
        serviceLocation: data?.serviceLocation,
        nearbyLocations: Array.isArray(data?.nearbyLocations) ? data.nearbyLocations : [],
      });
    } catch (error) {
      console.error("Failed to check booking availability:", error);
      setAvailability(null);
    } finally {
      setCheckingAvailability(false);
    }
  }, [resolvedLocation, serviceId]);

  useEffect(() => {
    void refreshAvailability();
  }, [refreshAvailability]);

  const requestService = useCallback(async (serviceName?: string) => {
    if (!serviceId) {
      toast.error("This service is not configured yet.");
      return false;
    }

    if (!resolvedLocation) {
      toast.error("Please set your service location first.");
      return false;
    }

    try {
      setRequestingService(true);
      const response = await serviceAreasAPI.requestUnavailableService({
        serviceId,
        latitude: resolvedLocation.latitude,
        longitude: resolvedLocation.longitude,
        address: resolvedLocation.address,
        area: resolvedLocation.area,
        city: resolvedLocation.city,
        state: resolvedLocation.state,
        zipCode: resolvedLocation.zipCode,
      });

      toast.success(response.message || `Request saved for ${serviceName || "this service"}.`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit service request.");
      return false;
    } finally {
      setRequestingService(false);
    }
  }, [resolvedLocation, serviceId]);

  return {
    availability,
    checkingAvailability,
    requestingService,
    resolvedLocation,
    hasResolvedLocation: Boolean(resolvedLocation),
    isOutOfRegion: availability?.available === false,
    canBookService: Boolean(serviceId) && Boolean(resolvedLocation) && availability?.available !== false,
    refreshAvailability,
    requestService,
  };
};