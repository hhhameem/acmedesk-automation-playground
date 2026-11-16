import { useRef, useState } from 'react';
import { ChallengeShell } from '../ChallengeShell';
import { cn } from '@/lib/cn';

const START = ['Draft release notes', 'Review metrics', 'Update changelog', 'Tag release'];
const CARDS = ['Ship it', 'Write docs', 'Fix bug'];

export function DragDropChallenge() {
  const [order, setOrder] = useState<string[]>(START);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [todo, setTodo] = useState<string[]>(['Ship it', 'Write docs', 'Fix bug']);
  const [done, setDone] = useState<string[]>([]);
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const [history, setHistory] = useState<{ id: number; text: string }[]>([]);
  const logSeq = useRef(0);

  // Called from event handlers only (never inside a state updater), so StrictMode's
  // double-invoked updaters can't duplicate log lines.
  const log = (m: string) => {
    logSeq.current += 1;
    const entry = { id: logSeq.current, text: m };
    setHistory((h) => [entry, ...h].slice(0, 8));
  };

  function onDropReorder(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...order];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setOrder(next);
    setDragIndex(null);
    log(`reordered "${moved}" → position ${targetIndex + 1} · order: ${next.join(' › ')} · To do: ${todo.length}, Done: ${done.length}`);
  }

  function moveToDone(card: string) {
    setDraggingCard(null);
    if (!todo.includes(card) || done.includes(card)) return;
    const nextTodo = todo.filter((c) => c !== card);
    const nextDone = [...done, card];
    setTodo(nextTodo);
    setDone(nextDone);
    log(`moved "${card}" → Done · To do: ${nextTodo.length}, Done: ${nextDone.length}`);
  }

  return (
    <ChallengeShell
      title="Drag & drop"
      tier="hard"
      blurb="Native HTML5 drag events (dragstart / dragover / drop) are notoriously awkward to automate — pointer sequences and synthesized events both have pitfalls."
      goal={[
        'Reorder the list so "Review metrics" sits first.',
        'Drag the card labeled "Ship it" into the Done column.',
        'Verify the final order and card counts in the log.',
      ]}
      selector='locator.dragTo() or a dispatchEvent drag sequence'
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <section className="stage space-y-2">
          <h2 className="text-sm font-medium">Release checklist (drag to reorder)</h2>
          <ul className="space-y-1">
            {order.map((label, i) => (
              <li
                key={label}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', label);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggingCard(null);
                  setDragIndex(i);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onDropReorder(i);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={cn(
                  'item cursor-grab rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900',
                  dragIndex === i && 'opacity-50',
                )}
              >
                {i + 1}. {label}
              </li>
            ))}
          </ul>
        </section>

        <section className="stage space-y-2">
          <h2 className="text-sm font-medium">Bulk actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <div
              className="bucket min-h-32 rounded-lg border border-dashed border-slate-300 p-2 dark:border-slate-700"
              onDragOver={(e) => e.preventDefault()}
            >
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">
                To do (<span data-testid="todo-count">{todo.length}</span>)
              </p>
              {todo.map((card) => (
                <div
                  key={card}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', card);
                    e.dataTransfer.effectAllowed = 'move';
                    setDragIndex(null);
                    setDraggingCard(card);
                  }}
                  onDragEnd={() => setDraggingCard(null)}
                  className="item mb-1 cursor-grab rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800"
                >
                  {card}
                </div>
              ))}
            </div>

            <div
              className="bucket done grid content-start rounded-lg border-2 border-dashed border-brand-300 bg-brand-50/40 p-3 dark:border-brand-800 dark:bg-brand-950/20"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingCard) moveToDone(draggingCard);
              }}
            >
              <span className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">
                Done (<span data-testid="done-count">{done.length}</span>)
              </span>
              {done.length === 0 ? (
                <span className="mt-2 text-xs text-slate-400">Drop cards here</span>
              ) : (
                done.map((c) => (
                  <span key={c} className="mt-2 rounded-md bg-white px-2 py-1 text-sm dark:bg-slate-800">
                    {c}
                  </span>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="result log rounded-lg bg-slate-50 p-3 text-xs sm:col-span-2 dark:bg-slate-800/50">
          {history.length === 0 ? <span className="text-slate-400">Drag actions appear here…</span> : history.map((h) => <div key={h.id}>{h.text}</div>)}
        </section>
      </div>
    </ChallengeShell>
  );
}
