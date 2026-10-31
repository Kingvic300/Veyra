/**
 * Payroll batch and payment state machines. State changes anywhere in the system
 * must go through `assertBatchTransition` so invalid transitions fail loudly.
 */

export const BATCH_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'EXECUTING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

const BATCH_TRANSITIONS: Record<BatchStatus, readonly BatchStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'CANCELLED'],
  APPROVED: ['EXECUTING', 'CANCELLED'],
  EXECUTING: ['COMPLETED', 'FAILED'],
  // A failed execution reverted atomically, so retrying is safe.
  FAILED: ['EXECUTING', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super(`Invalid batch transition ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function canTransition(from: BatchStatus, to: BatchStatus): boolean {
  return BATCH_TRANSITIONS[from].includes(to);
}

export function assertBatchTransition(from: BatchStatus, to: BatchStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

export function isTerminal(status: BatchStatus): boolean {
  return BATCH_TRANSITIONS[status].length === 0;
}

export function isEditable(status: BatchStatus): boolean {
  return status === 'DRAFT';
}

export const PAYMENT_STATUSES = ['PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  PENDING: ['SUBMITTED'],
  SUBMITTED: ['CONFIRMED', 'FAILED'],
  FAILED: ['SUBMITTED'],
  CONFIRMED: [],
};

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!PAYMENT_TRANSITIONS[from].includes(to)) throw new InvalidTransitionError(from, to);
}

/** How a batch is executed on the selected network. */
export const EXECUTION_MODES = ['vault', 'strk20-private', 'simulated'] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];
