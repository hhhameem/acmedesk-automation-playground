// Runtime-mutable mock backend configuration. Adjustable from Settings so you can
// practice slow/failing network conditions deterministically.
//
// Saved in localStorage so the settings survive reloads and apply to every open
// tab (a `storage` event keeps other tabs in sync).

const KEY = 'testdesk-mock-config';

const DEFAULTS = {
  latencyMs: 250,
  failureRate: 0,
  pageSize: 20,
};

export type MockConfig = typeof DEFAULTS;

export const mockConfig: MockConfig = { ...DEFAULTS };

function sanitize(raw: unknown): MockConfig {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof MockConfig, unknown>>;
  const num = (x: unknown, fallback: number, min: number, max: number) => {
    const n = Number(x);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  return {
    latencyMs: num(v.latencyMs, DEFAULTS.latencyMs, 0, 60_000),
    failureRate: num(v.failureRate, DEFAULTS.failureRate, 0, 1),
    pageSize: Math.round(num(v.pageSize, DEFAULTS.pageSize, 1, 500)),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    Object.assign(mockConfig, raw ? sanitize(JSON.parse(raw)) : DEFAULTS);
  } catch {
    // Storage unavailable — keep the in-memory defaults.
  }
}

/** Update the simulation settings for this tab and every other open tab. */
export function saveMockConfig(next: Partial<MockConfig>) {
  Object.assign(mockConfig, sanitize({ ...mockConfig, ...next }));
  try {
    localStorage.setItem(KEY, JSON.stringify(mockConfig));
  } catch {
    // Storage unavailable — the change applies to this tab only.
  }
}

load();
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) load();
  });
}
