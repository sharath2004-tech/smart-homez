/* eslint-disable no-console */
import 'dotenv/config';

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import mongoose from 'mongoose';

import Booking from '../models/Booking.js';
import { scheduleRecurringBookings } from '../utils/bookingStatusUpdater.js';
import { checkSubscriptionRenewals } from '../utils/subscriptionRenewalChecker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

const PNG_1X1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P8//8/AwAI/AL+X4W2NwAAAABJRU5ErkJggg==';
const SAMPLE_IMAGE_BUFFER = Buffer.from(PNG_1X1_BASE64, 'base64');
const ACCEPTABLE_LATENCY_MS = Number(process.env.SYSTEM_TEST_ACCEPTABLE_LATENCY_MS || 5000);
const EVENTUAL_CONSISTENCY_TIMEOUT_MS = Number(process.env.SYSTEM_TEST_EVENTUAL_CONSISTENCY_TIMEOUT_MS || 15000);
const EVENTUAL_CONSISTENCY_POLL_MS = Number(process.env.SYSTEM_TEST_EVENTUAL_CONSISTENCY_POLL_MS || 1500);
const SYSTEM_TEST_API_URL = (process.env.SYSTEM_TEST_API_URL || process.env.API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const OUTPUT_DIR = path.resolve(backendRoot, process.env.SYSTEM_TEST_OUTPUT_DIR || 'test-results/system-suite');
const MAX_SERVICES = Number(process.env.SYSTEM_TEST_MAX_SERVICES || 0);
const ENABLE_DB_ASSIST = Boolean(process.env.MONGODB_URI);

const managedWorkersFromEnv = (() => {
  const raw = process.env.SYSTEM_TEST_WORKERS_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to parse SYSTEM_TEST_WORKERS_JSON:', error.message);
    return [];
  }
})();

const CONFIG = {
  apiUrl: SYSTEM_TEST_API_URL,
  admin: {
    email: process.env.SYSTEM_TEST_ADMIN_EMAIL || process.env.TEST_ADMIN_EMAIL || '',
    password: process.env.SYSTEM_TEST_ADMIN_PASSWORD || process.env.TEST_ADMIN_PASSWORD || '',
  },
  superAdmin: {
    email: process.env.SYSTEM_TEST_SUPER_ADMIN_EMAIL || '',
    password: process.env.SYSTEM_TEST_SUPER_ADMIN_PASSWORD || '',
  },
  workers: managedWorkersFromEnv.length > 0
    ? managedWorkersFromEnv
    : [
        process.env.SYSTEM_TEST_WORKER_EMAIL && process.env.SYSTEM_TEST_WORKER_PASSWORD
          ? {
              email: process.env.SYSTEM_TEST_WORKER_EMAIL,
              password: process.env.SYSTEM_TEST_WORKER_PASSWORD,
            }
          : null,
        process.env.SYSTEM_TEST_WORKER_2_EMAIL && process.env.SYSTEM_TEST_WORKER_2_PASSWORD
          ? {
              email: process.env.SYSTEM_TEST_WORKER_2_EMAIL,
              password: process.env.SYSTEM_TEST_WORKER_2_PASSWORD,
            }
          : null,
      ].filter(Boolean),
  location: {
    coordinates: process.env.SYSTEM_TEST_LOCATION_COORDINATES || '',
    apartmentName: process.env.SYSTEM_TEST_LOCATION_APARTMENT || 'System Test Apartment',
    address: process.env.SYSTEM_TEST_LOCATION_ADDRESS || '123 System Test Street',
    area: process.env.SYSTEM_TEST_LOCATION_AREA || 'System Test Area',
    city: process.env.SYSTEM_TEST_LOCATION_CITY || 'System Test City',
    state: process.env.SYSTEM_TEST_LOCATION_STATE || 'System Test State',
    zipCode: process.env.SYSTEM_TEST_LOCATION_ZIP || '560001',
  },
};

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const REQUIRED_SELECTED_DAY_COUNT_BY_FREQUENCY = {
  weekly: 1,
  '3-days': 3,
  'alt-days': 3,
};
const PREFERRED_SUBSCRIPTION_FREQUENCIES = ['weekly', '3-days', 'alt-days', 'daily', 'monthly', 'biweekly'];

const summary = {
  startedAt: new Date().toISOString(),
  totalTestsRun: 0,
  passCount: 0,
  failCount: 0,
  criticalFailures: [],
  performanceIssues: [],
  suggestedFixes: [],
};

