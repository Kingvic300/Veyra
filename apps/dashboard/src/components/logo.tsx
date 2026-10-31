/**
 * Veyra mark: a "V" built from two settlement strokes meeting at a block,
 * the point where a payment becomes final.
 */
export function Logo({ className = '', withWord = true }: { className?: string; withWord?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 28 28" className="size-7" aria-hidden>
        <rect width="28" height="28" rx="7" fill="var(--color-ink)" />
        <path d="M7 8.5 12.6 19" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M21 8.5 15.4 19" stroke="var(--color-settle-wash)" strokeWidth="2.6" strokeLinecap="round" />
        <rect x="11.6" y="18.2" width="4.8" height="4.8" rx="1.2" fill="#3fbf8f" />
      </svg>
      {withWord && <span className="text-[19px] font-semibold tracking-[-0.02em]">Veyra</span>}
    </span>
  );
}
