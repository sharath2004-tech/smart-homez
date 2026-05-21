/**
 * MSG91 OTP Widget wrapper
 *
 * Requires the otp-provider.js script loaded in index.html.
 * With exposeMethods: true, the widget exposes window.sendOtp / retryOtp / verifyOtp
 * and never shows a popup — your custom UI stays in full control.
 *
 * Flow:
 *  1. sendOtp('91XXXXXXXXXX')   — widget calls MSG91, OTP is sent
 *  2. verifyOtp('123456')       — widget verifies locally, returns an access token on success
 *  3. Send the token to your backend (/api/auth/verify-widget-token etc.)
 *     The backend calls MSG91's verifyAccessToken API to confirm it, then issues a platform JWT.
 *
 * Env vars required (in .env.local / .env.production):
 *   VITE_MSG91_WIDGET_ID   — widget ID from MSG91 dashboard
 *   VITE_MSG91_TOKEN_AUTH  — tokenAuth from MSG91 widget settings
 */

declare global {
  interface Window {
    initSendOTP: (config: object) => void;
    sendOtp: (
      identifier: string,
      success?: (data: unknown) => void,
      failure?: (err: unknown) => void,
    ) => void;
    retryOtp: (
      channel: string | null,
      success?: (data: unknown) => void,
      failure?: (err: unknown) => void,
      reqId?: string,
    ) => void;
    verifyOtp: (
      otp: string | number,
      success?: (data: unknown) => void,
      failure?: (err: unknown) => void,
      reqId?: string,
    ) => void;
  }
}

let initPromise: Promise<void> | null = null;
let nativeReqId: string | null = null;

type Msg91Response = { message?: string; token?: string; access_token?: string; type?: string };
type Msg91Error = { message?: string };

function isNativePlatform(): boolean {
  return !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.();
}

// Backend proxy base — routes native OTP through backend to avoid CORS/origin issues with MSG91
const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000/api';

async function proxyFetch(path: string, body: Record<string, unknown>): Promise<Msg91Response> {
  const res = await fetch(`${API_BASE}/auth${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json() as Msg91Response & { error?: { message?: string } };
  if (!res.ok || data.type === 'error') throw new Error(data.error?.message ?? data.message ?? 'OTP request failed');
  return data;
}

async function nativeSendOtp(identifier: string): Promise<void> {
  const data = await proxyFetch('/mobile/send-otp', { identifier });
  nativeReqId = (data as unknown as { reqId?: string }).reqId ?? data.message ?? null;
}

async function nativeRetryOtp(channel: string | null): Promise<void> {
  const body: Record<string, unknown> = { reqId: nativeReqId };
  if (channel) body.retryChannel = Number(channel);
  await proxyFetch('/mobile/retry-otp', body);
}

async function nativeVerifyOtp(otp: string): Promise<string> {
  const data = await proxyFetch('/mobile/verify-otp', { reqId: nativeReqId, otp });
  const token = (data as unknown as { token?: string }).token ?? data.message ?? data.access_token;
  if (!token) throw new Error('OTP verified but no token returned. Please try again.');
  return token;
}

function extractError(err: unknown): Error {
  return new Error((err as Msg91Error)?.message || 'OTP operation failed. Please try again.');
}

function waitForSendOtp(timeout = 6000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (typeof window.sendOtp === 'function') {
        resolve();
      } else if (Date.now() - start > timeout) {
        reject(new Error('MSG91 widget timed out. Please refresh and try again.'));
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

function init(): Promise<void> {
  if (initPromise) return initPromise;
  if (typeof window.initSendOTP !== 'function') {
    return Promise.reject(new Error('MSG91 OTP script not loaded. Check internet connection and index.html.'));
  }
  window.initSendOTP({
    widgetId: import.meta.env.VITE_MSG91_WIDGET_ID as string,
    tokenAuth: import.meta.env.VITE_MSG91_TOKEN_AUTH as string,
    exposeMethods: true,
    success: () => {},
    failure: () => {},
  });
  initPromise = waitForSendOtp();
  return initPromise;
}

/**
 * Send OTP to a phone number.
 * @param phone - Must include country code without "+": e.g. "919876543210"
 */
export function sendOtp(phone: string): Promise<void> {
  if (isNativePlatform()) return nativeSendOtp(phone);
  return init().then(
    () =>
      new Promise((resolve, reject) => {
        window.sendOtp(
          phone,
          () => resolve(),
          (err: unknown) => reject(extractError(err)),
        );
      }),
  );
}

/**
 * Resend OTP via a specific channel.
 * @param channel - null = widget default, '11' = SMS, '4' = Voice, '12' = WhatsApp, '3' = Email
 */
export function retryOtp(channel: string | null = null): Promise<void> {
  if (isNativePlatform()) return nativeRetryOtp(channel);
  return new Promise((resolve, reject) => {
    window.retryOtp(
      channel,
      () => resolve(),
      (err: unknown) => reject(extractError(err)),
    );
  });
}

/**
 * Verify the OTP entered by the user.
 * On success, returns the MSG91 access token — send this to your backend for server-side
 * verification before issuing a platform JWT.
 */
export function verifyOtp(otp: string): Promise<string> {
  if (isNativePlatform()) return nativeVerifyOtp(otp);
  return new Promise((resolve, reject) => {
    window.verifyOtp(
      otp,
      (data: unknown) => {
        const d = data as Msg91Response;
        const token = d?.message ?? d?.token ?? d?.access_token ?? String(data ?? '');
        if (!token) {
          reject(new Error('OTP verified but no token returned. Please try again.'));
          return;
        }
        resolve(token);
      },
      (err: unknown) => reject(extractError(err)),
    );
  });
}

/** Force re-initialisation (e.g. after widgetId changes between environments). */
export function resetWidget(): void {
  initPromise = null;
}
