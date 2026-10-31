import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/password-forms';

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false },
  // Keep the reset token out of the Referer header sent to other sites.
  referrer: 'no-referrer',
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={typeof token === 'string' && token.length > 0 ? token : null} />;
}
