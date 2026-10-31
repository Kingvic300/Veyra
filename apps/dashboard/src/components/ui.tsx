'use client';

import clsx from 'clsx';
import { Check, Copy, ExternalLink, LoaderCircle } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import type { Tone } from '@/lib/format';
import { shortHash } from '@/lib/format';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }
>(function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        variant === 'primary' && 'bg-settle text-white hover:bg-settle-strong',
        variant === 'secondary' && 'border border-line-strong bg-surface text-ink hover:bg-wash',
        variant === 'ghost' && 'text-ink-soft hover:bg-wash hover:text-ink',
        variant === 'danger' && 'border border-fail/30 bg-surface text-fail hover:bg-fail-wash',
        className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

const controlClass =
  'h-10 w-full rounded-control border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-settle focus:outline-none focus:ring-2 focus:ring-settle/15 disabled:bg-wash';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(function Input(
  { className, mono, ...rest },
  ref,
) {
  return <input ref={ref} className={clsx(controlClass, mono && 'font-mono text-[13px]', className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(controlClass, 'appearance-none bg-[length:16px] pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? <p className="text-[13px] text-fail">{error}</p> : hint ? <p className="text-[13px] text-ink-faint">{hint}</p> : null}
    </div>
  );
}

const TONE: Record<Tone, string> = {
  neutral: 'bg-wash text-ink-soft',
  pending: 'bg-pending-wash text-pending',
  settle: 'bg-settle-wash text-settle-strong',
  fail: 'bg-fail-wash text-fail',
  muted: 'bg-wash text-ink-faint',
};
const DOT: Record<Tone, string> = {
  neutral: 'bg-ink-faint',
  pending: 'bg-pending',
  settle: 'bg-settle',
  fail: 'bg-fail',
  muted: 'bg-line-strong',
};

export function Pill({ tone = 'neutral', live, children }: { tone?: Tone; live?: boolean; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] font-medium', TONE[tone])}>
      <span className={clsx('size-1.5 rounded-full', DOT[tone], live && 'dot-live')} aria-hidden />
      {children}
    </span>
  );
}

export function Panel({ title, action, children, className, padded = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={clsx('rounded-panel border border-line bg-surface', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      <div className={clsx(padded && 'p-5')}>{children}</div>
    </section>
  );
}

/** Address or transaction hash: monospace, copyable, optionally linked to an explorer. */
export function Hash({ value, href, full, className }: { value: string; href?: string | null; full?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), 1400);
  };
  return (
    <span className={clsx('inline-flex max-w-full items-center gap-1 rounded-chip bg-wash py-0.5 pl-2 pr-1 font-mono text-[12.5px] text-ink', className)}>
      <span className={clsx(!full && 'truncate')} title={value}>
        {full ? value : shortHash(value)}
      </span>
      <button type="button" onClick={copy} className="rounded p-0.5 text-ink-faint hover:text-ink" aria-label={copied ? 'Copied' : 'Copy'}>
        {copied ? <Check className="size-3.5 text-settle" /> : <Copy className="size-3.5" />}
      </button>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" className="rounded p-0.5 text-ink-faint hover:text-settle" aria-label="Open in block explorer">
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </span>
  );
}

export function Empty({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-line-strong px-6 py-10">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-[56ch] text-sm text-ink-soft">{body}</p>
      {action}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-ink-faint" role="status">
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function Notice({ tone = 'neutral', title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <div
      className={clsx(
        'rounded-control border px-4 py-3 text-sm',
        tone === 'fail' && 'border-fail/25 bg-fail-wash text-fail',
        tone === 'pending' && 'border-pending/25 bg-pending-wash text-[#7a500f]',
        tone === 'settle' && 'border-settle/25 bg-settle-wash text-settle-strong',
        (tone === 'neutral' || tone === 'muted') && 'border-line bg-wash text-ink-soft',
      )}
      role={tone === 'fail' ? 'alert' : undefined}
    >
      {title && <p className="font-semibold">{title}</p>}
      <div className={clsx(title && 'mt-0.5')}>{children}</div>
    </div>
  );
}

/** Native dialog: focus trapping and Escape handling come from the browser. */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(520px,calc(100vw-2rem))] rounded-panel border border-line bg-surface p-0 text-ink backdrop:bg-ink/30"
    >
      <div className="border-b border-line px-6 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="px-6 py-5">{open && children}</div>
    </dialog>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-5 [&_td]:py-3 [&_th]:px-5 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-[12.5px] [&_th]:font-medium [&_th]:text-ink-faint">
        {children}
      </table>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-semibold">{title}</h1>
        {description && <p className="mt-1.5 max-w-[64ch] text-[15px] text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
