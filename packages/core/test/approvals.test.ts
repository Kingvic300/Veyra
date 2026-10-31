import { describe, expect, it } from 'vitest';
import { checkCanApprove, evaluateApprovals } from '../src/approvals';

const policy = { threshold: 2, allowCreatorApproval: false, maxBatchTotal: null };
const approvers = [
  { memberId: 'creator', role: 'ADMIN' as const },
  { memberId: 'a1', role: 'APPROVER' as const },
  { memberId: 'a2', role: 'OWNER' as const },
  { memberId: 'v', role: 'VIEWER' as const },
];

describe('approvals', () => {
  it('requires the threshold of confirmed approvals', () => {
    const e1 = evaluateApprovals({ policy, approvers, batchCreatedBy: 'creator', approvals: [{ memberId: 'a1', status: 'CONFIRMED' }] });
    expect(e1.satisfied).toBe(false);
    const e2 = evaluateApprovals({
      policy,
      approvers,
      batchCreatedBy: 'creator',
      approvals: [
        { memberId: 'a1', status: 'CONFIRMED' },
        { memberId: 'a2', status: 'PENDING_CHAIN' },
      ],
    });
    expect(e2).toMatchObject({ confirmed: 1, pending: 1, satisfied: false, eligibleRemaining: [] });
  });

  it('ignores approvals from the creator and non-approvers', () => {
    const e = evaluateApprovals({
      policy,
      approvers,
      batchCreatedBy: 'creator',
      approvals: [
        { memberId: 'creator', status: 'CONFIRMED' },
        { memberId: 'v', status: 'CONFIRMED' },
        { memberId: 'a1', status: 'CONFIRMED' },
      ],
    });
    expect(e.confirmed).toBe(1);
  });

  it('reports unreachable thresholds', () => {
    const e = evaluateApprovals({ policy: { ...policy, threshold: 3 }, approvers, batchCreatedBy: 'creator', approvals: [] });
    expect(e.unreachable).toBe(true);
  });

  it('rejects ineligible approvers', () => {
    const base = { batchCreatedBy: 'creator', batchPending: true, policy, existing: [] };
    expect(checkCanApprove({ ...base, member: approvers[0]! })).toBe('CREATOR_CANNOT_APPROVE');
    expect(checkCanApprove({ ...base, member: approvers[3]! })).toBe('NOT_APPROVER');
    expect(checkCanApprove({ ...base, member: approvers[1]!, existing: [{ memberId: 'a1', status: 'PENDING_CHAIN' }] })).toBe('ALREADY_APPROVED');
    expect(checkCanApprove({ ...base, member: approvers[1]!, batchPending: false })).toBe('BATCH_NOT_PENDING');
    expect(checkCanApprove({ ...base, member: approvers[1]! })).toBeNull();
  });

  it('allows a retry after a failed on-chain approval', () => {
    expect(
      checkCanApprove({ batchCreatedBy: 'creator', batchPending: true, policy, member: approvers[1]!, existing: [{ memberId: 'a1', status: 'FAILED' }] }),
    ).toBeNull();
  });
});
