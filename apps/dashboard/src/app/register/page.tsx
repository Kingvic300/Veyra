import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth-form';

export const metadata: Metadata = { title: 'Create account' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ invite?: string | string[] }> }) {
  const { invite } = await searchParams;
  return <AuthForm mode="register" inviteToken={typeof invite === 'string' ? invite : null} />;
}
