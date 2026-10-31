import type { Member, Organisation, Role } from '@veyra/core';
import type { OrgRow } from '../access/access.service.js';
import type { schema } from '../db/database.js';

export function toOrganisation(row: OrgRow): Organisation {
  return {
    id: row.id,
    name: row.name,
    chain: row.chain as Organisation['chain'],
    network: row.network,
    executionMode: row.executionMode as Organisation['executionMode'],
    treasuryAddress: row.treasuryAddress,
    asset: { address: row.assetAddress, symbol: row.assetSymbol, decimals: row.assetDecimals },
    approvalPolicy: {
      threshold: row.approvalThreshold,
      allowCreatorApproval: row.allowCreatorApproval,
      maxBatchTotal: row.maxBatchTotal,
    },
    createdAt: row.createdAt.toISOString(),
  };
}

export function toMember(
  row: typeof schema.members.$inferSelect,
  user: { email: string; name: string },
): Member {
  return {
    id: row.id,
    organisationId: row.organisationId,
    userId: row.userId,
    email: user.email,
    name: user.name,
    role: row.role as Role,
    walletAddress: row.walletAddress,
    createdAt: row.createdAt.toISOString(),
  };
}
