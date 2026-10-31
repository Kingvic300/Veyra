import type { Metadata } from 'next';
import { Mail, Scale, ShieldAlert, UserCheck } from 'lucide-react';
import { MarketingPage } from '@/components/marketing/legal-page';
import { GithubMark } from '@/components/marketing/chrome';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'Contact' };

const CHANNELS = [
  { icon: Mail, title: 'Pilots and sales', body: 'Run a pilot with your team or ask about hosted plans.', email: site.emails.hello },
  { icon: ShieldAlert, title: 'Security', body: 'Report a vulnerability. We reply within two working days.', email: site.emails.security },
  { icon: UserCheck, title: 'Privacy requests', body: 'Access, correct or delete personal data.', email: site.emails.privacy },
  { icon: Scale, title: 'Legal', body: 'Terms, agreements and misuse reports.', email: site.emails.legal },
];

export default function ContactPage() {
  return (
    <MarketingPage title="Talk to the Veyra team" intro="Pick the inbox that fits. A person reads every message.">
      <section className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8">
        <ul className="grid gap-4 md:grid-cols-2">
          {CHANNELS.map(({ icon: Icon, title, body, email }) => (
            <li key={title} className="flex gap-4 rounded-panel border border-line bg-surface p-6">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-wash text-ink-soft">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="font-semibold">{title}</h2>
                <p className="mt-1 text-[15px] text-ink-soft">{body}</p>
                <a href={`mailto:${email}`} className="mt-3 inline-block font-medium text-settle hover:underline">
                  {email}
                </a>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-panel border border-line bg-[#f4f7f5] p-6">
          <p className="max-w-[56ch] text-[15px] text-ink-soft">Found a bug or want a feature? Open an issue on GitHub so others can follow it.</p>
          <a href={`${site.githubUrl}/issues`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-control border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-wash">
            <GithubMark className="size-4" /> Open an issue
          </a>
        </div>
        <p className="mt-8 text-[13px] text-ink-faint">
          {site.legalEntity}, {site.registeredAddress}
        </p>
      </section>
    </MarketingPage>
  );
}
