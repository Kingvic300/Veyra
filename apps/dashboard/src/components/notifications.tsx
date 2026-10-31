'use client';

import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Two kinds of feedback:
 * - toasts for routine confirmations and recoverable errors (auto-dismiss);
 * - a result modal for outcomes that need attention: money moved, a payment
 *   failed, a wallet rejected a transaction. Modals wait for the person.
 */

export type NoticeTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastInput {
  tone: NoticeTone;
  title: string;
  description?: string;
  /** Milliseconds; errors stay longer by default. 0 keeps it until dismissed. */
  duration?: number;
}

export interface AlertInput {
  tone: NoticeTone;
  title: string;
  body: ReactNode;
  /** Optional link shown as the primary action. */
  action?: { label: string; href: string };
  dismissLabel?: string;
}

interface ToastItem extends ToastInput {
  id: number;
}

interface NotifyApi {
  toast: (input: ToastInput) => void;
  alert: (input: AlertInput) => void;
}

const NotifyContext = createContext<NotifyApi>({ toast: () => {}, alert: () => {} });

export const SESSION_EXPIRED_EVENT = 'veyra:session-expired';
export const SIGNED_IN_FLAG = 'veyra:signed-in';

const ICON = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
const ICON_COLOUR = { success: 'text-settle', error: 'text-fail', info: 'text-ink-soft', warning: 'text-pending' };
const BAR = { success: 'bg-settle', error: 'bg-fail', info: 'bg-ink-faint', warning: 'bg-pending' };

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [modal, setModal] = useState<AlertInput | null>(null);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-3), { ...input, id }]);
      const duration = input.duration ?? (input.tone === 'error' ? 9000 : 5000);
      if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
    },
    [dismiss],
  );

  const alert = useCallback((input: AlertInput) => setModal(input), []);

  // Session expiry is reported by the query client from anywhere in the app.
  useEffect(() => {
    const onExpired = () => {
      if (sessionStorage.getItem(SIGNED_IN_FLAG) !== '1') return;
      sessionStorage.removeItem(SIGNED_IN_FLAG);
      toast({ tone: 'warning', title: 'You were signed out', description: 'Your session ended. Sign in again to continue.' });
      const p = window.location.pathname;
      if (p.startsWith('/o/') || p.startsWith('/app') || p.startsWith('/onboarding')) {
        setTimeout(() => window.location.assign('/login'), 1200);
      }
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [toast]);

  return (
    <NotifyContext.Provider value={{ toast, alert }}>
      {children}

      <ol className="no-print pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <li
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="toast-in pointer-events-auto relative flex gap-3 overflow-hidden rounded-control border border-line bg-surface py-3 pl-4 pr-10 shadow-[0_10px_30px_-14px_rgba(19,32,27,0.4)]"
            >
              <span className={clsx('absolute inset-y-0 left-0 w-1', BAR[t.tone])} aria-hidden />
              <Icon className={clsx('mt-0.5 size-[18px] shrink-0', ICON_COLOUR[t.tone])} aria-hidden />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-ink">{t.title}</p>
                {t.description && <p className="mt-0.5 break-words text-ink-soft">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="absolute right-2 top-2 rounded p-1 text-ink-faint hover:bg-wash hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X className="size-4" />
              </button>
            </li>
          );
        })}
      </ol>

      <ResultModal input={modal} onClose={() => setModal(null)} />
    </NotifyContext.Provider>
  );
}

function ResultModal({ input, onClose }: { input: AlertInput | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (input && !d.open) d.showModal();
    if (!input && d.open) d.close();
  }, [input]);
  const Icon = input ? ICON[input.tone] : Info;
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(440px,calc(100vw-2rem))] rounded-panel border border-line bg-surface p-0 text-ink backdrop:bg-ink/30"
      aria-labelledby="result-title"
    >
      {input && (
        <div className="p-6">
          <span
            className={clsx(
              'flex size-11 items-center justify-center rounded-full',
              input.tone === 'success' && 'bg-settle-wash',
              input.tone === 'error' && 'bg-fail-wash',
              input.tone === 'warning' && 'bg-pending-wash',
              input.tone === 'info' && 'bg-wash',
            )}
          >
            <Icon className={clsx('size-6', ICON_COLOUR[input.tone])} aria-hidden />
          </span>
          <h2 id="result-title" className="mt-4 text-lg font-semibold">
            {input.title}
          </h2>
          <div className="mt-1.5 text-sm text-ink-soft">{input.body}</div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-control border border-line-strong px-4 text-sm font-medium hover:bg-wash"
              autoFocus={!input.action}
            >
              {input.dismissLabel ?? 'Close'}
            </button>
            {input.action && (
              <Link
                href={input.action.href}
                onClick={onClose}
                className="inline-flex h-10 items-center rounded-control bg-settle px-4 text-sm font-medium text-white hover:bg-settle-strong"
                autoFocus
              >
                {input.action.label}
              </Link>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}

export function useNotify(): NotifyApi {
  return useContext(NotifyContext);
}
