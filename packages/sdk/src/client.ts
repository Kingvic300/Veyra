import type {
  AddMemberInput,
  ApprovalEvaluation,
  AuditChainResult,
  AuditEvent,
  BatchIssue,
  Contractor,
  CreateBatchInput,
  CreateContractorInput,
  CreateOrganisationInput,
  ExecutionMode,
  Member,
  Organisation,
  OrganisationStats,
  PayrollBatch,
  Receipt,
  Role,
  Treasury,
  UpdateBatchInput,
  UpdateContractorInput,
  UpdateMemberInput,
  UpdateOrganisationInput,
  User,
  Invitation,
  InvitationPreview,
  InviteResult,
} from '@veyra/core';
import type { ChainCapabilities, TransactionKind, UnsignedTransaction } from '@veyra/chain-adapter';

export class VeyraApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'VeyraApiError';
  }
}

export interface VeyraClientOptions {
  /** API base URL including the version prefix, e.g. https://api.veyra.dev/v1 */
  baseUrl: string;
  /** Bearer token for server-side or script use. */
  token?: string;
  /**
   * Browser mode: send the httpOnly session cookie and the CSRF header instead
   * of a bearer token.
   */
  useCookies?: boolean;
  fetch?: typeof fetch;
}

export type OrganisationWithRole = Organisation & { role: Role; memberId?: string };
export type BatchDetail = PayrollBatch & { approvalSummary: ApprovalEvaluation; privacyLabel: string; shielded: boolean };
export interface ValidationReport {
  ok: boolean;
  total: string;
  issues: BatchIssue[];
  treasury: Treasury;
  capabilities: ChainCapabilities;
}
export interface NetworkOption {
  chain: Organisation['chain'];
  network: string;
  executionModes: ExecutionMode[];
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export class VeyraClient {
  private token: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: VeyraClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.token = opts.token;
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  setToken(token: string | undefined) {
    this.token = token;
  }

  async request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (this.opts.useCookies) headers['x-veyra-csrf'] = '1';
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: this.opts.useCookies ? 'include' : 'same-origin',
    });
    if (res.status === 204) return undefined as T;
    const type = res.headers.get('content-type') ?? '';
    const payload: unknown = type.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) {
      const err = (payload as { error?: { code?: string; message?: string; details?: unknown } })?.error;
      throw new VeyraApiError(res.status, err?.code ?? 'HTTP_ERROR', err?.message ?? `HTTP ${res.status}`, err?.details);
    }
    return payload as T;
  }

  // ---- Auth ----
  readonly auth = {
    /** Pass `inviteToken` from an invitation link to join that organisation on sign-up. */
    register: (input: { email: string; name: string; password: string; inviteToken?: string }) =>
      this.request<{ user: User; token: string; joinedOrganisationId?: string }>('POST', '/auth/register', input).then((r) => this.remember(r)),
    login: (input: { email: string; password: string }) =>
      this.request<{ user: User; token: string }>('POST', '/auth/login', input).then((r) => this.remember(r)),
    logout: () => this.request<void>('POST', '/auth/logout').then(() => this.setToken(undefined)),
    me: () => this.request<User>('GET', '/auth/me'),
    updateProfile: (input: { name: string }) => this.request<User>('PATCH', '/auth/me', input),
    /** Signs out on every device, this one included. */
    signOutEverywhere: () => this.request<void>('POST', '/auth/sessions/revoke').then(() => this.setToken(undefined)),
    /** Emails a reset link if the address has an account. Always resolves the same way. */
    forgotPassword: (input: { email: string }) => this.request<{ ok: true }>('POST', '/auth/password/forgot', input),
    /** Sets a new password from an emailed token. Signs out every session. */
    resetPassword: (input: { token: string; password: string }) =>
      this.request<void>('POST', '/auth/password/reset', input).then(() => this.setToken(undefined)),
    /** Changes the password while signed in. Signs out every other session. */
    changePassword: (input: { currentPassword: string; newPassword: string }) =>
      this.request<{ token: string }>('POST', '/auth/password/change', input).then((r) => {
        if (!this.opts.useCookies) this.token = r.token;
      }),
  };

  private remember<T extends { user: User; token: string }>(r: T): T {
    if (!this.opts.useCookies) this.token = r.token;
    return r;
  }

  networks = () => this.request<NetworkOption[]>('GET', '/networks');

  // ---- Organisations ----
  readonly organisations = {
    list: () => this.request<OrganisationWithRole[]>('GET', '/organisations'),
    create: (input: CreateOrganisationInput) => this.request<Organisation>('POST', '/organisations', input),
    get: (orgId: string) => this.request<OrganisationWithRole>('GET', `/organisations/${orgId}`),
    update: (orgId: string, input: UpdateOrganisationInput) => this.request<Organisation>('PATCH', `/organisations/${orgId}`, input),
    capabilities: (orgId: string) => this.request<ChainCapabilities>('GET', `/organisations/${orgId}/capabilities`),
    treasury: (orgId: string) => this.request<Treasury>('GET', `/organisations/${orgId}/treasury`),
    stats: (orgId: string) => this.request<OrganisationStats>('GET', `/organisations/${orgId}/stats`),
  };

  readonly members = {
    list: (orgId: string) => this.request<Member[]>('GET', `/organisations/${orgId}/members`),
    add: (orgId: string, input: AddMemberInput) => this.request<Member>('POST', `/organisations/${orgId}/members`, input),
    update: (orgId: string, memberId: string, input: UpdateMemberInput) =>
      this.request<Member>('PATCH', `/organisations/${orgId}/members/${memberId}`, input),
    remove: (orgId: string, memberId: string) => this.request<void>('DELETE', `/organisations/${orgId}/members/${memberId}`),
  };

  /** Create a real-money copy of a practice organisation (team, rules and people with real wallets). */
  goLive = (practiceOrgId: string, input: CreateOrganisationInput) =>
    this.request<{
      organisation: Organisation;
      copiedMembers: number;
      copiedPeople: number;
      peopleNeedingWallets: { name: string; email: string | null; country: string | null }[];
    }>('POST', `/organisations/${practiceOrgId}/go-live`, input);

  readonly invitations = {
    /** Existing accounts join now; anyone else is emailed an invitation link. */
    invite: (orgId: string, input: AddMemberInput) => this.request<InviteResult>('POST', `/organisations/${orgId}/invitations`, input),
    list: (orgId: string) => this.request<Invitation[]>('GET', `/organisations/${orgId}/invitations`),
    revoke: (orgId: string, invitationId: string) => this.request<void>('DELETE', `/organisations/${orgId}/invitations/${invitationId}`),
    preview: (token: string) => this.request<InvitationPreview>('GET', `/invitations/${encodeURIComponent(token)}`),
    accept: (token: string) => this.request<{ organisationId: string }>('POST', '/invitations/accept', { token }),
  };

  readonly contractors = {
    list: (orgId: string, opts: { archived?: boolean } = {}) =>
      this.request<Contractor[]>('GET', `/organisations/${orgId}/contractors${opts.archived ? '?archived=true' : ''}`),
    get: (orgId: string, id: string) => this.request<Contractor>('GET', `/organisations/${orgId}/contractors/${id}`),
    create: (orgId: string, input: CreateContractorInput) => this.request<Contractor>('POST', `/organisations/${orgId}/contractors`, input),
    update: (orgId: string, id: string, input: UpdateContractorInput) =>
      this.request<Contractor>('PATCH', `/organisations/${orgId}/contractors/${id}`, input),
    archive: (orgId: string, id: string) => this.request<Contractor>('DELETE', `/organisations/${orgId}/contractors/${id}`),
  };

  readonly batches = {
    list: (orgId: string, status?: string) =>
      this.request<PayrollBatch[]>('GET', `/organisations/${orgId}/batches${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    get: (orgId: string, id: string) => this.request<BatchDetail>('GET', this.batchPath(orgId, id)),
    create: (orgId: string, input: CreateBatchInput) => this.request<PayrollBatch>('POST', `/organisations/${orgId}/batches`, input),
    update: (orgId: string, id: string, input: UpdateBatchInput) => this.request<PayrollBatch>('PATCH', this.batchPath(orgId, id), input),
    validate: (orgId: string, id: string) => this.request<ValidationReport>('POST', `${this.batchPath(orgId, id)}/validate`),
    submit: (orgId: string, id: string) => this.request<BatchDetail>('POST', `${this.batchPath(orgId, id)}/submit`),
    recordProposal: (orgId: string, id: string, txHash: string) =>
      this.request<BatchDetail>('POST', `${this.batchPath(orgId, id)}/proposal`, { txHash }),
    approve: (orgId: string, id: string, txHash?: string) =>
      this.request<BatchDetail>('POST', `${this.batchPath(orgId, id)}/approvals`, txHash ? { txHash } : {}),
    execute: (orgId: string, id: string, txHash?: string) =>
      this.request<BatchDetail>('POST', `${this.batchPath(orgId, id)}/execute`, txHash ? { txHash } : {}),
    cancel: (orgId: string, id: string, reason?: string) =>
      this.request<{ batch: BatchDetail; onchainCancel: UnsignedTransaction | null }>(
        'POST',
        `${this.batchPath(orgId, id)}/cancel`,
        reason ? { reason } : {},
      ),
    reconcile: (orgId: string, id: string) => this.request<{ enqueued: number }>('POST', `${this.batchPath(orgId, id)}/reconcile`),
    chainAction: (orgId: string, id: string, kind: TransactionKind) =>
      this.request<UnsignedTransaction>('GET', `${this.batchPath(orgId, id)}/chain-actions/${kind}`),
    receipt: (orgId: string, id: string) => this.request<Receipt>('GET', `${this.batchPath(orgId, id)}/receipt`),
    receiptCsv: (orgId: string, id: string) => this.request<string>('GET', `${this.batchPath(orgId, id)}/receipt.csv`),
  };

  readonly audit = {
    list: (orgId: string, opts: { limit?: number; before?: number; entityId?: string } = {}) => {
      const q = new URLSearchParams();
      if (opts.limit) q.set('limit', String(opts.limit));
      if (opts.before) q.set('before', String(opts.before));
      if (opts.entityId) q.set('entityId', opts.entityId);
      const qs = q.toString();
      return this.request<AuditEvent[]>('GET', `/organisations/${orgId}/audit${qs ? `?${qs}` : ''}`);
    },
    verify: (orgId: string) => this.request<AuditChainResult>('GET', `/organisations/${orgId}/audit/verify`),
  };

  private batchPath(orgId: string, id: string) {
    return `/organisations/${orgId}/batches/${id}`;
  }
}
