'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { StatusPill } from '@/components/batch-bits';
import { Button, Empty, Hash, Notice, Panel, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { amount, explorerUrl, relative } from '@/lib/format';
import { keys, useMe, useOrg, useTreasury } from '@/lib/hooks';

export default function OverviewPage() {
  const org = useOrg();
  const me = useMe();
  const treasury = useTreasury();
  const batches = useQuery({ queryKey: keys.batches(org.orgId), queryFn: () => api.batches.list(org.orgId) });
  const o = org.data!;
  const base = `/o/${o.id}`;

  const attention = (batches.data ?? []).filter((b) =>
    (b.status === 'PENDING_APPROVAL' && org.can('batches:approve')) ||
    ((b.status === 'APPROVED' || b.status === 'FAILED') && org.can('batches:execute')) ||
    (b.status === 'DRAFT' && org.can('batches:write')),
  );
  const recent = (batches.data ?? []).filter((b) => b.status === 'COMPLETED').slice(0, 5);
  const t = treasury.data;

  return (
    <>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[15px] text-ink-soft">{me.data ? `Hello, ${me.data.name.split(' ')[0]}` : ''}</p>
          <h1 className="text-[30px] font-semibold">{o.name}</h1>
        </div>
        {org.can('batches:write') && (
          <Link href={`${base}/batches/new`}>
            <Button>New payroll batch</Button>
          </Link>
        )}
      </div>

      {/* Treasury ledger line */}
      <section className="rounded-panel border border-line bg-surface" aria-label="Treasury">
        <div className="grid divide-y divide-line sm:grid-cols-[1.3fr_1fr_1fr] sm:divide-x sm:divide-y-0">
          <div className="p-6">
            <p className="text-sm text-ink-soft">Treasury balance</p>
            <p className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.02em]">
              {t?.balance ? amount(t.balance, o.asset, { symbol: false }) : treasury.isLoading ? '…' : 'Unavailable'}
              <span className="ml-2 text-base font-medium text-ink-soft">{o.asset.symbol}</span>
            </p>
            {t?.address && (
              <div className="mt-4">
                <Hash value={t.address} href={explorerUrl(o.chain, o.network, 'contract', t.address)} />
              </div>
            )}
          </div>
          <div className="p-6">
            <p className="text-sm text-ink-soft">Promised to approved batches</p>
            <p className="mt-2 text-[22px] font-semibold">{t ? amount(t.committed, o.asset) : '…'}</p>
          </div>
          <div className="p-6">
            <p className="text-sm text-ink-soft">Free to pay out</p>
            <p className="mt-2 text-[22px] font-semibold text-settle-strong">{t?.available ? amount(t.available, o.asset) : '—'}</p>
          </div>
        </div>
        {t && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-6 py-3 text-[13px] text-ink-soft">
            <span>{t.privacy.label}</span>
            {t.error && <span className="text-pending">{t.error}</span>}
          </div>
        )}
      </section>

      {!o.treasuryAddress && org.can('org:manage') && (
        <div className="mt-6">
          <Notice tone="pending" title="Treasury not connected">
            Add your vault or paying account in <Link href={`${base}/settings`} className="font-medium underline">settings</Link> before submitting a batch.
          </Notice>
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Needs you" padded={false}>
          {batches.isLoading ? (
            <div className="px-5">
              <Spinner />
            </div>
          ) : attention.length === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-soft">Nothing is waiting on you right now.</p>
          ) : (
            <ul>
              {attention.map((b) => (
                <li key={b.id} className="border-t border-line first:border-t-0">
                  <Link href={`${base}/batches/${b.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-wash">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{b.title}</span>
                      <span className="block text-[13px] text-ink-soft">
                        {b.itemCount} payments, {amount(b.total, b.asset)}
                      </span>
                    </span>
                    <StatusPill status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recently paid" padded={false}>
          {recent.length === 0 ? (
            <div className="p-5">
              <Empty
                title="No payroll settled yet"
                body="Add contractors, build a batch and collect approvals. Paid batches and their receipts show up here."
                action={
                  org.can('contractors:write') ? (
                    <Link href={`${base}/contractors`}>
                      <Button variant="secondary" size="sm">
                        Add contractors
                      </Button>
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ul>
              {recent.map((b) => (
                <li key={b.id} className="border-t border-line first:border-t-0">
                  <Link href={`${base}/batches/${b.id}`} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-wash">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{b.title}</span>
                      <span className="block text-[13px] text-ink-faint">{b.completedAt ? relative(b.completedAt) : ''}</span>
                    </span>
                    <span className="text-sm font-medium">{amount(b.total, b.asset)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
