import { OFFCHAIN_ONLY_DISCLOSURES, type PrivacyCapabilities } from '@veyra/core';

/**
 * STRK20 privacy pool addresses as published in the STRK20 documentation
 * (https://strk20.starknet.io/docs/contract-addresses, verified 2026-09-29).
 * Re-check before each release. Veyra does not call the pool directly; the
 * payer's privacy-enabled wallet does.
 */
export const STRK20_POOL_ADDRESSES: Record<string, string> = {
  mainnet: '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
  sepolia: '0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91',
};

export const VAULT_PRIVACY: PrivacyCapabilities = {
  label: 'Transparent on-chain',
  shieldedTransfers: false,
  maturity: 'production',
  visibility: {
    recipientAddresses: 'public',
    amounts: 'public',
    contractorIdentity: 'encrypted-offchain',
    batchTotal: 'public',
    timing: 'public',
    approvals: 'public',
  },
  disclosures: [
    'Recipient addresses, individual amounts, batch totals and timing are public on Starknet.',
    'Approver wallet addresses and approval transactions are public.',
    'The batch commitment and items hash are public; they do not reveal names.',
    ...OFFCHAIN_ONLY_DISCLOSURES,
  ],
};

export const WALLET_PRIVACY: PrivacyCapabilities = {
  label: 'Transparent on-chain, paid from your wallet',
  shieldedTransfers: false,
  maturity: 'production',
  visibility: {
    recipientAddresses: 'public',
    amounts: 'public',
    contractorIdentity: 'encrypted-offchain',
    batchTotal: 'public',
    timing: 'public',
    approvals: 'encrypted-offchain',
  },
  disclosures: [
    'Recipient addresses, individual amounts, batch totals and timing are public on Starknet.',
    'Payments come straight from your account, so anyone can see that your account paid them.',
    'Approvals are enforced by the Veyra API, not by a contract, in this mode. Whoever holds the paying wallet can still send funds outside Veyra.',
    ...OFFCHAIN_ONLY_DISCLOSURES,
  ],
};

export const STRK20_PRIVACY: PrivacyCapabilities = {
  label: 'Private transfers via STRK20 (experimental)',
  shieldedTransfers: true,
  maturity: 'experimental',
  visibility: {
    recipientAddresses: 'hidden',
    amounts: 'hidden',
    contractorIdentity: 'encrypted-offchain',
    batchTotal: 'hidden',
    timing: 'public',
    approvals: 'encrypted-offchain',
  },
  disclosures: [
    'Transfers inside the STRK20 pool hide sender, recipient, amount and token from outside observers.',
    'Deposits into the pool (treasury funding) and withdrawals out of it are public, including amounts.',
    'That the payer account interacts with the pool, and when, is public.',
    'Recipients must have registered with the pool (set a viewing key) before they can be paid.',
    'Approvals are enforced by the Veyra API, not by a contract, in this mode.',
    'Veyra cannot independently verify shielded amounts; it verifies that the payer transaction succeeded.',
    ...OFFCHAIN_ONLY_DISCLOSURES,
  ],
};
