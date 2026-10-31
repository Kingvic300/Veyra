import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

const apiOrigin = originOf(process.env.NEXT_PUBLIC_VEYRA_API_URL ?? 'http://localhost:4000/v1');
// Loaded only after cookie consent; allow its origin for the script and its beacons.
const analyticsOrigin = originOf(process.env.NEXT_PUBLIC_ANALYTICS_SRC);

/**
 * Content Security Policy. Scripts may only come from this site (plus the
 * optional analytics origin), the page talks only to the Veyra API, and it
 * cannot be framed, post forms elsewhere or load plugins. Next.js still needs
 * inline scripts for hydration, and the dev server needs eval and websockets.
 */
const csp = [
  "default-src 'self'",
  ['script-src', "'self'", "'unsafe-inline'", isDev && "'unsafe-eval'", analyticsOrigin].filter(Boolean).join(' '),
  "style-src 'self' 'unsafe-inline'",
  // Wallet extensions supply their icons as data: URIs or https URLs.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  ['connect-src', "'self'", apiOrigin, analyticsOrigin, isDev && 'ws:'].filter(Boolean).join(' '),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  !isDev && 'upgrade-insecure-requests',
]
  .filter(Boolean)
  .join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
        ],
      },
    ];
  },
};

export default nextConfig;
