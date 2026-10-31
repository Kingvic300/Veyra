import clsx from 'clsx';

/** Muted tiles drawn from the banknote palette: greens, teals, ochres, slate. */
const TILES = [
  ['#0b6b4f', '#e3f1eb'],
  ['#1f5f73', '#e2eff3'],
  ['#8a5a12', '#f7ecd9'],
  ['#3d4f47', '#e8edea'],
  ['#25704a', '#e6f3ec'],
  ['#6b4e1f', '#f3ebdf'],
] as const;

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : (parts[0]?.[1] ?? ''))).toUpperCase();
}

export function Avatar({ name, seed, size = 'md', round = false }: { name: string; seed?: string; size?: 'sm' | 'md' | 'lg'; round?: boolean }) {
  const [fg, bg] = TILES[hash(seed ?? name) % TILES.length]!;
  return (
    <span
      aria-hidden
      className={clsx(
        'inline-flex shrink-0 items-center justify-center font-semibold tracking-[-0.02em]',
        round ? 'rounded-full' : 'rounded-[9px]',
        size === 'sm' && 'size-7 text-[11px]',
        size === 'md' && 'size-9 text-[13px]',
        size === 'lg' && 'size-12 text-base',
      )}
      style={{ color: fg, background: bg, boxShadow: `inset 0 0 0 1px ${fg}22` }}
    >
      {initials(name)}
    </span>
  );
}
