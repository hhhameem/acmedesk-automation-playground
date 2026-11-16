import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { store } from './store';

export const worker = setupWorker(...handlers);

export interface MockBackendOptions {
  /** Called when the data was changed by another tab, so the UI can refetch. */
  onExternalDataChange?: () => void;
}

/**
 * Start the in-browser backend: load the shared dataset, then start serving
 * /api requests. `?reset=1` in the URL restores the seed data first (handy for
 * automation that needs a clean, known state).
 */
export async function startMockBackend({ onExternalDataChange }: MockBackendOptions = {}) {
  await store.init();

  const url = new URL(window.location.href);
  if (url.searchParams.has('reset')) {
    try {
      await store.reset();
      url.searchParams.delete('reset');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    } catch (err) {
      // Keep ?reset=1 in the URL so a reload retries, and make the failure visible:
      // a test that asked for clean data must not silently run on old data.
      console.error('[TestDesk] ?reset=1 failed — data was NOT reset:', err);
      document.documentElement.dataset.resetFailed = 'true';
    }
  }

  if (onExternalDataChange) store.onExternalChange(onExternalDataChange);
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
}
