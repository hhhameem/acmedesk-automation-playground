import { Suspense } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { FlaskConical, Moon, Sun, TextCursorInput } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { PageSkeleton } from '@/components/Skeleton';
import { cn } from '@/lib/cn';
import { LOCALES, useTranslation } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth';
import { useUIStore, type Locale } from '@/store/ui';
import { useElT } from '@/features/elements/strings';

const LABS = [
  { to: '/elements', key: 'nav.elements', icon: TextCursorInput, testId: 'practice-nav-elements' },
  { to: '/challenges', key: 'nav.challenges', icon: FlaskConical, testId: 'practice-nav-challenges' },
];

/**
 * Public shell for the practice labs (Element Lab and Challenge Lab): no sign-in,
 * no app sidebar. A header links the two labs and leads into the full app.
 */
export function PracticeLayout() {
  const { t } = useElT();
  const { t: tApp } = useTranslation();
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const locale = useUIStore((s) => s.locale);
  const setLocale = useUIStore((s) => s.setLocale);
  const signedIn = useAuthStore((s) => s.isAuthenticated);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950" data-testid="practice-layout">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <a href="/" aria-label="TestDesk home">
            <Logo />
          </a>
          <nav className="flex items-center gap-1" aria-label={t('lab.labs')}>
            {LABS.map(({ to, key, icon: Icon, testId }) => (
              <NavLink
                key={to}
                to={to}
                data-testid={testId}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {tApp(key)}
              </NavLink>
            ))}
          </nav>
          <span className="hidden rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 md:inline">
            {t('lab.badge')}
          </span>
          <div className="ms-auto flex items-center gap-2">
            <label htmlFor="practice-locale" className="sr-only">
              {t('lab.language')}
            </label>
            <select
              id="practice-locale"
              data-testid="practice-locale"
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
              data-testid="practice-theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to={signedIn ? '/dashboard' : '/login'}
              className="btn-primary hidden sm:inline-flex"
              data-testid="practice-open-app"
            >
              {t('lab.openApp')}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
