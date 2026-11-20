import { useEffect } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Moon, Sun, TextCursorInput } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/cn';
import { LOCALES } from '@/lib/i18n';
import { useUIStore, type Locale } from '@/store/ui';
import { ELEMENTS, GROUPS, findElement, type ElementSpec } from '@/features/elements/catalog';
import { Specimen } from '@/features/elements/Specimen';
import { useElT } from '@/features/elements/strings';

/**
 * Element Lab: every native HTML form element on its own page, public (no sign-in).
 * /elements lists them by group; /elements/:slug shows one element and its variants.
 */
export function ElementLab() {
  const { slug } = useParams();
  const { t, locale } = useElT();
  const spec = slug ? findElement(slug) : undefined;
  const title = t('lab.title');

  useEffect(() => {
    document.title = spec ? `${spec.code} · ${title} · TestDesk` : `${title} · TestDesk`;
  }, [spec, title, locale]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950" data-testid="element-lab">
      <LabHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">
        {!slug ? <Overview /> : spec ? <ElementPage spec={spec} /> : <Missing slug={slug} />}
      </main>
    </div>
  );
}

function LabHeader() {
  const { t } = useElT();
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const locale = useUIStore((s) => s.locale);
  const setLocale = useUIStore((s) => s.setLocale);

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <a href="/" aria-label="TestDesk">
          <Logo />
        </a>
        <Link
          to="/elements"
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-brand-600 dark:text-slate-200"
          data-testid="element-lab-home"
        >
          <TextCursorInput className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          {t('lab.title')}
        </Link>
        <span className="hidden rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 sm:inline">
          {t('lab.badge')}
        </span>
        <div className="ms-auto flex items-center gap-2">
          <label htmlFor="element-lab-locale" className="sr-only">
            {t('lab.language')}
          </label>
          <select
            id="element-lab-locale"
            data-testid="element-lab-locale"
            className="input w-auto py-1.5"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
          >
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-ghost p-2"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('lab.light') : t('lab.dark')}
            title={theme === 'dark' ? t('lab.light') : t('lab.dark')}
            data-testid="element-lab-theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link to="/login" className="btn-primary hidden sm:inline-flex" data-testid="element-lab-open-app">
            {t('lab.openApp')}
          </Link>
        </div>
      </div>
    </header>
  );
}

function Overview() {
  const { t } = useElT();
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t('lab.title')}</h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">{t('lab.tagline')}</p>
      </section>

      <section className="card p-5" aria-labelledby="element-lab-how">
        <h2 id="element-lab-how" className="text-sm font-semibold">
          {t('lab.how')}
        </h2>
        <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-slate-600 dark:text-slate-300">
          <li>{t('lab.how.ids')}</li>
          <li>{t('lab.how.readout')}</li>
          <li>{t('lab.how.reset')}</li>
          <li>{t('lab.how.events')}</li>
          <li>{t('lab.how.links')}</li>
        </ul>
      </section>

      {GROUPS.map((g) => {
        const items = ELEMENTS.filter((e) => e.group === g.key);
        return (
          <section key={g.key} aria-labelledby={`element-group-${g.key}`} data-testid={`element-group-${g.key}`}>
            <h2 id={`element-group-${g.key}`} className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(g.label)}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((e) => (
                <Link
                  key={e.slug}
                  to={`/elements/${e.slug}`}
                  className="card flex flex-col gap-1.5 p-4 transition hover:border-brand-400 hover:shadow-md"
                  data-testid={`element-link-${e.slug}`}
                >
                  <code dir="ltr" className="text-start font-mono text-sm font-semibold text-brand-700 dark:text-brand-300">
                    {e.code}
                  </code>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t(e.desc)}</p>
                  <span className="mt-auto pt-1 text-xs text-slate-400">{t('lab.variants', { n: e.variants.length })}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ElementNav({ current }: { current: string }) {
  const { t } = useElT();
  const navigate = useNavigate();
  return (
    <>
      {/* Small screens: a native select to jump between elements. */}
      <div className="lg:hidden">
        <label htmlFor="element-lab-jump" className="mb-1 block text-xs font-semibold text-slate-500">
          {t('lab.jump')}
        </label>
        <select
          id="element-lab-jump"
          data-testid="element-lab-jump"
          className="input"
          value={current}
          onChange={(e) => navigate(`/elements/${e.target.value}`)}
        >
          {GROUPS.map((g) => (
            <optgroup key={g.key} label={t(g.label)}>
              {ELEMENTS.filter((e) => e.group === g.key).map((e) => (
                <option key={e.slug} value={e.slug}>
                  {e.code}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <nav className="hidden space-y-4 lg:block" aria-label={t('lab.all')} data-testid="element-lab-nav">
        {GROUPS.map((g) => (
          <div key={g.key}>
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t(g.label)}</p>
            <ul className="space-y-0.5">
              {ELEMENTS.filter((e) => e.group === g.key).map((e) => (
                <li key={e.slug}>
                  <NavLink
                    to={`/elements/${e.slug}`}
                    dir="ltr"
                    className={({ isActive }) =>
                      cn(
                        'block truncate rounded-md px-2 py-1 text-start font-mono text-xs',
                        isActive
                          ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                          : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-900',
                      )
                    }
                  >
                    {e.code}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}

function ElementPage({ spec }: { spec: ElementSpec }) {
  const { t } = useElT();
  const index = ELEMENTS.indexOf(spec);
  const prev = ELEMENTS[index - 1];
  const next = ELEMENTS[index + 1];

  return (
    <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
        <ElementNav current={spec.slug} />
      </aside>

      <div className="min-w-0 space-y-5" data-testid={`element-page-${spec.slug}`}>
        <Link to="/elements" className="inline-block text-sm text-brand-600 hover:underline dark:text-brand-400">
          {t('lab.back')}
        </Link>
        <header className="space-y-2">
          <h1 dir="ltr" className="text-start font-mono text-xl font-semibold" data-testid="element-title">
            {spec.code}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t(spec.desc)}</p>
        </header>

        {spec.variants.map((v) => (
          <Specimen key={v.key} spec={spec} variant={v} />
        ))}

        <nav className="flex items-center justify-between gap-3 pt-2" aria-label={t('lab.all')}>
          {prev ? (
            <Link to={`/elements/${prev.slug}`} className="btn-secondary" data-testid="element-prev">
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" /> {t('lab.prev')}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to={`/elements/${next.slug}`} className="btn-secondary" data-testid="element-next">
              {t('lab.next')} <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}

function Missing({ slug }: { slug: string }) {
  const { t } = useElT();
  return (
    <div className="card mx-auto max-w-md p-8 text-center" data-testid="element-not-found">
      <h1 className="text-lg font-semibold">{t('lab.notFound')}</h1>
      <p className="mt-2 text-sm text-slate-500">{t('lab.notFoundBody', { slug })}</p>
      <Link to="/elements" className="btn-primary mt-4">
        {t('lab.all')}
      </Link>
    </div>
  );
}
