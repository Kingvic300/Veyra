import type { Metadata } from 'next';
import Link from 'next/link';
import { HeroVisual } from '@/components/marketing/hero-visual';
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

const AUDIENCES = [
  ['Software agencies', 'Monthly contractor runs across many countries, without a spreadsheet of wallet addresses.'],
  ['Remote-first startups', 'Pay a distributed team in stablecoins with the same approvals you use for any other spend.'],
  ['Web3 teams and DAOs', 'Contributor payments and grants released only when the right people sign.'],
  ['African businesses', 'Built in Lagos for cross-border contractor payments where banking rails are slow or expensive.'],
];

const NETWORKS = [
  { name: 'Starknet', state: 'Available', note: 'PayrollVault contract, STRK20 private transfers in preview' },
  { name: 'Stellar', state: 'Next', note: 'Soroban contracts for stablecoin payroll' },
  { name: 'Sui and Solana', state: 'Planned', note: 'Move and Anchor adapters on the same core' },
  { name: 'Ethereum', state: 'Planned', note: 'Smart-account workflows' },
  { name: 'Bitcoin and Lightning', state: 'Researching', note: 'A separate design, not a contract port' },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="block-grid border-b border-line">
        <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 pb-24 pt-16 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:pt-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[13px] text-ink-soft">
              <span className="size-1.5 rounded-full bg-settle" /> Open source, live on Starknet
            </p>
            <h1 className="mt-6 text-[44px] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[58px]">
              Payroll that settles on-chain and stays between you and your team.
            </h1>
            <p className="mt-6 max-w-[48ch] text-[17px] leading-relaxed text-ink-soft">
              Veyra lets you prepare a payroll batch, collect approvals from the people who sign off on money, pay every contractor in one transaction
              and keep a receipt anyone can verify.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex h-12 items-center rounded-control bg-ink px-6 text-[15px] font-medium text-white hover:bg-settle-strong">
                Start free in the sandbox
              </Link>
              <Link href="/developers" className="inline-flex h-12 items-center rounded-control border border-line-strong bg-surface px-6 text-[15px] font-medium hover:bg-wash">
                Read the developer guide
              </Link>
            </div>
            <p className="mt-5 text-[13px] text-ink-faint">The sandbox uses test funds. No wallet or card needed to try it.</p>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-[1200px] scroll-mt-20 px-5 py-24 sm:px-8">
        <h2 className="max-w-[22ch] text-[34px] font-semibold leading-tight tracking-[-0.025em]">From spreadsheet to verified payment in four steps</h2>
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

      {/* Honest privacy */}
      <section className="border-y border-line bg-[#f4f7f5]">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_1.3fr]">
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
      <section className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8">
        <h2 className="max-w-[24ch] text-[34px] font-semibold leading-tight tracking-[-0.025em]">Made for teams that pay people across borders</h2>
        <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {AUDIENCES.map(([title, body]) => (
            <div key={title} className="border-t border-ink pt-5">
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Open source + networks */}
      <section className="border-t border-line">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-2">
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
          </div>
          <div>
            <h3 className="text-lg font-semibold">Networks</h3>
            <p className="mt-1 text-[15px] text-ink-soft">One payroll core, a separate adapter per chain. We add a network only when it works end to end.</p>
            <ul className="mt-6 divide-y divide-line rounded-panel border border-line bg-surface">
              {NETWORKS.map((n) => (
                <li key={n.name} className="flex items-start justify-between gap-4 px-5 py-4">
                  <span>
                    <span className="block font-medium">{n.name}</span>
                    <span className="block text-[13.5px] text-ink-soft">{n.note}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12.5px] font-medium ${
                      n.state === 'Available' ? 'bg-settle-wash text-settle-strong' : n.state === 'Next' ? 'bg-pending-wash text-pending' : 'bg-wash text-ink-soft'
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

      {/* CTA */}
      <section className="border-t border-line bg-ink text-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-8 px-5 py-20 sm:px-8">
          <div>
            <h2 className="max-w-[24ch] text-[34px] font-semibold leading-tight tracking-[-0.025em]">Run your next payroll through Veyra</h2>
            <p className="mt-3 text-[16px] text-white/70">Start in the sandbox, then connect a vault when you are ready to pay for real.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className="inline-flex h-12 items-center rounded-control bg-white px-6 text-[15px] font-medium text-ink hover:bg-settle-wash">
              Create an account
            </Link>
            <Link href="/contact" className="inline-flex h-12 items-center rounded-control border border-white/25 px-6 text-[15px] font-medium hover:bg-white/10">
              Talk to us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
