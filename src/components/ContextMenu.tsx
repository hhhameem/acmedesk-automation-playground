import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const EDGE = 8;

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  // Callers usually pass an inline arrow; keep the latest one without
  // re-subscribing listeners (or re-running focus logic) on every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Measure after render (before paint) and keep the menu inside the viewport:
  // flip to the other side of the cursor when it would overflow, then clamp.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = x;
    if (left + w + EDGE > window.innerWidth) left = x - w;
    left = Math.max(EDGE, Math.min(left, window.innerWidth - w - EDGE));
    let top = y;
    if (top + h + EDGE > window.innerHeight) top = y - h;
    top = Math.max(EDGE, Math.min(top, window.innerHeight - h - EDGE));
    setPos({ left, top });
  }, [x, y, items.length]);

  // Focus management: move focus into the menu on open, restore it on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const menu = ref.current;
    menu?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    return () => {
      // Only restore if focus is still in the (now removed) menu, i.e. the user
      // didn't deliberately move it elsewhere (clicking into an input, etc.).
      const active = document.activeElement;
      const focusLost = !active || active === document.body || menu?.contains(active);
      if (focusLost && previouslyFocused && previouslyFocused !== document.body && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, []);

  // Close on outside pointer-down, Escape, scroll and resize.
  useEffect(() => {
    const close = () => onCloseRef.current();
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      close();
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, []);

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (nodes.length === 0) return;
    const i = nodes.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = i < 0 ? 0 : (i + 1) % nodes.length;
    else if (e.key === 'ArrowUp') next = i < 0 ? nodes.length - 1 : (i - 1 + nodes.length) % nodes.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = nodes.length - 1;
    else if (e.key === 'Tab') {
      e.preventDefault();
      onCloseRef.current();
      return;
    }
    if (next !== null) {
      e.preventDefault();
      nodes[next].focus({ preventScroll: true });
    }
  }

  return createPortal(
    <div
      ref={ref}
      data-testid="context-menu"
      role="menu"
      style={{ top: pos.top, left: pos.left }}
      className="fixed z-[90] min-w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onMenuKeyDown}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          tabIndex={-1}
          onClick={() => {
            item.onClick();
            onCloseRef.current();
          }}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-1.5 text-start hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:hover:bg-slate-800 dark:focus:bg-slate-800',
            item.danger ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200',
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
