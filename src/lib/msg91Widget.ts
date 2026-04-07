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

let initialized = false;

type Msg91Response = { message?: string; token?: string; access_token?: string };
type Msg91Error = { message?: string };

function extractError(err: unknown): Error {
  return new Error((err as Msg91Error)?.message || 'OTP operation failed. Please try again.');
}

function init(): void {
  if (initialized) return;
  if (typeof window.initSendOTP !== 'function') {
    throw new Error('MSG91 OTP script not loaded. Check internet connection and index.html.');
  }
  window.initSendOTP({
    widgetId: import.meta.env.VITE_MSG91_WIDGET_ID as string,
    tokenAuth: import.meta.env.VITE_MSG91_TOKEN_AUTH as string,
    exposeMethods: true,
    success: () => {},
    failure: () => {},
  });
  initialized = true;
}

/**
 * Send OTP to a phone number.
 * @param phone - Must include country code without "+": e.g. "919876543210"
 */
export function sendOtp(phone: string): Promise<void> {
  return new Promise((resolve, reject) => {
    init();
    window.sendOtp(
      phone,
      () => resolve(),
      (err: unknown) => reject(extractError(err)),
    );
  });
}

/**
 * Resend OTP via a specific channel.
 * @param channel - null = widget default, '11' = SMS, '4' = Voice, '12' = WhatsApp, '3' = Email
 */
export function retryOtp(channel: string | null = null): Promise<void> {
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
  initialized = false;
}
