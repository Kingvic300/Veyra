import type { Metadata } from 'next';
import { Bell, Building2, Code2, FileCheck, FileSpreadsheet, FlaskConical, Gauge, Lock, ShieldCheck, UserCheck, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { HeroVisual } from '@/components/marketing/hero-visual';
import { ProductTour } from '@/components/marketing/product-tour';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: 'Veyra: private payroll for teams that pay in stablecoins' },
  description: site.tagline,
};

const STEPS = [
  {
    title: 'Build the batch',
    body: 'Pick contractors, enter amounts and save a draft. Veyra checks every payout wallet, the treasury balance and your spending limit before anyone signs.',
  },
  {
    title: 'Collect approvals',
    body: 'Submitting freezes the recipients and amounts. Approvers sign that exact list from their own wallets; the vault contract counts the signatures.',
  },
  {
    title: 'Settle on-chain',
    body: 'One transaction pays everyone at once. If any transfer fails, all of them revert, so nobody is paid twice and nobody is skipped.',
  },
  {
    title: 'Keep the proof',
    body: 'Veyra matches the settlement against token and vault events, then issues a receipt and appends it to a tamper-evident audit log.',
  },
];

const FEATURES = [
  {
    icon: FileSpreadsheet,
    title: 'Batch editor',
    body: 'Add every contractor in one click, see the total as you type, and catch bad wallets before submitting.',
  },
  { icon: ShieldCheck, title: 'Contract-enforced approvals', body: 'The vault pays only after the required approver wallets sign the exact list.' },
  { icon: UserCheck, title: 'Separation of duties', body: 'The person who prepares a batch cannot approve it unless you choose otherwise.' },
  { icon: Gauge, title: 'Spending limits', body: 'Cap the size of any batch. Larger runs are blocked before they reach approvers.' },
  {
    icon: Lock,
    title: 'Encrypted records',
    body: 'Contractor names, emails, wallets and amounts are sealed with a key unique to your organisation.',
  },
  { icon: Users, title: 'Roles', body: 'Owners, admins, approvers and viewers. Viewers see totals, never who earns what.' },
  { icon: FileCheck, title: 'Verified receipts', body: 'Printable receipts and CSV exports tied to the settlement transaction and audit chain.' },
  { icon: Bell, title: 'Notifications', body: 'Know when a batch needs you, when approvals confirm and when money settles.' },
  { icon: Wallet, title: 'Your wallets', body: 'Works with Starknet wallets that support the Wallet Standard. Veyra never asks for keys.' },
  { icon: FlaskConical, title: 'Sandbox', body: 'Run the full flow with test funds before you deploy a vault.' },
  { icon: Code2, title: 'API and SDK', body: 'Drive batches from your own tools with a typed TypeScript client.' },
  { icon: Building2, title: 'Self-hosting', body: 'Apache 2.0. Run it on your own servers with Postgres and Redis.' },
];

const COMPARISON: [string, string, string][] = [
  ['Who approved a payment', 'A thumbs-up in a chat thread', 'Signed on-chain by named approver wallets'],
  ['Wrong amount or address', 'Found after the money is gone', 'Rejected: the contract checks the frozen list'],
  ['Paying twenty people', 'Twenty transfers, one by one', 'One transaction that pays all or none'],
  ['Salary confidentiality', 'Spreadsheet shared with everyone', 'Encrypted, visible by role'],
  ['Proof for the accountant', 'Screenshots of an explorer', 'Receipt plus a verifiable audit log'],
];

