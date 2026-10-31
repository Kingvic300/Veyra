import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/legal-page';

export const metadata: Metadata = { title: 'Risk disclosure' };

export default function RiskPage() {
  return (
    <LegalPage
      current="/legal/risk"
      title="Risk disclosure"
      summary="Paying people with digital assets carries risks that bank payroll does not. Please read these before you move real funds."
    >
      <h2>Transactions are final</h2>
      <p>
        Once a blockchain transaction is final it cannot be reversed by Veyra or anyone else. A payment sent to a wrong wallet is almost always lost.
        Check payout addresses with your contractors before approving.
      </p>

      <h2>Smart contract risk</h2>
      <p>
        The PayrollVault contract is open source and tested, but it has not yet completed an independent security audit. Contracts can contain bugs
        that lead to loss of funds. Keep only what you need for upcoming payroll in the vault, and use a multisig account as the vault admin.
      </p>

      <h2>Experimental privacy</h2>
      <p>
        STRK20 private transfers are a preview feature that depends on third-party wallets and the Starknet privacy pool. They may fail, change or be
        withdrawn. Deposits into and withdrawals from the pool are public, and the privacy they offer depends on how you and your contractors use them.
      </p>

      <h2>Stablecoins and tokens</h2>
      <p>
        Stablecoins are issued by private companies and can lose their peg, be frozen by the issuer or become unavailable on a network. Other tokens,
        such as STRK, change in value. Veyra does not guarantee the value of any asset.
      </p>

      <h2>Network risk</h2>
      <p>
        Networks can be congested, change fees, halt or reorganise recent blocks. Veyra waits for the finality rule shown in your settings before
        marking a payment as paid.
      </p>

      <h2>Wallet and key risk</h2>
      <p>
        Whoever controls an approver or admin key can act for your organisation on-chain. Lost keys cannot be recovered by Veyra. Use hardware or
        multisig wallets for roles that release money.
      </p>

      <h2>Legal and tax treatment</h2>
      <p>
        The law on paying people in digital assets differs between countries and is changing, including in Nigeria. You may have tax, reporting,
        foreign exchange or licensing obligations. Get advice for each country where you or your contractors are based.
      </p>
    </LegalPage>
  );
}
