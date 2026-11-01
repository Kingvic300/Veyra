import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { MarketingPage } from '@/components/marketing/legal-page';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'Pricing' };

const PLANS = [
  {
    name: 'Open source',
    price: 'Free',
    cadence: 'forever',
    blurb: 'Run Veyra on your own servers.',
    cta: { label: 'Get the code', href: site.githubUrl, external: true },
    features: ['Every payroll feature', 'Contracts, adapters and SDK', 'Apache License 2.0', 'Community support on GitHub'],
  },
  {
    name: 'Team',
    price: '$49',
    cadence: 'per month',
    blurb: 'Hosted for small teams paying up to 25 contractors.',
    cta: { label: 'Start free', href: '/register' },
    features: [
      'Up to 25 active contractors',
      'Unlimited batches and approvers',
      'Starknet vault and sandbox',
      'Receipts and CSV export',
      'Email support',
    ],
    featured: true,
  },
  {
    name: 'Growth',
    price: '$199',
    cadence: 'per month',
    blurb: 'For agencies and DAOs with larger teams.',
    cta: { label: 'Start free', href: '/register' },
    features: ['Up to 150 active contractors', 'Everything in Team', 'Spending limits and policy controls', 'Priority support'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: '',
    blurb: 'Dedicated infrastructure and agreements.',
    cta: { label: 'Talk to us', href: '/contact' },
    features: ['Unlimited contractors', 'Single-tenant deployment', 'Custom integrations', 'Service levels and security review'],
  },
];

const FAQ = [
  [
    'Do you charge a fee on each payment?',
    'No. Plans are a flat monthly price. Network fees are paid by your own wallets and go to the network, not to us.',
  ],
  [
    'Do you ever hold our money?',
    'No. Funds stay in your vault contract or your own account. Veyra builds the transactions; your wallets sign them.',
  ],
  [
    'What happens if we stop paying for the hosted plan?',
    'You keep full access to your vault on-chain, and you can export every receipt and the audit log. You can also move to the open-source version.',
  ],
  ['Can we try it first?', 'Yes. Every account can create a practice company that runs the full flow with test funds.'],
];

export default function PricingPage() {
  return (
    <MarketingPage
      title="Simple pricing, no fee per payment"
      intro="Self-host for free, or let us run Veyra for you. Every plan includes the sandbox so you can test the full flow first."
    >
      <section className="w-full px-5 py-16 sm:px-8 lg:px-16 xl:px-20">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`flex flex-col rounded-[18px] border bg-surface p-7 ${p.featured ? 'border-ink shadow-[0_30px_60px_-40px_rgba(19,32,27,0.6)]' : 'border-line'}`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{p.name}</h2>
                {p.featured && (
                  <span className="rounded-full bg-settle-wash px-2.5 py-0.5 text-[12px] font-medium text-settle-strong">Most teams</span>
                )}
              </div>
              <p className="mt-1 text-sm text-ink-soft">{p.blurb}</p>
              <p className="mt-6">
                <span className="text-[38px] font-semibold tracking-[-0.03em]">{p.price}</span>
                {p.cadence && <span className="ml-1.5 text-sm text-ink-faint">{p.cadence}</span>}
              </p>
              {p.cta.external ? (
                <a
                  href={p.cta.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-control border border-line-strong text-sm font-medium hover:bg-wash"
                >
                  {p.cta.label}
                </a>
              ) : (
                <Link
                  href={p.cta.href}
                  className={`mt-6 inline-flex h-11 items-center justify-center rounded-control text-sm font-medium ${p.featured ? 'bg-ink text-white hover:bg-settle-strong' : 'border border-line-strong hover:bg-wash'}`}
                >
                  {p.cta.label}
                </Link>
              )}
              <ul className="mt-7 flex flex-col gap-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-settle" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 text-[13px] text-ink-faint">Prices in US dollars, billed monthly. Taxes may apply. Hosted plans are in early access.</p>
      </section>

      <section className="border-t border-line">
        <div className="w-full grid gap-10 px-5 py-20 sm:px-8 lg:px-16 xl:px-20 lg:grid-cols-[1fr_2fr]">
          <h2 className="text-[30px] font-semibold tracking-[-0.025em]">Questions</h2>
          <dl className="divide-y divide-line border-y border-line">
            {FAQ.map(([q, a]) => (
              <div key={q} className="py-5">
                <dt className="font-semibold">{q}</dt>
                <dd className="mt-1.5 max-w-[64ch] text-ink-soft">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </MarketingPage>
  );
}
