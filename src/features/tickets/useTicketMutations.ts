import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import type { Ticket, TicketStatus } from '@/lib/domain';
import { toast } from '@/store/toast';

const errorToast = (e: unknown) => toast.error((e as Error).message);

/** Write actions available on the ticket list (row menus, board, bulk bar). */
export function useTicketMutations() {
  const qc = useQueryClient();

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/tickets/${id}`),
    onError: errorToast,
  });

  const duplicate = useMutation({
    mutationFn: (t: Ticket) =>
      apiPost('/api/tickets', {
        subject: `${t.subject} (copy)`,
        description: t.description,
        priority: t.priority,
        category: t.category,
        customerId: t.customerId,
        tags: t.tags,
      }),
    onSuccess: () => toast.success('Ticket duplicated'),
    onError: errorToast,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) => apiPatch(`/api/tickets/${id}`, { status }),
    onSuccess: (_d, vars) => toast.success(`Moved ticket to ${vars.status}`),
    onError: errorToast,
  });

  const assign = useMutation({
    mutationFn: ({ id, assignee }: { id: string; assignee: string }) => apiPatch(`/api/tickets/${id}`, { assignee }),
    onSuccess: (_d, vars) => toast.success(`Assigned to ${vars.assignee}`),
    onError: errorToast,
  });

  /**
   * Delete several tickets. Resolves with the ids that failed, so the caller can
   * keep them selected for a retry. Failures are reported with a toast.
   */
  async function removeMany(ids: string[]): Promise<{ deleted: number; failedIds: string[] }> {
    const results = await Promise.allSettled(ids.map((id) => apiDelete(`/api/tickets/${id}`)));
    const failedIds = ids.filter((_, i) => results[i].status === 'rejected');
    if (failedIds.length > 0) {
      toast.error({
        title: `${failedIds.length} ticket(s) could not be deleted`,
        message: 'They are still selected so you can retry.',
      });
    }
    // Deletes change counts on the dashboard and customer pages too.
    void qc.invalidateQueries();
    return { deleted: ids.length - failedIds.length, failedIds };
  }

  return { remove, duplicate, setStatus, assign, removeMany };
}
