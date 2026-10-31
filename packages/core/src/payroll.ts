import { canonicalJson, sha256Hex } from './hash';
import { sumAmounts } from './money';
import type { ApprovalPolicy } from './types';

export interface BatchItemInput {
  contractorId: string;
  /** Null when the contractor has no payout destination. */
  recipient: string | null;
  amount: bigint;
  contractorActive: boolean;
}

export type BatchIssueCode =
  | 'EMPTY_BATCH'
  | 'TOO_MANY_ITEMS'
  | 'NON_POSITIVE_AMOUNT'
  | 'MISSING_RECIPIENT'
  | 'INVALID_RECIPIENT'
  | 'INACTIVE_CONTRACTOR'
  | 'DUPLICATE_CONTRACTOR'
  | 'EXCEEDS_POLICY_LIMIT'
  | 'INSUFFICIENT_TREASURY';

export interface BatchIssue {
  code: BatchIssueCode;
  message: string;
  itemIndex?: number;
  /** Warnings do not block submission; errors do. */
  severity: 'error' | 'warning';
}

export interface BatchValidationOptions {
  maxItems: number;
  policy: ApprovalPolicy;
  /** Spendable treasury balance (balance - committed), if known. */
  availableBalance?: bigint | null;
  isValidRecipient: (address: string) => boolean;
}

export interface BatchValidationResult {
  ok: boolean;
  total: bigint;
  issues: BatchIssue[];
}

/** Validate a payroll batch before it is submitted for approval. */
export function validateBatch(items: readonly BatchItemInput[], opts: BatchValidationOptions): BatchValidationResult {
  const issues: BatchIssue[] = [];
  if (items.length === 0) {
    issues.push({ code: 'EMPTY_BATCH', message: 'Add at least one payment', severity: 'error' });
  }
  if (items.length > opts.maxItems) {
    issues.push({
      code: 'TOO_MANY_ITEMS',
      message: `A batch can contain at most ${opts.maxItems} payments`,
      severity: 'error',
    });
  }

  const seen = new Set<string>();
  items.forEach((item, itemIndex) => {
    if (item.amount <= 0n) {
      issues.push({ code: 'NON_POSITIVE_AMOUNT', message: 'Amount must be greater than zero', itemIndex, severity: 'error' });
    }
    if (!item.recipient) {
      issues.push({ code: 'MISSING_RECIPIENT', message: 'Contractor has no payout address', itemIndex, severity: 'error' });
    } else if (!opts.isValidRecipient(item.recipient)) {
      issues.push({ code: 'INVALID_RECIPIENT', message: `Invalid payout address ${item.recipient}`, itemIndex, severity: 'error' });
    }
    if (!item.contractorActive) {
      issues.push({ code: 'INACTIVE_CONTRACTOR', message: 'Contractor is archived', itemIndex, severity: 'error' });
    }
    if (seen.has(item.contractorId)) {
      issues.push({
        code: 'DUPLICATE_CONTRACTOR',
        message: 'Contractor appears more than once; combine the amounts into one payment',
        itemIndex,
        severity: 'error',
      });
    }
    seen.add(item.contractorId);
  });

  const total = sumAmounts(items.map((i) => (i.amount > 0n ? i.amount : 0n)));
  if (opts.policy.maxBatchTotal !== null && total > BigInt(opts.policy.maxBatchTotal)) {
    issues.push({ code: 'EXCEEDS_POLICY_LIMIT', message: 'Batch total exceeds the organisation spending limit', severity: 'error' });
  }
  if (opts.availableBalance !== undefined && opts.availableBalance !== null && total > opts.availableBalance) {
    issues.push({
      code: 'INSUFFICIENT_TREASURY',
      message: 'Treasury balance (minus approved batches) does not cover this batch yet. Fund the treasury before execution.',
      severity: 'warning',
    });
  }

  return { ok: !issues.some((i) => i.severity === 'error'), total, issues };
}

export interface CommitmentInput {
  batchId: string;
  organisationId: string;
  chain: string;
  network: string;
  asset: string;
  items: readonly { recipient: string; amount: bigint }[];
}

/**
 * Chain-agnostic commitment: SHA-256 over the canonical batch contents.
 * Stored with the batch and included in receipts so anyone holding the batch
 * data can prove it was not altered after submission.
 */
export async function computeBatchCommitment(input: CommitmentInput): Promise<string> {
  return sha256Hex(
    canonicalJson({
      v: 1,
      batchId: input.batchId,
      organisationId: input.organisationId,
      chain: input.chain,
      network: input.network,
      asset: input.asset.toLowerCase(),
      items: input.items.map((i) => ({ recipient: i.recipient.toLowerCase(), amount: i.amount.toString() })),
    }),
  );
}