const AUDIENCES = [
  {
    icon: Code2,
    title: 'Software agencies',
    body: 'Monthly contractor runs across many countries, without a spreadsheet of wallet addresses.',
    setup: [
      ['Pays', 'Monthly'],
      ['People', '10 to 60 contractors'],
      ['Approvals', 'Finance lead and a director'],
      ['Asset', 'USDC'],
    ],
  },
  {
    icon: Users,
    title: 'Remote-first startups',
    body: 'Pay a distributed team in stablecoins with the same approvals you use for any other spend.',
    setup: [
      ['Pays', 'Monthly or twice a month'],
      ['People', 'Employees and contractors'],
      ['Approvals', '2 of 3 founders'],
      ['Asset', 'USDC'],
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Web3 teams and DAOs',
    body: 'Contributor payments and grants released only when the right people sign.',
    setup: [
      ['Pays', 'Per milestone or epoch'],
      ['People', 'Contributors and grantees'],
      ['Approvals', 'Council wallets, on-chain'],
      ['Asset', 'USDC or STRK'],
    ],
  },
  {
    icon: Building2,
    title: 'African businesses',
    body: 'Built in Lagos for cross-border contractor payments where banking rails are slow or expensive.',
    setup: [
      ['Pays', 'Monthly'],
      ['People', 'Teams across Nigeria, Ghana, Kenya and beyond'],
      ['Approvals', 'Owner plus finance'],
      ['Asset', 'USDC'],
    ],
  },
];


const NETWORKS = [
  { name: 'Starknet', state: 'Available', note: 'PayrollVault contract, STRK20 private transfers in preview' },
  { name: 'Stellar', state: 'Next', note: 'Soroban contracts for stablecoin payroll' },
  { name: 'Sui and Solana', state: 'Planned', note: 'Move and Anchor adapters on the same core' },
  { name: 'Ethereum', state: 'Planned', note: 'Smart-account workflows' },
  { name: 'Bitcoin and Lightning', state: 'Researching', note: 'A separate design, not a contract port' },
];

const FAQ = [
  [
    'Does Veyra hold our money?',
    'No. Funds sit in your PayrollVault contract or your own account. Veyra prepares transactions; your wallets sign them.',
  ],
  [
    'What can the public see?',
    'In vault mode, recipient wallets, amounts and approvals are public on Starknet, like any token transfer. Names and emails never leave Veyra. STRK20 mode hides transfers inside the privacy pool.',
  ],
  [
    'What if a payment fails halfway?',
    'It cannot. All transfers in a batch happen in one transaction, so either everyone is paid or nobody is, and you can retry safely.',
  ],
  [
    'Which stablecoins work?',
    'Any ERC-20 style token on the network, such as USDC on Starknet. You enter the token contract when you set up the organisation.',
  ],
  ['Can our contractors use Veyra?', 'They do not need to. They only share a wallet address. Receipts can be sent to them as PDF or CSV.'],
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="block-grid border-b border-line">
        <div className="w-full grid items-center gap-14 px-5 pb-24 pt-16 sm:px-8 lg:px-16 xl:px-20 lg:grid-cols-[1fr_1.05fr] lg:pt-24">
          <div>
            <h1 className="text-[44px] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[58px]">
              Payroll that settles on-chain and stays between you and your team.
            </h1>
            <p className="mt-6 max-w-[48ch] text-[17px] leading-relaxed text-ink-soft">
              Prepare a payroll batch, collect approvals from the people who sign off on money, pay every contractor in one transaction and keep a
              receipt anyone can verify.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex h-12 items-center rounded-control bg-ink px-6 text-[15px] font-medium text-white hover:bg-settle-strong"
              >
                Start free in the sandbox
              </Link>
              <Link
                href="/developers"
                className="inline-flex h-12 items-center rounded-control border border-line-strong bg-surface px-6 text-[15px] font-medium hover:bg-wash"
              >
                Read the developer guide
              </Link>
            </div>
            <p className="mt-5 text-[13px] text-ink-faint">The sandbox uses test funds. No wallet or card needed to try it.</p>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="w-full scroll-mt-20 px-5 py-24 sm:px-8 lg:px-16 xl:px-20">
        <h2 className="max-w-[22ch] text-[34px] font-semibold leading-tight tracking-[-0.025em]">
          From spreadsheet to verified payment in four steps
        </h2>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-panel border border-line bg-line md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="bg-surface p-7">
              <span className="flex size-8 items-center justify-center rounded-full border border-line-strong text-sm font-semibold">{i + 1}</span>
              <h3 className="mt-6 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Product tour */}
      <section className="border-y border-line bg-[#f4f7f5]">
        <div className="w-full px-5 py-24 sm:px-8 lg:px-16 xl:px-20">
          <h2 className="max-w-[24ch] text-[34px] font-semibold leading-tight tracking-[-0.025em]">What your finance team sees</h2>
          <p className="mt-4 max-w-[56ch] text-[16px] text-ink-soft">
            One place for the treasury, the approvals waiting on people, and the receipts for everything already paid.
          </p>
          <div className="mt-12">
            <ProductTour />
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="w-full px-5 py-24 sm:px-8 lg:px-16 xl:px-20">
        <h2 className="max-w-[26ch] text-[34px] font-semibold leading-tight tracking-[-0.025em]">What changes when payroll runs through Veyra</h2>
        <div className="mt-10 overflow-x-auto rounded-panel border border-line bg-surface">
          <table className="w-full min-w-[640px] text-[15px]">
            <thead>
              <tr className="text-left">
                <th className="w-1/4 px-6 py-4 text-[13px] font-medium text-ink-faint">&nbsp;</th>
                <th className="px-6 py-4 font-semibold text-ink-soft">Spreadsheet and a wallet</th>
                <th className="px-6 py-4 font-semibold">With Veyra</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map(([what, before, after]) => (
                <tr key={what} className="border-t border-line">
                  <td className="px-6 py-4 font-medium">{what}</td>
                  <td className="px-6 py-4 text-ink-soft">{before}</td>
                  <td className="px-6 py-4 text-settle-strong">{after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-line">
        <div className="w-full px-5 py-24 sm:px-8 lg:px-16 xl:px-20">
          <h2 className="max-w-[22ch] text-[34px] font-semibold leading-tight tracking-[-0.025em]">Everything a payroll run needs</h2>
          <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-settle">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Honest privacy */}
      <section className="border-t border-line">
        <div className="w-full grid gap-12 px-5 py-24 sm:px-8 lg:px-16 xl:px-20 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <h2 className="text-[34px] font-semibold leading-tight tracking-[-0.025em]">We tell you exactly what is public</h2>
            <p className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-ink-soft">
              Blockchains are public by default. Veyra never calls a payment private unless the network and mode really hide it, and every batch shows
              a plain list of who can see what.
            </p>
            <Link href="/security" className="mt-6 inline-block font-medium text-settle hover:underline">
              How Veyra protects payroll data
            </Link>
          </div>
          <div className="overflow-hidden rounded-panel border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-5 py-3.5 font-medium text-ink-faint">Who can see it</th>
                  <th className="px-5 py-3.5 font-semibold">Payroll vault</th>
                  <th className="px-5 py-3.5 font-semibold">STRK20 private</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Names and emails', 'Your team only', 'Your team only'],
                  ['Individual amounts', 'Anyone on-chain', 'Hidden in the pool'],
                  ['Recipient wallets', 'Anyone on-chain', 'Hidden in the pool'],
                  ['Treasury deposits', 'Anyone on-chain', 'Anyone on-chain'],
                  ['Who approved', 'Anyone on-chain', 'Your team only'],
                ].map(([what, vault, strk]) => (
                  <tr key={what} className="border-t border-line">
                    <td className="px-5 py-3 text-ink-soft">{what}</td>
                    <td className={`px-5 py-3 ${vault === 'Anyone on-chain' ? '' : 'font-medium text-settle-strong'}`}>{vault}</td>
                    <td className={`px-5 py-3 ${strk === 'Anyone on-chain' ? '' : 'font-medium text-settle-strong'}`}>{strk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Audiences */}
      <section className="border-t border-line bg-[#f4f7f5]">
        <div className="grid w-full gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)] lg:px-16 xl:px-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="text-[34px] font-semibold leading-tight tracking-[-0.025em]">Made for teams that pay people across borders</h2>
            <p className="mt-4 max-w-[40ch] text-[16px] leading-relaxed text-ink-soft">
              Different teams, same problem: many people, many countries, and money that should only move when the right people agree.
            </p>
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {AUDIENCES.map(({ icon: Icon, title, body, setup }) => (
              <li key={title} className="flex flex-col rounded-[18px] border border-line bg-surface p-7">
                <span className="flex size-11 items-center justify-center rounded-[12px] bg-settle-wash text-settle">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-6 text-xl font-semibold tracking-[-0.01em]">{title}</h3>
                <p className="mb-6 mt-2 text-[15px] leading-relaxed text-ink-soft">{body}</p>
                <dl className="mt-auto border-t border-line pt-4 text-[14px]">
                  <p className="mb-2 text-[12.5px] font-medium text-ink-faint">Typical setup</p>
                  {setup.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 py-1.5">
                      <dt className="text-ink-soft">{k}</dt>
                      <dd className="text-right font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Open source + networks */}
      <section className="border-t border-line">
        <div className="w-full grid gap-12 px-5 py-24 sm:px-8 lg:px-16 xl:px-20 lg:grid-cols-2">
          <div>
            <h2 className="text-[34px] font-semibold leading-tight tracking-[-0.025em]">Open source, run it anywhere</h2>
            <p className="mt-5 max-w-[48ch] text-[16px] leading-relaxed text-ink-soft">
              The payroll engine, contracts, chain adapters and SDK are Apache 2.0. Self-host it, audit it, extend it. The hosted service adds managed
              infrastructure and support, not lock-in.
            </p>
            <pre className="mt-8 overflow-x-auto rounded-panel border border-line bg-ink p-5 font-mono text-[13px] leading-relaxed text-[#d9e6df]">
              {`import { VeyraClient } from '@veyra/sdk';

const veyra = new VeyraClient({ baseUrl, token });
const batch = await veyra.batches.create(orgId, {
  title: 'October contractors',
  items: [{ contractorId, amount: '2400' }],
});
await veyra.batches.submit(orgId, batch.id);`}
            </pre>
            <p className="mt-6 text-[14px] text-ink-soft">Works with Ready, Braavos and other Starknet wallets that implement the Wallet Standard.</p>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Networks</h3>
            <p className="mt-1 text-[15px] text-ink-soft">
              One payroll core, a separate adapter per chain. We add a network only when it works end to end.
            </p>
            <ul className="mt-6 divide-y divide-line rounded-panel border border-line bg-surface">
              {NETWORKS.map((n) => (
                <li key={n.name} className="flex items-start justify-between gap-4 px-5 py-4">
                  <span>
                    <span className="block font-medium">{n.name}</span>
                    <span className="block text-[13.5px] text-ink-soft">{n.note}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12.5px] font-medium ${
                      n.state === 'Available'
                        ? 'bg-settle-wash text-settle-strong'
                        : n.state === 'Next'
                          ? 'bg-pending-wash text-pending'
                          : 'bg-wash text-ink-soft'
                    }`}
                  >
                    {n.state}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-line">
        <div className="w-full grid gap-10 px-5 py-24 sm:px-8 lg:px-16 xl:px-20 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 className="text-[34px] font-semibold leading-tight tracking-[-0.025em]">Questions teams ask first</h2>
            <p className="mt-4 text-[15px] text-ink-soft">
              Something else?{' '}
              <Link href="/contact" className="font-medium text-settle hover:underline">
                Ask us
              </Link>
              .
            </p>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {q}
                  <span className="text-xl font-normal text-ink-faint transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-2 max-w-[64ch] text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-line bg-ink text-white">
        <div className="w-full flex flex-wrap items-center justify-between gap-8 px-5 py-20 sm:px-8 lg:px-16 xl:px-20">
          <div>
            <h2 className="max-w-[24ch] text-[34px] font-semibold leading-tight tracking-[-0.025em]">Run your next payroll through Veyra</h2>
            <p className="mt-3 text-[16px] text-white/70">Start in the sandbox, then connect a vault when you are ready to pay for real.</p>
          </div>
          <div className="flex flex-wrap gap-3">
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
      </section>
    </>
  );
}
