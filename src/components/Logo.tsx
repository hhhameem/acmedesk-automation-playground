import { useId } from 'react';
import { cn } from '@/lib/cn';

interface LogoProps {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  /** Render only the square mark (no "TestDesk" wordmark). */
  markOnly?: boolean;
}

/**
 * TestDesk logo — an inspector-style selection frame (locate) wrapped around a
 * check mark (assert), with a twinkling "cursor" dot. Locate → act → assert.
 */
export function Logo({ className, markClassName, wordmarkClassName, markOnly = false }: LogoProps) {
  const gradientId = `testdesk-logo-${useId().replace(/[:]/g, '')}`;

  return (
    <span className={cn('group/logo flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'relative grid h-8 w-8 shrink-0 place-items-center transition-transform duration-300 group-hover/logo:scale-105 motion-reduce:transition-none',
          markClassName,
        )}
      >
        <span className="absolute inset-1 animate-logo-glow rounded-full bg-brand-500/40 blur-md motion-reduce:animate-none" />
        <svg
          viewBox="0 0 24 24"
          className="relative h-[90%] w-[90%] animate-logo-mark motion-reduce:animate-none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#818cf8" />
              <stop offset="0.55" stopColor="#6366f1" />
              <stop offset="1" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          {/* App tile */}
          <rect x="2" y="2" width="20" height="20" rx="6" fill={`url(#${gradientId})`} />
          {/* Selection frame — the "locator" corners */}
          <g
            fill="none"
            stroke="#fff"
            strokeOpacity="0.8"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9.5V7.5A1.5 1.5 0 0 1 7.5 6h2" />
            <path d="M14.5 6h2A1.5 1.5 0 0 1 18 7.5v2" />
            <path d="M18 14.5v2a1.5 1.5 0 0 1-1.5 1.5h-2" />
            <path d="M9.5 18h-2A1.5 1.5 0 0 1 6 16.5v-2" />
          </g>
          {/* Assertion — the check */}
          <path
            d="M9 12.2 11.1 14.3 15.1 9.9"
            fill="none"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Cursor spark */}
          <circle
            className="animate-logo-twinkle [transform-box:fill-box] [transform-origin:center] motion-reduce:animate-none"
            cx="19.2"
            cy="4.8"
            r="1.5"
            fill="#fde68a"
            stroke="#fff"
            strokeWidth="0.6"
          />
        </svg>
      </span>
      {!markOnly && (
        <span className={cn('text-lg font-semibold leading-none tracking-tight', wordmarkClassName)}>
          <span className="animate-logo-text bg-gradient-to-r from-slate-900 via-slate-400 to-slate-900 bg-clip-text text-transparent [background-size:200%_auto] dark:from-white dark:via-slate-500 dark:to-white">
            Test
          </span>
          <span className="animate-logo-text bg-gradient-to-r from-brand-600 via-violet-500 to-brand-600 bg-clip-text text-transparent [background-size:200%_auto] [animation-delay:1.2s] dark:from-brand-400 dark:via-violet-400 dark:to-brand-400">
            Desk
          </span>
        </span>
      )}
    </span>
  );
}
