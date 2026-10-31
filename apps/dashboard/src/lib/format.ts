import { formatUnits } from '@veyra/core';
import type { Asset, BatchStatus } from '@veyra/core';

export function amount(units: string | bigint, asset: Pick<Asset, 'decimals' | 'symbol'>, opts: { symbol?: boolean } = {}) {
  const raw = formatUnits(units, asset.decimals);
  const [whole = '0', fraction = ''] = raw.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = fraction.length < 2 ? fraction.padEnd(2, '0') : fraction;
  const text = `${grouped}.${frac}`;
  return opts.symbol === false ? text : `${text} ${asset.symbol}`;
}

export function shortHash(value: string, head = 6, tail = 4) {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function date(iso: string | null | undefined, withTime = false) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(iso));
}

export function relative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (diff < 60) return 'just now';
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  return rtf.format(-Math.round(diff / 86400), 'day');
}

export const STATUS_LABEL: Record<BatchStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Ready to pay',
  EXECUTING: 'Settling',
  COMPLETED: 'Paid',
  FAILED: 'Payment failed',
  CANCELLED: 'Cancelled',
};

export type Tone = 'neutral' | 'pending' | 'settle' | 'fail' | 'muted';

export const STATUS_TONE: Record<BatchStatus, Tone> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'pending',
  APPROVED: 'pending',
  EXECUTING: 'pending',
  COMPLETED: 'settle',
  FAILED: 'fail',
  CANCELLED: 'muted',
};

const EXPLORERS: Record<string, string | undefined> = {
  sepolia: process.env.NEXT_PUBLIC_EXPLORER_SEPOLIA ?? 'https://sepolia.voyager.online',
  mainnet: process.env.NEXT_PUBLIC_EXPLORER_MAINNET ?? 'https://voyager.online',
};

export function explorerUrl(chain: string, network: string, kind: 'tx' | 'contract', value: string): string | null {
  if (chain !== 'starknet') return null;
  const base = EXPLORERS[network];
  return base ? `${base}/${kind}/${value}` : null;
}

export function networkLabel(chain: string, network: string) {
  if (chain === 'simulated') return 'Simulated ledger';
  return `Starknet ${network.charAt(0).toUpperCase()}${network.slice(1)}`;
}
