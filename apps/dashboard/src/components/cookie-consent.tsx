'use client';

import { Cookie } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CONSENT_CHANGED_EVENT, OPEN_CONSENT_EVENT, readConsent, saveConsent, type Consent } from '@/lib/consent';
import { Dialog } from './ui';

const ANALYTICS_SRC = process.env.NEXT_PUBLIC_ANALYTICS_SRC;

/**
 * Consent banner and preferences. Rejecting is as easy as accepting, nothing
 * optional runs before a choice, and the choice can be changed at any time
 * from "Cookie settings" in the footer.
 */
export function CookieConsent() {
  const [consent, setConsent] = useState<Consent | null | undefined>(undefined);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const c = readConsent();
    setConsent(c);
    setAnalytics(c?.analytics ?? false);
    const open = () => {
      setAnalytics(readConsent()?.analytics ?? false);
      setPrefsOpen(true);
    };
    const changed = (e: Event) => setConsent((e as CustomEvent<Consent>).detail);
    window.addEventListener(OPEN_CONSENT_EVENT, open);
    window.addEventListener(CONSENT_CHANGED_EVENT, changed);
    return () => {
      window.removeEventListener(OPEN_CONSENT_EVENT, open);
      window.removeEventListener(CONSENT_CHANGED_EVENT, changed);
    };
  }, []);

  // Load optional analytics only after consent, and only if an operator configured it.
  useEffect(() => {
    if (!consent?.analytics || !ANALYTICS_SRC || document.querySelector('script[data-veyra-analytics]')) return;
    const s = document.createElement('script');
    s.src = ANALYTICS_SRC;
    s.defer = true;
    s.dataset.veyraAnalytics = '1';
    document.head.appendChild(s);
  }, [consent]);

  const decide = (value: boolean) => {
    setConsent(saveConsent(value));
    setPrefsOpen(false);
  };

  return (
    <>
      {consent === null && (
        <div
          role="region"
          aria-label="Cookie consent"
          className="no-print toast-in fixed inset-x-3 bottom-3 z-[55] mx-auto flex max-w-3xl flex-col gap-3 rounded-panel border border-line bg-surface px-4 py-3 shadow-[0_20px_50px_-24px_rgba(19,32,27,0.5)] sm:flex-row sm:items-center"
        >
          <p className="flex flex-1 items-start gap-2.5 text-[13px] text-ink-soft">
            <Cookie className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              We use one cookie to keep you signed in. May we also count page visits anonymously?{' '}
              <Link href="/legal/cookies" className="font-medium text-settle underline-offset-2 hover:underline">
                Cookie policy
              </Link>
            </span>
          </p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setPrefsOpen(true)} className="h-8 rounded-control px-2.5 text-[13px] font-medium text-ink-soft hover:bg-wash hover:text-ink">
              Settings
            </button>
            <button type="button" onClick={() => decide(false)} className="h-8 rounded-control border border-line-strong px-3 text-[13px] font-medium hover:bg-wash">
              No thanks
            </button>
            <button type="button" onClick={() => decide(true)} className="h-8 rounded-control bg-settle px-3 text-[13px] font-medium text-white hover:bg-settle-strong">
              Allow
            </button>
          </div>
        </div>
      )}

      <Dialog open={prefsOpen} onClose={() => setPrefsOpen(false)} title="Cookie settings">
        <div className="flex flex-col gap-3 text-sm">
          <div className="rounded-control border border-line p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="font-medium">Essential</p>
              <span className="text-[12.5px] text-ink-faint">Always on</span>
            </div>
            <p className="mt-1 text-ink-soft">Keeps you signed in, protects forms from cross-site requests and remembers these choices. Veyra cannot work without them.</p>
          </div>
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-control border border-line p-4">
            <span>
              <span className="block font-medium">Anonymous analytics</span>
              <span className="mt-1 block text-ink-soft">Counts page visits without identifying you, so we learn which parts of Veyra are useful. Never used for advertising.</span>
            </span>
            <span className="relative mt-0.5 inline-flex shrink-0">
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="peer sr-only" />
              <span className="h-6 w-10 rounded-full bg-line-strong transition-colors peer-checked:bg-settle peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-settle" />
              <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </span>
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => decide(false)} className="h-10 rounded-control border border-line-strong px-4 font-medium hover:bg-wash">
              Reject optional
            </button>
            <button type="button" onClick={() => decide(analytics)} className="h-10 rounded-control bg-settle px-4 font-medium text-white hover:bg-settle-strong">
              Save choices
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
