'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { BatchEditor } from '@/components/batch-editor';
import { PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { keys, useOrg } from '@/lib/hooks';

export default function NewBatchPage() {
  const org = useOrg();
  const router = useRouter();
  const qc = useQueryClient();
  return (
    <>
      <PageHeader title="New payroll batch" description="Save it as a draft. You can review and edit everything before sending it for approval." />
      <BatchEditor
        orgId={org.orgId}
        asset={org.data!.asset}
        submitLabel="Save draft"
        onSave={async (draft) => {
          const batch = await api.batches.create(org.orgId, draft);
          await qc.invalidateQueries({ queryKey: keys.batches(org.orgId) });
          router.push(`/o/${org.orgId}/batches/${batch.id}`);
        }}
      />
    </>
  );
}
