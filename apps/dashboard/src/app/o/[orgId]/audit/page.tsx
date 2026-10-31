'use client';

import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import type { AuditEvent } from '@veyra/core';
import { Button, Notice, PageHeader, Panel, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { date, shortHash } from '@/lib/format';
import { keys, useOrg } from '@/lib/hooks';

const ACTION_COPY: Record<string, string> = {
  'organisation.created': 'Organisation created',
  'organisation.updated': 'Settings changed',
  'member.added': 'Teammate added',
  'member.updated': 'Teammate updated',
  'member.removed': 'Teammate removed',
  'contractor.created': 'Contractor added',
  'contractor.updated': 'Contractor updated',
  'contractor.archived': 'Contractor archived',
  'batch.created': 'Batch drafted',
  'batch.updated': 'Draft edited',
  'batch.submitted': 'Sent for approval',
  'batch.proposal_recorded': 'On-chain registration sent',
  'batch.proposal_confirmed': 'Registered on-chain',
  'batch.proposal_failed': 'On-chain registration failed',
  'approval.recorded': 'Approval given',
  'approval.confirmed': 'Approval confirmed',
  'approval.failed': 'Approval failed',
  'batch.approved': 'Batch fully approved',
  'execution.submitted': 'Payment sent',
  'execution.confirmed': 'Payment settled',
  'execution.failed': 'Payment failed',
  'batch.completed': 'Batch paid',
  'batch.cancelled': 'Batch cancelled',
  'receipt.exported': 'Receipt viewed',
};

const PAGE = 50;

export default function AuditPage() {
  const org = useOrg();
  const events = useInfiniteQuery({
    queryKey: keys.audit(org.orgId),
    queryFn: ({ pageParam }) => api.audit.list(org.orgId, { limit: PAGE, before: pageParam }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last: AuditEvent[]) => (last.length === PAGE ? last.at(-1)!.seq : undefined),
  });
  const verify = useMutation({ mutationFn: () => api.audit.verify(org.orgId) });
  const rows = events.data?.pages.flat() ?? [];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change, in order. Each entry contains the fingerprint of the one before it, so editing or deleting history breaks the chain."
        actions={
          <Button variant="secondary" onClick={() => verify.mutate()} loading={verify.isPending} icon={<ShieldCheck className="size-4" />}>
            Verify chain
          </Button>
        }
      />
      {verify.data && (
        <div className="mb-6">
          {verify.data.valid ? (
            <Notice tone="settle" title="History is intact">
              All {verify.data.checked} entries link up and none was altered.
            </Notice>
          ) : (
            <Notice tone="fail" title="History was altered">
              <span className="inline-flex items-center gap-1.5">
                <ShieldAlert className="size-4" /> Entry {verify.data.brokenAt}: {verify.data.reason}. Contact your Veyra operator.
              </span>
            </Notice>
          )}
        </div>
      )}
      {verify.error && <Notice tone="fail">{errorMessage(verify.error)}</Notice>}

      {events.isLoading ? (
        <Spinner />
      ) : (
        <Panel padded={false}>
          <ol>
            {rows.map((e) => (
              <li key={e.id} className="grid grid-cols-[3.5rem_1fr_auto] items-baseline gap-4 border-t border-line px-5 py-3 text-sm first:border-t-0">
                <span className="text-[12.5px] tabular-nums text-ink-faint">{e.seq}</span>
                <span className="min-w-0">
                  <span className="font-medium">{ACTION_COPY[e.action] ?? e.action}</span>
                  {e.entityType === 'batch' && (
                    <Link href={`/o/${org.orgId}/batches/${e.entityId}`} className="ml-2 text-[13px] text-settle hover:underline">
                      Open batch
                    </Link>
                  )}
                  {e.actorId === null && <span className="ml-2 text-[12.5px] text-ink-faint">by Veyra after checking the chain</span>}
                  <span className="mt-0.5 block font-mono text-[11.5px] text-ink-faint" title={e.hash}>
                    {shortHash(e.hash, 10, 6)}
                  </span>
                </span>
                <span className="text-[13px] text-ink-soft">{date(e.createdAt, true)}</span>
              </li>
            ))}
          </ol>
          {events.hasNextPage && (
            <div className="border-t border-line p-4">
              <Button variant="ghost" size="sm" onClick={() => events.fetchNextPage()} loading={events.isFetchingNextPage}>
                Show older entries
              </Button>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}
