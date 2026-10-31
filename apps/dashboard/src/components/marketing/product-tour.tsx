'use client';

import clsx from 'clsx';
import { Check, FileCheck, LayoutGrid, Users } from 'lucide-react';
import { useState } from 'react';

const TABS = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutGrid,
    title: 'See every payout at a glance',
    body: 'Treasury balance, money promised to approved batches, monthly spend and payouts by country, updated live.',
  },
  {
    id: 'approvals',
    label: 'Approvals',
    icon: Users,
    title: 'Approvals that mean something',
    body: 'Approvers see the exact recipients and amounts, sign from their own wallets and watch the count update when the block confirms.',
  },
  {
    id: 'receipt',
    label: 'Receipts',
    icon: FileCheck,
    title: 'A receipt you can check yourself',
    body: 'Each paid batch gets a printable receipt with the settlement transaction, approvers, commitments and the last audit hash.',
  },
] as const;

const MONTHS: [string, number][] = [
  ['May', 38],
  ['Jun', 52],
  ['Jul', 47],
  ['Aug', 66],
  ['Sep', 74],
  ['Oct', 88],
];

function OverviewMock() {
  return (
    <div className="grid gap-4 p-5 md:grid-cols-[1fr_1.2fr]">
      <div className="rounded-panel border border-line p-4">
        <p className="text-[12.5px] text-ink-faint">Treasury balance</p>
        <p className="mt-1 text-[26px] font-semibold tracking-[-0.02em]">48,210.75 USDC</p>
        <div className="mt-4 flex h-2 overflow-hidden rounded-full">
          <div className="w-[16%] bg-pending" />
          <div className="ml-0.5 flex-1 bg-settle" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
          <span>
            <span className="block text-ink-faint">Promised</span>7,950.50
          </span>
          <span>
            <span className="block text-ink-faint">Free to pay</span>
            <span className="text-settle-strong">40,260.25</span>
          </span>
        </div>
      </div>
      <div className="rounded-panel border border-line p-4">
        <p className="text-[12.5px] text-ink-faint">Payroll paid per month</p>
        <div className="mt-3 flex h-28 items-end gap-3 border-b border-line-strong">
          {MONTHS.map(([m, h]) => (
            <div key={m} className="flex h-full flex-1 flex-col items-center justify-end">
              <span className="w-full max-w-6 rounded-t-[4px] bg-settle" style={{ height: `${h}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-3 text-center text-[11px] text-ink-faint">
          {MONTHS.map(([m]) => (
            <span key={m} className="flex-1">
              {m}
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-panel border border-line p-4 md:col-span-2">
        <p className="text-[12.5px] text-ink-faint">Where the money goes</p>
        {[
          ['Nigeria', 100, '9,600.00'],
          ['Ghana', 77, '7,402.00'],
          ['Kenya', 54, '5,101.00'],
        ].map(([c, w, a]) => (
          <div key={c as string} className="mt-3">
            <div className="flex justify-between text-[13px]">
              <span>{c}</span>
              <span className="font-medium">{a} USDC</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-wash">
              <div className="h-1.5 rounded-full bg-settle" style={{ width: `${w}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApprovalsMock() {
  return (
    <div className="grid gap-4 p-5 md:grid-cols-[1.3fr_1fr]">
      <div className="rounded-panel border border-line">
        <div className="border-b border-line px-4 py-3 text-[13px] font-semibold">November 2026 contractors</div>
        {[
          ['Ngozi Okafor', '2,400.00'],
          ['Kwame Mensah', '1,850.50'],
          ['Yusuf Abdi', '1,275.25'],
        ].map(([n, a]) => (
          <div key={n} className="flex justify-between border-t border-line px-4 py-2.5 text-[13px] first:border-t-0">
            <span>{n}</span>
            <span className="font-medium">{a} USDC</span>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-line bg-wash/60 px-4 py-3">
          <span className="text-[13px] text-ink-soft">1 of 2 approvals</span>
          <span className="rounded-control bg-settle px-3 py-1.5 text-[12.5px] font-medium text-white">Approve with wallet</span>
        </div>
      </div>
      <div className="rounded-panel border border-line p-4">
        <p className="text-[13px] font-semibold">Approvals</p>
        {[
          ['Tunde Bakare', 'Approved', true],
          ['Wanjiru Kamau', 'Confirming', false],
        ].map(([n, s, done]) => (
          <div key={n as string} className="mt-3 flex items-center justify-between text-[13px]">
            <span>{n}</span>
            <span
              className={clsx(
                'rounded-full px-2 py-0.5 text-[12px] font-medium',
                done ? 'bg-settle-wash text-settle-strong' : 'bg-pending-wash text-pending',
              )}
            >
              {s}
            </span>
          </div>
        ))}
        <p className="mt-5 text-[12px] leading-relaxed text-ink-faint">
          The person who prepared the batch cannot approve it. Each approval is a transaction from the approver&apos;s own wallet.
        </p>
      </div>
    </div>
  );
}

function ReceiptMock() {
  return (
    <div className="p-5">
      <div className="mx-auto max-w-xl rounded-panel border border-line p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-semibold">Payroll receipt</p>
            <p className="text-[13px] text-ink-soft">Lagos Dev Studio, September 2026 contractors</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-settle-wash px-2.5 py-0.5 text-[12px] font-medium text-settle-strong">
            <Check className="size-3" /> Verified
          </span>
        </div>
        <div className="mt-5 border-t border-line text-[13px]">
          {[
            ['Ngozi Okafor', '2,400.00'],
            ['Kwame Mensah', '1,850.50'],
            ['Amara Diallo', '1,600.00'],
          ].map(([n, a]) => (
            <div key={n} className="flex justify-between border-b border-line py-2">
              <span>{n}</span>
              <span>{a} USDC</span>
            </div>
          ))}
          <div className="flex justify-between py-2.5 font-semibold">
            <span>Total</span>
            <span>5,850.50 USDC</span>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-y-1 font-mono text-[11.5px] text-ink-soft">
          <dt className="font-sans text-ink-faint">Settlement tx</dt>
          <dd className="truncate">0x06d4e1…b72c09</dd>
          <dt className="font-sans text-ink-faint">Items hash</dt>
          <dd className="truncate">0x73961680fa98…4fe6</dd>
          <dt className="font-sans text-ink-faint">Audit entry</dt>
          <dd className="truncate">a3f9c1…0e57d2</dd>
        </dl>
      </div>
    </div>
  );
}

export function ProductTour() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('overview');
  const active = TABS.find((t) => t.id === tab)!;
  return (
    <div className="grid gap-10 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div role="tablist" aria-label="Product tour" className="flex flex-col gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="tour-panel"
              onClick={() => setTab(t.id)}
              className={clsx(
                'rounded-panel border p-5 text-left transition-colors',
                on ? 'border-ink bg-surface shadow-[0_18px_40px_-30px_rgba(19,32,27,0.6)]' : 'border-transparent hover:bg-surface/70',
              )}
            >
              <span className="flex items-center gap-2.5 font-semibold">
                <Icon className={clsx('size-[18px]', on ? 'text-settle' : 'text-ink-faint')} />
                {t.label}
              </span>
              {on && (
                <>
                  <span className="mt-2 block font-medium">{t.title}</span>
                  <span className="mt-1 block text-[14.5px] leading-relaxed text-ink-soft">{t.body}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div
        id="tour-panel"
        role="tabpanel"
        aria-label={active.label}
        className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-[0_40px_80px_-56px_rgba(19,32,27,0.6)]"
      >
        <div className="flex items-center gap-1.5 border-b border-line bg-wash/60 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="ml-3 font-mono text-[11.5px] text-ink-faint">app.veyra / {active.label.toLowerCase()}</span>
        </div>
        {tab === 'overview' && <OverviewMock />}
        {tab === 'approvals' && <ApprovalsMock />}
        {tab === 'receipt' && <ReceiptMock />}
      </div>
    </div>
  );
}
