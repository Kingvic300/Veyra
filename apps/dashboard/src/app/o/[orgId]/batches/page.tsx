'use client';

import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { BatchStatus } from '@veyra/core';
import { StatusPill } from '@/components/batch-bits';
import { SkeletonRows } from '@/components/loading';
import { Avatar } from '@/components/org-avatar';
import { Button, Empty, PageHeader, Panel } from '@/components/ui';
import { api } from '@/lib/api';
import { amount, date, shortHash, STATUS_LABEL } from '@/lib/format';
import { keys, useOrg } from '@/lib/hooks';

const FILTERS: (BatchStatus | 'ALL')[] = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'EXECUTING', 'COMPLETED', 'FAILED', 'CANCELLED'];

export default function BatchesPage() {
  const org = useOrg();
  const o = org.data!;
  const [filter, setFilter] = useState<BatchStatus | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const batches = useQuery({ queryKey: keys.batches(o.id), queryFn: () => api.batches.list(o.id) });
  const members = useQuery({ queryKey: keys.members(o.id), queryFn: () => api.members.list(o.id) });
  const stats = useQuery({ queryKey: ['org', o.id, 'stats'], queryFn: () => api.organisations.stats(o.id) });
  const base = `/o/${o.id}/batches`;
  const names = new Map(members.data?.map((m) => [m.id, m.name]));

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const b of batches.data ?? []) c.set(b.status, (c.get(b.status) ?? 0) + 1);
    return c;
  }, [batches.data]);
  const rows = (batches.data ?? []).filter(
    (b) => (filter === 'ALL' || b.status === filter) && (!query || b.title.toLowerCase().includes(query.toLowerCase())),
  );
  const s = stats.data;

  return (
    <>
      <PageHeader
        title="Payouts"
        description="A payout pays several people at once. It goes from draft, to approved, to paid. Every step is saved in your history."
        actions={
          org.can('batches:write') && (
            <Link href={`${base}/new`}>
              <Button icon={<Plus className="size-4" />}>New payout</Button>
            </Link>
          )
        }
      />

      <section className="mb-6 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Waiting for approval', value: s ? `${s.awaitingApproval.count}` : null, note: s ? amount(s.awaitingApproval.total, s.asset) : '', tone: 'text-pending' },
          { label: 'Approved, ready to pay', value: s ? `${s.readyToPay.count}` : null, note: s ? amount(s.readyToPay.total, s.asset) : '', tone: 'text-ink' },
          { label: 'Paid this month', value: s ? amount(s.paidThisMonth, s.asset) : null, note: s ? `${s.monthly.at(-1)?.batches ?? 0} settled this month` : '', tone: 'text-settle-strong' },
          { label: 'Need attention', value: s ? `${s.failed + s.drafts}` : null, note: s ? `${s.drafts} drafts, ${s.failed} failed` : '', tone: s && s.failed > 0 ? 'text-fail' : 'text-ink' },
        ].map((f) => (
          <div key={f.label} className="bg-surface p-5">
            <p className="text-sm text-ink-soft">{f.label}</p>
            {f.value === null ? (
              <span className="skeleton mt-2.5 block h-7 w-24 rounded-md" />
            ) : (
              <p className={clsx('mt-1.5 text-[22px] font-semibold', f.tone)}>{f.value}</p>
            )}
            <p className="mt-0.5 text-[13px] text-ink-faint">{f.note}</p>
          </div>
        ))}
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter by status">
          {FILTERS.map((f) => {
            const n = f === 'ALL' ? (batches.data?.length ?? 0) : (counts.get(f) ?? 0);
            if (f !== 'ALL' && n === 0 && filter !== f) return null;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px]',
                  filter === f ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-soft hover:border-line-strong',
                )}
              >
                {f === 'ALL' ? 'All' : STATUS_LABEL[f]}
                <span className={clsx('text-[11.5px]', filter === f ? 'text-white/70' : 'text-ink-faint')}>{n}</span>
              </button>
            );
          })}
        </div>
        <label className="relative">
          <span className="sr-only">Search payouts</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name"
            className="h-9 w-56 rounded-control border border-line bg-surface pl-9 pr-3 text-sm placeholder:text-ink-faint focus:border-settle focus:outline-none"
          />
        </label>
      </div>

      {batches.isLoading ? (
        <SkeletonRows rows={6} />
      ) : (batches.data ?? []).length === 0 ? (
        <Empty
          title="No payouts yet"
          body="Create a payout, choose who gets paid and how much, then send it for approval. No money moves until enough people approve."
          action={
            org.can('batches:write') ? (
              <Link href={`${base}/new`}>
                <Button size="sm">New payout</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Panel padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[12.5px] text-ink-faint">
                  <th className="px-5 py-2.5 font-medium">Payout</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Prepared by</th>
                  <th className="px-5 py-2.5 text-right font-medium">Payments</th>
                  <th className="px-5 py-2.5 text-right font-medium">Total</th>
                  <th className="px-5 py-2.5 font-medium">Created</th>
                  <th className="px-5 py-2.5 font-medium">Paid</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const by = names.get(b.createdBy);
                  return (
                    <tr key={b.id} className="border-t border-line hover:bg-wash">
                      <td className="px-5 py-3">
                        <Link href={`${base}/${b.id}`} className="font-medium hover:text-settle">
                          {b.title}
                        </Link>
                        <span className="block font-mono text-[11.5px] text-ink-faint">{shortHash(b.chainBatchId, 8, 4)}</span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill status={b.status} />
                      </td>
                      <td className="px-5 py-3">
                        {by ? (
                          <span className="flex items-center gap-2">
                            <Avatar name={by} seed={b.createdBy} size="sm" round />
                            <span className="truncate">{by}</span>
                          </span>
                        ) : (
                          <span className="text-ink-faint">Former member</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">{b.itemCount}</td>
                      <td className="px-5 py-3 text-right font-medium">{amount(b.total, b.asset)}</td>
                      <td className="px-5 py-3 text-ink-soft">{date(b.createdAt)}</td>
                      <td className="px-5 py-3 text-ink-soft">{b.completedAt ? date(b.completedAt) : ''}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-ink-soft">
                      No payouts match. Clear the search or choose another status.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
