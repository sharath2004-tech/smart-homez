/**
 * API Service for Pure App Weave
 * Centralized API calls to backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
async function apiCall(endpoint: string, options:RequestInit = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...getHeaders(),
        ...options.headers
      }
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle validation errors array
      if (data.errors && Array.isArray(data.errors)) {
        const errorMessages = data.errors.map((err: any) => err.msg).join(', ');
        throw new Error(errorMessages || 'Validation failed');
      }
      throw new Error(data.message || data.error?.message || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
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

  register: async (userData: any) => {
    return apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  getProfile: async () => {
    return apiCall('/auth/me');
  },

  updateProfile: async (userData: any) => {
    return apiCall('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(userData)
    });
  },

  updatePreferences: async (preferences: any) => {
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

  create: async (serviceData: any) => {
    return apiCall('/services', {
      method: 'POST',
      body: JSON.stringify(serviceData)
    });
  },

  update: async (id: string, serviceData: any) => {
    return apiCall(`/services/${id}`, {
      method: 'PATCH',
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

  create: async (bookingData: any) => {
    return apiCall('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData)
    });
  },

  update: async (id: string, bookingData: any) => {
    return apiCall(`/bookings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(bookingData)
    });
  },

  cancel: async (id: string, reason?: string) => {
    return apiCall(`/bookings/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
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
  }
};

// ====== Locations APIs ======

export const locationsAPI = {
  getAllLocations: async () => {
    return apiCall('/locations');
  },

  createLocation: async (locationData: any) => {
    return apiCall('/locations', {
      method: 'POST',
      body: JSON.stringify(locationData)
    });
  },

  updateLocation: async (id: string, locationData: any) => {
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

  geocode: async (address: any) => {
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

  update: async (id: string, userData: any) => {
    return apiCall(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(userData)
    });
  },

  updatePreferences: async (preferences: any) => {
    return apiCall('/users/preferences', {
      method: 'PATCH',
      body: JSON.stringify(preferences)
    });
  },

  addAddress: async (address: any) => {
    return apiCall('/users/addresses', {
      method: 'POST',
      body: JSON.stringify(address)
    });
  },

  updateAddress: async (addressId: string, address: any) => {
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
      body: JSON.stringify({ transactionId, screenshot })
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
    return apiCall('/users/worker/availability', {
      method: 'PATCH',
      body: JSON.stringify({ available })
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
  getDashboardStats: async () => {
    return apiCall('/admin/dashboard-stats');
  },

  getRecentBookings: async (limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    return apiCall(`/admin/recent-bookings${params.toString() ? `?${params.toString()}` : ''}`);
  },

  getAlerts: async () => {
    return apiCall('/admin/alerts');
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
  }) => {
    return apiCall('/admin/create-admin', {
      method: 'POST',
      body: JSON.stringify(adminData)
    });
  },

  // Worker Management
  createWorker: async (workerData: {
    name: string;
    email: string;
    password?: string;
    phone?: string;
    gender?: string;
    religion?: string;
    experience?: number;
    specialization: string[];
    assignedApartmentIds: string[];
  }) => {
    return apiCall('/admin/workers', {
      method: 'POST',
      body: JSON.stringify(workerData)
    });
  },

  getWorkers: async () => {
    return apiCall('/admin/workers');
  },

  deleteWorker: async (workerId: string) => {
    return apiCall(`/admin/workers/${workerId}`, {
      method: 'DELETE'
    });
  },

  assignWorkerToLocation: async (workerId: string, locationId: string, apartmentId: string) => {
    return apiCall(`/admin/workers/${workerId}/assign-location`, {
      method: 'PATCH',
      body: JSON.stringify({ locationId, apartmentId })
    });
  }
};

// Export all
export default {
  auth: authAPI,
  services: servicesAPI,
  bookings: bookingsAPI,
  locations: locationsAPI,
  users: usersAPI,
  qrPayments: qrPaymentsAPI,
  workers: workersAPI,
  admin: adminAPI
};
