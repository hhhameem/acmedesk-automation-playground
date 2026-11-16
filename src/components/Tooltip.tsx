import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: 'top' | 'bottom';
  align?: 'center' | 'start' | 'end';
  testId?: string;
}

export function Tooltip({ label, children, side = 'top', align = 'center', testId }: TooltipProps) {
  const id = useId();
  // Link the tooltip to its trigger for assistive tech when the child is a plain
  // DOM element (component children such as <NotificationBell /> may not forward
  // the prop, so they are left untouched).
  const trigger =
    isValidElement(children) && typeof children.type === 'string'
      ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
          'aria-describedby':
            [(children.props as { 'aria-describedby'?: string })['aria-describedby'], id]
              .filter(Boolean)
              .join(' '),
        })
      : children;

  return (
    <span className="group/tt relative inline-flex">
      {trigger}
      <span
        id={id}
        role="tooltip"
        data-testid={testId}
        className={cn(
          // Hidden with visibility AND opacity: `invisible` makes automation tools
          // (Playwright isVisible / toBeHidden) see it as hidden when not hovered,
          // while the opacity transition keeps the fade (transitioning `visibility`
          // keeps it visible until the fade-out finishes, then flips to hidden).
          // z-30 keeps it below dropdown panels (profile menu z-40, menus z-[90]).
          'pointer-events-none invisible absolute z-30 w-max max-w-48 whitespace-normal rounded-md bg-slate-900 px-2 py-1 text-center text-[11px] font-medium text-white opacity-0 shadow-lg transition-[opacity,visibility] duration-150 group-hover/tt:visible group-hover/tt:opacity-100 group-focus-within/tt:visible group-focus-within/tt:opacity-100 dark:bg-slate-700',
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          align === 'start'
            ? 'start-0'
            : align === 'end'
              ? 'end-0'
              : // `start-1/2` is `right: 50%` in RTL, so the shift must flip too.
                'start-1/2 -translate-x-1/2 rtl:translate-x-1/2',
        )}
      >
        {label}
      </span>
    </span>
  );
}