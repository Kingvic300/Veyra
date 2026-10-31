'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { BatchEditor } from '@/components/batch-editor';
import { useToast } from '@/components/providers';
import { PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { keys, useOrg } from '@/lib/hooks';

export default function NewBatchPage() {
  const org = useOrg();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  return (
    <>
      <PageHeader title="New payout" description="Choose who gets paid and how much. Nothing is paid until it is approved." />
      <BatchEditor
        orgId={org.orgId}
        asset={org.data!.asset}
        submitLabel="Send for approval"
        secondaryLabel="Save as draft"
        onSave={async (draft, intent) => {
          const batch = await api.batches.create(org.orgId, draft);
          if (intent === 'primary') {
            await api.batches.submit(org.orgId, batch.id);
            toast('settle', 'Sent for approval', 'Approvers can review it now.');
          } else {
            toast('settle', 'Draft saved', 'Send it for approval when you are ready.');
          }
          await qc.invalidateQueries({ queryKey: keys.batches(org.orgId) });
          router.push(`/o/${org.orgId}/batches/${batch.id}`);
        }}
      />
    </>
  );
}
