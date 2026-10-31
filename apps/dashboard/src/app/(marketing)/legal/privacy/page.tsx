import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/marketing/legal-page';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <LegalPage
      current="/legal/privacy"
      title="Privacy policy"
      summary="What personal data the hosted Veyra service collects, why, who it is shared with, and the choices you have. Payroll data is encrypted before it is stored, and blockchain transactions are public by nature."
    >
      <h2>1. Who we are</h2>
      <p>
        The hosted Veyra service is operated by <strong>{site.legalEntity}</strong>, {site.registeredAddress} (&quot;Veyra&quot;, &quot;we&quot;,
        &quot;us&quot;). For account data we are the data controller. For the payroll data your organisation enters (contractor names, emails, payout
        wallets and amounts) your organisation is the controller and we process it on your behalf as a processor.
      </p>
      <p>
        If you run the open-source software on your own servers, the person or company operating that installation is responsible for it, and this
        policy does not apply to their deployment.
      </p>
      <p>
        Contact for privacy matters: <a href={`mailto:${site.emails.privacy}`}>{site.emails.privacy}</a>.
      </p>

      <h2>2. What we collect</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Examples</th>
            <th>How it is stored</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Account</td>
            <td>Name, work email, password</td>
            <td>Passwords are stored only as a salted scrypt hash. We never see the password itself.</td>
          </tr>
          <tr>
            <td>Organisation</td>
            <td>Name, network, treasury address, approval rules, members and their roles</td>
            <td>Stored in our database.</td>
          </tr>
          <tr>
            <td>Contractor records</td>
            <td>Name, email, country, payout wallet</td>
            <td>Name, email and wallet are encrypted with AES-256-GCM using a key unique to your organisation.</td>
          </tr>
          <tr>
            <td>Payroll</td>
            <td>Batch names, per-person amounts, approvals, transaction hashes</td>
            <td>Per-person amounts and recipients are encrypted. Batch totals and statuses are stored in plain form so the service can work.</td>
          </tr>
          <tr>
            <td>Wallet addresses</td>
            <td>The approver wallet you link, the wallet you connect in the browser</td>
            <td>Linked wallets are stored. A connected browser wallet is not stored on our servers.</td>
          </tr>
          <tr>
            <td>Audit log</td>
            <td>Who did what and when, hashes of each event</td>
            <td>Stored as a hash-chained log. It records IDs and totals, never contractor names.</td>
          </tr>
          <tr>
            <td>Technical</td>
            <td>IP address, browser type, request times, error logs</td>
            <td>Kept in server logs for security and debugging.</td>
          </tr>
        </tbody>
      </table>
      <p>We do not collect government ID, bank details or card numbers, and Veyra never asks for wallet private keys or seed phrases.</p>

      <h2>3. Blockchain data is public</h2>
      <p>
        When you settle payroll on a public blockchain, the transaction is recorded by that network, not by us, and anyone can read it. In the
        transparent payroll vault mode this includes recipient wallets, amounts, totals, approver wallets and timing. In the experimental STRK20 mode
        transfers inside the privacy pool are hidden, but deposits, withdrawals and timing remain public. We cannot delete or change on-chain records.
        Each batch in Veyra shows exactly what is public for its mode.
      </p>

      <h2>4. Why we use it</h2>
      <ul>
        <li>
          <strong>To provide the service</strong> you or your organisation signed up for: accounts, payroll batches, approvals, receipts. Legal basis:
          performance of a contract.
        </li>
        <li>
          <strong>To keep it secure</strong>: preventing abuse, rate limiting sign-in attempts, investigating incidents. Legal basis: legitimate
          interests.
        </li>
        <li>
          <strong>To meet legal obligations</strong>, such as responding to lawful requests from authorities. Legal basis: legal obligation.
        </li>
        <li>
          <strong>To improve Veyra</strong> with anonymous usage measurement, only if you agree in the cookie settings. Legal basis: consent, which
          you can withdraw at any time.
        </li>
      </ul>
      <p>We do not sell personal data, use it for advertising, or make automated decisions that have legal effects on you.</p>

      <h2>5. Who we share it with</h2>
      <ul>
        <li>Infrastructure providers that host our servers, databases and backups, under data processing agreements.</li>
        <li>
          Blockchain RPC providers, which receive the transactions and contract reads needed to check settlement. They see wallet addresses and
          transaction hashes, not names.
        </li>
        <li>Other members of your organisation, according to their role. Viewers cannot see contractor records.</li>
        <li>Authorities, when the law requires it.</li>
      </ul>

      <h2>6. International transfers</h2>
      <p>
        Our providers may process data outside your country. Where that happens we use safeguards recognised by the Nigeria Data Protection Act 2023
        and, where it applies, the EU and UK GDPR, such as standard contractual clauses.
      </p>

      <h2>7. How long we keep it</h2>
      <ul>
        <li>Account data: while your account exists, then deleted within 30 days of closing it.</li>
        <li>
          Payroll and audit records: for as long as your organisation keeps its account and as required by tax and accounting law, which is often six
          years or more. Your organisation decides this.
        </li>
        <li>Server logs: up to 90 days.</li>
      </ul>

      <h2>8. Security</h2>
      <p>
        We encrypt sensitive payroll fields at rest with a per-organisation key, use TLS in transit, enforce role-based access on the server, and keep
        a tamper-evident audit log. Read more on the <Link href="/security">security page</Link>. No system is perfectly secure; if we learn of a
        breach that affects you, we will tell you and the relevant regulator as the law requires.
      </p>

      <h2>9. Your rights</h2>
      <p>
        Depending on where you live, you can ask to access, correct, delete or export your personal data, object to or restrict some processing, and
        withdraw consent. If your data was entered by an organisation (for example you are a contractor), contact that organisation first; we will
        help them respond. Email <a href={`mailto:${site.emails.privacy}`}>{site.emails.privacy}</a>. You can also complain to your data protection
        authority, in Nigeria the Nigeria Data Protection Commission.
      </p>

      <h2>10. Children</h2>
      <p>Veyra is a business tool and is not meant for anyone under 18.</p>

      <h2>11. Changes</h2>
      <p>If we change this policy in a way that matters, we will tell account owners by email or in the app before the change takes effect.</p>
    </LegalPage>
  );
}
