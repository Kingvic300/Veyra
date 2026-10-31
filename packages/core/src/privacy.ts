/**
 * Privacy capabilities are declared per chain and execution mode, never assumed.
 * The dashboard shows this description next to every batch so nobody believes a
 * transparent payment is private.
 */

export type Visibility = 'public' | 'hidden' | 'encrypted-offchain' | 'not-stored';

export interface PrivacyCapabilities {
  /** Short label shown in the UI, for example "Transparent on-chain". */
  label: string;
  /** Whether on-chain transfer amounts and counterparties are shielded. */
  shieldedTransfers: boolean;
  /** Feature maturity. Experimental modes are behind an explicit opt-in. */
  maturity: 'production' | 'experimental' | 'simulated';
  visibility: {
    recipientAddresses: Visibility;
    amounts: Visibility;
    contractorIdentity: Visibility;
    batchTotal: Visibility;
    timing: Visibility;
    approvals: Visibility;
  };
  /** What an outside observer can still learn. Always non-empty for honesty. */
  disclosures: string[];
}

export const OFFCHAIN_ONLY_DISCLOSURES = [
  'Contractor names, emails and per-item amounts are encrypted at rest in the Veyra database.',
  'Organisation members can see payroll data according to their role; VIEWER cannot see contractor records.',
];

export function isTransparent(caps: PrivacyCapabilities): boolean {
  return !caps.shieldedTransfers;
}
