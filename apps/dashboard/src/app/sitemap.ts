import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

const PATHS = ['', '/pricing', '/security', '/developers', '/about', '/contact', '/legal/privacy', '/legal/terms', '/legal/cookies', '/legal/acceptable-use', '/legal/risk'];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((p) => ({ url: `${site.url}${p}`, changeFrequency: 'monthly', priority: p === '' ? 1 : 0.6 }));
}
