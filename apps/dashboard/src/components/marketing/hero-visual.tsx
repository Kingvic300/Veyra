import { Check, Lock } from 'lucide-react';

const ROWS: [string, string, string][] = [
  ['Ngozi O.', 'NG', '2,400.00'],
  ['Kwame M.', 'GH', '1,850.50'],
  ['Amara D.', 'SN', '1,600.00'],
  ['Thandiwe N.', 'ZA', '2,100.00'],
];

const STOPS = [
  { label: 'Submitted', detail: 'Contents frozen' },
  { label: 'Registered', detail: 'Vault knows the batch' },
  { label: 'Approved', detail: '2 of 2 signed' },
  { label: 'Paid', detail: 'Block 1,204,611' },
  { label: 'Verified', detail: 'Matches chain events' },
];

const APPROVERS = [
  ['TB', '#1f5f73', '#e2eff3', 'Tunde B.', '0x05c2…41af'],
  ['WK', '#8a5a12', '#f7ecd9', 'Wanjiru K.', '0x0a17…9d03'],
];

/**
 * The product in one picture: a payroll batch, its settlement rail and the
 * signatures behind it. The rail fills once on load (the page's single
 * orchestrated motion).
 */
export function HeroVisual() {
  return (
    <div className="relative sm:pb-28" aria-hidden>
      <div className="rounded-[18px] border border-line bg-surface shadow-[0_40px_80px_-48px_rgba(19,32,27,0.55)]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-[13px] text-ink-faint">Lagos Dev Studio</p>
            <p className="font-semibold">October 2026 contractors</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-settle-wash px-2.5 py-0.5 text-[12.5px] font-medium text-settle-strong">
            <span className="size-1.5 rounded-full bg-settle" /> Paid
          </span>
        </div>

        <ol className="grid grid-cols-5 gap-0 px-5 pb-4 pt-5">
          {STOPS.map((s, i) => (
            <li key={s.label} className="relative">
              {i < STOPS.length - 1 && (
                <span className="absolute left-5 right-0 top-[9px] h-0.5 bg-line">
                  <span className="rail-segment-done block size-full bg-settle" style={{ animationDelay: `${200 + i * 260}ms` }} />
                </span>
              )}
              <span
                className="rail-dot relative z-10 flex size-5 items-center justify-center rounded-full bg-settle text-white"
                style={{ animationDelay: `${i * 260}ms` }}
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              <p className="mt-2.5 text-[12.5px] font-semibold">{s.label}</p>
              <p className="pr-2 text-[11.5px] leading-snug text-ink-faint">{s.detail}</p>
            </li>
          ))}
        </ol>

        <table className="w-full text-[13px]">
          <tbody>
            {ROWS.map(([name, cc, amt]) => (
              <tr key={name} className="border-t border-line">
                <td className="px-5 py-2.5 font-medium">{name}</td>
                <td className="py-2.5 text-ink-faint">{cc}</td>
                <td className="py-2.5 font-mono text-[11.5px] text-ink-faint">0x04a1…{cc.toLowerCase()}9e</td>
                <td className="px-5 py-2.5 text-right font-medium">{amt} USDC</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line bg-wash/60">
              <td className="px-5 py-3 font-semibold" colSpan={3}>
                Total
              </td>
              <td className="px-5 py-3 text-right font-semibold">7,950.50 USDC</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="absolute -bottom-4 right-4 hidden w-60 rounded-panel border border-line bg-surface p-4 shadow-[0_24px_60px_-36px_rgba(19,32,27,0.6)] sm:block">
        <p className="text-[12.5px] text-ink-faint">Signed on-chain by</p>
        <ul className="mt-2 flex flex-col gap-2">
          {APPROVERS.map(([ini, fg, bg, name, wallet]) => (
            <li key={name} className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-full text-[11px] font-semibold" style={{ color: fg, background: bg }}>
                {ini}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium">{name}</span>
                <span className="block font-mono text-[11px] text-ink-faint">{wallet}</span>
              </span>
              <Check className="size-4 text-settle" />
            </li>
          ))}
        </ul>
      </div>

      <div className="absolute bottom-0 left-4 hidden w-64 rounded-panel border border-line bg-surface p-4 shadow-[0_24px_60px_-36px_rgba(19,32,27,0.6)] sm:block">
        <p className="flex items-center gap-2 text-[13px] font-semibold">
          <Lock className="size-3.5 text-settle" /> Stored encrypted
        </p>
        <p className="mt-1 text-[12.5px] text-ink-soft">Names and amounts are sealed with your company key before they reach the database.</p>
      </div>
    </div>
  );
}
