import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingPage } from '@/components/marketing/legal-page';

export const metadata: Metadata = { title: 'About' };

const PRINCIPLES = [
  ['Prove one thing well', 'A business can create, approve, pay and verify a payroll batch on one network before we add the next.'],
  [
    'Never overstate privacy',
    'Every screen says what is public. We would rather lose a sale than let someone believe a transparent payment is hidden.',
  ],
  [
    'Keep custody with the customer',
    'Funds stay in contracts and wallets our customers control. Our servers can be wrong without anyone losing money.',
  ],
  ['Stay open', 'The core is Apache 2.0 so anyone can inspect it, run it and keep running it without us.'],
];

export default function AboutPage() {
  return (
    <MarketingPage
      title="Payroll for the way teams are paid now"
      intro="Teams across Africa and beyond pay contractors in stablecoins every month. Most still juggle spreadsheets, screenshots of wallet addresses and a chat thread for approvals. Veyra replaces that with a workflow you can prove."
    >
      <section className="w-full grid gap-12 px-5 py-16 sm:px-8 lg:px-16 xl:px-20 lg:grid-cols-[1fr_1.4fr]">
        <div className="prose-veyra">
          <h2 style={{ marginTop: 0 }}>Why we started</h2>
          <p>
            Cross-border payroll is slow and expensive on bank rails, and fast but chaotic on-chain. The hard part is not sending tokens. It is
            agreeing who gets paid, proving that the right people approved it, and keeping salaries confidential while doing it.
          </p>
          <p>
            Veyra began in Lagos as an open-source project to solve that for software agencies and remote teams, starting on Starknet and adding
            networks one at a time.
          </p>
        </div>
        <ul className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2">
          {PRINCIPLES.map(([title, body]) => (
            <li key={title} className="bg-surface p-6">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{body}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="border-t border-line bg-[#f4f7f5]">
        <div className="w-full px-5 py-16 sm:px-8 lg:px-16 xl:px-20">
          <h2 className="text-[30px] font-semibold tracking-[-0.025em]">Where Veyra is going</h2>
          <ol className="relative mt-10 grid gap-8 md:grid-cols-3 xl:grid-cols-6">
            <span className="absolute left-0 right-0 top-[7px] hidden h-0.5 bg-line-strong xl:block" aria-hidden />
            {(
              [
                ['Now', 'Starknet payroll vault', 'Contract-enforced approvals, verified receipts, sandbox.', true],
                ['Now', 'STRK20 preview', 'Private transfers for teams with privacy-enabled wallets.', true],
                ['Next', 'Testnet pilots', 'Five teams running real payroll cycles on Sepolia.', false],
                ['Next', 'Independent audit', 'External review of the PayrollVault before mainnet.', false],
                ['Later', 'Stellar', 'Soroban contracts for stablecoin payroll.', false],
                ['Later', 'More networks', 'Sui, Solana, Ethereum, then Bitcoin and Lightning.', false],
              ] as const
            ).map(([when, title, body, done]) => (
              <li key={title} className="relative">
                <span
                  className={`relative z-10 block size-4 rounded-full border-2 ring-4 ring-[#f4f7f5] ${done ? 'border-settle bg-settle' : 'border-line-strong bg-surface'}`}
                />
                <p className={`mt-4 text-[13px] font-medium ${done ? 'text-settle' : 'text-ink-faint'}`}>{when}</p>
                <h3 className="mt-1 font-semibold">{title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="border-t border-line">
        <div className="w-full flex flex-wrap items-center justify-between gap-6 px-5 py-14 sm:px-8 lg:px-16 xl:px-20">
          <p className="max-w-[48ch] text-lg">Want to pilot Veyra with your team, or help build the next network adapter?</p>
          <Link
            href="/contact"
            className="inline-flex h-11 items-center rounded-control bg-ink px-5 text-sm font-medium text-white hover:bg-settle-strong"
          >
            Get in touch
          </Link>
        </div>
      </section>
    </MarketingPage>
  );
}
