'use client';

import { useState } from 'react';
import type { Asset, MonthlySpend } from '@veyra/core';
import { amount } from '@/lib/format';

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });
const MONTH_LONG = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthDate = (m: string) => new Date(`${m}-01T00:00:00Z`);

/** Compact axis figure: 12.4k, 1.2M. */
function compact(units: bigint, decimals: number): string {
  const n = Number(units) / 10 ** decimals;
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/**
 * Monthly payroll paid out. Single series (no legend; the panel title names it).
 * Columns: 24px max, 4px rounded top, square on the baseline, 2px gap minimum.
 * Value label only on the latest month; every column has a hover tooltip.
 */
export function MonthlyColumns({ data, asset }: { data: MonthlySpend[]; asset: Asset }) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map((d) => BigInt(d.total));
  const max = totals.reduce((a, b) => (b > a ? b : a), 0n);
  const top = max === 0n ? 1n : max;
  const H = 168;
  const last = data.length - 1;

  return (
    <figure>
      <div className="relative">
        {/* recessive grid: baseline + midline */}
        <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: H }} aria-hidden>
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
          <div className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: H / 2 }} />
          <div className="absolute inset-x-0 bottom-0 border-t border-line-strong" />
          <span className="absolute -top-2 right-0 bg-surface pl-1 text-[11px] text-ink-faint">{compact(top, asset.decimals)}</span>
        </div>
        <div className="relative grid items-end gap-0.5" style={{ height: H, gridTemplateColumns: `repeat(${data.length}, minmax(0,1fr))` }}>
          {data.map((d, i) => {
            const h = totals[i] === 0n ? 0 : Math.max(3, Number((totals[i]! * BigInt(H - 22)) / top));
            return (
              <button
                key={d.month}
                type="button"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="relative flex h-full items-end justify-center focus:outline-none"
                aria-label={`${MONTH_LONG.format(monthDate(d.month))}: ${amount(d.total, asset)} across ${d.batches} batches`}
              >
                {i === last && h > 0 && (
                  <span className="absolute text-[12px] font-medium text-ink" style={{ bottom: h + 6 }}>
                    {compact(totals[i]!, asset.decimals)}
                  </span>
                )}
                <span
                  className="block w-full max-w-6 rounded-t-[4px] transition-opacity"
                  style={{ height: h, background: 'var(--color-settle)', opacity: hover === null || hover === i ? 1 : 0.45 }}
                />
                {hover === i && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute z-10 w-max rounded-control border border-line bg-surface px-3 py-2 text-left text-[12.5px] shadow-[0_8px_24px_-12px_rgba(19,32,27,0.4)]"
                    style={{ bottom: h + 10 }}
                  >
                    <span className="block font-medium text-ink">{MONTH_LONG.format(monthDate(d.month))}</span>
                    <span className="block text-ink-soft">{amount(d.total, asset)}</span>
                    <span className="block text-ink-faint">
                      {d.batches} batch{d.batches === 1 ? '' : 'es'}, {d.payments} payment{d.payments === 1 ? '' : 's'}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-2 grid gap-0.5 text-center text-[12px] text-ink-faint" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0,1fr))` }} aria-hidden>
          {data.map((d, i) => (
            <span key={d.month} className={i === last ? 'font-medium text-ink-soft' : ''}>
              {MONTH.format(monthDate(d.month))}
            </span>
          ))}
        </div>
      </div>
      {/* table view for screen readers */}
      <table className="sr-only">
        <caption>Payroll paid per month</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th scope="row">{MONTH_LONG.format(monthDate(d.month))}</th>
              <td>{amount(d.total, asset)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const REGION = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
export function countryName(code: string) {
  if (code === 'Unknown') return 'Country not set';
  try {
    return REGION?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Horizontal bars, one hue, value at the tip in ink. */
export function CountryBars({ rows, asset }: { rows: { country: string; total: string; contractors: number }[]; asset: Asset }) {
  const max = rows.reduce((a, r) => (BigInt(r.total) > a ? BigInt(r.total) : a), 0n) || 1n;
  return (
    <ul className="flex flex-col gap-3.5">
      {rows.slice(0, 6).map((r) => {
        const pct = Number((BigInt(r.total) * 1000n) / max) / 10;
        return (
          <li key={r.country}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">
                {countryName(r.country)}
                <span className="ml-1.5 text-[12px] text-ink-faint">
                  {r.contractors} {r.contractors === 1 ? 'person' : 'people'}
                </span>
              </span>
              <span className="shrink-0 font-medium">{amount(r.total, asset)}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-wash">
              <div className="h-2 rounded-r-[4px] rounded-l-full bg-settle" style={{ width: `${Math.max(pct, 2)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
