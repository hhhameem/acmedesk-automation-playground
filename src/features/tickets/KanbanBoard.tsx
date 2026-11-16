import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Ticket, TicketStatus } from '@/lib/domain';
import { PriorityBadge } from '@/components/Badges';
import { relativeTime } from '@/lib/format';

const COLUMNS: { status: TicketStatus; label: string; accent: string }[] = [
  { status: 'open', label: 'Open', accent: 'border-sky-400' },
  { status: 'pending', label: 'Pending', accent: 'border-amber-400' },
  { status: 'resolved', label: 'Resolved', accent: 'border-emerald-400' },
  { status: 'closed', label: 'Closed', accent: 'border-slate-400' },
];

interface KanbanBoardProps {
  tickets: Ticket[];
  onDrop: (ticketId: string, status: TicketStatus) => void;
}

export function KanbanBoard({ tickets, onDrop }: KanbanBoardProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TicketStatus | null>(null);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="kanban-board">
      {COLUMNS.map((col) => {
        const items = tickets.filter((t) => t.status === col.status);
        return (
          <div
            key={col.status}
            data-testid={`kanban-column-${col.status}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (overStatus !== col.status) setOverStatus(col.status);
            }}
            onDragLeave={(e) => {
              // Moving over a card inside the column also fires dragleave on the
              // column; only clear the highlight when the pointer really leaves it.
              if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
              setOverStatus((s) => (s === col.status ? null : s));
            }}
            onDrop={(e) => {
              e.preventDefault();
              setOverStatus(null);
              // Prefer the id carried by the drag itself (works for synthetic drags too).
              const id = e.dataTransfer.getData('text/plain') || dragId;
              setDragId(null);
              const ticket = id ? tickets.find((t) => t.id === id) : undefined;
              // Dropping a card back onto its own column is not a change.
              if (ticket && ticket.status !== col.status) onDrop(ticket.id, col.status);
            }}
            className={`rounded-xl border-t-4 bg-slate-50 p-3 transition-colors dark:bg-slate-900/60 ${col.accent} ${
              overStatus === col.status ? 'bg-brand-50 dark:bg-brand-950/40' : ''
            }`}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-sm font-semibold">{col.label}</span>
              <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {items.length}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((ticket) => (
                <div
                  key={ticket.id}
                  draggable
                  data-testid={`kanban-card-${ticket.ref}`}
                  aria-roledescription="draggable ticket"
                  onDragStart={(e) => {
                    // Firefox only starts an HTML5 drag when data is set.
                    e.dataTransfer.setData('text/plain', ticket.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDragId(ticket.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverStatus(null);
                  }}
                  className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800"
                >
                  <Link
                    to={`/tickets/${ticket.id}`}
                    className="text-sm font-medium hover:text-brand-600 dark:hover:text-brand-400"
                  >
                    {ticket.subject}
                  </Link>
                  <div className="mt-2 flex items-center justify-between">
                    <PriorityBadge priority={ticket.priority} />
                    <span className="font-mono text-[11px] text-slate-400">{ticket.ref}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-400">{relativeTime(ticket.updatedAt)}</p>
                    {/* Keyboard / no-drag alternative for moving a card. */}
                    <select
                      aria-label={`Move ${ticket.ref} to`}
                      data-testid={`kanban-move-${ticket.ref}`}
                      className="rounded border border-slate-200 bg-transparent px-1 py-0.5 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-300"
                      value={ticket.status}
                      onChange={(e) => onDrop(ticket.id, e.target.value as TicketStatus)}
                    >
                      {COLUMNS.map((c) => (
                        <option key={c.status} value={c.status}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="py-6 text-center text-xs text-slate-400">Drop tickets here</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
