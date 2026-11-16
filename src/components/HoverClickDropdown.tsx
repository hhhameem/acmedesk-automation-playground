import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface DropdownItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  danger?: boolean;
}

interface HoverClickDropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'start' | 'end';
  testId?: string;
  ariaLabel?: string;
  triggerClassName?: string;
}

export function HoverClickDropdown({
  trigger,
  items,
  align = 'end',
  testId = 'hover-click-dropdown',
  ariaLabel,
  triggerClassName,
}: HoverClickDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // How the menu was opened. A real pointer click (e.g. Playwright's click())
  // moves the mouse first, so `mouseenter` opens the menu just before `click`
  // fires. That click must not toggle the hover-opened menu closed again.
  const openedBy = useRef<'hover' | 'click' | null>(null);

  const show = (via: 'hover' | 'click') => {
    openedBy.current = via;
    setOpen(true);
  };
  const hide = () => {
    openedBy.current = null;
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) hide();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const hadFocus = ref.current?.contains(document.activeElement) ?? false;
        hide();
        if (hadFocus) triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => {
        if (!open) show('hover');
      }}
      onMouseLeave={hide}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        data-testid={`${testId}-trigger`}
        ref={triggerRef}
        onClick={() => {
          if (!open) show('click');
          // First click after a hover-open "pins" the menu instead of closing it.
          else if (openedBy.current === 'hover') openedBy.current = 'click';
          else hide();
        }}
        className={cn('flex items-center', triggerClassName)}
      >
        {trigger}
      </button>

      {open && (
        <div className={cn('absolute top-full z-40 pt-2', align === 'end' ? 'end-0' : 'start-0')}>
          <div
            role="menu"
            data-testid={testId}
            className="min-w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            {items.map((item, i) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                data-testid={`${testId}-item-${i}`}
                onClick={() => {
                  item.onSelect();
                  hide();
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-start hover:bg-slate-100 dark:hover:bg-slate-800',
                  item.danger
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-700 dark:text-slate-200',
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
