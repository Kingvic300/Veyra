import { Check, FileCheck, Lock, X } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/* ---------- How it works: the settlement rail as a page section ---------- */

const STEPS: { title: string; body: string; artifact: ReactNode }[] = [
  {
    title: 'Build the batch',
    body: 'Pick contractors and amounts. Veyra checks every payout wallet, the treasury balance and your spending limit.',
    artifact: (
      <div className="rounded-control border border-line bg-surface text-[12px]">
        {[
          ['Ngozi O.', '2,400.00'],
          ['Kwame M.', '1,850.50'],
          ['Amara D.', '1,600.00'],
        ].map(([n, a]) => (
          <div key={n} className="flex justify-between border-t border-line px-3 py-1.5 first:border-t-0">
            <span>{n}</span>
            <span className="font-medium">{a}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Collect approvals',
    body: 'Submitting freezes the list. Approvers sign that exact list from their own wallets; the vault counts signatures.',
    artifact: (
      <div className="flex flex-col gap-1.5 text-[12px]">
        {[
          ['TB', 'Tunde B.', true],
          ['WK', 'Wanjiru K.', true],
        ].map(([i, n]) => (
          <div key={n as string} className="flex items-center gap-2 rounded-control border border-line bg-surface px-2.5 py-1.5">
            <span className="flex size-5 items-center justify-center rounded-full bg-settle-wash text-[9px] font-semibold text-settle-strong">
              {i}
            </span>
            <span className="flex-1">{n}</span>
            <Check className="size-3.5 text-settle" />
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Settle on-chain',
    body: 'One transaction pays everyone. If any transfer fails, all of them revert, so nobody is paid twice or skipped.',
    artifact: (
      <div className="rounded-control border border-line bg-surface px-3 py-2.5 text-[12px]">
        <div className="flex justify-between">
          <span className="text-ink-faint">Transaction</span>
          <span className="font-mono text-[11px]">0x06d4…2c09</span>
        </div>
        <div className="mt-1.5 flex justify-between">
          <span className="text-ink-faint">Transfers</span>
          <span className="font-medium">3 of 3</span>
        </div>
      </div>
    ),
  },
  {
    title: 'Keep the proof',
    body: 'Veyra matches vault and token events against the frozen list, then issues a receipt and logs it.',
    artifact: (
      <div className="flex items-center gap-2.5 rounded-control border border-settle/30 bg-settle-wash px-3 py-2.5 text-[12px] text-settle-strong">
        <FileCheck className="size-4" />
        <span className="font-medium">Receipt verified</span>
      </div>
    ),
  },
];

export function HowItWorks() {
  return (
    <ol className="relative mt-14 grid gap-10 md:grid-cols-2 xl:grid-cols-4 xl:gap-8">
      <span className="absolute left-[15px] right-0 top-[15px] hidden h-0.5 bg-settle/25 xl:block" aria-hidden />
      {STEPS.map((s, i) => (
        <li key={s.title} className="relative">
          <span className="relative z-10 flex size-8 items-center justify-center rounded-full bg-settle text-sm font-semibold text-white ring-4 ring-paper">
            {i + 1}
          </span>
          <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
          <p className="mt-2 max-w-[38ch] text-[15px] leading-relaxed text-ink-soft">{s.body}</p>
          <div className="mt-5 max-w-[300px]">{s.artifact}</div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Comparison: two panels instead of a table ---------- */

const ROWS: [string, string, string][] = [
  ['Who approved a payment', 'A thumbs-up in a chat thread', 'Signed on-chain by named approver wallets'],
  ['Wrong amount or address', 'Found after the money is gone', 'Rejected: the contract checks the frozen list'],
  ['Paying twenty people', 'Twenty transfers, one by one', 'One transaction that pays all or none'],
  ['Salary confidentiality', 'Spreadsheet shared with everyone', 'Encrypted, visible by role'],
  ['Proof for the accountant', 'Screenshots of an explorer', 'Receipt plus a verifiable audit log'],
];

export function Comparison() {
  return (
    <div className="mt-12 grid gap-5 lg:grid-cols-2">
      <div className="rounded-[18px] border border-line bg-[#f4f7f5] p-7">
        <p className="font-semibold text-ink-soft">Spreadsheet and a wallet</p>
        <ul className="mt-5 flex flex-col">
          {ROWS.map(([what, before]) => (
            <li key={what} className="flex gap-3 border-t border-line py-4 first:border-t-0">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-fail-wash text-fail">
                <X className="size-3" strokeWidth={3} />
              </span>
              <span>
                <span className="block text-[13px] text-ink-faint">{what}</span>
                <span className="block text-[15.5px] text-ink-soft">{before}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-[18px] border border-ink bg-surface p-7 shadow-[0_30px_60px_-40px_rgba(19,32,27,0.6)]">
        <p className="font-semibold">With Veyra</p>
        <ul className="mt-5 flex flex-col">
          {ROWS.map(([what, , after]) => (
            <li key={what} className="flex gap-3 border-t border-line py-4 first:border-t-0">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-settle text-white">
                <Check className="size-3" strokeWidth={3} />
              </span>
              <span>
                <span className="block text-[13px] text-ink-faint">{what}</span>
                <span className="block text-[15.5px] font-medium">{after}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- Features: three themed cards ---------- */

const GROUPS: { title: string; lead: string; items: [string, string][] }[] = [
  {
    title: 'Control',
    lead: 'Money moves only when the right people agree.',
    items: [
      ['Contract-enforced approvals', 'The vault pays after the required approver wallets sign.'],
      ['Separation of duties', 'Whoever prepares a batch cannot approve it, unless you allow it.'],
      ['Spending limits', 'Batches over your cap never reach approvers.'],
      ['Roles', 'Owners, admins, approvers and viewers each see and do different things.'],
    ],
  },
  {
    title: 'Privacy and proof',
    lead: 'Salaries stay confidential and every payment can be checked.',
    items: [
      ['Encrypted records', 'Names, emails, wallets and amounts sealed with your company key.'],
      ['Verified receipts', 'Printable and CSV, tied to the settlement transaction.'],
      ['Audit log', 'A hash chain anyone in your team can re-verify.'],
      ['Notifications', 'Know when a batch needs you and when money settles.'],
    ],
  },
  {
    title: 'Build and run',
    lead: 'Start in minutes, grow into your own infrastructure.',
    items: [
      ['Sandbox', 'The full flow with test funds before you deploy a vault.'],
      ['Your wallets', 'Starknet wallets that support the Wallet Standard. No keys shared.'],
      ['API and SDK', 'Drive batches from your own tools with a typed client.'],
      ['Self-hosting', 'Apache 2.0, with Postgres and Redis.'],
    ],
  },
];

export function FeatureGroups() {
  return (
    <div className="mt-12 grid gap-5 lg:grid-cols-3">
      {GROUPS.map((g) => (
        <section key={g.title} className="flex flex-col rounded-[18px] border border-line bg-surface">
          <div className="border-b border-line p-7">
            <h3 className="text-xl font-semibold tracking-[-0.01em]">{g.title}</h3>
            <p className="mt-1.5 text-[15px] text-ink-soft">{g.lead}</p>
          </div>
          <ul className="flex flex-col p-3">
            {g.items.map(([t, b]) => (
              <li key={t} className="flex gap-3 rounded-control px-4 py-3">
                <Check className="mt-0.5 size-4 shrink-0 text-settle" aria-hidden />
                <span>
                  <span className="block font-medium">{t}</span>
                  <span className="block text-[14px] leading-relaxed text-ink-soft">{b}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ---------- FAQ ---------- */

export function Faq({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map(([q, a], i) => (
        <details
          key={q}
          open={i === 0}
          className="group rounded-panel border border-line bg-surface px-6 py-5 open:shadow-[0_18px_40px_-32px_rgba(19,32,27,0.6)]"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold">
            {q}
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-transform group-open:rotate-45 group-open:border-settle group-open:text-settle"
              aria-hidden
            >
              +
            </span>
          </summary>
          <p className="mt-3 max-w-[70ch] leading-relaxed text-ink-soft">{a}</p>
        </details>
      ))}
    </div>
  );
}

/* ---------- Closing call to action ---------- */

export function ClosingCta() {
  return (
    <section className="bg-ink text-white">
      <div className="grid w-full items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.2fr_1fr] lg:px-16 xl:px-20">
        <div>
          <h2 className="max-w-[20ch] text-[38px] font-semibold leading-tight tracking-[-0.025em]">Run your next payroll through Veyra</h2>
          <p className="mt-4 max-w-[46ch] text-[16px] text-white/70">
            Start in the sandbox with test funds, then connect a vault when you are ready to pay for real.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex h-12 items-center rounded-control bg-white px-6 text-[15px] font-medium text-ink hover:bg-settle-wash"
            >
              Create an account
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-12 items-center rounded-control border border-white/25 px-6 text-[15px] font-medium hover:bg-white/10"
            >
              Talk to us
            </Link>
          </div>
        </div>
        <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-6" aria-hidden>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-white/60">Payroll receipt</span>
            <span className="flex items-center gap-1.5 rounded-full bg-[#3fbf8f]/15 px-2.5 py-0.5 text-[12px] font-medium text-[#7fdcb6]">
              <Check className="size-3" /> Verified
            </span>
          </div>
          <p className="mt-3 text-[28px] font-semibold tracking-[-0.02em]">9,225.75 USDC</p>
          <p className="text-[13px] text-white/60">5 contractors, 4 countries, 2 approvals</p>
          <div className="mt-5 grid gap-2 font-mono text-[12px] text-white/70">
            <div className="flex justify-between gap-4 border-t border-white/10 pt-2">
              <span className="font-sans text-white/50">Settlement</span>0x06d4e1…b72c09
            </div>
            <div className="flex justify-between gap-4 border-t border-white/10 pt-2">
              <span className="font-sans text-white/50">Items hash</span>0x7396…4fe6
            </div>
            <div className="flex justify-between gap-4 border-t border-white/10 pt-2">
              <span className="flex items-center gap-1.5 font-sans text-white/50">
                <Lock className="size-3" /> Names
              </span>
              <span className="font-sans">Encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
