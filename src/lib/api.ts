/**
 * API Service for Pure App Weave
 * Centralized API calls to backend
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
export const USER_LOCATION_STORAGE_KEY = 'userLocation';
export const USER_LOCATION_EVENT_NAME = 'pure-app:user-location-changed';

type StoredCustomerLocation = {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  apartmentName?: string;
  address?: string;
  area?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  isAvailable?: boolean;
  serviceAreaId?: string;
  timestamp?: number;
  source?: 'selected' | 'profile' | 'device';
};

type LocationBearingUser = {
  role?: string;
  addresses?: Array<{
    isDefault?: boolean;
    apartmentName?: string;
    apartment?: string;
    building?: string;
    street?: string;
    address?: string;
    area?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    location?: {
      coordinates?: number[];
    };
  }>;
  currentLocation?: {
    coordinates?: number[];
  };
};

const hasValidCoordinates = (coordinates?: number[]) => (
  Array.isArray(coordinates)
  && coordinates.length === 2
  && coordinates.every((value) => typeof value === 'number' && !Number.isNaN(value))
);

const hasValidLatLng = (latitude?: number, longitude?: number) => (
  typeof latitude === 'number'
  && typeof longitude === 'number'
  && !Number.isNaN(latitude)
  && !Number.isNaN(longitude)
);

export const getStoredCustomerLocation = (): StoredCustomerLocation | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(USER_LOCATION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredCustomerLocation;
    const latitude = parsed.latitude ?? parsed.lat;
    const longitude = parsed.longitude ?? parsed.lng;

    if (!hasValidLatLng(latitude, longitude)) {
      return null;
    }

    return {
      ...parsed,
      lat: latitude,
      lng: longitude,
      latitude,
      longitude,
    };
  } catch {
    return null;
  }
};

const notifyStoredLocationChange = (location: StoredCustomerLocation | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(USER_LOCATION_EVENT_NAME, {
    detail: location,
  }));
};

export const setStoredCustomerLocation = (
  location: StoredCustomerLocation,
  source: StoredCustomerLocation['source'] = 'selected'
) => {
  if (typeof window === 'undefined') {
    return null;
  }

  const latitude = location.latitude ?? location.lat;
  const longitude = location.longitude ?? location.lng;
  if (!hasValidLatLng(latitude, longitude)) {
    return null;
  }

  const payload: StoredCustomerLocation = {
    ...location,
    lat: latitude,
    lng: longitude,
    latitude,
    longitude,
    source,
    timestamp: location.timestamp ?? Date.now(),
  };

  window.localStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify(payload));
  notifyStoredLocationChange(payload);
  return payload;
};

const removeStoredCustomerLocation = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(USER_LOCATION_STORAGE_KEY);
  notifyStoredLocationChange(null);
};

const buildStoredLocationFromUser = (user?: LocationBearingUser | null) => {
  if (!user || user.role !== 'customer') {
    return null;
  }

  const addresses = Array.isArray(user.addresses) ? user.addresses : [];
  const address = addresses.find((entry) => entry?.isDefault) || addresses[0];
  const coordinates = address?.location?.coordinates || user.currentLocation?.coordinates;

  if (!hasValidCoordinates(coordinates)) {
    return null;
  }

  const [lng, lat] = coordinates;
  const addressText = [address?.street, address?.apartment, address?.building, address?.area, address?.city]
    .filter(Boolean)
    .join(', ');

  return {
    lat,
    lng,
    apartmentName: address?.apartmentName || address?.apartment || address?.building || address?.area,
    address: address?.address || addressText || undefined,
    area: address?.area,
    city: address?.city,
    state: address?.state,
    zipCode: address?.zipCode,
  };
};

const syncStoredAuthState = (user?: Record<string, unknown> | null) => {
  if (typeof window === 'undefined' || !user) {
    return;
  }

  try {
    const existingUser = JSON.parse(window.localStorage.getItem('user') || '{}');
    window.localStorage.setItem('user', JSON.stringify({ ...existingUser, ...user }));
  } catch {
    window.localStorage.setItem('user', JSON.stringify(user));
  }

  const storedLocation = buildStoredLocationFromUser(user as LocationBearingUser);
  const existingLocation = getStoredCustomerLocation();
  const shouldPreserveExistingLocation = Boolean(
    existingLocation
    && hasValidLatLng(existingLocation.latitude ?? existingLocation.lat, existingLocation.longitude ?? existingLocation.lng)
    && existingLocation.source !== 'profile'
  );

  if (storedLocation && !shouldPreserveExistingLocation) {
    setStoredCustomerLocation(storedLocation, 'profile');
  } else if ((user as LocationBearingUser)?.role) {
    if (!shouldPreserveExistingLocation) {
      removeStoredCustomerLocation();
    }
  }
};

// Log API configuration in development/production for debugging
if (import.meta.env.DEV) {
  console.log('🔧 API Base URL:', API_BASE_URL);
  console.log('🔧 Environment:', import.meta.env.MODE);
} else {
  console.log('🌐 Production API:', API_BASE_URL);
  if (API_BASE_URL.includes('localhost')) {
    console.warn('⚠️ WARNING: Using localhost in production! Set VITE_API_URL environment variable.');
  }
}

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token');
};

// Create headers with auth token
const getHeaders = () => {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

// Generic API call function
async function apiCall(endpoint: string, options: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...getHeaders(),
        ...options.headers
      }
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle validation errors array
      if (data.errors && Array.isArray(data.errors)) {
        const errorMessages = data.errors.map((err: { msg: string }) => err.msg).join(', ');
        throw new Error(errorMessages || 'Validation failed');
      }
      throw new Error(data.message || data.error?.message || 'API request failed');
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. The server may be starting up — please try again.');
    }
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  } finally {
    clearTimeout(timerId);
  }
}

// ====== Authentication APIs ======

export const authAPI = {
  login: async (email: string, password: string) => {
    return apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  register: async (userData: Record<string, unknown>) => {
    return apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  getProfile: async () => {
    const data = await apiCall('/auth/me');
    syncStoredAuthState(data?.user);
    return data;
  },

  updateProfile: async (userData: Record<string, unknown> | FormData) => {
    if (userData instanceof FormData) {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'PATCH',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: userData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error?.message || 'Failed to update profile');
      }

      syncStoredAuthState(data?.user);

      return data;
    }

    const data = await apiCall('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(userData)
    });

    syncStoredAuthState(data?.user);
    return data;
  },

  updatePreferences: async (preferences: Record<string, unknown>) => {
    return apiCall('/auth/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ preferences })
    });
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    return apiCall('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },

  forgotPassword: async (email: string) => {
    return apiCall('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    }, 35000); // extended timeout — SMTP send can be slow on first request
  },

  forgotPasswordEmailOtp: async (email: string) => {
    return apiCall('/auth/forgot-password-email-otp', {
      method: 'POST',
      body: JSON.stringify({ email })
    }, 35000); // extended timeout — SMTP send can be slow on first request
  },

  resetPasswordEmailOtp: async (email: string, otp: string, newPassword: string) => {
    return apiCall('/auth/reset-password-email-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword })
    });
  },

  forgotPasswordPhone: async (phone: string) => {
    return apiCall('/auth/forgot-password-phone', {
      method: 'POST',
      body: JSON.stringify({ phone })
    });
  },

  resetPasswordPhone: async (phone: string, otp: string, newPassword: string) => {
    return apiCall('/auth/reset-password-phone', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, newPassword })
    });
  },

  resetPassword: async (token: string, newPassword: string) => {
    return apiCall('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword })
    });
  },

  // Twilio OTP — send a 6-digit SMS OTP to the given phone number
  sendOTP: async (phone: string) => {
    return apiCall('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone })
    });
  },

  // Email OTP — send a 6-digit OTP to the given email for signup verification
  sendEmailOTP: async (email: string) => {
    return apiCall('/auth/send-email-otp', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  // Email OTP — verify the code sent to email during signup
  verifyEmailOTP: async (email: string, otp: string) => {
    return apiCall('/auth/verify-email-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp })
    });
  },

  // Twilio OTP — verify code and return platform JWT (creates user if new)
  verifyOTP: async (phone: string, code: string, role?: string, name?: string, gender?: string) => {
    return apiCall('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code, role, name, gender })
    });
  },

  // Twilio OTP — verify code only, no user creation (for worker registration phone check)
  checkOTP: async (phone: string, code: string) => {
    return apiCall('/auth/check-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code })
    });
  },

  // Worker registration with file uploads (multipart/form-data)
  registerWorker: async (formData: FormData) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/auth/register-worker`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || data.message || 'Worker registration failed');
    }
    return data;
  },

  // Google OAuth login/signup
  googleLogin: async (credential: string) => {
    return apiCall('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential })
    });
  },

  // Update customer location after OAuth signup
  updateLocation: async (locationId: string) => {
    const data = await apiCall('/auth/update-location', {
      method: 'POST',
      body: JSON.stringify({ locationId })
    });

    syncStoredAuthState(data?.user);
    return data;
  }
};

// ====== Public APIs (no authentication required) ======

export const publicAPI = {
  getStats: async () => {
    return apiCall('/public/stats', {}, 10000);
  },

  // Returns all active service cities and their locations — used in signup city picker
  getServiceLocations: async () => {
    return apiCall('/locations/public', {}, 10000);
  }
};

// ====== Services APIs ======

export const servicesAPI = {
  getAll: async (params?: {
    category?: string;
    search?: string;
    latitude?: number;
    longitude?: number;
    apartmentName?: string;
    page?: number;
    limit?: number;
    isActive?: boolean;
    serviceType?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        // Only append if value is not undefined, null, or empty string
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }
    const queryString = queryParams.toString();
    return apiCall(`/services${queryString ? `?${queryString}` : ''}`);
  },

  getById: async (id: string) => {
    return apiCall(`/services/${id}`);
  },

  create: async (serviceData: Record<string, unknown>) => {
    return apiCall('/services', {
      method: 'POST',
      body: JSON.stringify(serviceData)
    });
  },

  update: async (id: string, serviceData: Record<string, unknown>) => {
    return apiCall(`/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(serviceData)
    });
  },

  requestPriceChange: async (id: string, serviceData: Record<string, unknown>) => {
    return apiCall(`/services/${id}/price-change-request`, {
      method: 'POST',
      body: JSON.stringify(serviceData)
    });
  },

  delete: async (id: string) => {
    return apiCall(`/services/${id}`, {
      method: 'DELETE'
    });
  }
};

// ====== Bookings APIs ======

export const bookingsAPI = {
  getAll: async (params?: { status?: string; page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    const queryString = queryParams.toString();
    return apiCall(`/bookings${queryString ? `?${queryString}` : ''}`);
  },

  getById: async (id: string) => {
    return apiCall(`/bookings/${id}`);
  },

  create: async (bookingData: Record<string, unknown>) => {
    return apiCall('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData)
    });
  },

  update: async (id: string, bookingData: Record<string, unknown>) => {
    return apiCall(`/bookings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(bookingData)
    });
  },

  cancel: async (id: string, reason?: string) => {
    return apiCall(`/bookings/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    });
  },

  reschedule: async (id: string, newDate: string, newTime: string) => {
    return apiCall(`/bookings/${id}/reschedule`, {
      method: 'PUT',
      body: JSON.stringify({ newDate, newTime })
    });
  },

  retryAssignment: async (id: string) => {
    return apiCall(`/bookings/${id}/retry-assignment`, {
      method: 'POST'
    });
  },

  getUpcoming: async () => {
    return apiCall('/bookings?status=confirmed,pending');
  },

  getOngoing: async () => {
    return apiCall('/bookings?status=in-progress');
  },

  getPast: async () => {
    return apiCall('/bookings?status=completed,cancelled');
  },

  getBookedSlots: async (
    date: string,
    location?: { lng: number; lat: number } | null,
    options?: { gender?: string; service?: string }
  ) => {
    let url = `/bookings/booked-slots?date=${date}`;
    if (location?.lng && location?.lat && !isNaN(location.lng) && !isNaN(location.lat)) {
      url += `&lng=${location.lng}&lat=${location.lat}`;
    }
    if (options?.gender && options.gender !== 'any') url += `&gender=${options.gender}`;
    if (options?.service) url += `&service=${options.service}`;
    return apiCall(url);
  },

  generateStartQR: async (id: string, jobDescriptionAcknowledged: boolean = true) => {
    return apiCall(`/bookings/${id}/generate-start-qr`, {
      method: 'POST',
      body: JSON.stringify({ jobDescriptionAcknowledged })
    });
  },

  scanStartQR: async (id: string, qrCode: string, termsAccepted: boolean) => {
    return apiCall(`/bookings/${id}/scan-start-qr`, {
      method: 'POST',
      body: JSON.stringify({ qrCode, termsAccepted })
    });
  },

  generateEndQR: async (id: string) => {
    return apiCall(`/bookings/${id}/generate-end-qr`, {
      method: 'POST'
    });
  },

  scanEndQR: async (id: string, qrCode: string) => {
    return apiCall(`/bookings/${id}/scan-end-qr`, {
      method: 'POST',
      body: JSON.stringify({ qrCode })
    });
  },

  uploadCompletionPhoto: async (id: string, file: File) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('completionPhoto', file);

    const response = await fetch(`${API_BASE_URL}/bookings/${id}/upload-completion-photo`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` })
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to upload photo');
    }

    return data;
  },

  addCompletionPhoto: async (id: string, file: File) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('photo', file);

    const response = await fetch(`${API_BASE_URL}/bookings/${id}/add-completion-photo`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` })
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to add completion photo');
    }

    return data;
  },

  uploadArrivalPhoto: async (id: string, file: File) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('arrivalPhoto', file);
    const response = await fetch(`${API_BASE_URL}/bookings/${id}/upload-arrival-photo`, {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Failed to upload arrival photo');
    return data;
  },

  uploadPaymentProof: async (id: string, file: File, transactionId?: string, transactionTime?: string) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('paymentProof', file);
    if (transactionId) {
      formData.append('transactionId', transactionId);
    }
    formData.append('transactionTime', transactionTime || new Date().toISOString());

    const response = await fetch(`${API_BASE_URL}/bookings/${id}/upload-payment-proof`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` })
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to upload payment proof');
    }

    return data;
  },

  adminApproveBooking: async (id: string) => {
    return apiCall(`/bookings/${id}/admin-approve`, { method: 'POST' });
  },

  initChecklist: (id: string, items: string[]) =>
    apiCall(`/bookings/${id}/checklist`, { method: 'PATCH', body: JSON.stringify({ items }) }),

  toggleChecklistItem: (id: string, itemId: string) =>
    apiCall(`/bookings/${id}/checklist/${itemId}/toggle`, { method: 'PATCH' }),

  getCompletionPhotoUrl: (photoPath: string) => {
    if (!photoPath) return '';
    // Remove /api/ from API_BASE_URL if present and remove /uploads prefix from photoPath if it starts with it
    const baseUrl = API_BASE_URL.replace('/api', '');
    return `${baseUrl}${photoPath}`;
  },

  addSupportStaff: (bookingId: string, workerId: string) =>
    apiCall(`/bookings/${bookingId}/support-staff`, {
      method: 'POST',
      body: JSON.stringify({ workerId })
    }),

  removeSupportStaff: (bookingId: string, workerId: string) =>
    apiCall(`/bookings/${bookingId}/support-staff/${workerId}`, { method: 'DELETE' }),

  setTeamHead: (bookingId: string, workerId: string) =>
    apiCall(`/bookings/${bookingId}/team-head`, {
      method: 'PATCH',
      body: JSON.stringify({ workerId })
    }),

  requestBreak: (bookingId: string, reason?: string) =>
    apiCall(`/bookings/${bookingId}/break-request`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),

  approveBreak: (bookingId: string, breakId: string) =>
    apiCall(`/bookings/${bookingId}/break-approve/${breakId}`, { method: 'PATCH' }),

  resumeFromBreak: (bookingId: string, breakId: string) =>
    apiCall(`/bookings/${bookingId}/break-resume/${breakId}`, { method: 'PATCH' }),

  rejectBreak: (bookingId: string, breakId: string) =>
    apiCall(`/bookings/${bookingId}/break-reject/${breakId}`, { method: 'PATCH' }),

  updateWorkforce: (bookingId: string, data: { workerCount?: number }) =>
    apiCall(`/bookings/${bookingId}/workforce`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
};

// ====== Locations APIs ======

export const locationsAPI = {
  getAllLocations: async () => {
    return apiCall('/locations');
  },

  createLocation: async (locationData: Record<string, unknown>) => {
    return apiCall('/locations', {
      method: 'POST',
      body: JSON.stringify(locationData)
    });
  },

  updateLocation: async (id: string, locationData: Record<string, unknown>) => {
    return apiCall(`/locations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(locationData)
    });
  },

  deleteLocation: async (id: string) => {
    return apiCall(`/locations/${id}`, {
      method: 'DELETE'
    });
  },

  checkAvailability: async (data: {
    serviceId: string;
    longitude: number;
    latitude: number;
    apartmentName?: string;
  }) => {
    return apiCall('/locations/check-availability', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getNearbyWorkers: async (data: {
    longitude: number;
    latitude: number;
    maxDistance?: number;
    specializations?: string[];
  }) => {
    return apiCall('/locations/nearby-workers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getNearby: async (data: {
    longitude: number;
    latitude: number;
    maxDistance?: number;
  }) => {
    return apiCall('/locations/nearby', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  geocode: async (address: string | Record<string, unknown>) => {
    return apiCall('/locations/geocode', {
      method: 'POST',
      body: JSON.stringify({ address })
    });
  },

  reverseGeocode: async (latitude: number, longitude: number) => {
    return apiCall('/locations/reverse-geocode', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude })
    });
  },

  assignWorker: async (locationId: string, workerId: string) => {
    return apiCall(`/locations/${locationId}/assign-worker`, {
      method: 'POST',
      body: JSON.stringify({ workerId })
    });
  },

  getPaymentQR: async (locationId: string) => {
    return apiCall(`/locations/${locationId}/payment-qr`);
  },

  updatePaymentQR: async (locationId: string, qrData: {
    upiId?: string;
    upiName?: string;
    qrCodeImage?: string;
    accountNumber?: string;
    ifscCode?: string;
    phoneNumber?: string;
  }) => {
    return apiCall(`/locations/${locationId}/payment-qr`, {
      method: 'PUT',
      body: JSON.stringify(qrData)
    });
  },

  deletePaymentQR: async (locationId: string) => {
    return apiCall(`/locations/${locationId}/payment-qr`, {
      method: 'DELETE'
    });
  }
};

// ====== Service Area APIs ======

export const serviceAreasAPI = {
  validate: async (latitude: number, longitude: number) => {
    return apiCall('/service-areas/validate', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude })
    });
  },

  getAll: async (city?: string) => {
    const params = new URLSearchParams();
    if (city) params.append('city', city);
    return apiCall(`/service-areas${params.toString() ? `?${params.toString()}` : ''}`);
  },

  notify: async (latitude: number, longitude: number, email: string) => {
    return apiCall('/service-areas/notify', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, email })
    });
  },

  requestUnavailableService: async (requestData: {
    serviceId: string;
    latitude: number;
    longitude: number;
    address?: string;
    area?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    serviceAreaId?: string;
  }) => {
    return apiCall('/service-areas/requests', {
      method: 'POST',
      body: JSON.stringify(requestData)
    });
  },

  getRequestAnalytics: async (params?: {
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    from?: string;
    to?: string;
    serviceId?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }

    const queryString = queryParams.toString();
    return apiCall(`/service-areas/requests/analytics${queryString ? `?${queryString}` : ''}`);
  }
};

// ====== Users APIs ======

export const usersAPI = {
  getAll: async (role?: string) => {
    return apiCall(`/users${role ? `?role=${role}` : ''}`);
  },

  getById: async (id: string) => {
    return apiCall(`/users/${id}`);
  },

  update: async (id: string, userData: Record<string, unknown>) => {
    return apiCall(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(userData)
    });
  },

  updatePreferences: async (preferences: Record<string, unknown>) => {
    return apiCall('/users/preferences', {
      method: 'PATCH',
      body: JSON.stringify(preferences)
    });
  },

  addAddress: async (address: Record<string, unknown>) => {
    return apiCall('/users/addresses', {
      method: 'POST',
      body: JSON.stringify(address)
    });
  },

  updateAddress: async (addressId: string, address: Record<string, unknown>) => {
    return apiCall(`/users/addresses/${addressId}`, {
      method: 'PATCH',
      body: JSON.stringify(address)
    });
  },

  deleteAddress: async (addressId: string) => {
    return apiCall(`/users/addresses/${addressId}`, {
      method: 'DELETE'
    });
  },

  setDefaultAddress: async (addressId: string) => {
    return apiCall(`/users/addresses/${addressId}/set-default`, {
      method: 'POST'
    });
  },

  getStats: async () => {
    return apiCall('/users/stats');
  },

  getAvailableWorkers: async (specialization?: string, minRating?: number) => {
    const params = new URLSearchParams();
    if (specialization) params.append('specialization', specialization);
    if (minRating) params.append('minRating', minRating.toString());
    const queryString = params.toString();
    return apiCall(`/users/workers/available${queryString ? `?${queryString}` : ''}`);
  }
};

// ====== QR Payments APIs ======

export const qrPaymentsAPI = {
  generate: async (bookingId: string) => {
    return apiCall('/qr-payments/generate', {
      method: 'POST',
      body: JSON.stringify({ bookingId })
    });
  },

  workerConfirm: async (paymentId: string, transactionId: string, screenshot: string) => {
    return apiCall(`/qr-payments/${paymentId}/worker-confirm`, {
      method: 'POST',
      body: JSON.stringify({ transactionId, transactionScreenshot: screenshot })
    });
  },

  adminVerify: async (paymentId: string, verified: boolean, notes?: string) => {
    return apiCall(`/qr-payments/${paymentId}/admin-verify`, {
      method: 'POST',
      body: JSON.stringify({ verified, notes })
    });
  },

  getAll: async (status?: string) => {
    return apiCall(`/qr-payments${status ? `?status=${status}` : ''}`);
  },

  getById: async (id: string) => {
    return apiCall(`/qr-payments/${id}`);
  },

  getPendingWorkerActions: async () => {
    return apiCall('/qr-payments/pending/worker-action');
  }
};

// ====== Workers APIs ======

export const workersAPI = {
  getAll: async () => {
    return usersAPI.getAll('worker');
  },

  getById: async (id: string) => {
    return usersAPI.getById(id);
  },

  updateAvailability: async (available: boolean) => {
    return apiCall('/users/toggle-availability', {
      method: 'PUT',
      body: JSON.stringify({ availability: available })
    });
  },

  getEarnings: async (startDate?: string, endDate?: string, page?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    return apiCall(`/users/worker/earnings${params.toString() ? `?${params.toString()}` : ''}`);
  },

  getDashboardStats: async () => {
    return apiCall('/users/worker/dashboard-stats');
  },

  getDocuments: async () => {
    return apiCall('/users/worker/documents');
  },

  getCurrentTask: async () => {
    return apiCall('/users/worker/current-task');
  },

  getUpcomingTasks: async (limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    return apiCall(`/users/worker/upcoming-tasks${params.toString() ? `?${params.toString()}` : ''}`);
  }
};

// ====== Admin APIs ======

export const adminAPI = {
  // Dashboard
  getDashboardStats: async (locationId?: string) => {
    const params = locationId ? `?locationId=${locationId}` : '';
    return apiCall(`/admin/dashboard-stats${params}`);
  },

  getProfitStats: async (from?: string, to?: string, locationId?: string) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (locationId) params.append('locationId', locationId);
    return apiCall(`/admin/profit-stats${params.toString() ? `?${params.toString()}` : ''}`);
  },

  getRecentBookings: async (limit?: number, locationId?: string) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (locationId) params.append('locationId', locationId);
    return apiCall(`/admin/recent-bookings${params.toString() ? `?${params.toString()}` : ''}`);
  },

  getAlerts: async () => {
    return apiCall('/admin/alerts');
  },

  getLocationOverview: async () => {
    return apiCall('/admin/location-overview');
  },

  // Location Management (Super Admin)
  createLocation: async (locationData: {
    apartmentName: string;
    building?: string;
    area: string;
    city: string;
    state?: string;
    zipCode?: string;
    coordinates: number[];
    maxServiceRadius?: number;
  }) => {
    return apiCall('/admin/locations', {
      method: 'POST',
      body: JSON.stringify(locationData)
    });
  },

  getLocations: async () => {
    return apiCall('/admin/locations');
  },

  updateLocation: async (locationId: string, locationData: {
    apartmentName?: string;
    building?: string;
    area?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    coordinates?: number[];
    maxServiceRadius?: number;
    isServiceAvailable?: boolean;
  }) => {
    return apiCall(`/admin/locations/${locationId}`, {
      method: 'PATCH',
      body: JSON.stringify(locationData)
    });
  },

  deleteLocation: async (locationId: string) => {
    return apiCall(`/admin/locations/${locationId}`, {
      method: 'DELETE'
    });
  },

  // Admin Management (Super Admin)
  getAdmins: async (city?: string) => {
    const params = new URLSearchParams();
    if (city) params.append('city', city);
    return apiCall(`/admin/admins${params.toString() ? `?${params.toString()}` : ''}`);
  },

  createAdmin: async (adminData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    city: string;
    assignedLocationIds: string[];
    idDocument?: File | null;
    idDocumentType?: string;
  }) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('name', adminData.name);
    formData.append('email', adminData.email);
    formData.append('password', adminData.password);
    if (adminData.phone) formData.append('phone', adminData.phone);
    if (adminData.city) formData.append('city', adminData.city);
    if (adminData.assignedLocationIds) {
      adminData.assignedLocationIds.forEach(id => formData.append('assignedLocationIds', id));
    }
    if (adminData.idDocument) formData.append('idDocument', adminData.idDocument);
    if (adminData.idDocumentType) formData.append('idDocumentType', adminData.idDocumentType);

    const response = await fetch(`${API_BASE_URL}/admin/create-admin`, {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || data.message || 'Failed to create admin');
    return data;
  },

  updateAdmin: async (adminId: string, adminData: {
    name?: string;
    phone?: string;
    email?: string;
    assignedLocationIds?: string[];
    permissions?: {
      canCreateWorkers?: boolean;
      canDeleteWorkers?: boolean;
      canManageApartments?: boolean;
      canViewReports?: boolean;
    };
  }) => {
    return apiCall(`/admin/admins/${adminId}`, {
      method: 'PATCH',
      body: JSON.stringify(adminData)
    });
  },

  deleteAdmin: async (adminId: string) => {
    return apiCall(`/admin/admins/${adminId}`, {
      method: 'DELETE'
    });
  },

  // Worker Management
  createWorker: async (formData: FormData) => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/admin/workers`, {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || data.message || 'Failed to create worker');
    return data;
  },

  getWorkers: async (locationId?: string) => {
    return apiCall(locationId ? `/admin/workers?locationId=${locationId}` : '/admin/workers');
  },

  archiveWorker: async (workerId: string, resignedDate?: string) => {
    return apiCall(`/admin/workers/${workerId}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ resignedDate })
    });
  },

  unarchiveWorker: async (workerId: string) => {
    return apiCall(`/admin/workers/${workerId}/unarchive`, {
      method: 'PATCH'
    });
  },

  updateWorkerDocuments: async (workerId: string, formData: FormData) => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/admin/workers/${workerId}/documents`, {
      method: 'PATCH',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || data.message || 'Failed to update worker documents');
    return data;
  },

  getWorkerDetails: async (workerId: string) => {
    return apiCall(`/admin/workers/${workerId}`);
  },

  resetWorkerPassword: async (workerId: string, credentialDelivery?: 'email' | 'phone' | 'both') => {
    return apiCall(`/admin/workers/${workerId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ credentialDelivery })
    });
  },

  updateWorker: async (workerId: string, formData: FormData) => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/admin/workers/${workerId}`, {
      method: 'PUT',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || data.message || 'Failed to update worker');
    return data;
  },

  // Worker approval requests
  getPendingWorkers: async () => {
    return apiCall('/admin/worker-requests');
  },

  approveWorker: async (workerId: string, approvalData: {
    hourlyRate: number;
  }) => {
    return apiCall(`/admin/worker-requests/${workerId}/approve`, {
      method: 'POST',
      body: JSON.stringify(approvalData)
    });
  },

  rejectWorker: async (workerId: string, reason?: string) => {
    return apiCall(`/admin/worker-requests/${workerId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  assignWorkerToLocation: async (workerId: string, locationId: string, apartmentId: string) => {
    return apiCall(`/admin/workers/${workerId}/assign-location`, {
      method: 'PATCH',
      body: JSON.stringify({ locationId, apartmentId })
    });
  },

  // Workforce Management
  getWorkforceStatus: async () => {
    return apiCall('/admin/workforce-status');
  },

  getAvailableWorkersForBooking: async (bookingId: string) => {
    return apiCall(`/admin/bookings/${bookingId}/available-workers`);
  },

  manualAssign: async (bookingId: string, workerId: string, reason?: string) => {
    return apiCall('/admin/manual-assign', {
      method: 'POST',
      body: JSON.stringify({ bookingId, workerId, reason })
    });
  },

  // Customer Management
  getCustomers: async (params?: {
    search?: string;
    city?: string;
    page?: number;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }
    const queryString = queryParams.toString();
    return apiCall(`/admin/customers${queryString ? `?${queryString}` : ''}`);
  },

  getCustomerDetails: async (customerId: string) => {
    return apiCall(`/admin/customers/${customerId}`);
  }
};

// ====== Settings APIs ======

export const settingsAPI = {
  getSettings: async () => {
    return apiCall('/settings');
  },

  getAdminSettings: async () => {
    return apiCall('/settings/admin');
  },

  // Public endpoint — works for every role
  getBusinessHours: async () => {
    return apiCall('/settings/business-hours');
  },

  // Public slot preview for selected date (YYYY-MM-DD)
  getAvailableSlotsByDate: async (date: string) => {
    return apiCall(`/settings/business-hours/available-slots?date=${encodeURIComponent(date)}`);
  },

  updateSettings: async (settings: {
    payment?: {
      upiId?: string;
      upiName?: string;
      qrCodeImage?: string | null;
    };
    company?: {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      defaultState?: string;
    };
    booking?: {
      overtimeRate?: number;
      cancellationHours?: number;
      serviceRadius?: number;
    };
    earnings?: {
      platformCommissionRate?: number;
      bookingConvenienceFee?: number;
      minPayoutAmount?: number;
      payoutSchedule?: string;
      instantPayoutFee?: number;
      payoutDay?: number;
      autoPayoutEnabled?: boolean;
    };
    subscriptions?: {
      workerPlans?: {
        basic?: { price?: number; commissionRate?: number };
        pro?: { price?: number; commissionRate?: number };
        premium?: { price?: number; commissionRate?: number };
      };
      customerPlans?: {
        basic?: { price?: number; discountRate?: number };
        premium?: { price?: number; discountRate?: number };
      };
    };
    cancellationPolicy?: {
      fullRefundHours?: number;
      partialRefundPercentage?: number;
      partialRefundHours?: number;
      cancellationCharge?: number;
      noRefundHours?: number;
    };
  }) => {
    return apiCall('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }
};

// ====== Preferences APIs ======

export const preferencesAPI = {
  getPreferences: async () => {
    return apiCall('/preferences');
  },

  updatePreferences: async (preferences: {
    workerGenderPreference?: 'any' | 'male' | 'female';
    preferredWorkerP1?: string;
    preferredWorkerP2?: string;
    preferredWorkerP3?: string;
    languagePreference?: string[];
    religionPreference?: string;
    specialInstructions?: string;
  }) => {
    return apiCall('/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences)
    });
  },

  addException: async (workerId: string, reason?: string) => {
    return apiCall('/preferences/exception', {
      method: 'POST',
      body: JSON.stringify({ workerId, reason })
    });
  },

  removeException: async (workerId: string) => {
    return apiCall(`/preferences/exception/${workerId}`, {
      method: 'DELETE'
    });
  },

  getAvailableWorkers: async (params?: {
    latitude?: number;
    longitude?: number;
    radius?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    const queryString = queryParams.toString();
    return apiCall(`/preferences/available-workers${queryString ? `?${queryString}` : ''}`);
  }
};

// ====== Leaves Management APIs ======

export const leavesAPI = {
  // Apply for leave (Worker)
  applyLeave: async (date: string, reason?: string) => {
    return apiCall('/leaves/apply', {
      method: 'POST',
      body: JSON.stringify({ date, reason })
    });
  },

  // Get my leaves (Worker)
  getMyLeaves: async () => {
    return apiCall('/leaves/my-leaves');
  },

  // Cancel leave request (Worker)
  cancelLeave: async (leaveId: string) => {
    return apiCall(`/leaves/${leaveId}`, {
      method: 'DELETE'
    });
  },

  // Get pending leave requests (Admin)
  getPendingLeaves: async () => {
    return apiCall('/leaves/pending');
  },

  // Get worker's leave history (Admin)
  getWorkerLeaves: async (workerId: string) => {
    return apiCall(`/leaves/worker/${workerId}`);
  },

  // Approve or reject leave (Admin)
  updateLeaveStatus: async (workerId: string, leaveId: string, status: 'approved' | 'rejected') => {
    return apiCall(`/leaves/${workerId}/${leaveId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  // Get leave statistics (Admin)
  getLeaveStatistics: async () => {
    return apiCall('/leaves/statistics');
  },

  // ─── Admin leave self-service ─────────────────────────────────────────

  // Apply for leave as admin (date range)
  applyAdminLeave: async (fromDate: string, toDate: string, reason?: string) => {
    return apiCall('/leaves/admin/apply', {
      method: 'POST',
      body: JSON.stringify({ fromDate, toDate, reason })
    });
  },

  // Get admin's own leave requests
  getAdminMyLeaves: async () => {
    return apiCall('/leaves/admin/my-leaves');
  },

  // Cancel an admin's pending leave
  cancelAdminLeave: async (leaveId: string) => {
    return apiCall(`/leaves/admin/${leaveId}`, {
      method: 'DELETE'
    });
  }
};

// ====== Reviews APIs ======

export const reviewsAPI = {
  // Submit a review for a completed booking
  createReview: async (reviewData: {
    booking: string;
    worker?: string;
    workerIds?: string[];
    overallRating: number;
    categoryRatings: {
      quality: number;
      timeliness: number;
      professionalism: number;
    };
    comment?: string;
    isAnonymous?: boolean;
  }) => {
    return apiCall('/reviews', {
      method: 'POST',
      body: JSON.stringify(reviewData)
    });
  },

  // Get reviews for a specific worker
  getWorkerReviews: async (workerId: string) => {
    return apiCall(`/reviews/worker/${workerId}`);
  }
};

// ====== Super Admin APIs (/api/super-admin/*) ======
// Dedicated endpoints exclusively for the super_admin role.

export const superAdminAPI = {
  // Location overview with aggregate stats
  getOverview: async () => {
    return apiCall('/super-admin/overview');
  },

  // Global or location-filtered dashboard stats
  getStats: async (locationId?: string) => {
    const params = locationId ? `?locationId=${locationId}` : '';
    return apiCall(`/super-admin/stats${params}`);
  },

  // Workers — all (incl. archived). Optional locationId filter.
  getWorkers: async (locationId?: string) => {
    const params = locationId ? `?locationId=${locationId}` : '';
    return apiCall(`/super-admin/workers${params}`);
  },

  createWorker: async (formData: FormData) => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/super-admin/workers`, {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || data.message || 'Failed to create worker');
    return data;
  },

  archiveWorker: async (workerId: string, resignedDate?: string) => {
    return apiCall(`/super-admin/workers/${workerId}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ resignedDate })
    });
  },

  unarchiveWorker: async (workerId: string) => {
    return apiCall(`/super-admin/workers/${workerId}/unarchive`, { method: 'PATCH' });
  },

  // Bookings — all. Optional ?locationId= and ?status= filters.
  getBookings: async (params?: { locationId?: string; status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.locationId) q.append('locationId', params.locationId);
    if (params?.status) q.append('status', params.status);
    if (params?.limit) q.append('limit', String(params.limit));
    return apiCall(`/super-admin/bookings${q.toString() ? `?${q.toString()}` : ''}`);
  },

  // Locations
  getLocations: async () => {
    return apiCall('/super-admin/locations');
  },

  createLocation: async (locationData: {
    apartmentName: string;
    building?: string;
    area: string;
    city: string;
    state?: string;
    zipCode?: string;
    coordinates: number[];
    maxServiceRadius?: number;
  }) => {
    return apiCall('/super-admin/locations', {
      method: 'POST',
      body: JSON.stringify(locationData)
    });
  },

  updateLocation: async (locationId: string, locationData: {
    apartmentName?: string;
    building?: string;
    area?: string;
    city?: string;
    state?: string;
    coordinates?: number[];
    maxServiceRadius?: number;
    isServiceAvailable?: boolean;
  }) => {
    return apiCall(`/super-admin/locations/${locationId}`, {
      method: 'PATCH',
      body: JSON.stringify(locationData)
    });
  },

  deleteLocation: async (locationId: string) => {
    return apiCall(`/super-admin/locations/${locationId}`, { method: 'DELETE' });
  },

  // Admins
  getAdmins: async (city?: string) => {
    const params = city ? `?city=${encodeURIComponent(city)}` : '';
    return apiCall(`/super-admin/admins${params}`);
  },

  createAdmin: async (adminData: {
    name: string;
    email: string;
    password: string;
    phone: string;
    assignedLocationIds?: string[];
  }) => {
    return apiCall('/super-admin/admins', {
      method: 'POST',
      body: JSON.stringify(adminData)
    });
  },

  updateAdmin: async (adminId: string, adminData: {
    name?: string;
    phone?: string;
    assignedLocationIds?: string[];
  }) => {
    return apiCall(`/super-admin/admins/${adminId}`, {
      method: 'PATCH',
      body: JSON.stringify(adminData)
    });
  },

  deleteAdmin: async (adminId: string) => {
    return apiCall(`/super-admin/admins/${adminId}`, { method: 'DELETE' });
  },

  // ─── Admin Leave Approval ─────────────────────────────────────────────

  // Get all admin leave requests. Optional status filter.
  getAdminLeaves: async (status?: string) => {
    const params = status ? `?status=${status}` : '';
    return apiCall(`/super-admin/admin-leaves${params}`);
  },

  // Approve or reject an admin leave
  updateAdminLeaveStatus: async (adminId: string, leaveId: string, status: 'approved' | 'rejected') => {
    return apiCall(`/super-admin/admin-leaves/${adminId}/${leaveId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  // ─── Service Requests ─────────────────────────────────────────────────

  // List service requests from admins. status: 'pending' | 'approved' | 'rejected' | 'all'
  getServiceRequests: async (status?: string) => {
    const q = status ? `?status=${status}` : '';
    return apiCall(`/super-admin/service-requests${q}`);
  },

  // Approve a pending service request (creates the service live)
  approveServiceRequest: async (id: string, note?: string) => {
    return apiCall(`/super-admin/service-requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note: note || '' })
    });
  },

  // Reject a pending service request with an optional reason
  rejectServiceRequest: async (id: string, reason: string) => {
    return apiCall(`/super-admin/service-requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  // ─── Business Hours ───────────────────────────────────────────────────────

  getBusinessHours: async () => {
    return apiCall('/super-admin/business-hours');
  },

  updateBusinessHours: async (data: {
    schedule?: Array<{
      day: string;
      isActive: boolean;
      openTime: string;
      closeTime: string;
      breaks: Array<{ start: string; end: string; label?: string }>;
    }>;
    timezone?: string;
    slotDurationMinutes?: number;
    holidays?: Array<{ date: string; label: string }>;
  }) => {
    return apiCall('/super-admin/business-hours', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  getAvailableSlotsByDate: async (date: string) => {
    return apiCall(`/super-admin/business-hours/available-slots?date=${date}`);
  }
};

// ====== Help / Support APIs ======

export const helpAPI = {
  // Submit a help message (authenticated user)
  submitMessage: async (subject: string, message: string) => {
    return apiCall('/help', {
      method: 'POST',
      body: JSON.stringify({ subject, message })
    });
  },

  // Get own past messages
  getMyMessages: async () => {
    return apiCall('/help/my');
  },

  // Admin: list all messages (with optional status filter)
  adminGetAll: async (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return apiCall(`/help/admin${query}`);
  },

  // Admin: mark as read
  markRead: async (id: string) => {
    return apiCall(`/help/${id}/read`, { method: 'PATCH' });
  },

  // Admin: reply and resolve
  reply: async (id: string, reply: string) => {
    return apiCall(`/help/${id}/reply`, {
      method: 'PATCH',
      body: JSON.stringify({ reply })
    });
  },

  // Admin: delete
  deleteMessage: async (id: string) => {
    return apiCall(`/help/${id}`, { method: 'DELETE' });
  }
};

// ====== Expense Categories API ======
export const expenseCategoriesAPI = {
  getAll: async () => {
    return apiCall('/expense-categories');
  },

  create: async (data: {
    name: string;
    icon?: string;
    color?: string;
  }) => {
    return apiCall('/expense-categories', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  update: async (id: string, data: {
    name?: string;
    icon?: string;
    color?: string;
    isActive?: boolean;
  }) => {
    return apiCall(`/expense-categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  delete: async (id: string) => {
    return apiCall(`/expense-categories/${id}`, { method: 'DELETE' });
  }
};

// ====== Business Expenses API ======
export const businessExpensesAPI = {
  create: async (data: FormData | {
    title: string;
    amount: number;
    category: string;
    customCategory?: string;
    description?: string;
    date: string;
    locationId?: string;
    bookingId?: string;
    type?: string;
  }) => {
    if (data instanceof FormData) {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/business-expenses`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: data
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || result.message || 'Failed to create expense');
      }
      return result;
    }

    return apiCall('/business-expenses', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getAll: async (params?: {
    locationId?: string;
    category?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    bookingId?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.locationId) q.append('locationId', params.locationId);
    if (params?.category) q.append('category', params.category);
    if (params?.from) q.append('from', params.from);
    if (params?.to) q.append('to', params.to);
    if (params?.page) q.append('page', String(params.page));
    if (params?.limit) q.append('limit', String(params.limit));
    if (params?.bookingId) q.append('bookingId', params.bookingId);
    return apiCall(`/business-expenses${q.toString() ? `?${q.toString()}` : ''}`);
  },

  update: async (id: string, data: FormData | Record<string, unknown>) => {
    if (data instanceof FormData) {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/business-expenses/${id}`, {
        method: 'PATCH',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: data
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || result.message || 'Failed to update expense');
      }
      return result;
    }

    return apiCall(`/business-expenses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  delete: async (id: string) => {
    return apiCall(`/business-expenses/${id}`, { method: 'DELETE' });
  }
};

// ====== Location Requests API ======
export const locationRequestsAPI = {
  create: async (data: {
    apartmentName: string;
    building?: string;
    area: string;
    city: string;
    state: string;
    zipCode?: string;
    reason?: string;
  }) => {
    return apiCall('/location-requests', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getAll: async (status?: string) => {
    return apiCall(status ? `/location-requests?status=${status}` : '/location-requests');
  },

  review: async (id: string, status: 'approved' | 'rejected', reviewNote?: string, coordinates?: [number, number]) => {
    return apiCall(`/location-requests/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reviewNote, coordinates })
    });
  }
};

// ====== Reliability Score APIs ======
export const reliabilityAPI = {
  // Get reliability score and history for a specific worker
  getWorkerScore: async (workerId: string) => {
    return apiCall(`/reliability/worker/${workerId}`);
  },

  // Get reliability dashboard statistics (admin only)
  getDashboard: async () => {
    return apiCall('/reliability/dashboard');
  },

  // Get monthly reliability score trends
  getTrends: async (months?: number) => {
    const params = months ? `?months=${months}` : '';
    return apiCall(`/reliability/trends${params}`);
  },

  // Get bulk reliability scores for multiple workers
  getBulkScores: async (workerIds: string[]) => {
    return apiCall('/reliability/bulk', {
      method: 'POST',
      body: JSON.stringify({ workerIds })
    });
  },

  // Manually recalculate reliability scores (super admin only)
  recalculate: async () => {
    return apiCall('/reliability/recalculate', {
      method: 'POST'
    });
  }
};

// ====== Review Analytics APIs ======
export const reviewAnalyticsAPI = {
  // Get complete analytics for a worker (weekly, monthly, trends)
  getWorkerAnalytics: async (workerId: string) => {
    return apiCall(`/reviews/worker/${workerId}/analytics`);
  },

  // Get rating trends for a worker (30-day comparison)
  getWorkerTrends: async (workerId: string) => {
    return apiCall(`/reviews/worker/${workerId}/trends`);
  },

  // Get admin dashboard review analytics
  getDashboard: async () => {
    return apiCall('/reviews/analytics/dashboard');
  }
};

// ====== Generic API wrapper (axios-like convenience object) ======
// Used by pages that call api.get(), api.patch(), etc. directly.
export const api = {
  baseURL: API_BASE_URL,
  get: (endpoint: string) => apiCall(endpoint),
  post: (endpoint: string, data?: Record<string, unknown>) =>
    apiCall(endpoint, { method: 'POST', ...(data !== undefined && { body: JSON.stringify(data) }) }),
  patch: (endpoint: string, data?: Record<string, unknown>) =>
    apiCall(endpoint, { method: 'PATCH', ...(data !== undefined && { body: JSON.stringify(data) }) }),
  put: (endpoint: string, data?: Record<string, unknown>) =>
    apiCall(endpoint, { method: 'PUT', ...(data !== undefined && { body: JSON.stringify(data) }) }),
  delete: (endpoint: string) => apiCall(endpoint, { method: 'DELETE' })
};

// Export all
export const dashboardPreferencesAPI = {
  getServices: async () => {
    return apiCall('/dashboard-preferences');
  },

  getAdminConfig: async () => {
    return apiCall('/dashboard-preferences/admin');
  },

  updateConfig: async (services: any[], maxServices?: number) => {
    return apiCall('/dashboard-preferences', {
      method: 'PUT',
      body: JSON.stringify({ services, maxServices })
    });
  },

  toggleService: async (serviceId: string) => {
    return apiCall(`/dashboard-preferences/services/${serviceId}/toggle`, {
      method: 'PATCH'
    });
  },

  reorderServices: async (serviceIds: string[]) => {
    return apiCall('/dashboard-preferences/reorder', {
      method: 'PUT',
      body: JSON.stringify({ serviceIds })
    });
  }
};

export default {
  auth: authAPI,
  services: servicesAPI,
  bookings: bookingsAPI,
  locations: locationsAPI,
  users: usersAPI,
  qrPayments: qrPaymentsAPI,
  workers: workersAPI,
  admin: adminAPI,
  superAdmin: superAdminAPI,
  settings: settingsAPI,
  preferences: preferencesAPI,
  leaves: leavesAPI,
  reviews: reviewsAPI,
  reliability: reliabilityAPI,
  reviewAnalytics: reviewAnalyticsAPI,
  dashboardPreferences: dashboardPreferencesAPI
};

