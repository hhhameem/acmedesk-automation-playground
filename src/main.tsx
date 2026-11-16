import React from 'react';
import ReactDOM from 'react-dom/client';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import './index.css';

const queryClient: QueryClient = new QueryClient({
  // Any successful write can change data shown elsewhere (lists, counts,
  // dashboards, detail pages), so mark every cached query stale. Only the
  // queries on screen refetch immediately; the rest refetch when next used.
  mutationCache: new MutationCache({
    onSuccess: () => void queryClient.invalidateQueries(),
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

async function enableMocking() {
  const { startMockBackend } = await import('./mocks/browser');
  await startMockBackend({
    // Another tab changed the data: refetch whatever this tab is showing.
    onExternalDataChange: () => void queryClient.invalidateQueries(),
  });
}

/**
 * The whole app depends on the in-browser backend. If it can't start (service
 * workers blocked: some private windows, browser policies, or plain http on a
 * LAN address), say so instead of leaving the loading screen up forever.
 */
function showStartupError(err: unknown) {
  console.error('[TestDesk] Could not start the in-browser backend:', err);
  const root = document.getElementById('root');
  if (!root) return;
  const insecure = !window.isSecureContext;
  root.innerHTML = `
    <div class="boot" role="alert" data-testid="app-startup-error" style="padding:24px;text-align:center">
      <strong style="font-size:16px;color:inherit">TestDesk couldn't start</strong>
      <span style="max-width:420px;line-height:1.5"></span>
      <button type="button" class="btn-primary">Try again</button>
    </div>`;
  const message = root.querySelector('span');
  if (message) {
    message.textContent = insecure
      ? 'This page must be opened over https:// or on localhost, because it needs a service worker.'
      : 'The browser blocked the service worker this demo uses (private windows and some policies do this). Try a normal window or another browser.';
  }
  root.querySelector('button')?.addEventListener('click', () => window.location.reload());
}

function renderApp() {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

enableMocking().then(renderApp, showStartupError);
