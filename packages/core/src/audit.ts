import { canonicalJson, sha256Hex } from './hash';

/**
 * Append-only, hash-chained audit log. Each event commits to the previous
 * event's hash, so any edit or deletion of history breaks verification.
 */

export const GENESIS_HASH = '0'.repeat(64);

export interface AuditEventBody {
  organisationId: string;
  seq: number;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
  createdAt: string;
  prevHash: string;
}

export async function hashAuditEvent(body: AuditEventBody): Promise<string> {
  return sha256Hex(
    canonicalJson({
      v: 1,
      organisationId: body.organisationId,
      seq: body.seq,
      actorId: body.actorId,
      action: body.action,
      entityType: body.entityType,
      entityId: body.entityId,
      data: body.data,
      createdAt: body.createdAt,
      prevHash: body.prevHash,
    }),
  );
}

export interface AuditChainResult {
  valid: boolean;
  checked: number;
  /** First sequence number that failed verification. */
  brokenAt: number | null;
  reason: string | null;
}

/** Verify a full chain ordered by `seq` ascending, starting at seq 1. */
export async function verifyAuditChain(
  events: readonly (AuditEventBody & { hash: string })[],
): Promise<AuditChainResult> {
  let prev = GENESIS_HASH;
  let expectedSeq = 1;
  for (const event of events) {
    if (event.seq !== expectedSeq) {
      return { valid: false, checked: expectedSeq - 1, brokenAt: event.seq, reason: `Expected seq ${expectedSeq}` };
    }
    if (event.prevHash !== prev) {
      return { valid: false, checked: expectedSeq - 1, brokenAt: event.seq, reason: 'prevHash does not match previous event' };
    }
    const computed = await hashAuditEvent(event);
    if (computed !== event.hash) {
      return { valid: false, checked: expectedSeq - 1, brokenAt: event.seq, reason: 'Event hash mismatch (content altered)' };
    }
    prev = event.hash;
    expectedSeq += 1;
  }
  return { valid: true, checked: events.length, brokenAt: null, reason: null };
}

/** Audit action names used across the system. */
export const AuditActions = {
  OrganisationCreated: 'organisation.created',
  OrganisationUpdated: 'organisation.updated',
  MemberAdded: 'member.added',
  MemberUpdated: 'member.updated',
  MemberRemoved: 'member.removed',
  ContractorCreated: 'contractor.created',
  ContractorUpdated: 'contractor.updated',
  ContractorArchived: 'contractor.archived',
  BatchCreated: 'batch.created',
  BatchUpdated: 'batch.updated',
  BatchSubmitted: 'batch.submitted',
  BatchProposalRecorded: 'batch.proposal_recorded',
  BatchProposalConfirmed: 'batch.proposal_confirmed',
  BatchProposalFailed: 'batch.proposal_failed',
  ApprovalRecorded: 'approval.recorded',
  ApprovalConfirmed: 'approval.confirmed',
  ApprovalFailed: 'approval.failed',
  BatchApproved: 'batch.approved',
  ExecutionSubmitted: 'execution.submitted',
  ExecutionConfirmed: 'execution.confirmed',
  ExecutionFailed: 'execution.failed',
  BatchCompleted: 'batch.completed',
  BatchCancelled: 'batch.cancelled',
  ReceiptExported: 'receipt.exported',
} as const;
