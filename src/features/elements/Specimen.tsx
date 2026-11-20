import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  EMPTY_SNAPSHOT,
  LOGGED_EVENTS,
  REFRESH_EVENT,
  describeEvent,
  readSnapshot,
  serializeFormData,
  validationTarget,
  type Snapshot,
} from './probe';
import { useElT } from './strings';
import type { ElementSpec, Variant } from './catalog';

const LOG_SIZE = 8;

interface LogEntry {
  n: number;
  type: string;
  text: string;
}

/**
 * One variant of an element: the control itself, plus a readout of its value, validity
 * and events. The control lives in its own <form> (unless the variant brings its own),
 * so implicit submission, reset buttons and form data behave as they do on a real page.
 */
export function Specimen({ spec, variant }: { spec: ElementSpec; variant: Variant }) {
  const { t, locale } = useElT();
  const id = `el-${spec.slug}-${variant.key}`;
  const [generation, setGeneration] = useState(0);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [lastSubmit, setLastSubmit] = useState<string | null>(null);
  const total = useRef(0);

  const probe = useCallback(
    (el: HTMLElement) => el.querySelector<HTMLElement>(`#${CSS.escape(id)}`) ?? el,
    [id],
  );

  useEffect(() => {
    if (!root) return;
    let timer = 0;
    // Read after the event has finished, so handlers that change the control have run.
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setSnap(readSnapshot(probe(root))), 0);
    };
    const onEvent = (e: Event) => {
      if (e.type === 'submit' && e.target instanceof HTMLFormElement) {
        const form = e.target;
        // Never navigate away; dialogs still need their own submit to close.
        if (form.method !== 'dialog') e.preventDefault();
        let data: FormData;
        try {
          data = new FormData(form, (e as SubmitEvent).submitter);
        } catch {
          data = new FormData(form);
        }
        setLastSubmit(serializeFormData(data));
      }
      const entry = describeEvent(e);
      if (entry) {
        total.current += 1;
        const n = total.current;
        setLog((prev) => [{ n, ...entry }, ...prev].slice(0, LOG_SIZE));
      }
      schedule();
    };
    LOGGED_EVENTS.forEach((type) => root.addEventListener(type, onEvent, true));
    root.addEventListener(REFRESH_EVENT, schedule);
    schedule();
    return () => {
      window.clearTimeout(timer);
      LOGGED_EVENTS.forEach((type) => root.removeEventListener(type, onEvent, true));
      root.removeEventListener(REFRESH_EVENT, schedule);
    };
  }, [root, probe]);

  // Labels and messages change with the language; read the control again.
  useEffect(() => {
    if (root) setSnap(readSnapshot(probe(root)));
  }, [locale, root, probe]);

  function reset() {
    total.current = 0;
    setLog([]);
    setLastSubmit(null);
    setGeneration((g) => g + 1);
  }

  function checkValidity() {
    if (!root) return;
    validationTarget(probe(root))?.reportValidity();
    setSnap(readSnapshot(probe(root)));
  }

  function clearLog() {
    total.current = 0;
    setLog([]);
  }

  const Render = variant.render;
  const validState = snap.valid === null ? 'na' : snap.valid ? 'valid' : 'invalid';

  return (
    <section
      className="card overflow-hidden"
      aria-labelledby={`${id}-title`}
      data-testid={`${id}-card`}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h3 id={`${id}-title`} className="text-sm font-semibold">
          {t(variant.label)}
        </h3>
        <code
          dir="ltr"
          className="ms-auto rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          title="id / data-testid"
        >
          #{id}
        </code>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="space-y-3 p-4">
          {variant.hint && <p className="text-xs text-slate-500 dark:text-slate-400">{t(variant.hint)}</p>}
          {variant.ownForm ? (
            <div key={generation} ref={setRoot} data-testid={`${id}-stage`}>
              <Render id={id} t={t} locale={locale} />
            </div>
          ) : (
            <form
              key={generation}
              ref={setRoot}
              id={`${id}-form`}
              data-testid={`${id}-form`}
              aria-label={t(variant.label)}
            >
              <Render id={id} t={t} locale={locale} />
            </form>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="btn-secondary px-2.5 py-1 text-xs" onClick={checkValidity} data-testid={`${id}-check`}>
              <ShieldCheck className="h-3.5 w-3.5" /> {t('ro.check')}
            </button>
            <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={reset} data-testid={`${id}-reset`}>
              <RotateCcw className="h-3.5 w-3.5" /> {t('ro.reset')}
            </button>
          </div>
        </div>

        <aside
          className="border-t border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-950/40 lg:border-s lg:border-t-0"
          aria-label={t('ro.title')}
          data-testid={`${id}-readout`}
        >
          <dl className="space-y-2">
            <div>
              <dt className="font-semibold text-slate-500 dark:text-slate-400">{t('ro.value')}</dt>
              <dd
                dir="ltr"
                className="mt-0.5 break-all text-start font-mono text-slate-800 dark:text-slate-100"
                data-testid={`${id}-value`}
                data-value={snap.value}
              >
                "{snap.value}"
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500 dark:text-slate-400">{t('ro.validity')}</dt>
              <dd className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    'badge',
                    validState === 'valid' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
                    validState === 'invalid' && 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
                    validState === 'na' && 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                  )}
                  data-testid={`${id}-valid`}
                  data-valid={validState}
                >
                  {validState === 'na' ? t('ro.notValidated') : t(validState === 'valid' ? 'ro.valid' : 'ro.invalid')}
                </span>
                {snap.flags.map((f) => (
                  <code key={f} dir="ltr" className="font-mono text-[11px] text-rose-600 dark:text-rose-400" data-testid={`${id}-flag`}>
                    {f}
                  </code>
                ))}
              </dd>
            </div>
            {snap.message && (
              <div>
                <dt className="font-semibold text-slate-500 dark:text-slate-400">{t('ro.message')}</dt>
                <dd className="mt-0.5 text-slate-700 dark:text-slate-200" data-testid={`${id}-message`}>
                  {snap.message}
                </dd>
              </div>
            )}
            {lastSubmit !== null && (
              <div>
                <dt className="font-semibold text-slate-500 dark:text-slate-400">{t('ro.lastSubmit')}</dt>
                <dd
                  dir="ltr"
                  className="mt-0.5 break-all text-start font-mono text-slate-800 dark:text-slate-100"
                  data-testid={`${id}-submitted`}
                  data-value={lastSubmit}
                >
                  "{lastSubmit}"
                </dd>
              </div>
            )}
            <div>
              <dt className="flex items-center gap-2 font-semibold text-slate-500 dark:text-slate-400">
                {t('ro.events')}
                <span className="font-normal" data-testid={`${id}-event-count`} data-count={total.current}>
                  {t('ro.total', { n: total.current })}
                </span>
                {log.length > 0 && (
                  <button
                    type="button"
                    onClick={clearLog}
                    className="ms-auto inline-flex items-center gap-1 rounded px-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    data-testid={`${id}-clear-log`}
                  >
                    <Trash2 className="h-3 w-3" /> {t('ro.clear')}
                  </button>
                )}
              </dt>
              <dd className="mt-1">
                {log.length === 0 ? (
                  <p className="text-slate-400">{t('ro.noEvents')}</p>
                ) : (
                  <ol className="space-y-0.5 font-mono text-[11px]" dir="ltr" data-testid={`${id}-events`}>
                    {log.map((entry) => (
                      <li
                        key={entry.n}
                        className="truncate text-start text-slate-600 dark:text-slate-300"
                        data-event={entry.type}
                        title={entry.text}
                      >
                        <span className="text-slate-400">{entry.n}.</span> {entry.text}
                      </li>
                    ))}
                  </ol>
                )}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
