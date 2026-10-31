# Threat model

Scope: the hosted or self-hosted Veyra API and dashboard, the Starknet PayrollVault contract, and the STRK20 integration. This is a living document; open an issue or email the security contact to challenge it.

## Assets

1. Treasury funds held in the PayrollVault (or the STRK20 paying account).
2. Integrity of payroll: who is paid, how much, and who approved it.
3. Confidentiality of contractor identities and individual salaries.
4. Integrity of the historical record (receipts and audit log).
5. Availability of payroll on payday.

## Actors

| Actor | Capabilities |
|---|---|
| Organisation members | Roles OWNER, ADMIN, APPROVER, VIEWER with different permissions |
| Vault admin key | Can change approvers and threshold, transfer admin |
| External attacker | Network access to the dashboard and API |
| Malicious insider at the operator | Database and server access |
| Malicious or buggy token contract | Called by the vault during execution |
| RPC provider | Sees reads and transaction hashes; can return wrong data |

## Threats and mitigations

### Funds

| Threat | Mitigation | Residual risk |
|---|---|---|
| Compromised API server tries to pay itself | API never holds keys; vault requires on-chain approvals from approver wallets over a Poseidon hash of exact recipients and amounts | None for vault mode. STRK20 mode relies on the API for approvals (documented as experimental). |
| Approver set changed mid-flight to sneak in approvals | `config_version` bump invalidates every pending batch | Admin can still re-propose with a new approver set: protect the admin key (use a multisig account). |
| Batch executed twice | Contract marks `Executed` before transfers; batch IDs single-use; API allows one in-flight execution | None known. |
| Re-entrant token | Checks-effects-interactions ordering in `execute_batch` | Covered by tests; awaiting audit. |
| Partial payment | All transfers in one transaction; any failure reverts all | None. |
| Insufficient funds discovered late | Balance check in contract; API validation warns on submit using balance minus committed batches | Funds can still move out between approval and execution. |
| Admin key compromise | Admin cannot spend directly, but can add approvers and lower threshold | **High impact.** Use a multisig account as admin. A timelock on config changes is planned. |

### Integrity of records

| Threat | Mitigation |
|---|---|
| Edit or delete audit events in the database | Hash chain with per-organisation sequence; verification endpoint detects any change |
| Report a fake transaction hash as payment | API verifies from chain: vault events and independent token Transfer events must match the frozen plan |
| Reuse another member's approval transaction | Approval verified against the approver's linked wallet and current `has_approved` state |
| Malicious RPC returns false receipts | Single-RPC trust today. Planned: optional multi-RPC quorum. |

### Confidentiality

| Threat | Mitigation | Residual risk |
|---|---|---|
| Database dump | Sensitive fields AES-256-GCM encrypted with per-org keys wrapped by a master key held outside the DB | Attacker with both DB and server environment can decrypt. Move the master key to a KMS in production. |
| Ciphertext swapped between rows or organisations | AAD binds ciphertext to organisation and field purpose | None. |
| Over-privileged members | Role-based permissions on the server; viewers cannot read contractor data | Admins and approvers see salaries by design. |
| On-chain observers (vault mode) | Stated plainly in the UI: amounts and recipients are public | Inherent to transparent transfers. |
| On-chain observers (STRK20) | Transfers hidden inside the pool | Deposits, withdrawals, timing and pool usage are public; amount correlation possible. |

### Web application

| Threat | Mitigation |
|---|---|
| Credential stuffing | scrypt hashing, uniform timing for unknown emails, rate limits on auth routes |
| Session theft via XSS | Session cookie is HttpOnly and SameSite=Lax; no tokens in JS storage |
| CSRF | Cookie-authenticated writes require the `x-veyra-csrf` header (not settable cross-site without CORS approval) |
| Organisation enumeration | Non-members get 404, not 403 |
| CSV formula injection in receipts | Cells beginning with `= + - @` are prefixed |
| Clickjacking | `X-Frame-Options: DENY` on the dashboard; helmet on the API |

## Out of scope today

- Compromised user devices or wallets.
- Regulatory compliance of individual organisations (their responsibility; see the terms).
- Denial of service against public RPC providers.

## Planned work

1. Independent audit of `PayrollVault`.
2. Timelock and multisig requirement for vault configuration changes.
3. Master key in a cloud KMS with rotation.
4. Multi-RPC verification quorum.
5. Bug bounty.
