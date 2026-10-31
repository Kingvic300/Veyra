import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/marketing/legal-page';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'Terms of service' };

export default function TermsPage() {
  return (
    <LegalPage
      current="/legal/terms"
      title="Terms of service"
      summary="The agreement between you and Veyra for the hosted service. In short: Veyra is non-custodial software, you stay in control of your funds and your compliance obligations, and blockchain transactions cannot be reversed."
    >
      <h2>1. The agreement</h2>
      <p>
        These terms are between you (and the organisation you act for) and {site.legalEntity}. By creating an account you confirm you can bind that
        organisation to them. If you do not agree, do not use the hosted service. The open-source code is licensed separately under the Apache License
        2.0, and these terms do not limit your rights under that licence.
      </p>

      <h2>2. What Veyra is</h2>
      <p>
        Veyra is software for preparing payroll batches, collecting approvals, building blockchain transactions for your wallets to sign, and
        verifying and recording the results. <strong>Veyra is non-custodial.</strong> We never hold your funds or your private keys. Payments move
        from your treasury contract or account when your authorised wallets sign them.
      </p>
      <p>
        Veyra is not a bank, money transmitter, payment institution, exchange, broker or tax adviser, and nothing in the service is financial, legal
        or tax advice.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>Keep your password and wallets secure. You are responsible for activity under your account and for transactions your wallets sign.</li>
        <li>Give accurate information and keep member roles current. Remove people who should no longer approve or pay.</li>
        <li>You must be at least 18 and allowed to use the service under the laws that apply to you.</li>
      </ul>

      <h2>4. Your responsibilities</h2>
      <ul>
        <li>
          <strong>Compliance.</strong> You are responsible for employment, contractor, tax, sanctions, anti-money-laundering and reporting obligations
          for the payments you make, including checking who you pay.
        </li>
        <li>
          <strong>Correct details.</strong> Check payout wallets and amounts before approving. Payments sent to a wrong address cannot be recovered by
          Veyra.
        </li>
        <li>
          <strong>Lawful use.</strong> Follow the <Link href="/legal/acceptable-use">acceptable use policy</Link>.
        </li>
        <li>
          <strong>Contractor data.</strong> You must have a lawful basis to enter contractor data and must tell your contractors how it is used.
        </li>
      </ul>

      <h2>5. Blockchain transactions</h2>
      <p>
        Transactions are processed by independent networks we do not control. They may be delayed, fail, cost network fees or, once final, be
        impossible to reverse. Experimental features such as STRK20 private transfers may not work as expected. Read the{' '}
        <Link href="/legal/risk">risk disclosure</Link>.
      </p>

      <h2>6. Fees</h2>
      <p>
        Hosted plans are billed as shown on the <Link href="/pricing">pricing page</Link> or in your order. Network fees are paid by your wallets and
        are not collected by us. We will give at least 30 days&apos; notice of price changes.
      </p>

      <h2>7. Your data</h2>
      <p>
        Your organisation owns the data it puts into Veyra. You give us permission to store and process it only to run the service, as described in
        the <Link href="/legal/privacy">privacy policy</Link>. You can export receipts and audit logs at any time.
      </p>

      <h2>8. Availability and changes</h2>
      <p>
        We aim to keep the service available but do not promise it will be uninterrupted. We may change features; if a change removes something you
        rely on, we will try to tell you in advance. Your funds never depend on Veyra being online: you can always interact with your vault contract
        directly.
      </p>

      <h2>9. Ending the agreement</h2>
      <p>
        You can close your account at any time. We may suspend or close accounts that break these terms or the law, or that put others at risk. After
        closure you can request an export of your records for 30 days.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        Except where the law does not allow it, the service is provided &quot;as is&quot; without warranties of any kind, including fitness for a
        particular purpose and non-infringement.
      </p>

      <h2>11. Limits on liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential losses, lost profits, lost funds caused by transactions your
        wallets signed, or failures of blockchain networks, wallets or third-party providers. Our total liability for any claim is limited to the fees
        you paid us in the 12 months before the claim. Nothing here limits liability that cannot be limited by law.
      </p>

      <h2>12. Indemnity</h2>
      <p>You will cover our reasonable losses from claims caused by your breach of these terms or of the law in how you use Veyra.</p>

      <h2>13. Law and disputes</h2>
      <p>
        These terms are governed by the laws of {site.governingLaw}. We will first try to resolve any dispute informally; contact{' '}
        <a href={`mailto:${site.emails.legal}`}>{site.emails.legal}</a>.
      </p>

      <h2>14. Changes to these terms</h2>
      <p>
        We will give account owners at least 30 days&apos; notice of material changes. Continuing to use the service after that means you accept them.
      </p>
    </LegalPage>
  );
}
