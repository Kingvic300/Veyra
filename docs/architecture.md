# Architecture

Veyra has a stable shared core and replaceable chain adapters. Nothing chain-specific lives in the payroll domain model.

```
            ┌──────────────────────────── apps/dashboard (Next.js) ────────────────────────────┐
            │  marketing + legal pages   payroll UI   wallet (Wallet Standard / injected)       │
            └───────────────┬──────────────────────────────────────────────┬───────────────────┘
                            │ @veyra/sdk (cookie session + CSRF header)    │ wallet signs calls
            ┌───────────────▼────────────── apps/api (NestJS) ─────────────▼───────────────────┐
            │ auth · access · organisations · contractors · batches · audit · stats            │
            │ EncryptionService (AES-256-GCM, per-org keys)   TxMonitor (BullMQ | inline)      │
            │ ChainService → AdapterRegistry                                                  │
            └───────┬─────────────────────────┬─────────────────────────┬──────────────────────┘
                    │                         │                         │
            PostgreSQL (Drizzle)       Redis (BullMQ)        ChainAdapter implementations
                                                             ├─ SimulatedAdapter (in memory)
                                                             └─ Starknet: Vault | STRK20
                                                                   │
                                                          PayrollVault.cairo / STRK20 pool
```

## Packages

| Package | Responsibility |
|---|---|
| `@veyra/core` | Money in base units, roles and permissions, batch/payment state machines, approval evaluation, batch validation, commitments, hash-chained audit primitives, zod request schemas. Isomorphic (Node and browser). |
| `@veyra/chain-adapter` | `ChainAdapter` interface, `ChainCapabilities` (including the privacy model), `AdapterRegistry`, `SimulatedAdapter`. |
| `@veyra/starknet-adapter` | `StarknetVaultAdapter` and `StarknetStrk20Adapter`: calldata encoding, Poseidon items hash (identical to Cairo), receipt event parsing, payment verification. |
| `@veyra/sdk` | Typed REST client. Bearer tokens for scripts; cookies plus `x-veyra-csrf` in browsers. |
| `@veyra/api` | NestJS 12 (ESM). Drizzle ORM on PostgreSQL. BullMQ for transaction monitoring. |
| `@veyra/dashboard` | Next.js 16 app router, Tailwind 4, TanStack Query. |

## Chain adapter contract

Each adapter declares what it can do rather than simulating missing features:

- `getCapabilities()`: execution mode, whether approvals are enforced on-chain, whether a proposal is required, signing model, batch size limit, finality rule, whether amounts are independently verifiable, and the privacy model shown to users.
- `isValidAddress`, `normaliseAddress`, `getBalance`.
- `computeItemsHash`, `buildProposal`, `buildApproval`, `createPayment`, `buildCancellation`: unsigned transactions for the user's wallet.
- `submitTransaction`: only for server-signed (simulated) chains.
- `getTransaction`, `verifyProposal`, `verifyApproval`, `verifyPayment`.

Adding a network means implementing this interface and registering a factory in `ChainService`.

## Batch lifecycle

```
DRAFT ──submit──▶ PENDING_APPROVAL ──threshold met──▶ APPROVED ──execute──▶ EXECUTING ──▶ COMPLETED
  │                    │                                 │                     │
  └──cancel──▶ CANCELLED ◀──────────────────────────────┘                     └──▶ FAILED ──retry──▶ EXECUTING
```

- Transitions are enforced in one place (`assertBatchTransition`).
- Batch rows are locked `FOR UPDATE` for every state change.
- A partial unique index allows only one in-flight execution per batch; another prevents reusing a transaction hash.
- Vault execution is atomic, so a failed attempt moved no funds and can be retried. The contract refuses to execute a batch twice.

## Transaction monitoring

Wallet transactions are reported back to the API by hash. The `TxMonitor` polls the chain until the transaction is final under the adapter's finality rule, then the `ReconcilerService` verifies it and applies the result. Handlers are idempotent. On startup all pending proposals, approvals and executions are re-enqueued. With `REDIS_URL` set, BullMQ provides durable, deduplicated jobs; without it an in-process monitor is used.

## Data protection

- Contractor name, email, payout address, item recipient and item amount are encrypted with AES-256-GCM.
- Each organisation has a random data key, wrapped by `VEYRA_MASTER_KEY`. The AAD binds ciphertext to `<orgId>:<purpose>`.
- The audit log stores IDs and totals only, never decrypted payroll details.
- Viewers see batch totals but not items, contractors, receipts or per-country breakdowns.

## Audit log

Each event stores `prevHash` and `hash = sha256(canonicalJson(event))`. Appends are serialised per organisation with a transaction-scoped advisory lock. `GET /organisations/:id/audit/verify` recomputes the whole chain.
