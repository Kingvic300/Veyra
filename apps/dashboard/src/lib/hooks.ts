'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { can, type Permission } from '@veyra/core';
import { api } from './api';

export const keys = {
  me: ['me'] as const,
  orgs: ['orgs'] as const,
  networks: ['networks'] as const,
  org: (id: string) => ['org', id] as const,
  caps: (id: string) => ['org', id, 'caps'] as const,
  treasury: (id: string) => ['org', id, 'treasury'] as const,
  members: (id: string) => ['org', id, 'members'] as const,
  contractors: (id: string) => ['org', id, 'contractors'] as const,
  batches: (id: string) => ['org', id, 'batches'] as const,
  batch: (id: string, batchId: string) => ['org', id, 'batch', batchId] as const,
  audit: (id: string) => ['org', id, 'audit'] as const,
};

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => api.auth.me(), retry: false });
}

export function useOrgId(): string {
  const params = useParams<{ orgId: string }>();
  return params.orgId;
}

export function useOrg() {
  const orgId = useOrgId();
  const query = useQuery({ queryKey: keys.org(orgId), queryFn: () => api.organisations.get(orgId) });
  const role = query.data?.role;
  return { ...query, orgId, can: (p: Permission) => (role ? can(role, p) : false) };
}

export function useCapabilities() {
  const orgId = useOrgId();
  return useQuery({ queryKey: keys.caps(orgId), queryFn: () => api.organisations.capabilities(orgId), staleTime: 5 * 60_000 });
}

export function useTreasury() {
  const orgId = useOrgId();
  return useQuery({ queryKey: keys.treasury(orgId), queryFn: () => api.organisations.treasury(orgId), refetchInterval: 30_000 });
}
