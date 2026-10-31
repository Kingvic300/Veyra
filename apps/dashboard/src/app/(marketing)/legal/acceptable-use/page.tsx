import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/legal-page';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'Acceptable use policy' };

export default function AcceptableUsePage() {
  return (
    <LegalPage
      current="/legal/acceptable-use"
      title="Acceptable use policy"
      summary="Veyra is for paying real people for real work. These are the things you may not use the hosted service for."
    >
      <h2>Do not use Veyra to</h2>
      <ul>
        <li>Pay or receive funds connected to fraud, theft, extortion, scams or any other crime.</li>
        <li>Pay people or entities on sanctions lists, or evade sanctions, export controls or anti-money-laundering rules.</li>
        <li>Hide the true source, purpose or recipient of funds from authorities who are entitled to know them.</li>
        <li>Pay for illegal goods or services, or for content that exploits children.</li>
        <li>Collect or store personal data about contractors without a lawful basis or without telling them.</li>
        <li>Break, probe or overload the service, other users&apos; data or the blockchain networks it connects to, except through our responsible disclosure process.</li>
        <li>Pretend to be another person or organisation, or misrepresent your authority to approve payments.</li>
        <li>Resell access to the hosted service without a written agreement with us.</li>
      </ul>

      <h2>Privacy features</h2>
      <p>
        Private transfers exist to keep salaries confidential between an employer and the people they pay, the same confidentiality a bank payroll
        gives. They must not be used to conceal criminal activity. We may disable private execution for organisations that misuse it.
      </p>

      <h2>What happens if this policy is broken</h2>
      <p>
        We may warn you, suspend features, suspend or close the account, and report to authorities where the law requires. Because Veyra is
        non-custodial we cannot freeze funds held in your vault or wallets.
      </p>

      <h2>Reporting misuse</h2>
      <p>
        Report suspected misuse to <a href={`mailto:${site.emails.legal}`}>{site.emails.legal}</a>. Report security issues to{' '}
        <a href={`mailto:${site.emails.security}`}>{site.emails.security}</a>.
      </p>
    </LegalPage>
  );
}
