import Link from 'next/link';
import type { ReactNode } from 'react';
import { site } from '@/lib/site';

const LEGAL_NAV = [
  { href: '/legal/privacy', label: 'Privacy policy' },
  { href: '/legal/terms', label: 'Terms of service' },
  { href: '/legal/cookies', label: 'Cookie policy' },
  { href: '/legal/acceptable-use', label: 'Acceptable use' },
  { href: '/legal/risk', label: 'Risk disclosure' },
];

export function LegalPage({ title, summary, current, children }: { title: string; summary: string; current: string; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Legal documents" className="lg:sticky lg:top-24 lg:self-start">
        <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
          {LEGAL_NAV.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={l.href === current ? 'page' : undefined}
                className={`block rounded-control px-3 py-1.5 text-sm ${l.href === current ? 'bg-surface font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-line)]' : 'text-ink-soft hover:text-ink'}`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <article>
        <h1 className="text-[38px] font-semibold tracking-[-0.025em]">{title}</h1>
        <p className="mt-3 max-w-[64ch] text-[17px] text-ink-soft">{summary}</p>
        <p className="mt-4 text-[13px] text-ink-faint">Last updated {site.legalUpdated}</p>
        {!site.legalReviewed && (
          <p className="mt-6 max-w-[72ch] rounded-control border border-pending/25 bg-pending-wash px-4 py-3 text-[13.5px] text-[#7a500f]">
            This document is a draft that has not yet been reviewed by a lawyer. It describes how the software actually works, but the final terms may
            change before the hosted service launches.
          </p>
        )}
        <div className="prose-veyra mt-10">{children}</div>
      </article>
    </div>
  );
}

export function MarketingPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <>
      <section className="block-grid border-b border-line">
        <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-20 sm:px-8">
          <h1 className="max-w-[20ch] text-[44px] font-semibold leading-[1.06] tracking-[-0.03em]">{title}</h1>
          <div className="mt-5 max-w-[60ch] text-[17px] leading-relaxed text-ink-soft">{intro}</div>
        </div>
      </section>
      {children}
    </>
  );
}
