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
          className="no-print toast-in fixed bottom-4 left-4 z-[55] w-[min(420px,calc(100vw-2rem))] rounded-panel border border-line bg-surface p-5 shadow-[0_20px_50px_-24px_rgba(19,32,27,0.5)]"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-wash text-ink-soft">
              <Cookie className="size-[18px]" aria-hidden />
            </span>
            <div className="text-sm">
              <p className="font-semibold">Your privacy choices</p>
              <p className="mt-1 text-ink-soft">
                We use one essential cookie to keep you signed in. With your permission we would also measure page visits anonymously to improve
                Veyra. Read the{' '}
                <Link href="/legal/cookies" className="font-medium text-settle underline-offset-2 hover:underline">
                  cookie policy
                </Link>
                .
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => decide(false)} className="h-9 rounded-control border border-line-strong text-[13px] font-medium hover:bg-wash">
              Essential only
            </button>
            <button type="button" onClick={() => setPrefsOpen(true)} className="h-9 rounded-control border border-line-strong text-[13px] font-medium hover:bg-wash">
              Choose
            </button>
            <button type="button" onClick={() => decide(true)} className="h-9 rounded-control bg-settle text-[13px] font-medium text-white hover:bg-settle-strong">
              Accept all
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
