import { z } from 'zod';
import { EXECUTION_MODES } from './batch';
import { ROLES } from './roles';

/**
 * Request schemas shared by the API (server-side validation) and the dashboard
 * (form validation). Chain-specific address checks happen in the chain adapter.
 */

const decimalAmount = z
  .string()
  .trim()
  .regex(/^(0|[1-9]\d*)(\.\d+)?$/, 'Use a plain decimal amount such as 1250.50');

const baseUnits = z.string().regex(/^(0|[1-9]\d*)$/, 'Must be an integer amount in base units');

const address = z.string().trim().min(1).max(128);

export const registerSchema = z.object({
  email: z.email().max(254).transform((v) => v.toLowerCase()),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(8, 'Use at least 8 characters').max(256),
  /** Secret from an invitation email; joins the inviting organisation on sign-up. */
  inviteToken: z
    .string()
    .regex(/^[A-Za-z0-9_-]{32,128}$/, 'Invalid invitation link')
    .optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(256),
});
export type LoginInput = z.infer<typeof loginSchema>;

const newPassword = z.string().min(8, 'Use at least 8 characters').max(256);

export const forgotPasswordSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/, 'Invalid reset link'),
  password: newPassword,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const approvalPolicySchema = z.object({
  threshold: z.number().int().min(1).max(20),
  allowCreatorApproval: z.boolean(),
  maxBatchTotal: baseUnits.nullable(),
});

export const assetSchema = z.object({
  address,
  symbol: z.string().trim().min(1).max(16),
  decimals: z.number().int().min(0).max(36),
});

export const createOrganisationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  chain: z.enum(['starknet', 'simulated']),
  network: z.string().trim().min(1).max(32),
  executionMode: z.enum(EXECUTION_MODES),
  treasuryAddress: address.nullable().optional(),
  asset: assetSchema,
  approvalPolicy: approvalPolicySchema,
});
export type CreateOrganisationInput = z.infer<typeof createOrganisationSchema>;

export const updateOrganisationSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    treasuryAddress: address.nullable(),
    approvalPolicy: approvalPolicySchema,
  })
  .partial();
export type UpdateOrganisationInput = z.infer<typeof updateOrganisationSchema>;

export const addMemberSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  role: z.enum(ROLES),
  walletAddress: address.nullable().optional(),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/, 'Invalid invitation link'),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(120),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateMemberSchema = z
  .object({
    role: z.enum(ROLES),
    walletAddress: address.nullable(),
  })
  .partial();
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const createContractorSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.email().max(254).nullable().optional(),
  country: z.string().trim().length(2, 'Use an ISO 3166-1 alpha-2 code').toUpperCase().nullable().optional(),
  payoutAddress: address,
});
export type CreateContractorInput = z.infer<typeof createContractorSchema>;

export const updateContractorSchema = createContractorSchema.partial().extend({ active: z.boolean().optional() });
export type UpdateContractorInput = z.infer<typeof updateContractorSchema>;

export const batchItemSchema = z.object({
  contractorId: z.uuid(),
  amount: decimalAmount,
});

export const createBatchSchema = z.object({
  title: z.string().trim().min(1).max(160),
  items: z.array(batchItemSchema).max(500),
});
export type CreateBatchInput = z.infer<typeof createBatchSchema>;

export const updateBatchSchema = createBatchSchema.partial();
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;

const txHash = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{1,64}$/, 'Expected a 0x-prefixed transaction hash');

/** Report a wallet-signed transaction back to the API. */
export const chainTxSchema = z.object({ txHash });
export type ChainTxInput = z.infer<typeof chainTxSchema>;

/** Approval: on-chain modes require the wallet transaction hash. */
export const approveBatchSchema = z.object({ txHash: txHash.optional() });
export type ApproveBatchInput = z.infer<typeof approveBatchSchema>;

export const executeBatchSchema = z.object({ txHash: txHash.optional() });
export type ExecuteBatchInput = z.infer<typeof executeBatchSchema>;

export const cancelBatchSchema = z.object({ reason: z.string().trim().max(500).optional() });
export type CancelBatchInput = z.infer<typeof cancelBatchSchema>;
