import type { Metadata } from 'next';
import { InvitePage } from '@/components/invite-page';

export const metadata: Metadata = { title: 'Invitation', robots: { index: false }, referrer: 'no-referrer' };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InvitePage token={token} />;
}
