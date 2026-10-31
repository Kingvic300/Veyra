'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import type { BatchStatus } from '@veyra/core';
import { StatusPill } from '@/components/batch-bits';
import { Button, Empty, PageHeader, Panel, Spinner, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { amount, date, STATUS_LABEL } from '@/lib/format';
import { keys, useOrg } from '@/lib/hooks';

const FILTERS: (BatchStatus | 'ALL')[] = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'COMPLETED', 'FAILED', 'CANCELLED'];

export default function BatchesPage() {
  const org = useOrg();
  const [filter, setFilter] = useState<BatchStatus | 'ALL'>('ALL');
  const batches = useQuery({ queryKey: keys.batches(org.orgId), queryFn: () => api.batches.list(org.orgId) });
  const base = `/o/${org.orgId}/batches`;
  const rows = (batches.data ?? []).filter((b) => filter === 'ALL' || b.status === filter);

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Each batch pays a group of contractors once. It moves from draft to approved to paid, and every step is recorded."
        actions={
          org.can('batches:write') && (
            <Link href={`${base}/new`}>
              <Button>New payroll batch</Button>
            </Link>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-[13px] ${filter === f ? 'bg-ink text-white' : 'text-ink-soft hover:bg-wash'}`}
          >
            {f === 'ALL' ? 'All' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>
      {batches.isLoading ? (
        <Spinner />
      ) : (batches.data ?? []).length === 0 ? (
        <Empty
          title="No payroll batches yet"
          body="Create a batch, choose who gets paid and how much, then send it for approval."
          action={
            org.can('batches:write') ? (
              <Link href={`${base}/new`}>
                <Button size="sm">New payroll batch</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Panel padded={false}>
          <Table>
            <thead>
              <tr>
                <th>Batch</th>
                <th>Status</th>
                <th className="text-right">Payments</th>
                <th className="text-right">Total</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="hover:bg-wash">
                  <td>
                    <Link href={`${base}/${b.id}`} className="font-medium hover:text-settle">
                      {b.title}
                    </Link>
                  </td>
                  <td>
                    <StatusPill status={b.status} />
                  </td>
                  <td className="text-right">{b.itemCount}</td>
                  <td className="text-right font-medium">{amount(b.total, b.asset)}</td>
                  <td className="text-ink-soft">{date(b.createdAt)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-ink-soft">
                    No batches with this status.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Panel>
      )}
    </>
  );
}
