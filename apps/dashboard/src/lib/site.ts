/**
 * Public site settings. Every value here is shown to visitors; replace the
 * placeholders before launch (the `.example` addresses are reserved and never
 * deliver mail).
 */
export const site = {
  name: 'Veyra',
  tagline: 'Private payroll and programmable treasury for teams that pay in stablecoins.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  githubUrl: 'https://github.com/Kingvic300/Veyra',
  /** Registered company that operates the hosted service. */
  legalEntity: process.env.NEXT_PUBLIC_LEGAL_ENTITY ?? 'Veyra (operator name to be confirmed)',
  registeredAddress: process.env.NEXT_PUBLIC_LEGAL_ADDRESS ?? 'Lagos, Nigeria (full registered address to be confirmed)',
  governingLaw: process.env.NEXT_PUBLIC_GOVERNING_LAW ?? 'the Federal Republic of Nigeria',
  emails: {
    hello: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'hello@veyra.example',
    privacy: process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? 'privacy@veyra.example',
    security: process.env.NEXT_PUBLIC_SECURITY_EMAIL ?? 'security@veyra.example',
    legal: process.env.NEXT_PUBLIC_LEGAL_EMAIL ?? 'legal@veyra.example',
  },
  /** Set to true once a lawyer has reviewed the legal pages. */
  legalReviewed: process.env.NEXT_PUBLIC_LEGAL_REVIEWED === 'true',
  legalUpdated: '31 October 2026',
} as const;
