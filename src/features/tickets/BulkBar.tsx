import { Trash2 } from 'lucide-react';

/** Shown above the ticket table while rows are selected. */
export function BulkBar({
  count,
  busy,
  onClear,
  onDelete,
}: {
  count: number;
  busy?: boolean;
  onClear: () => void;
  onDelete: () => void;
}) {
  if (count === 0) return null;
  return (
    <div
      className="mt-3 flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-sm dark:bg-brand-950/40"
      data-testid="bulk-bar"
    >
      <span className="font-medium text-brand-700 dark:text-brand-300">{count} selected</span>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost text-sm" onClick={onClear} disabled={busy}>
          Clear
        </button>
        <button type="button" className="btn-danger text-sm" data-testid="bulk-delete" onClick={onDelete} disabled={busy}>
          <Trash2 className="h-4 w-4" />
          {busy ? 'Deleting…' : 'Delete selected'}
        </button>
      </div>
    </div>
  );
}
