import type {
  Approval,
  ApprovalStatus,
  BatchStatus,
  ChainActionStatus,
  Execution,
  ExecutionMode,
  ExecutionStatus,
  Payment,
  PaymentStatus,
  PaymentVerification,
  PayrollBatch,
} from '@veyra/core';
import type { schema } from '../db/database.js';

export type BatchRow = typeof schema.payrollBatches.$inferSelect;
export type ApprovalRow = typeof schema.approvals.$inferSelect;
export type ExecutionRow = typeof schema.executions.$inferSelect;
export type PaymentRow = typeof schema.payments.$inferSelect;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toBatch(row: BatchRow): PayrollBatch {
  return {
    id: row.id,
    organisationId: row.organisationId,
    title: row.title,
    status: row.status as BatchStatus,
    executionMode: row.executionMode as ExecutionMode,
    asset: { address: row.assetAddress, symbol: row.assetSymbol, decimals: row.assetDecimals },
    total: row.total,
    itemCount: row.itemCount,
    commitment: row.commitment,
    chainBatchId: row.chainBatchId,
    chainItemsHash: row.chainItemsHash,
    proposal: { status: row.proposalStatus as ChainActionStatus, txHash: row.proposalTxHash },
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    submittedAt: iso(row.submittedAt),
    completedAt: iso(row.completedAt),
  };
}

export function toApproval(row: ApprovalRow, memberName: string): Approval {
  return {
    id: row.id,
    batchId: row.batchId,
    memberId: row.memberId,
    memberName,
    status: row.status as ApprovalStatus,
    txHash: row.txHash,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: iso(row.confirmedAt),
  };
}

export function toExecution(row: ExecutionRow): Execution {
  return {
    id: row.id,
    batchId: row.batchId,
    attempt: row.attempt,
    status: row.status as ExecutionStatus,
    txHash: row.txHash,
    submittedBy: row.submittedBy,
    error: row.error,
    verification: (row.verification as PaymentVerification | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    finalisedAt: iso(row.finalisedAt),
  };
}

export function toPayment(row: PaymentRow, recipient: string, amount: string): Payment {
  return {
    id: row.id,
    batchId: row.batchId,
    itemId: row.itemId,
    recipient,
    amount,
    status: row.status as PaymentStatus,
    txHash: row.txHash,
    verified: row.verified,
    updatedAt: row.updatedAt.toISOString(),
  };
}
