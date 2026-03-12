/**
 * API Service for Pure App Weave
 * Centralized API calls to backend
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
    return apiCall('/auth/me');
  },

  updateProfile: async (userData: Record<string, unknown>) => {
    return apiCall('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(userData)
    });
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

  getUpcoming: async () => {
    return apiCall('/bookings?status=confirmed,pending');
  },

  getOngoing: async () => {
    return apiCall('/bookings?status=in-progress');
  },

  getPast: async () => {
    return apiCall('/bookings?status=completed,cancelled');
  },

  getBookedSlots: async (date: string) => {
    return apiCall(`/bookings/booked-slots?date=${date}`);
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

  getCompletionPhotoUrl: (photoPath: string) => {
    if (!photoPath) return '';
    // Remove /api/ from API_BASE_URL if present and remove /uploads prefix from photoPath if it starts with it
    const baseUrl = API_BASE_URL.replace('/api', '');
    return `${baseUrl}${photoPath}`;
  }
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

  archiveWorker: async (workerId: string) => {
    return apiCall(`/admin/workers/${workerId}/archive`, {
      method: 'PATCH'
    });
  },

  unarchiveWorker: async (workerId: string) => {
    return apiCall(`/admin/workers/${workerId}/unarchive`, {
      method: 'PATCH'
    });
  },

  // Worker approval requests
  getPendingWorkers: async () => {
    return apiCall('/admin/worker-requests');
  },

  approveWorker: async (workerId: string) => {
    return apiCall(`/admin/worker-requests/${workerId}/approve`, { method: 'POST' });
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

  manualAssign: async (bookingId: string, workerId: string) => {
    return apiCall('/admin/manual-assign', {
      method: 'POST',
      body: JSON.stringify({ bookingId, workerId })
    });
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
    worker: string;
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

  archiveWorker: async (workerId: string) => {
    return apiCall(`/super-admin/workers/${workerId}/archive`, { method: 'PATCH' });
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

// ====== Generic API wrapper (axios-like convenience object) ======
// Used by pages that call api.get(), api.patch(), etc. directly.
export const api = {
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
  reviews: reviewsAPI
};

