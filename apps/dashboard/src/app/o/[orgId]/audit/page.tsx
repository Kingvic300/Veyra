'use client';

import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import type { AuditEvent } from '@veyra/core';
import { useToast } from '@/components/providers';
import { Button, Notice, PageHeader, Panel, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { date, shortHash } from '@/lib/format';
import { keys, useOrg } from '@/lib/hooks';
import { ACTION_COPY } from '@/lib/audit-copy';


const PAGE = 50;

export default function AuditPage() {
  const org = useOrg();
  const events = useInfiniteQuery({
    queryKey: keys.audit(org.orgId),
    queryFn: ({ pageParam }) => api.audit.list(org.orgId, { limit: PAGE, before: pageParam }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last: AuditEvent[]) => (last.length === PAGE ? last.at(-1)!.seq : undefined),
  });
  const toast = useToast();
  const verify = useMutation({ mutationFn: () => api.audit.verify(org.orgId), onError: (err) => toast('fail', errorMessage(err)) });
  const rows = events.data?.pages.flat() ?? [];

  return (
    <>
      <PageHeader
        title="History"
        description="Every change, in order. Each entry is linked to the one before it, so any edit or deletion shows up."
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
                  {e.actorId === null && <span className="ml-2 text-[12.5px] text-ink-faint">by Veyra after checking the blockchain</span>}
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
