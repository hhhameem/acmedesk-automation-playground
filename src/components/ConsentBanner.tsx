import { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';

const KEY = 'testdesk-consent';
/** Dispatch on `window` after clearing the consent key to re-show the banner without a reload. */
export const CONSENT_RESET_EVENT = 'testdesk-consent-reset';

type Choice = 'accepted' | 'declined';

function readChoice(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function storeChoice(choice: Choice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* storage unavailable: the choice just won't persist */
  }
}

// Intentionally overlays the bottom of the viewport (occlusion edge case):
// while visible it can cover content near the bottom of the page.
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Hidden once the user made either choice.
    const sync = () => {
      const v = readChoice();
      setVisible(v !== 'accepted' && v !== 'declined');
    };
    sync();
    const onStorage = (e: StorageEvent) => {
      // key === null means localStorage.clear() in another tab.
      if (e.key === KEY || e.key === null) sync();
    };
    window.addEventListener(CONSENT_RESET_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CONSENT_RESET_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const choose = (choice: Choice) => {
    storeChoice(choice);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      data-testid="consent-banner"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Cookie className="h-4 w-4" />
          <span>TestDesk uses cookies to remember your preferences.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="consent-decline"
            className="btn-ghost text-sm"
            onClick={() => choose('declined')}
          >
            Decline
          </button>
          <button
            type="button"
            data-testid="consent-accept"
            className="btn-primary text-sm"
            onClick={() => choose('accepted')}
          >
            Accept cookies
          </button>
        </div>
      </div>
    </div>
  );
}
