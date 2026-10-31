'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { keys, useMe } from '@/lib/hooks';

/** Route signed-in people to their organisation, everyone else to sign in. */
export default function Home() {
  const router = useRouter();
  const me = useMe();
  const orgs = useQuery({ queryKey: keys.orgs, queryFn: () => api.organisations.list(), enabled: !!me.data });

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (orgs.data) router.replace(orgs.data[0] ? `/o/${orgs.data[0].id}` : '/onboarding');
  }, [me.isError, orgs.data, router]);

  return (
    <main className="flex min-h-dvh items-center justify-center">
      <Spinner label="Opening Veyra" />
    </main>
  );
}
