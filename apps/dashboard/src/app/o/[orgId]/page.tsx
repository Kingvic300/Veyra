'use client';

import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Check, Plus, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { StatusPill } from '@/components/batch-bits';
import { CountryBars, MonthlyColumns } from '@/components/charts';
import { SkeletonRows } from '@/components/loading';
import { Button, Hash, Notice, Panel } from '@/components/ui';
import { api } from '@/lib/api';
import { attentionReason, needsAttention } from '@/lib/attention';
import { ACTION_COPY } from '@/lib/audit-copy';
import { amount, date, explorerUrl, relative } from '@/lib/format';
import { keys, useMe, useOrg, useTreasury } from '@/lib/hooks';

export default function OverviewPage() {
  const org = useOrg();
  const me = useMe();
  const treasury = useTreasury();
  const o = org.data!;
  const base = `/o/${o.id}`;
  const batches = useQuery({ queryKey: keys.batches(o.id), queryFn: () => api.batches.list(o.id) });
  const stats = useQuery({ queryKey: ['org', o.id, 'stats'], queryFn: () => api.organisations.stats(o.id) });
  const activity = useQuery({ queryKey: [...keys.audit(o.id), 'latest'], queryFn: () => api.audit.list(o.id, { limit: 8 }) });
  const members = useQuery({ queryKey: keys.members(o.id), queryFn: () => api.members.list(o.id) });

  const s = stats.data;
  const t = treasury.data;
  const attention = needsAttention(batches.data ?? [], org.can);
  const recent = (batches.data ?? []).filter((b) => b.status === 'COMPLETED').slice(0, 5);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const thisMonth = s ? BigInt(s.paidThisMonth) : 0n;
  const lastMonth = s ? BigInt(s.paidLastMonth) : 0n;
  const change = lastMonth > 0n ? Number(((thisMonth - lastMonth) * 1000n) / lastMonth) / 10 : null;

  // Approvers beyond the batch creator, unless creators may approve their own batches.
  const approvers = members.data?.filter((m) => m.role !== 'VIEWER').length ?? 0;
  const neededApprovers = o.approvalPolicy.threshold + (o.approvalPolicy.allowCreatorApproval ? 0 : 1);
  const setup = [
    { done: !!o.treasuryAddress, label: 'Connect the treasury', href: `${base}/settings` },
    { done: (s?.activeContractors ?? 0) > 0, label: 'Add the people you pay', href: `${base}/contractors` },
    { done: approvers >= neededApprovers, label: `Have ${neededApprovers} people who can approve`, href: `${base}/team` },
    { done: (batches.data?.length ?? 0) > 0, label: 'Draft your first payroll batch', href: `${base}/batches/new` },
    { done: (s?.completedBatches ?? 0) > 0, label: 'Pay and get a verified receipt', href: `${base}/batches` },
  ];
  const setupDone = setup.filter((x) => x.done).length;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[15px] text-ink-soft">
            {greeting}
            {me.data ? `, ${me.data.name.split(' ')[0]}` : ''}
          </p>
          <h1 className="mt-0.5 text-[30px] font-semibold tracking-[-0.02em]">{o.name}</h1>
        </div>
        <div className="flex gap-2">
          {org.can('contractors:write') && (
            <Link href={`${base}/contractors`}>
              <Button variant="secondary" icon={<UserPlus className="size-4" />}>
                Add contractor
              </Button>
            </Link>
          )}
          {org.can('batches:write') && (
            <Link href={`${base}/batches/new`}>
              <Button icon={<Plus className="size-4" />}>New payroll batch</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Headline figures */}
      <section className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 xl:grid-cols-4" aria-label="Key figures">
        <Figure label="Paid this month" loading={!s}>
          {s && amount(s.paidThisMonth, s.asset)}
          {change !== null && (
            <span className={clsx('ml-2 inline-flex items-center gap-0.5 text-[13px] font-medium', change >= 0 ? 'text-settle' : 'text-fail')}>
              {change >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(change)}% vs last month
            </span>
          )}
        </Figure>
        <Figure label="Paid since you started" loading={!s} note={s ? `${s.completedPayments} payments in ${s.completedBatches} batches` : undefined}>
          {s && amount(s.paidAllTime, s.asset)}
        </Figure>
        <Figure label="Waiting for approval" loading={!s} note={s?.awaitingApproval.count ? amount(s.awaitingApproval.total, s.asset) : 'Nothing pending'}>
          {s && `${s.awaitingApproval.count} batch${s.awaitingApproval.count === 1 ? '' : 'es'}`}
        </Figure>
        <Figure
          label="Approval to settlement"
          loading={!s}
          note={s?.medianSettlementSeconds !== null && s ? `Settles in ~${Math.max(1, Math.round(s.medianSettlementSeconds!))}s once sent` : 'Median across batches'}
        >
          {s && (s.medianApprovalHours === null ? 'No data yet' : `${s.medianApprovalHours < 1 ? '<1' : s.medianApprovalHours.toFixed(1)} h to approve`)}
        </Figure>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        {/* Treasury ledger */}
        <section className="flex flex-col rounded-panel border border-line bg-surface" aria-label="Treasury">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-[15px] font-semibold">Treasury</h2>
            <span className="text-[12.5px] text-ink-faint">{t?.privacy.label}</span>
          </div>
          <div className="flex-1 p-5">
            <p className="text-sm text-ink-soft">Balance</p>
            {t ? (
              <p className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.02em]">
                {t.balance ? amount(t.balance, o.asset, { symbol: false }) : 'Unavailable'}
                <span className="ml-2 text-base font-medium text-ink-soft">{o.asset.symbol}</span>
              </p>
            ) : (
              <span className="skeleton mt-2 block h-9 w-56 rounded-md" />
            )}
            {t?.address && <Hash value={t.address} href={explorerUrl(o.chain, o.network, 'contract', t.address)} className="mt-3" />}
            {t?.balance && (
              <>
                <div className="mt-6 flex h-2.5 overflow-hidden rounded-full bg-wash" aria-hidden>
                  <div className="h-full bg-pending" style={{ width: `${Math.min(100, Number((BigInt(t.committed) * 1000n) / (BigInt(t.balance) || 1n)) / 10)}%` }} />
                  <div className="ml-0.5 h-full flex-1 bg-settle" />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="flex items-center gap-1.5 text-ink-soft">
                      <span className="size-2 rounded-sm bg-pending" aria-hidden /> Promised to approved batches
                    </dt>
                    <dd className="mt-0.5 font-semibold">{amount(t.committed, o.asset)}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-ink-soft">
                      <span className="size-2 rounded-sm bg-settle" aria-hidden /> Free to pay out
                    </dt>
                    <dd className="mt-0.5 font-semibold text-settle-strong">{t.available ? amount(t.available, o.asset) : '—'}</dd>
                  </div>
                </dl>
              </>
            )}
            {t?.error && (
              <div className="mt-4">
                <Notice tone="pending">{t.error}</Notice>
              </div>
            )}
          </div>
        </section>

        <Panel title="Payroll paid per month" action={<span className="text-[12.5px] text-ink-faint">Last 6 months, {o.asset.symbol}</span>}>
          {s ? <MonthlyColumns data={s.monthly} asset={s.asset} /> : <span className="skeleton block h-44 rounded-md" />}
        </Panel>
      </div>

      {setupDone < setup.length && org.can('org:manage') && (
        <section className="mt-6 rounded-panel border border-line bg-surface p-5" aria-label="Setup checklist">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Get to your first verified payroll</h2>
              <p className="text-sm text-ink-soft">
                {setupDone} of {setup.length} done
              </p>
            </div>
            <div className="h-1.5 w-48 overflow-hidden rounded-full bg-wash">
              <div className="h-full rounded-full bg-settle" style={{ width: `${(setupDone / setup.length) * 100}%` }} />
            </div>
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {setup.map((step, i) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className={clsx(
                    'flex h-full items-start gap-2.5 rounded-control border px-3 py-2.5 text-sm',
                    step.done ? 'border-settle/20 bg-settle-wash/60 text-settle-strong' : 'border-line hover:border-line-strong',
                  )}
                >
                  <span
                    className={clsx(
                      'mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                      step.done ? 'bg-settle text-white' : 'border border-line-strong text-ink-soft',
                    )}
                  >
                    {step.done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                  </span>
                  {step.label}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Needs you" padded={false} action={attention.length > 0 && <span className="rounded-full bg-pending-wash px-2 text-[12px] font-semibold text-pending">{attention.length}</span>}>
          {batches.isLoading ? (
            <div className="p-4">
              <SkeletonRows rows={3} />
            </div>
          ) : attention.length === 0 ? (
            <div className="flex flex-col items-start gap-1 px-5 py-8">
              <span className="flex size-9 items-center justify-center rounded-full bg-settle-wash text-settle">
                <Check className="size-4" />
              </span>
              <p className="mt-2 font-medium">You are all caught up</p>
              <p className="text-sm text-ink-soft">New approvals and payments will show up here.</p>
            </div>
          ) : (
            <ul>
              {attention.map((b) => (
                <li key={b.id} className="border-t border-line first:border-t-0">
                  <Link href={`${base}/batches/${b.id}`} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-wash">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{b.title}</span>
                      <span className="block text-[13px] text-ink-soft">
                        {attentionReason(b)}, {amount(b.total, b.asset)}
                      </span>
                    </span>
                    <StatusPill status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Where the money goes" action={<span className="text-[12.5px] text-ink-faint">Last 12 months</span>}>
          {!s ? (
            <span className="skeleton block h-40 rounded-md" />
          ) : s.byCountry === null ? (
            <p className="text-sm text-ink-soft">Your role sees totals only. Country breakdowns are limited to people who can see contractor records.</p>
          ) : s.byCountry.length === 0 ? (
            <p className="text-sm text-ink-soft">Once a batch is paid you will see payouts by country here.</p>
          ) : (
            <CountryBars rows={s.byCountry} asset={s.asset} />
          )}
        </Panel>

        <Panel title="Activity" padded={false} action={<Link href={`${base}/audit`} className="text-[13px] font-medium text-settle hover:underline">Audit log</Link>}>
          {activity.isLoading ? (
            <div className="p-4">
              <SkeletonRows rows={4} />
            </div>
          ) : (
            <ol className="relative px-5 py-4">
              <span className="absolute bottom-6 left-[27px] top-6 w-px bg-line" aria-hidden />
              {(activity.data ?? []).map((e) => (
                <li key={e.id} className="relative flex gap-3 py-2">
                  <span className={clsx('relative z-10 mt-1.5 size-[9px] shrink-0 rounded-full border-2 border-surface', e.actorId ? 'bg-ink-faint' : 'bg-settle')} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm">{ACTION_COPY[e.action] ?? e.action}</span>
                    <span className="block text-[12px] text-ink-faint">
                      {relative(e.createdAt)}
                      {!e.actorId && ', confirmed on-chain'}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <Panel title="Recently paid" padded={false} className="mt-6">
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-soft">Paid batches and their receipts will be listed here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[12.5px] text-ink-faint">
                  <th className="px-5 py-2.5 font-medium">Batch</th>
                  <th className="px-5 py-2.5 font-medium">Paid on</th>
                  <th className="px-5 py-2.5 text-right font-medium">Payments</th>
                  <th className="px-5 py-2.5 text-right font-medium">Total</th>
                  <th className="px-5 py-2.5 font-medium">
                    <span className="sr-only">Receipt</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((b) => (
                  <tr key={b.id} className="border-t border-line hover:bg-wash">
                    <td className="px-5 py-3">
                      <Link href={`${base}/batches/${b.id}`} className="font-medium hover:text-settle">
                        {b.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{date(b.completedAt)}</td>
                    <td className="px-5 py-3 text-right">{b.itemCount}</td>
                    <td className="px-5 py-3 text-right font-medium">{amount(b.total, b.asset)}</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`${base}/batches/${b.id}/receipt`} className="text-[13px] font-medium text-settle hover:underline">
                        Receipt
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

function Figure({ label, note, loading, children }: { label: string; note?: string; loading?: boolean; children?: React.ReactNode }) {
  return (
    <div className="bg-surface p-5">
      <p className="text-sm text-ink-soft">{label}</p>
      {loading ? (
        <>
          <span className="skeleton mt-2.5 block h-7 w-40 rounded-md" />
          <span className="skeleton mt-2 block h-3.5 w-28 rounded-md" />
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.01em]">{children}</p>
          {note && <p className="mt-0.5 text-[13px] text-ink-faint">{note}</p>}
        </>
      )}
    </div>
  );
}
