import Link from 'next/link';
import { Logo } from '@/components/logo';

export default function NotFound() {
  return (
    <main className="block-grid flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mt-10 font-mono text-sm text-ink-faint">404</p>
      <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.02em]">This page is not on the ledger</h1>
      <p className="mt-2 max-w-[44ch] text-ink-soft">The link may be old, or the page may have moved.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="inline-flex h-10 items-center rounded-control border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-wash">
          Home
        </Link>
        <Link href="/app" className="inline-flex h-10 items-center rounded-control bg-ink px-4 text-sm font-medium text-white hover:bg-settle-strong">
          Open the app
        </Link>
      </div>
    </main>
  );
}
