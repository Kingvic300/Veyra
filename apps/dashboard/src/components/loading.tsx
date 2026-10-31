'use client';

/**
 * Loading states that look like Veyra, not a generic spinner:
 * - BrandLoader: the logo's settlement block drops into place while a thin
 *   rail fills underneath. Used for full-screen transitions.
 * - Skeleton blocks shaped like the content that is about to appear.
 */

export function BrandLoader({ label }: { label: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-paper" role="status" aria-label={label}>
      <svg viewBox="0 0 56 56" className="size-14" aria-hidden>
        <rect width="56" height="56" rx="14" fill="var(--color-ink)" />
        <path d="M14 17 25.2 38" stroke="#fff" strokeWidth="5" strokeLinecap="round" className="loader-stroke" />
        <path d="M42 17 30.8 38" stroke="var(--color-settle-wash)" strokeWidth="5" strokeLinecap="round" className="loader-stroke loader-stroke-2" />
        <rect x="23.2" y="36.4" width="9.6" height="9.6" rx="2.4" fill="#3fbf8f" className="loader-block" />
      </svg>
      <div className="h-[3px] w-40 overflow-hidden rounded-full bg-line">
        <div className="loader-rail h-full w-1/3 rounded-full bg-settle" />
      </div>
    </main>
  );
}

function Bar({ className = '' }: { className?: string }) {
  return <span className={`skeleton block rounded-md ${className}`} />;
}

/** Rows of a table or list. */
export function SkeletonRows({ rows = 4, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div className="rounded-panel border border-line bg-surface" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-6 border-t border-line px-5 py-4 first:border-t-0">
          <Bar className="h-3.5 w-1/4" />
          <Bar className="h-3.5 w-1/5" />
          <Bar className="ml-auto h-3.5 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Whole page: heading, a wide band and two columns. */
export function SkeletonPage({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label}>
      <Bar className="h-4 w-24" />
      <Bar className="mt-3 h-8 w-72" />
      <div className="mt-10 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-surface p-6">
            <Bar className="h-3.5 w-28" />
            <Bar className="mt-4 h-7 w-40" />
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <SkeletonRows rows={3} />
        <SkeletonRows rows={2} />
      </div>
    </div>
  );
}

/** App frame with sidebar, shown while the organisation loads. */
export function SkeletonShell() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="hidden h-dvh flex-col gap-6 border-r border-line bg-surface p-5 lg:flex">
        <Bar className="h-7 w-28" />
        <Bar className="h-10 w-full" />
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Bar key={i} className="h-5 w-3/4" />
          ))}
        </div>
      </aside>
      <main className="w-full px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
        <SkeletonPage label="Loading organisation" />
      </main>
    </div>
  );
}