const allReports = [];
const cleanupTasks = [];

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function toDateOnly(value) {
  const date = new Date(value);
  return date.toISOString().slice(0, 10);
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function timeStringToMinutes(value) {
  if (!value || typeof value !== 'string') return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
}

function minutesToTimeString(value) {
  const normalized = ((value % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function addMinutes(time, deltaMinutes) {
  const base = timeStringToMinutes(time);
  return base === null ? time : minutesToTimeString(base + deltaMinutes);
}

function overlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function normalizeCoordinates(rawCoordinates) {
  if (!rawCoordinates) return null;
  if (Array.isArray(rawCoordinates) && rawCoordinates.length === 2) {
    const [longitude, latitude] = rawCoordinates.map(Number);
    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
      return [longitude, latitude];
    }
  }
  if (typeof rawCoordinates === 'string') {
    const [longitude, latitude] = rawCoordinates.split(',').map((value) => Number(value.trim()));
    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
      return [longitude, latitude];
    }
  }
  return null;
}

function createFormDataWithImage(fieldName, fileName = 'system-test.png', extraFields = {}) {
  const formData = new FormData();
  formData.append(fieldName, new Blob([SAMPLE_IMAGE_BUFFER], { type: 'image/png' }), fileName);
  Object.entries(extraFields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });
  return formData;
}

function classifyService(service) {
  const serviceType = String(service?.serviceType || '').toLowerCase();
  const serviceCategory = String(service?.serviceCategory || '').toLowerCase();
  const hasSubscriptionOptions = Boolean(
    service?.subscriptionOptions?.enabled
    || (service?.subscriptionPlans || []).some((plan) => plan?.isActive !== false)
    || serviceType === 'monthly_subscription'
    || serviceCategory === 'subscription_services'
  );
  const isDeepCleaning = serviceType.startsWith('deep_cleaning') || serviceCategory === 'deep_cleaning';
  const isInstant = serviceType === 'instant_hourly' || serviceCategory === 'instant_services';
  const isSpot = serviceCategory === 'spot_cleaning' || serviceType.startsWith('fixed_');
  const isLongDuration = Number(service?.duration || 0) >= 180 || Number(service?.defaultWorkerCount || 1) > 1;

  if (hasSubscriptionOptions) return 'subscription';
  if (isInstant) return 'instant';
  if (isDeepCleaning) return 'deep_cleaning';
  if (isSpot) return 'spot_service';
  if (isLongDuration) return 'long_duration';
  return 'scheduled';
}

function inferExpectedBehavior(service, bookingType) {
  return {
    booking_creation: 'POST /api/bookings should either create a booking or return a validation/business-rule error with server-authored details.',
    worker_assignment: bookingType === 'subscription'
      ? 'Subscription should remain payment_pending until proof approval; worker assignment should respect coverage checks and activate only after payment approval.'
      : bookingType === 'instant'
        ? 'Instant booking should attempt immediate worker assignment and confirm quickly when workforce is available.'
        : 'Scheduled booking should either auto-assign or stay pending with recoverable admin/worker assignment options.',
    service_execution: bookingType === 'subscription'
      ? 'Recurring metadata should be created, payment proof reviewed, and future scheduling should remain coherent.'
      : 'Worker/customer should be able to progress through QR-driven start/end and admin approval without stale status mismatches.',
    payment: bookingType === 'subscription'
      ? 'Prepaid subscription root should collect proof only once; future visits should not request payment proof again.'
      : 'Payment proof requirements should align with booking status and completion workflow.',
    classification: {
      serviceType: service?.serviceType || null,
      serviceCategory: service?.serviceCategory || null,
      inferredBookingType: bookingType,
    },
  };
}

function createReport(testName, bookingType) {
  return {
    test_name: testName,
    booking_type: bookingType,
    steps_executed: [],
    api_calls: [],
    observed_behavior: {
      state_timeline: [],
      sync_snapshots: [],
    },
    expected_behavior_inferred: {},
    latency_metrics: {
      assignment_time: null,
      update_delay: null,
    },
    consistency_check: {
      customer_vs_worker: 'not_checked',
      worker_vs_admin: 'not_checked',
    },
    errors_detected: [],
    race_conditions_detected: [],
    final_status: 'FAIL',
    root_cause_analysis: '',
  };
}

function pushStep(report, step, details = {}) {
  report.steps_executed.push({ step, at: nowIso(), ...details });
}

function pushApiCall(report, apiCallMeta) {
  report.api_calls.push(apiCallMeta);
}

function pushObservedState(report, label, payload) {
  report.observed_behavior.state_timeline.push({ label, at: nowIso(), payload });
}

function finalizeReport(report) {
  summary.totalTestsRun += 1;
  if (report.final_status === 'PASS') {
    summary.passCount += 1;
  } else {
    summary.failCount += 1;
    if (report.errors_detected.length > 0) {
      summary.criticalFailures.push({
        test_name: report.test_name,
        booking_type: report.booking_type,
        errors: report.errors_detected,
      });
    }
  }

  const updateDelay = Number(report.latency_metrics.update_delay);
  if (Number.isFinite(updateDelay) && updateDelay > ACCEPTABLE_LATENCY_MS) {
    summary.performanceIssues.push({
      test_name: report.test_name,
      booking_type: report.booking_type,
      issue: `Observed sync delay ${updateDelay}ms exceeded ${ACCEPTABLE_LATENCY_MS}ms threshold.`,
    });
  }

  allReports.push(report);
}

async function apiCall({ report, session, actor, method, endpoint, query, body, formData, expectedStatuses = [200], description }) {
  const url = new URL(`${CONFIG.apiUrl}${endpoint}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const headers = {};
  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }
  let finalBody;
  if (formData) {
    finalBody = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    finalBody = JSON.stringify(body);
  }

  const started = performance.now();
  const response = await fetch(url, {
    method,
    headers,
    body: finalBody,
  });
  const durationMs = Math.round(performance.now() - started);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  const apiMeta = {
    actor,
    method,
    endpoint: `${endpoint}${url.search ? url.search : ''}`,
    status: response.status,
    duration_ms: durationMs,
    description: description || null,
    request_summary: body ? body : formData ? '[multipart/form-data]' : null,
    response_summary: data,
  };
  if (report) {
    pushApiCall(report, apiMeta);
  }

  if (!expectedStatuses.includes(response.status)) {
    const error = new Error(data?.error?.message || data?.message || `${method} ${endpoint} failed with ${response.status}`);
    error.response = response;
    error.data = data;
    throw error;
  }

  return { response, data, durationMs };
}

async function loginUser(email, password, actorLabel) {
  const { data } = await apiCall({
    actor: actorLabel,
    method: 'POST',
    endpoint: '/auth/login',
    body: { email, password },
    expectedStatuses: [200],
  });

  return {
    token: data.token,
    user: data.user,
    actorLabel,
  };
}

async function registerTempCustomer(label, location) {
  const uniqueEmail = `system.${label}.${Date.now()}.${crypto.randomUUID().slice(0, 6)}@example.com`;
  const password = 'SystemTest@123';
  const { data } = await apiCall({
    actor: `customer:${label}`,
    method: 'POST',
    endpoint: '/auth/register',
    body: {
      name: `System Test ${label}`,
      email: uniqueEmail,
      password,
      role: 'customer',
      location: {
        address: location.address,
        area: location.area,
        city: location.city,
        zipCode: location.zipCode,
        coordinates: location.coordinates,
      },
    },
    expectedStatuses: [201],
  });

  cleanupTasks.push({ type: 'temp-customer', email: uniqueEmail });

  return {
    token: data.token,
    user: data.user,
    actorLabel: `customer:${label}`,
    password,
    email: uniqueEmail,
  };
}

async function maybeConnectDatabase() {
  if (!ENABLE_DB_ASSIST) return false;
  if (mongoose.connection.readyState === 1) return true;
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  return true;
}

async function resolveTestLocation(adminSession, workerSessions) {
  const envCoordinates = normalizeCoordinates(CONFIG.location.coordinates);
  if (envCoordinates) {
    return {
      coordinates: envCoordinates,
      apartmentName: CONFIG.location.apartmentName,
      address: CONFIG.location.address,
      area: CONFIG.location.area,
      city: CONFIG.location.city,
      state: CONFIG.location.state,
      zipCode: CONFIG.location.zipCode,
    };
  }

  if (adminSession) {
    try {
      const { data } = await apiCall({
        actor: adminSession.actorLabel,
        session: adminSession,
        method: 'GET',
        endpoint: '/admin/locations',
        expectedStatuses: [200],
      });
      const locations = data.locations || data.data || [];
      const usableLocation = locations.find((location) => Array.isArray(location?.location?.coordinates));
      if (usableLocation) {
        return {
          coordinates: usableLocation.location.coordinates,
          apartmentName: usableLocation.apartmentName || CONFIG.location.apartmentName,
          address: usableLocation.address || CONFIG.location.address,
          area: usableLocation.area || CONFIG.location.area,
          city: usableLocation.city || CONFIG.location.city,
          state: usableLocation.state || CONFIG.location.state,
          zipCode: usableLocation.zipCode || CONFIG.location.zipCode,
          locationId: usableLocation._id,
        };
      }
    } catch (error) {
      console.warn('Unable to resolve location from admin/locations:', error.message);
    }
  }

  for (const workerSession of workerSessions) {
    try {
      const { data } = await apiCall({
        actor: workerSession.actorLabel,
        session: workerSession,
        method: 'GET',
        endpoint: '/auth/me',
        expectedStatuses: [200],
      });
      const apartments = data.user?.workerProfile?.assignedApartments || [];
      const apartmentWithCoordinates = apartments.find((apartment) => Array.isArray(apartment?.location?.coordinates));
      if (apartmentWithCoordinates) {
        return {
          coordinates: apartmentWithCoordinates.location.coordinates,
          apartmentName: apartmentWithCoordinates.apartmentName || CONFIG.location.apartmentName,
          address: apartmentWithCoordinates.apartmentName || CONFIG.location.address,
          area: apartmentWithCoordinates.area || CONFIG.location.area,
          city: apartmentWithCoordinates.city || CONFIG.location.city,
          state: CONFIG.location.state,
          zipCode: CONFIG.location.zipCode,
          locationId: apartmentWithCoordinates.locationId,
        };
      }
    } catch (error) {
      console.warn(`Unable to resolve location from ${workerSession.actorLabel}:`, error.message);
    }
  }

  throw new Error('No usable test location could be resolved. Set SYSTEM_TEST_LOCATION_COORDINATES or provide an admin/worker account with mapped locations.');
}

async function discoverServices() {
  const { data } = await apiCall({
    actor: 'suite',
    method: 'GET',
    endpoint: '/services',
    query: { isActive: true, limit: 300 },
    expectedStatuses: [200],
  });
  let services = (data.services || []).filter((service) => service?.isActive !== false);
  if (MAX_SERVICES > 0) {
    services = services.slice(0, MAX_SERVICES);
  }
  return services;
}

function getServiceDurationMinutes(service, bookingType) {
  if (bookingType === 'subscription') {
    const durationOption = (service.durationOptions || []).find((option) => option?.isDefault) || service.durationOptions?.[0];
    if (durationOption?.hours) return Number(durationOption.hours) * 60;
  }
  if (service?.sizeParameters?.enabled && Array.isArray(service?.sizeParameters?.options) && service.sizeParameters.options[0]?.duration) {
    return Number(service.sizeParameters.options[0].duration);
  }
  if (Array.isArray(service?.pricingTiers) && service.pricingTiers[0]?.duration) {
    return Number(service.pricingTiers[0].duration);
  }
  return Number(service?.duration || 60);
}

function computeTotalAmount(service, bookingType) {
  if (bookingType === 'subscription') {
    const activePlan = (service.subscriptionPlans || [])
      .filter((plan) => plan?.isActive !== false)
      .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0))[0];
    if (activePlan?.totalMonthlyPrice) return Number(activePlan.totalMonthlyPrice);
    if (activePlan?.price) return Number(activePlan.price);
    const durationOption = (service.durationOptions || []).find((option) => option?.isDefault) || service.durationOptions?.[0];
    if (durationOption?.price) return Number(durationOption.price);
  }
  if (service?.sizeParameters?.enabled && Array.isArray(service?.sizeParameters?.options) && service.sizeParameters.options[0]?.price) {
    return Number(service.sizeParameters.options[0].price);
  }
  if (Array.isArray(service?.pricingTiers) && service.pricingTiers[0]?.totalPrice) {
    return Number(service.pricingTiers[0].totalPrice);
  }
  return Number(service?.price || 0);
}

function inferBookingTypeField(bookingType) {
  switch (bookingType) {
    case 'instant':
      return 'adhoc';
    case 'subscription':
      return 'monthly';
    default:
      return 'oneTime';
  }
}

function selectSubscriptionFrequency(service) {
  const configuredFrequencies = [
    ...(service?.subscriptionOptions?.frequencyConfigs || []).filter((entry) => entry?.isActive !== false).map((entry) => entry?.id),
    ...(service?.subscriptionOptions?.allowedFrequencies || []),
    ...(service?.subscriptionPlans || []).map((plan) => plan?.id),
  ].filter(Boolean);
  for (const preferred of PREFERRED_SUBSCRIPTION_FREQUENCIES) {
    if (configuredFrequencies.includes(preferred)) return preferred;
  }
  return configuredFrequencies[0] || 'weekly';
}

function resolveSelectedDays(frequency, startDate) {
  const startDayIndex = new Date(startDate).getDay();
  const requiredCount = REQUIRED_SELECTED_DAY_COUNT_BY_FREQUENCY[frequency] || 0;
  if (requiredCount === 0) return [];
  if (frequency === 'weekly') return [DAY_NAMES[startDayIndex]];
  if (frequency === '3-days' || frequency === 'alt-days') {
    return [0, 2, 4].map((offset) => DAY_NAMES[(startDayIndex + offset) % 7]);
  }
  return [DAY_NAMES[startDayIndex]];
}

function summarizeBookingState(booking) {
  if (!booking) return null;
  return {
    id: booking._id,
    parentBooking: booking.parentBooking || null,
    status: booking.status,
    paymentStatus: booking.paymentStatus || null,
    workerId: booking.worker?._id || booking.worker || null,
    activationStatus: booking.subscription?.activationStatus || null,
    isPrepaid: booking.subscription?.isPrepaid || false,
    bookingDate: booking.bookingDate,
    startTime: booking.startTime,
    endTime: booking.endTime,
  };
}

async function fetchBookingViews(report, bookingId, sessions) {
  const snapshots = {};
  const viewEntries = Object.entries(sessions).filter(([, session]) => Boolean(session));
  for (const [label, session] of viewEntries) {
    try {
      const { data } = await apiCall({
        report,
        actor: label,
        session,
        method: 'GET',
        endpoint: `/bookings/${bookingId}`,
        expectedStatuses: [200, 403, 404],
        description: `Fetch ${label} booking detail`,
      });
      snapshots[label] = data?.booking ? summarizeBookingState(data.booking) : null;
    } catch (error) {
      snapshots[label] = { error: error.message };
    }
  }
  report.observed_behavior.sync_snapshots.push({ at: nowIso(), snapshots });
  return snapshots;
}

function compareSnapshots(report, snapshots) {
  const customer = snapshots.customer;
  const worker = snapshots.worker;
  const admin = snapshots.admin;
  const mismatches = [];

  const comparePair = (leftLabel, left, rightLabel, right, fields) => {
    if (!left || !right || left.error || right.error) {
      return `${leftLabel} or ${rightLabel} unavailable`;
    }
    const pairMismatches = fields
      .filter((field) => (left[field] ?? null) !== (right[field] ?? null))
      .map((field) => `${field}: ${left[field] ?? null} !== ${right[field] ?? null}`);
    if (pairMismatches.length > 0) {
      mismatches.push(`${leftLabel} vs ${rightLabel}: ${pairMismatches.join(', ')}`);
      return `mismatch (${pairMismatches.join('; ')})`;
    }
    return 'consistent';
  };

  report.consistency_check.customer_vs_worker = comparePair('customer', customer, 'worker', worker, ['status', 'workerId', 'paymentStatus']);
  report.consistency_check.worker_vs_admin = comparePair('worker', worker, 'admin', admin, ['status', 'workerId', 'paymentStatus']);
  return mismatches;
}

async function waitForConsistency(report, bookingId, sessions, predicate) {
  const started = performance.now();
  while ((performance.now() - started) < EVENTUAL_CONSISTENCY_TIMEOUT_MS) {
    const snapshots = await fetchBookingViews(report, bookingId, sessions);
    const mismatches = compareSnapshots(report, snapshots);
    if (predicate(snapshots, mismatches)) {
      const delay = Math.round(performance.now() - started);
      report.latency_metrics.update_delay = delay;
      return { snapshots, mismatches, delay };
    }
    await sleep(EVENTUAL_CONSISTENCY_POLL_MS);
  }
  const snapshots = await fetchBookingViews(report, bookingId, sessions);
  const mismatches = compareSnapshots(report, snapshots);
  report.errors_detected.push(`Consistency did not stabilize within ${EVENTUAL_CONSISTENCY_TIMEOUT_MS}ms`);
  return { snapshots, mismatches, delay: EVENTUAL_CONSISTENCY_TIMEOUT_MS };
}

function buildWorkerBusyMap(bookedRanges) {
  const map = new Map();
  (bookedRanges || []).forEach((range) => {
    const workerId = range.workerId || 'unknown-worker';
    if (!map.has(workerId)) map.set(workerId, []);
    map.get(workerId).push({
      start: timeStringToMinutes(range.startTime),
      end: timeStringToMinutes(range.endTime),
      reason: range.reason || null,
    });
  });
  return map;
}

function findFirstFreeSlot(slotResponse, durationMinutes) {
  const totalWorkers = Number(slotResponse?.totalWorkers || 0);
  if (totalWorkers <= 0) return null;
  const openMinutes = timeStringToMinutes(slotResponse.openTime || '09:00');
  const closeMinutes = timeStringToMinutes(slotResponse.closeTime || '18:00');
  const slotStep = Number(slotResponse.slotDurationMinutes || 30);
  const busyByWorker = buildWorkerBusyMap(slotResponse.bookedRanges || []);
  const allWorkerIds = [...busyByWorker.keys()];

  for (let candidate = openMinutes; candidate !== null && closeMinutes !== null && candidate + durationMinutes <= closeMinutes; candidate += slotStep) {
    let busyWorkers = 0;
    for (const workerId of allWorkerIds) {
      const overlaps = (busyByWorker.get(workerId) || []).some((range) => {
        if (range.start === null || range.end === null) return false;
        return overlap(candidate, candidate + durationMinutes, range.start, range.end);
      });
      if (overlaps) busyWorkers += 1;
    }
    if (busyWorkers < totalWorkers) {
      return {
        startTime: minutesToTimeString(candidate),
        endTime: minutesToTimeString(candidate + durationMinutes),
      };
    }
  }
  return null;
}

async function findBookableWindow({ report, customerSession, service, location, bookingType }) {
  const durationMinutes = getServiceDurationMinutes(service, bookingType);
  const sameDayFirst = bookingType === 'instant';
  const dayOffsets = sameDayFirst ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7];

  for (const offset of dayOffsets) {
    const targetDate = toDateOnly(addDays(new Date(), offset));
    try {
      const { data } = await apiCall({
        report,
        actor: customerSession.actorLabel,
        session: customerSession,
        method: 'GET',
        endpoint: '/bookings/booked-slots',
        query: {
          date: targetDate,
          lng: location.coordinates[0],
          lat: location.coordinates[1],
          service: service._id,
        },
        expectedStatuses: [200],
        description: 'Discover bookable slots',
      });
      const freeWindow = findFirstFreeSlot(data, durationMinutes);
      if (freeWindow) {
        return {
          bookingDate: targetDate,
          startTime: freeWindow.startTime,
          endTime: freeWindow.endTime,
          slotResponse: data,
          durationMinutes,
        };
      }
    } catch (error) {
      report.errors_detected.push(`Slot discovery failed for ${service.name} on offset ${offset}: ${error.message}`);
    }
  }
  throw new Error(`Unable to find a bookable slot for ${service.name}`);
}

function buildLocationPayload(location) {
  return {
    apartmentName: location.apartmentName || '',
    address: location.address || '',
    area: location.area || '',
    city: location.city || '',
    state: location.state || '',
    zipCode: location.zipCode || '',
    coordinates: location.coordinates,
  };
}

function buildBookingPayload({ service, bookingType, location, bookingWindow }) {
  const totalAmount = computeTotalAmount(service, bookingType);
  const payload = {
    service: service._id,
    bookingDate: bookingWindow.bookingDate,
    startTime: bookingWindow.startTime,
    endTime: bookingWindow.endTime,
    totalAmount,
    bookingType: inferBookingTypeField(bookingType),
    autoAssign: bookingType !== 'subscription',
    preferences: { workerGenderPreference: 'any', specialInstructions: 'System suite execution' },
    location: buildLocationPayload(location),
    notes: `System suite booking for ${service.name}`,
  };
  if (bookingType === 'instant') {
    payload.serviceDetails = { hours: Math.max(1, Math.round(bookingWindow.durationMinutes / 60)) };
  }
  if (bookingType === 'deep_cleaning') {
    payload.serviceDetails = {
      package: service?.sizeParameters?.options?.[0]?.label || service.name,
      addOns: [],
    };
    payload.bookingType = 'adhoc';
    payload.endTime = bookingWindow.startTime;
  }
  if (bookingType === 'subscription') {
    const frequency = selectSubscriptionFrequency(service);
    const startDate = bookingWindow.bookingDate;
    const selectedDays = resolveSelectedDays(frequency, startDate);
    const durationOption = (service.durationOptions || []).find((option) => option?.isDefault) || service.durationOptions?.[0];
    const durationPerSession = Number(durationOption?.hours || Math.max(1, Math.round(bookingWindow.durationMinutes / 60)));
    payload.bookingType = 'monthly';
    payload.isSubscription = true;
    payload.autoAssign = false;
    payload.subscriptionDetails = {
      startDate,
      endDate: toDateOnly(addDays(startDate, 27)),
      frequency,
      selectedDays,
      preferredTime: bookingWindow.startTime,
      durationPerSession,
      autoRenewal: true,
      allowPause: true,
    };
    payload.serviceDetails = { sessionDurationHours: durationPerSession };
  }
  return payload;
}

async function createBooking({ report, customerSession, payload }) {
  const started = performance.now();
  const { data } = await apiCall({
    report,
    actor: customerSession.actorLabel,
    session: customerSession,
    method: 'POST',
    endpoint: '/bookings',
    body: payload,
    expectedStatuses: [201],
    description: 'Create booking',
  });
  report.latency_metrics.assignment_time = Math.round(performance.now() - started);
  return data.booking;
}

async function chooseManagedWorkerForBooking(report, adminSession, bookingId, workerSessions) {
  const { data } = await apiCall({
    report,
    actor: adminSession.actorLabel,
    session: adminSession,
    method: 'GET',
    endpoint: `/admin/bookings/${bookingId}/available-workers`,
    expectedStatuses: [200],
    description: 'Fetch admin available workers',
  });
  const workers = data.workers || [];
  if (workers.length === 0) return null;
  for (const workerSession of workerSessions) {
    const match = workers.find((worker) => String(worker._id) === String(workerSession.user.id || workerSession.user._id));
    if (match) return { worker: match, session: workerSession };
  }
  const first = workers[0];
  const matchingSession = workerSessions.find((session) => String(session.user.id || session.user._id) === String(first._id)) || null;
  return { worker: first, session: matchingSession };
}

async function manualAssign(report, adminSession, bookingId, workerId, reason = 'System test assignment') {
  const { data } = await apiCall({
    report,
    actor: adminSession.actorLabel,
    session: adminSession,
    method: 'POST',
    endpoint: '/admin/manual-assign',
    body: { bookingId, workerId, reason },
    expectedStatuses: [200],
    description: 'Manual assign worker',
  });
  return data;
}

async function progressStandardBooking({ report, booking, customerSession, workerSession, adminSession }) {
  ensure(workerSession, `No worker session available to continue lifecycle for booking ${booking._id}`);
  pushStep(report, 'worker_generate_start_qr');
  const startQr = await apiCall({
    report,
    actor: workerSession.actorLabel,
    session: workerSession,
    method: 'POST',
    endpoint: `/bookings/${booking._id}/generate-start-qr`,
    body: {},
    expectedStatuses: [200],
    description: 'Worker generates start QR',
  });
  pushObservedState(report, 'start_qr_generated', startQr.data);

  pushStep(report, 'customer_scan_start_qr');
  await apiCall({
    report,
    actor: customerSession.actorLabel,
    session: customerSession,
    method: 'POST',
    endpoint: `/bookings/${booking._id}/scan-start-qr`,
    body: { qrCode: startQr.data.qrCode, force: true },
    expectedStatuses: [200],
    description: 'Customer scans start QR',
  });

  await waitForConsistency(report, booking._id, { customer: customerSession, worker: workerSession, admin: adminSession }, (snapshots) => snapshots.customer?.status === 'in-progress' && snapshots.admin?.status === 'in-progress');

  pushStep(report, 'worker_upload_arrival_photo');
  await apiCall({
    report,
    actor: workerSession.actorLabel,
    session: workerSession,
    method: 'POST',
    endpoint: `/bookings/${booking._id}/upload-arrival-photo`,
    formData: createFormDataWithImage('arrivalPhoto', 'arrival.png'),
    expectedStatuses: [200],
    description: 'Worker uploads arrival photo',
  });

  pushStep(report, 'worker_upload_completion_photos');
  for (let index = 0; index < 2; index += 1) {
    await apiCall({
      report,
      actor: workerSession.actorLabel,
      session: workerSession,
      method: 'POST',
      endpoint: `/bookings/${booking._id}/add-completion-photo`,
      formData: createFormDataWithImage('photo', `completion-${index + 1}.png`),
      expectedStatuses: [200],
      description: `Worker uploads completion photo ${index + 1}`,
    });
  }

  pushStep(report, 'worker_generate_end_qr');
  const endQr = await apiCall({
    report,
    actor: workerSession.actorLabel,
    session: workerSession,
    method: 'POST',
    endpoint: `/bookings/${booking._id}/generate-end-qr`,
    body: {},
    expectedStatuses: [200],
    description: 'Worker generates end QR',
  });

  pushStep(report, 'customer_scan_end_qr');
  const endResult = await apiCall({
    report,
    actor: customerSession.actorLabel,
    session: customerSession,
    method: 'POST',
    endpoint: `/bookings/${booking._id}/scan-end-qr`,
    body: { qrCode: endQr.data.qrCode },
    expectedStatuses: [200],
    description: 'Customer scans end QR',
  });
  pushObservedState(report, 'end_qr_scanned', summarizeBookingState(endResult.data.booking));

  const latestBooking = endResult.data.booking;
  if (latestBooking.status === 'pending-review') {
    pushStep(report, 'worker_upload_payment_proof');
    await apiCall({
      report,
      actor: workerSession.actorLabel,
      session: workerSession,
      method: 'POST',
      endpoint: `/bookings/${booking._id}/upload-payment-proof`,
      formData: createFormDataWithImage('paymentProof', 'payment-proof.png', {
        transactionId: makeId('txn'),
        transactionTime: nowIso(),
      }),
      expectedStatuses: [200],
      description: 'Worker uploads payment proof',
    });
  }

  pushStep(report, 'admin_approve_completion');
  await apiCall({
    report,
    actor: adminSession.actorLabel,
    session: adminSession,
    method: 'POST',
    endpoint: `/bookings/${booking._id}/admin-approve`,
    body: {},
    expectedStatuses: [200],
    description: 'Admin approves booking completion',
  });

  return waitForConsistency(report, booking._id, { customer: customerSession, worker: workerSession, admin: adminSession }, (snapshots, mismatches) => snapshots.customer?.status === 'completed' && mismatches.length === 0);
}

async function progressSubscriptionBooking({ report, booking, customerSession, adminSession, workerSessions }) {
  pushStep(report, 'customer_upload_subscription_payment_proof');
  await apiCall({
    report,
    actor: customerSession.actorLabel,
    session: customerSession,
    method: 'POST',
    endpoint: `/bookings/${booking._id}/upload-payment-proof`,
    formData: createFormDataWithImage('paymentProof', 'subscription-proof.png', {
      transactionId: makeId('subtxn'),
      transactionTime: nowIso(),
    }),
    expectedStatuses: [200],
    description: 'Customer uploads subscription payment proof',
  });

  pushStep(report, 'admin_review_subscription_payment');
  await apiCall({
    report,
    actor: adminSession.actorLabel,
    session: adminSession,
    method: 'POST',
    endpoint: `/bookings/${booking._id}/payment-proof-review`,
    body: { action: 'approve', reason: 'System suite approval' },
    expectedStatuses: [200],
    description: 'Admin approves subscription payment proof',
  });

  const pickedWorker = await chooseManagedWorkerForBooking(report, adminSession, booking._id, workerSessions);
  if (pickedWorker?.worker) {
    pushStep(report, 'admin_assign_subscription_worker');
    await manualAssign(report, adminSession, booking._id, pickedWorker.worker._id, 'System suite subscription assignment');
  }

  const syncResult = await waitForConsistency(report, booking._id, { customer: customerSession, worker: pickedWorker?.session || null, admin: adminSession }, (snapshots) => ['approval_pending', 'active'].includes(snapshots.customer?.activationStatus || ''));

  if (ENABLE_DB_ASSIST) {
    pushStep(report, 'db_schedule_recurring_occurrence');
    const rootBooking = await Booking.findById(booking._id);
    if (rootBooking?.recurringSchedule) {
      rootBooking.recurringSchedule.nextScheduledDate = new Date();
      await rootBooking.save();
      await scheduleRecurringBookings();
      const occurrence = await Booking.findOne({ parentBooking: booking._id }).sort({ createdAt: -1 }).lean();
      pushObservedState(report, 'subscription_occurrence_created', summarizeBookingState(occurrence));
      if (!occurrence) {
        report.errors_detected.push('Recurring subscription occurrence was not created after forcing schedule job.');
      }
    }
  }

  return syncResult;
}

function validateStateMachine(report) {
  const states = report.observed_behavior.state_timeline
    .map((entry) => entry?.payload?.status || entry?.payload?.activationStatus || null)
    .filter(Boolean);
  const invalidBacktracks = [];
  const order = ['pending', 'confirmed', 'in-progress', 'pending-review', 'completed'];
  for (let index = 1; index < states.length; index += 1) {
    const prev = states[index - 1];
    const next = states[index];
    const prevIndex = order.indexOf(prev);
    const nextIndex = order.indexOf(next);
    if (prevIndex >= 0 && nextIndex >= 0 && nextIndex + 1 < prevIndex) {
      invalidBacktracks.push(`${prev} -> ${next}`);
    }
  }
  if (invalidBacktracks.length > 0) {
    report.errors_detected.push(`Invalid state regressions detected: ${invalidBacktracks.join(', ')}`);
  }
  report.observed_behavior.captured_states = [...new Set(states)];
}

async function runServiceLifecycle(service, adminSession, workerSessions, location) {
  const bookingType = classifyService(service);
  const report = createReport(`service-lifecycle:${service.name}`, bookingType);
  report.expected_behavior_inferred = inferExpectedBehavior(service, bookingType);

  try {
    const customerSession = await registerTempCustomer(service.serviceType || service.name.toLowerCase().replace(/\s+/g, '-'), location);
    pushStep(report, 'customer_registered', { email: customerSession.email });

    const bookingWindow = await findBookableWindow({ report, customerSession, service, location, bookingType });
    pushStep(report, 'bookable_window_selected', bookingWindow);

    const bookingPayload = buildBookingPayload({ service, bookingType, location, bookingWindow });
    pushObservedState(report, 'booking_payload_prepared', bookingPayload);

    const createdBooking = await createBooking({ report, customerSession, payload: bookingPayload });
    pushObservedState(report, 'booking_created', summarizeBookingState(createdBooking));

    let matchedWorkerSession = null;
    if (createdBooking.worker) {
      matchedWorkerSession = workerSessions.find((session) => String(session.user.id || session.user._id) === String(createdBooking.worker._id || createdBooking.worker)) || null;
    }

    if (!matchedWorkerSession && bookingType !== 'subscription') {
      const pickedWorker = await chooseManagedWorkerForBooking(report, adminSession, createdBooking._id, workerSessions);
      if (pickedWorker?.worker) {
        await manualAssign(report, adminSession, createdBooking._id, pickedWorker.worker._id, 'System suite alignment assignment');
        matchedWorkerSession = pickedWorker.session;
      }
    }

    const initialConsistency = await waitForConsistency(report, createdBooking._id, { customer: customerSession, worker: matchedWorkerSession, admin: adminSession }, (snapshots) => Boolean(snapshots.customer));
    pushObservedState(report, 'post_create_consistency', initialConsistency.snapshots);

    if (bookingType === 'subscription') {
      await progressSubscriptionBooking({ report, booking: createdBooking, customerSession, adminSession, workerSessions });
    } else {
      await progressStandardBooking({ report, booking: createdBooking, customerSession, workerSession: matchedWorkerSession, adminSession });
    }

    validateStateMachine(report);
    report.final_status = report.errors_detected.length === 0 ? 'PASS' : 'FAIL';
    report.root_cause_analysis = report.final_status === 'PASS'
      ? 'Lifecycle executed without fatal sync or workflow mismatches.'
      : report.errors_detected.join(' | ');
  } catch (error) {
    report.errors_detected.push(error.message);
    report.final_status = 'FAIL';
    report.root_cause_analysis = error.stack || error.message;
  }

  finalizeReport(report);
}

async function runConcurrentBookingRace(service, adminSession, location) {
  const report = createReport(`concurrency:parallel-bookings:${service.name}`, classifyService(service));
  report.expected_behavior_inferred = {
    scenario: 'Multiple customers booking the same service and time concurrently should avoid duplicate IDs, stale assignment, or illegal double-booking on one worker.',
  };

  try {
    const customers = await Promise.all([
      registerTempCustomer('concurrency-a', location),
      registerTempCustomer('concurrency-b', location),
      registerTempCustomer('concurrency-c', location),
    ]);

    const bookingWindow = await findBookableWindow({ report, customerSession: customers[0], service, location, bookingType: classifyService(service) });
    const payload = buildBookingPayload({ service, bookingType: classifyService(service), location, bookingWindow });
    payload.autoAssign = false;

    const results = await Promise.allSettled(
      customers.map((customerSession, index) => createBooking({ report, customerSession, payload: { ...payload, notes: `Concurrency system test ${index + 1}` } }))
    );

    const successfulBookings = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    const failedBookings = results.filter((result) => result.status === 'rejected').map((result) => result.reason?.message || 'unknown error');

    const duplicateIds = successfulBookings.length !== new Set(successfulBookings.map((booking) => booking._id)).size;
    if (duplicateIds) {
      report.race_conditions_detected.push('Duplicate booking IDs observed under concurrent creation.');
    }

    const assignments = successfulBookings.filter((booking) => booking.worker).map((booking) => ({
      bookingId: booking._id,
      workerId: booking.worker?._id || booking.worker,
      startTime: booking.startTime,
      endTime: booking.endTime,
    }));
    const byWorker = new Map();
    assignments.forEach((entry) => {
      if (!byWorker.has(entry.workerId)) byWorker.set(entry.workerId, []);
      byWorker.get(entry.workerId).push(entry);
    });
    for (const [workerId, workerAssignments] of byWorker.entries()) {
      if (workerAssignments.length > 1) {
        report.race_conditions_detected.push(`Worker ${workerId} received ${workerAssignments.length} overlapping concurrent assignments.`);
      }
    }

    pushObservedState(report, 'concurrent_creation_results', {
      successfulBookings: successfulBookings.map((booking) => summarizeBookingState(booking)),
      failedBookings,
    });

    report.final_status = report.race_conditions_detected.length === 0 ? 'PASS' : 'FAIL';
    report.root_cause_analysis = report.final_status === 'PASS'
      ? 'Concurrent booking creation did not expose duplicate IDs or illegal worker double-assignment.'
      : report.race_conditions_detected.join(' | ');
  } catch (error) {
    report.errors_detected.push(error.message);
    report.final_status = 'FAIL';
    report.root_cause_analysis = error.stack || error.message;
  }

  finalizeReport(report);
}

async function runWorkerAcceptRace(service, workerSessions, location) {
  const report = createReport(`concurrency:worker-accept-race:${service.name}`, classifyService(service));
  report.expected_behavior_inferred = { scenario: 'Only one worker should be able to accept a pending booking.' };

  try {
    ensure(workerSessions.length >= 2, 'At least two worker credentials are required for the worker accept race test.');
    const customerSession = await registerTempCustomer('accept-race', location);
    const bookingWindow = await findBookableWindow({ report, customerSession, service, location, bookingType: classifyService(service) });
    const payload = buildBookingPayload({ service, bookingType: classifyService(service), location, bookingWindow });
    payload.autoAssign = false;
    payload.bookingType = 'oneTime';
    const booking = await createBooking({ report, customerSession, payload });

    const acceptResults = await Promise.allSettled(
      workerSessions.slice(0, 2).map((workerSession) => apiCall({
        report,
        actor: workerSession.actorLabel,
        session: workerSession,
        method: 'POST',
        endpoint: `/bookings/${booking._id}/accept-order`,
        body: {},
        expectedStatuses: [200, 400, 403, 404],
        description: 'Competing worker accept-order request',
      }))
    );

    const successfulAccepts = acceptResults.filter((result) => result.status === 'fulfilled' && result.value.response.status === 200);
    if (successfulAccepts.length !== 1) {
      report.race_conditions_detected.push(`Expected exactly one worker acceptance success, observed ${successfulAccepts.length}.`);
    }

    pushObservedState(report, 'worker_accept_race_results', acceptResults.map((result) => {
      if (result.status === 'fulfilled') {
        return { status: result.value.response.status, data: result.value.data };
      }
      return { error: result.reason?.message || 'unknown error' };
    }));

    report.final_status = report.race_conditions_detected.length === 0 ? 'PASS' : 'FAIL';
    report.root_cause_analysis = report.final_status === 'PASS'
      ? 'Accept-order race correctly allowed only one winning worker.'
      : report.race_conditions_detected.join(' | ');
  } catch (error) {
    report.errors_detected.push(error.message);
    report.final_status = 'FAIL';
    report.root_cause_analysis = error.stack || error.message;
  }

  finalizeReport(report);
}

async function runFailureRecoveryTests(service, adminSession, workerSessions, location) {
  const report = createReport(`failure-recovery:${service.name}`, classifyService(service));
  report.expected_behavior_inferred = {
    scenario: 'Server should reject invalid booking creation, reject incomplete payment uploads, and refuse manual assignment to offline workers.',
  };

  try {
    const customerSession = await registerTempCustomer('failure-recovery', location);
    const bookingWindow = await findBookableWindow({ report, customerSession, service, location, bookingType: classifyService(service) });
    const validPayload = buildBookingPayload({ service, bookingType: classifyService(service), location, bookingWindow });

    pushStep(report, 'invalid_booking_creation_without_location');
    const invalidCreation = await apiCall({
      report,
      actor: customerSession.actorLabel,
      session: customerSession,
      method: 'POST',
      endpoint: '/bookings',
      body: { ...validPayload, location: undefined },
      expectedStatuses: [400],
      description: 'Invalid booking creation without location',
    });
    pushObservedState(report, 'invalid_creation_response', invalidCreation.data);

    const booking = await createBooking({ report, customerSession, payload: { ...validPayload, autoAssign: false } });

    pushStep(report, 'payment_proof_without_file');
    const noFileUpload = await apiCall({
      report,
      actor: customerSession.actorLabel,
      session: customerSession,
      method: 'POST',
      endpoint: `/bookings/${booking._id}/upload-payment-proof`,
      formData: new FormData(),
      expectedStatuses: [400],
      description: 'Upload payment proof without file',
    });
    pushObservedState(report, 'payment_without_file_response', noFileUpload.data);

    const managedWorker = workerSessions[0];
    ensure(managedWorker, 'At least one worker credential is required for failure recovery tests.');

    pushStep(report, 'toggle_worker_offline');
    await apiCall({
      report,
      actor: managedWorker.actorLabel,
      session: managedWorker,
      method: 'PUT',
      endpoint: '/users/toggle-availability',
      body: { availability: false },
      expectedStatuses: [200],
      description: 'Take worker offline',
    });

    try {
      const assignmentAttempt = await apiCall({
        report,
        actor: adminSession.actorLabel,
        session: adminSession,
        method: 'POST',
        endpoint: '/admin/manual-assign',
        body: {
          bookingId: booking._id,
          workerId: managedWorker.user.id || managedWorker.user._id,
          reason: 'Offline assignment validation',
        },
        expectedStatuses: [400],
        description: 'Attempt assignment to offline worker',
      });
      pushObservedState(report, 'offline_assignment_response', assignmentAttempt.data);
    } finally {
      await apiCall({
        report,
        actor: managedWorker.actorLabel,
        session: managedWorker,
        method: 'PUT',
        endpoint: '/users/toggle-availability',
        body: { availability: true },
        expectedStatuses: [200],
        description: 'Restore worker availability',
      });
    }

    report.final_status = report.errors_detected.length === 0 ? 'PASS' : 'FAIL';
    report.root_cause_analysis = report.final_status === 'PASS'
      ? 'Failure paths returned controlled validation errors and recovered cleanly.'
      : report.errors_detected.join(' | ');
  } catch (error) {
    report.errors_detected.push(error.message);
    report.final_status = 'FAIL';
    report.root_cause_analysis = error.stack || error.message;
  }

  finalizeReport(report);
}

async function runWorkerOfflineMidTask(service, adminSession, workerSessions, location) {
  const report = createReport(`edge:worker-offline-mid-task:${service.name}`, classifyService(service));
  report.expected_behavior_inferred = {
    scenario: 'Worker going offline mid-task should not orphan an in-progress booking or desynchronize customer/admin views.',
  };

  try {
    const customerSession = await registerTempCustomer('offline-mid-task', location);
    const bookingWindow = await findBookableWindow({ report, customerSession, service, location, bookingType: classifyService(service) });
    const payload = buildBookingPayload({ service, bookingType: classifyService(service), location, bookingWindow });
    payload.autoAssign = false;
    const booking = await createBooking({ report, customerSession, payload });

    const pickedWorker = await chooseManagedWorkerForBooking(report, adminSession, booking._id, workerSessions);
    ensure(pickedWorker?.worker && pickedWorker?.session, 'No managed worker is available for offline-mid-task test.');
    await manualAssign(report, adminSession, booking._id, pickedWorker.worker._id, 'Prepare offline-mid-task scenario');

    const startQr = await apiCall({
      report,
      actor: pickedWorker.session.actorLabel,
      session: pickedWorker.session,
      method: 'POST',
      endpoint: `/bookings/${booking._id}/generate-start-qr`,
      body: {},
      expectedStatuses: [200],
      description: 'Generate start QR before offline toggle',
    });

    await apiCall({
      report,
      actor: customerSession.actorLabel,
      session: customerSession,
      method: 'POST',
      endpoint: `/bookings/${booking._id}/scan-start-qr`,
      body: { qrCode: startQr.data.qrCode, force: true },
      expectedStatuses: [200],
      description: 'Start booking before worker offline toggle',
    });

    await apiCall({
      report,
      actor: pickedWorker.session.actorLabel,
      session: pickedWorker.session,
      method: 'PUT',
      endpoint: '/users/toggle-availability',
      body: { availability: false },
      expectedStatuses: [200],
      description: 'Worker goes offline mid-task',
    });

    try {
      const consistency = await waitForConsistency(report, booking._id, { customer: customerSession, worker: pickedWorker.session, admin: adminSession }, (snapshots) => snapshots.customer?.status === 'in-progress' && snapshots.admin?.status === 'in-progress');
      pushObservedState(report, 'offline_mid_task_consistency', consistency.snapshots);
    } finally {
      await apiCall({
        report,
        actor: pickedWorker.session.actorLabel,
        session: pickedWorker.session,
        method: 'PUT',
        endpoint: '/users/toggle-availability',
        body: { availability: true },
        expectedStatuses: [200],
        description: 'Restore worker online after offline-mid-task test',
      });
    }

    report.final_status = report.errors_detected.length === 0 ? 'PASS' : 'FAIL';
    report.root_cause_analysis = report.final_status === 'PASS'
      ? 'In-progress task remained intact when worker availability changed.'
      : report.errors_detected.join(' | ');
  } catch (error) {
    report.errors_detected.push(error.message);
    report.final_status = 'FAIL';
    report.root_cause_analysis = error.stack || error.message;
  }

  finalizeReport(report);
}

async function runCustomerCancellationTest(service, adminSession, location) {
  const report = createReport(`edge:customer-cancellation:${service.name}`, classifyService(service));
  report.expected_behavior_inferred = {
    scenario: 'Customer cancellation should behave coherently before service start and surface consistent terminal state.',
  };

  try {
    const customerSession = await registerTempCustomer('cancel-flow', location);
    const bookingWindow = await findBookableWindow({ report, customerSession, service, location, bookingType: classifyService(service) });
    const payload = buildBookingPayload({ service, bookingType: classifyService(service), location, bookingWindow });
    payload.autoAssign = false;
    const booking = await createBooking({ report, customerSession, payload });

    const cancelResult = await apiCall({
      report,
      actor: customerSession.actorLabel,
      session: customerSession,
      method: 'DELETE',
      endpoint: `/bookings/${booking._id}`,
      expectedStatuses: [200, 400],
      description: 'Customer cancellation request',
    });
    pushObservedState(report, 'customer_cancellation_response', cancelResult.data);

    const consistency = await waitForConsistency(report, booking._id, { customer: customerSession, worker: null, admin: adminSession }, (snapshots) => !snapshots.customer || ['cancelled', 'pending'].includes(snapshots.customer?.status || ''));
    pushObservedState(report, 'customer_cancellation_consistency', consistency.snapshots);

    report.final_status = report.errors_detected.length === 0 ? 'PASS' : 'FAIL';
    report.root_cause_analysis = report.final_status === 'PASS'
      ? 'Cancellation endpoint responded predictably and did not create conflicting views.'
      : report.errors_detected.join(' | ');
  } catch (error) {
    report.errors_detected.push(error.message);
    report.final_status = 'FAIL';
    report.root_cause_analysis = error.stack || error.message;
  }

  finalizeReport(report);
}

async function runAdminOverrideTest(service, adminSession, workerSessions, location) {
  const report = createReport(`edge:admin-override:${service.name}`, classifyService(service));
  report.expected_behavior_inferred = {
    scenario: 'Admin should be able to override assignment without creating duplicate worker bindings or stale customer state.',
  };

  try {
    ensure(workerSessions.length >= 2, 'At least two managed workers are required for admin override test.');
    const customerSession = await registerTempCustomer('admin-override', location);
    const bookingWindow = await findBookableWindow({ report, customerSession, service, location, bookingType: classifyService(service) });
    const payload = buildBookingPayload({ service, bookingType: classifyService(service), location, bookingWindow });
    payload.autoAssign = false;
    const booking = await createBooking({ report, customerSession, payload });

    const firstChoice = await chooseManagedWorkerForBooking(report, adminSession, booking._id, workerSessions);
    ensure(firstChoice?.worker, 'No initial worker available for admin override test.');
    await manualAssign(report, adminSession, booking._id, firstChoice.worker._id, 'Initial assignment for override test');

    const secondWorkerSession = workerSessions.find((session) => String(session.user.id || session.user._id) !== String(firstChoice.worker._id));
    ensure(secondWorkerSession, 'No alternate worker available for admin override test.');

    const overrideResult = await apiCall({
      report,
      actor: adminSession.actorLabel,
      session: adminSession,
      method: 'POST',
      endpoint: '/admin/manual-assign',
      body: {
        bookingId: booking._id,
        workerId: secondWorkerSession.user.id || secondWorkerSession.user._id,
        reason: 'Admin override test reassignment',
      },
      expectedStatuses: [200],
      description: 'Admin override reassignment',
    });
    pushObservedState(report, 'admin_override_response', overrideResult.data);

    const consistency = await waitForConsistency(report, booking._id, { customer: customerSession, worker: secondWorkerSession, admin: adminSession }, (snapshots, mismatches) => snapshots.admin?.workerId === String(secondWorkerSession.user.id || secondWorkerSession.user._id) && mismatches.length === 0);
    pushObservedState(report, 'admin_override_consistency', consistency.snapshots);

    report.final_status = report.errors_detected.length === 0 ? 'PASS' : 'FAIL';
    report.root_cause_analysis = report.final_status === 'PASS'
      ? 'Admin override reassignment propagated cleanly across interfaces.'
      : report.errors_detected.join(' | ');
  } catch (error) {
    report.errors_detected.push(error.message);
    report.final_status = 'FAIL';
    report.root_cause_analysis = error.stack || error.message;
  }

  finalizeReport(report);
}

async function runSubscriptionAutoRenewTest(subscriptionService, adminSession, workerSessions, location) {
  const report = createReport(`edge:subscription-auto-renew:${subscriptionService.name}`, 'subscription');
  report.expected_behavior_inferred = {
    scenario: 'Expired auto-renew subscriptions should spawn a fresh root booking cycle without orphaning the previous cycle.',
  };

  try {
    ensure(ENABLE_DB_ASSIST, 'MONGODB_URI is required for direct auto-renew verification.');
    await maybeConnectDatabase();

    const customerSession = await registerTempCustomer('auto-renew', location);
    const bookingWindow = await findBookableWindow({ report, customerSession, service: subscriptionService, location, bookingType: 'subscription' });
    const payload = buildBookingPayload({ service: subscriptionService, bookingType: 'subscription', location, bookingWindow });
    const booking = await createBooking({ report, customerSession, payload });

    await progressSubscriptionBooking({ report, booking, customerSession, adminSession, workerSessions });

    const rootBooking = await Booking.findById(booking._id);
    ensure(rootBooking, 'Subscription root booking missing for auto-renew test.');
    rootBooking.subscription.autoRenewal = true;
    rootBooking.subscription.subscriptionEndDate = addDays(new Date(), -2);
    if (rootBooking.recurringSchedule) {
      rootBooking.recurringSchedule.endDate = addDays(new Date(), -2);
      rootBooking.recurringSchedule.nextScheduledDate = null;
    }
    await rootBooking.save();

    await checkSubscriptionRenewals();

    const renewedBooking = await Booking.findOne({ 'subscription.renewedFrom': booking._id }).lean();
    pushObservedState(report, 'auto_renew_query_result', summarizeBookingState(renewedBooking));
    if (!renewedBooking) {
      report.errors_detected.push('Auto-renew did not create a renewed subscription root booking.');
    }

    report.final_status = report.errors_detected.length === 0 ? 'PASS' : 'FAIL';
    report.root_cause_analysis = report.final_status === 'PASS'
      ? 'Auto-renew created a new root cycle and completed the expired root subscription.'
      : report.errors_detected.join(' | ');
  } catch (error) {
    report.errors_detected.push(error.message);
    report.final_status = 'FAIL';
    report.root_cause_analysis = error.stack || error.message;
  }

  finalizeReport(report);
}

function buildSummaryDashboard() {
  return {
    total_tests_run: summary.totalTestsRun,
    pass_fail: { pass: summary.passCount, fail: summary.failCount },
    critical_failures: summary.criticalFailures,
    performance_issues: summary.performanceIssues,
    suggested_fixes: Array.from(new Set([
      ...summary.suggestedFixes,
      ...summary.criticalFailures.flatMap((failure) => failure.errors),
      ...summary.performanceIssues.map((issue) => issue.issue),
    ])).slice(0, 20),
  };
}

async function writeReportArtifacts() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const summaryDashboard = buildSummaryDashboard();
  const payload = {
    generatedAt: nowIso(),
    config: {
      apiUrl: CONFIG.apiUrl,
      acceptableLatencyMs: ACCEPTABLE_LATENCY_MS,
      eventualConsistencyTimeoutMs: EVENTUAL_CONSISTENCY_TIMEOUT_MS,
      dbAssistEnabled: ENABLE_DB_ASSIST,
    },
    summary: summaryDashboard,
    reports: allReports,
  };
  const fileName = `system-booking-suite-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log('\n=== SYSTEM TEST SUMMARY DASHBOARD ===');
  console.log(`Total tests run : ${summaryDashboard.total_tests_run}`);
  console.log(`Pass count      : ${summaryDashboard.pass_fail.pass}`);
  console.log(`Fail count      : ${summaryDashboard.pass_fail.fail}`);
  console.log(`Critical issues : ${summaryDashboard.critical_failures.length}`);
  console.log(`Perf issues     : ${summaryDashboard.performance_issues.length}`);
  console.log(`Report saved    : ${filePath}`);

  return filePath;
}

async function run() {
  ensure(CONFIG.admin.email && CONFIG.admin.password, 'SYSTEM_TEST_ADMIN_EMAIL and SYSTEM_TEST_ADMIN_PASSWORD are required.');
  ensure(CONFIG.workers.length > 0, 'Provide at least one worker using SYSTEM_TEST_WORKER_EMAIL/PASSWORD or SYSTEM_TEST_WORKERS_JSON.');

  const adminSession = await loginUser(CONFIG.admin.email, CONFIG.admin.password, 'admin');
  const workerSessions = [];
  for (const [index, worker] of CONFIG.workers.entries()) {
    workerSessions.push(await loginUser(worker.email, worker.password, `worker-${index + 1}`));
  }

  const location = await resolveTestLocation(adminSession, workerSessions);
  const services = await discoverServices();
  ensure(services.length > 0, 'No active services were discovered.');

  const servicesToTest = services.filter((service) => !service.isQuoteService);
  const subscriptionService = servicesToTest.find((service) => classifyService(service) === 'subscription') || null;
  const concurrencyService = servicesToTest.find((service) => ['instant', 'scheduled', 'spot_service'].includes(classifyService(service))) || servicesToTest[0];

  for (const service of servicesToTest) {
    await runServiceLifecycle(service, adminSession, workerSessions, location);
  }

  if (concurrencyService) {
    await runConcurrentBookingRace(concurrencyService, adminSession, location);
    await runWorkerAcceptRace(concurrencyService, workerSessions, location);
    await runFailureRecoveryTests(concurrencyService, adminSession, workerSessions, location);
    await runWorkerOfflineMidTask(concurrencyService, adminSession, workerSessions, location);
    await runCustomerCancellationTest(concurrencyService, adminSession, location);
    await runAdminOverrideTest(concurrencyService, adminSession, workerSessions, location);
  }

  if (subscriptionService) {
    await runSubscriptionAutoRenewTest(subscriptionService, adminSession, workerSessions, location);
  }

  const reportPath = await writeReportArtifacts();
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  if (summary.failCount > 0) {
    process.exitCode = 1;
  }
  return reportPath;
}

run().catch(async (error) => {
  console.error('System booking suite failed:', error);
  summary.criticalFailures.push({
    test_name: 'suite-bootstrap',
    booking_type: 'system',
    errors: [error.message],
  });
  await writeReportArtifacts().catch(() => {});
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect().catch(() => {});
  }
  process.exitCode = 1;
});
