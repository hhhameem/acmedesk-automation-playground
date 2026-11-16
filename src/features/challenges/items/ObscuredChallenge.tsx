import { useEffect, useRef, useState } from 'react';
import { ChallengeShell } from '../ChallengeShell';

const TOAST_MS = 3000;

export function ObscuredChallenge() {
  const [adOpen, setAdOpen] = useState(true);
  const [footerOpen, setFooterOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
  const [toastOpen, setToastOpen] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  function save() {
    setSaved(true);
    setSaveCount((n) => n + 1);
    // A local toast deliberately lands on top of the action area (the global toast host
    // renders top-right, far from the button), so a second click is intercepted until it goes.
    setToastOpen(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastOpen(false), TOAST_MS);
  }

  return (
    <ChallengeShell
      title="Overlays & occlusion"
      tier="medium"
      blurb="The primary button is covered by an ad overlay and a sticky cookie bar. Clicks on the button land on the overlay until you clear it — a classic 'element intercepts pointer events' failure."
      goal={[
        'Close the interstitial ad, then click "Save preferences".',
        'Accept (or decline) the sticky cookie bar pinned to the bottom.',
        'After saving, a toast covers the action for ~3s — wait for it to disappear before clicking "Save preferences" again.',
      ]}
      selector='getByRole("button", { name: "Save preferences" })'
    >
      <div className="relative space-y-5">
        <div className="relative overflow-hidden rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <fieldset className="space-y-2" disabled={adOpen}>
            <legend className="text-sm font-medium">Notification preferences</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" defaultChecked /> Product updates
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" /> Security alerts
            </label>
            <button
              type="button"
              className="btn-primary mt-2"
              onClick={save}
            >
              Save preferences
            </button>
          </fieldset>

          {adOpen && (
            <div className="overlay absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-900/80 p-6 text-center backdrop-blur-sm">
              <p className="text-sm font-semibold text-white">Upgrade to TestDesk Pro</p>
              <p className="text-xs text-slate-300">Unlock unlimited automations and priority support.</p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setAdOpen(false)}
              >
                No thanks, continue
              </button>
            </div>
          )}

          {toastOpen && (
            <div
              role="status"
              data-testid="obscuring-toast"
              className="toast absolute inset-x-2 bottom-2 z-30 flex min-h-[4.5rem] items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-lg dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
            >
              <span className="font-semibold">Settings updated</span>
              <span className="text-xs opacity-80">This notice covers the button for a few seconds.</span>
            </div>
          )}
        </div>

        {saved && (
          <p className="result text-sm text-emerald-600 dark:text-emerald-400">
            Preferences saved.{' '}
            <span className="text-xs text-slate-500" data-testid="save-count">
              Saves: {saveCount}
            </span>
          </p>
        )}

        <div className="h-24" />

        {footerOpen && (
          <div className="bar fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 text-sm">
              <span>We use cookies to improve your experience. (Sticky bar covering the page bottom.)</span>
              <span className="flex gap-2">
                <button type="button" className="btn-ghost" onClick={() => setFooterOpen(false)}>
                  Decline
                </button>
                <button type="button" className="btn-primary" onClick={() => setFooterOpen(false)}>
                  Accept cookies
                </button>
              </span>
            </div>
          </div>
        )}
      </div>
    </ChallengeShell>
  );
}
