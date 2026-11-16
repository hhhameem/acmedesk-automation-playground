import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Demo credentials. The username is fixed; the password is NOT — the sign-in
// screen generates a fresh random one every time it loads (and when the user
// goes "Back" from the OTP step) and prints it in the hint box, so it has to be
// read from the page rather than hard-coded. The one-time code is random too
// and is emailed to the demo inbox (see lib/otp).
export const TEST_USERNAME = 'analyst';

const PASSWORD_LENGTH = 10;
// No look-alike characters (0/O, 1/l/I) so the value is unambiguous when read.
const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const ALL = LOWER + UPPER + DIGITS;

function pick(chars: string): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return chars[buf[0] % chars.length];
}

/** A new random password with at least one lowercase, uppercase and digit. */
export function generatePassword(): string {
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)];
  while (chars.length < PASSWORD_LENGTH) chars.push(pick(ALL));
  // Fisher–Yates shuffle so the guaranteed classes aren't always up front.
  for (let i = chars.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function checkCredentials(username: string, password: string, expectedPassword: string): boolean {
  return username.trim() === TEST_USERNAME && password === expectedPassword;
}

export interface AuthUser {
  username: string;
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  location: string;
  bio: string;
}

export type ProfileFields = Omit<AuthUser, 'username'>;

const EMPTY_PROFILE: ProfileFields = {
  name: '',
  email: '',
  phone: '',
  jobTitle: '',
  department: '',
  location: '',
  bio: '',
};

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  signIn: (username: string) => void;
  updateProfile: (patch: Partial<ProfileFields>) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      signIn: (username) =>
        set({ user: { username, ...EMPTY_PROFILE }, isAuthenticated: true }),
      updateProfile: (patch) =>
        set((s) => (s.user ? { user: { ...s.user, ...patch } } : {})),
      signOut: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'testdesk-auth',
      version: 2,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as {
          user?: Partial<AuthUser> | null;
          isAuthenticated?: boolean;
        };
        if (state.user) {
          state.user = { ...EMPTY_PROFILE, ...state.user };
        }
        return state as AuthState;
      },
    },
  ),
);

// Keep the session in sync across tabs: signing in/out or editing the profile in
// one tab is picked up by the others instead of being overwritten by them.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'testdesk-auth' || e.key === null) void useAuthStore.persist.rehydrate();
  });
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
