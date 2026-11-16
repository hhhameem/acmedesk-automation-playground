// Random one-time codes for the sign-in flow, "delivered" to a demo inbox.
//
// The code is never shown on the sign-in page. Each time the OTP step is
// reached (or "Resend code" is clicked) a fresh code is generated and an email
// is dropped into the demo inbox (/inbox), which is meant to be opened in a new
// tab. Messages live in localStorage so both tabs see the same mailbox, and a
// `storage` event keeps the inbox live across tabs.
//
// Rules: only the most recent code is accepted, it expires after
// OTP_EXPIRY_SECONDS, and it can be used once.

const KEY = 'testdesk-otp-inbox';
const EVENT = 'testdesk-otp-changed';
const MAX_MESSAGES = 6;

/**
 * How long a one-time code stays valid. This is the single source of truth:
 * the sign-in countdown, the resend lock, the inbox email copy and the
 * Capabilities page all derive from it.
 */
export const OTP_EXPIRY_SECONDS = 60;
export const OTP_TTL_MS = OTP_EXPIRY_SECONDS * 1000;

/** Simulated email delivery delay: each code lands in the inbox after a random 1–5s. */
export const OTP_DELIVERY_MIN_SECONDS = 1;
export const OTP_DELIVERY_MAX_SECONDS = 5;
export const OTP_MAILBOX = 'analyst@testdesk.io';

export interface OtpMessage {
  id: string;
  code: string;
  /** When the code was generated; expiry counts from here. */
  issuedAt: number;
  /** When the email shows up in the inbox (simulated delivery delay). */
  deliverAt: number;
  expiresAt: number;
  used: boolean;
}

export type OtpCheck = 'ok' | 'invalid' | 'expired';

function read(): OtpMessage[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as OtpMessage[]) : [];
  } catch {
    return [];
  }
}

function write(messages: OtpMessage[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(messages));
  } catch {
    // Storage unavailable — the inbox simply won't sync across tabs.
  }
  window.dispatchEvent(new Event(EVENT));
}

function randomCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  // 100000–999999: always six digits, no leading zero to trip up numeric inputs.
  return String(100000 + (buf[0] % 900000));
}

function randomBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Generate a new code, invalidating any earlier one, and "send" it. */
export function issueOtp(): OtpMessage {
  const now = Date.now();
  const message: OtpMessage = {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    code: randomCode(),
    issuedAt: now,
    deliverAt: now + randomBetween(OTP_DELIVERY_MIN_SECONDS * 1000, OTP_DELIVERY_MAX_SECONDS * 1000),
    expiresAt: now + OTP_TTL_MS,
    used: false,
  };
  write([message, ...read()].slice(0, MAX_MESSAGES));
  return message;
}

/** Check a code against the latest issued one. A successful check consumes it. */
export function verifyOtp(input: string): OtpCheck {
  const messages = read();
  const latest = messages[0];
  if (!latest || latest.used || input.trim() !== latest.code) return 'invalid';
  if (Date.now() > latest.expiresAt) return 'expired';
  write([{ ...latest, used: true }, ...messages.slice(1)]);
  return 'ok';
}

/** Messages that have been delivered so far, newest first. */
export function deliveredMessages(now = Date.now()): OtpMessage[] {
  return read().filter((m) => m.deliverAt <= now);
}

export function clearInbox() {
  write([]);
}

/** Subscribe to inbox changes from this tab and from other tabs. */
export function subscribeOtp(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) callback();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(EVENT, callback);
  };
}
