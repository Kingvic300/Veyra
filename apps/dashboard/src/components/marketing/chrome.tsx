'use client';

import clsx from 'clsx';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/logo';
import { openConsentPreferences } from '@/lib/consent';
import { site } from '@/lib/site';

/** GitHub's mark, used only to link to the source repository. */
export function GithubMark({ className = 'size-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

const NAV = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/security', label: 'Security' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/developers', label: 'Developers' },
  { href: '/about', label: 'About' },
];

export function MarketingHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={clsx('sticky top-0 z-40 border-b bg-paper/85 backdrop-blur transition-colors', scrolled ? 'border-line' : 'border-transparent')}>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-5 sm:px-8">
        <Link href="/" aria-label="Veyra home">
          <Logo />
        </Link>
        <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={clsx('rounded-control px-3 py-2 text-[14.5px]', pathname === n.href ? 'text-ink' : 'text-ink-soft hover:text-ink')}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <a href={site.githubUrl} target="_blank" rel="noreferrer" className="rounded-control p-2 text-ink-soft hover:bg-wash hover:text-ink" aria-label="Veyra on GitHub">
            <GithubMark />
          </a>
          <Link href="/login" className="rounded-control px-3 py-2 text-[14.5px] text-ink-soft hover:text-ink">
            Sign in
          </Link>
          <Link href="/register" className="inline-flex h-10 items-center rounded-control bg-ink px-4 text-sm font-medium text-white hover:bg-settle-strong">
            Start free
          </Link>
        </div>
        <button type="button" className="ml-auto p-2 md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-line bg-paper px-5 py-4 md:hidden" aria-label="Mobile">
          <ul className="flex flex-col">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block py-2.5 text-[15px]">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/login" className="flex h-10 items-center justify-center rounded-control border border-line-strong text-sm font-medium">
              Sign in
            </Link>
            <Link href="/register" className="flex h-10 items-center justify-center rounded-control bg-ink text-sm font-medium text-white">
              Start free
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

const FOOTER = [
  {
    title: 'Product',
    links: [
      { href: '/#how-it-works', label: 'How it works' },
      { href: '/security', label: 'Security and privacy' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/developers', label: 'Developers' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
      { href: site.githubUrl, label: 'Source code' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/privacy', label: 'Privacy policy' },
      { href: '/legal/terms', label: 'Terms of service' },
      { href: '/legal/cookies', label: 'Cookie policy' },
      { href: '/legal/acceptable-use', label: 'Acceptable use' },
      { href: '/legal/risk', label: 'Risk disclosure' },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-[#f4f7f5]">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-[34ch] text-sm text-ink-soft">{site.tagline}</p>
          <p className="mt-6 text-[13px] text-ink-faint">Open source under the Apache License 2.0.</p>
        </div>
        {FOOTER.map((g) => (
          <div key={g.title}>
            <h2 className="text-[13px] font-semibold">{g.title}</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {g.links.map((l) => (
                <li key={l.href}>
                  {l.href.startsWith('http') ? (
                    <a href={l.href} target="_blank" rel="noreferrer" className="text-ink-soft hover:text-ink">
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="text-ink-soft hover:text-ink">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
              {g.title === 'Legal' && (
                <li>
                  <button type="button" onClick={openConsentPreferences} className="text-ink-soft hover:text-ink">
                    Cookie settings
                  </button>
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-3 px-5 py-5 text-[12.5px] text-ink-faint sm:px-8">
          <span>
            © {new Date().getFullYear()} {site.legalEntity}
          </span>
          <span>Veyra is software, not a bank. It never holds your funds.</span>
        </div>
      </div>
    </footer>
  );
}
