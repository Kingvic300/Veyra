import type { Permission, PayrollBatch } from '@veyra/core';

/** Batches that are waiting on someone with these permissions. */
export function needsAttention(batches: readonly PayrollBatch[], can: (p: Permission) => boolean): PayrollBatch[] {
  return batches.filter(
    (b) =>
      (b.status === 'PENDING_APPROVAL' && can('batches:approve')) ||
      ((b.status === 'APPROVED' || b.status === 'FAILED') && can('batches:execute')) ||
      (b.status === 'DRAFT' && can('batches:write')),
  );
}

export function attentionReason(b: PayrollBatch): string {
  switch (b.status) {
    case 'PENDING_APPROVAL':
      return 'Waiting for approvals';
    case 'APPROVED':
      return 'Approved and ready to pay';
    case 'FAILED':
      return 'Payment failed, retry when ready';
    case 'DRAFT':
      return 'Draft not yet sent for approval';
    default:
      return '';
  }
}
