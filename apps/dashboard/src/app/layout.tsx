import type { Metadata } from 'next';
import { IBM_Plex_Mono, Schibsted_Grotesk } from 'next/font/google';
import { CookieConsent } from '@/components/cookie-consent';
import { Providers } from '@/components/providers';
import './globals.css';

const schibsted = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-schibsted', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Veyra', template: '%s | Veyra' },
  description: 'Private payroll and programmable treasury for teams that pay in stablecoins.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${schibsted.variable} ${plexMono.variable}`}>
      <body>
        <Providers>
          {children}
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}
