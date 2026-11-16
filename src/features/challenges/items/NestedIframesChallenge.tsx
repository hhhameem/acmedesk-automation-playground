import { useEffect, useRef, useState } from 'react';
import { ChallengeShell } from '../ChallengeShell';

interface StatusPayload {
  transit?: number;
}

export function NestedIframesChallenge() {
  const [spawned, setSpawned] = useState(false);
  const [wide, setWide] = useState(false);
  const [shown, setShown] = useState(false);
  // Refreshes relayed up two levels (inner status frame → vendor portal → this page).
  const [relayCount, setRelayCount] = useState(0);
  const [lastRelayed, setLastRelayed] = useState<number | null>(null);
  // Refreshes posted straight to this page by the spawned / revealed status frames (one level).
  const [directCount, setDirectCount] = useState(0);
  const vendorFrameRef = useRef<HTMLIFrameElement>(null);
  const framesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { source?: string; type?: string; payload?: StatusPayload } | null;
      if (!data || typeof data !== 'object') return;

      // Only trust messages coming from this challenge's own iframes.
      const vendorWin = vendorFrameRef.current?.contentWindow ?? null;
      if (data.source === 'testdesk-vendor' && data.type === 'status-refreshed') {
        if (!vendorWin || e.source !== vendorWin) return;
        setRelayCount((n) => n + 1);
        if (typeof data.payload?.transit === 'number') setLastRelayed(data.payload.transit);
        return;
      }

      if (data.source === 'testdesk-vendor-status') {
        const frames = Array.from(framesRef.current?.querySelectorAll('iframe') ?? []);
        const fromDirectFrame = frames.some(
          (f) => f !== vendorFrameRef.current && f.contentWindow === e.source,
        );
        if (fromDirectFrame) setDirectCount((n) => n + 1);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <ChallengeShell
      title="Nested & dynamic iframes"
      tier="hard"
      blurb="One iframe renders immediately and contains another iframe (two levels). Others are spawned after a delay, resized on demand, or hidden until revealed."
      goal={[
        'Switch into the Vendor portal iframe, then into its inner status iframe and click "Refresh status" — the "Relayed refreshes" count on this page must increase by 1.',
        'Click "Spawn iframe", wait for the frame to appear, then read the "In transit" value inside it.',
        'Toggle the width, then reveal the hidden iframe and read its transit value.',
      ]}
      selector='iframe.frame'
    >
      <div ref={framesRef} className="space-y-4">
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50"
          aria-live="polite"
        >
          <span>
            Relayed refreshes:{' '}
            <strong className="font-mono" data-testid="relay-count">
              {relayCount}
            </strong>
          </span>
          <span className="text-slate-500">
            Last relayed in transit:{' '}
            <span className="font-mono" data-testid="relay-last-transit">
              {lastRelayed ?? '—'}
            </span>
          </span>
          <span className="text-slate-500">
            Direct refreshes (spawned / revealed frames):{' '}
            <span className="font-mono" data-testid="direct-count">
              {directCount}
            </span>
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => setSpawned(true)}>
            Spawn iframe (after 800ms)
          </button>
          <button type="button" className="btn-secondary" onClick={() => setWide((w) => !w)}>
            {wide ? 'Shrink' : 'Widen'} nested iframe
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShown((s) => !s)}
          >
            {shown ? 'Hide' : 'Show'} hidden iframe
          </button>
        </div>

        <div
          className={`overflow-hidden rounded-lg border border-slate-200 transition-all dark:border-slate-700 ${
            wide ? 'w-full' : 'w-[340px]'
          }`}
        >
          <iframe
            ref={vendorFrameRef}
            title="Vendor portal"
            src="/embed/vendor.html"
            className="frame block h-[280px] w-full border-0 bg-white"
          />
        </div>

        {spawned && <SpawnedIframe />}

        {shown && (
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <iframe
              title="Status panel"
              src="/embed/vendor-status.html"
              className="frame block h-[240px] w-full border-0 bg-white"
            />
          </div>
        )}
      </div>
    </ChallengeShell>
  );
}

function SpawnedIframe() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 800);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready) {
    return (
      <p className="pending text-sm text-slate-400">Spawning iframe…</p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <iframe
            title="Status panel"
            src="/embed/vendor-status.html"
            className="frame block h-[240px] w-full border-0 bg-white"
          />
    </div>
  );
}
