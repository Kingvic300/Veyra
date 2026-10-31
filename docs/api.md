# API reference

Base URL: `/v1`. All bodies are JSON. Amounts in responses are integer strings in the asset's base units; amounts in batch requests are decimal strings (for example `"1250.50"`).

## Authentication

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | `{ email, name, password }` (password at least 12 characters). Sets the session cookie, returns `{ user, token }`. |
| POST | `/auth/login` | `{ email, password }`. Rate limited. |
| POST | `/auth/logout` | Clears the cookie. |
| GET | `/auth/me` | Current user. |

Send either `Authorization: Bearer <token>` or the `veyra_session` cookie. Cookie-authenticated `POST`, `PATCH` and `DELETE` requests must include the header `x-veyra-csrf: 1`.

Errors use one shape: `{ "error": { "code": "ALREADY_APPROVED", "message": "...", "details": ... } }`.

## Organisations and members

| Method | Path | Permission |
|---|---|---|
| GET | `/networks` | any user: chains, networks and execution modes this server supports |
| GET | `/organisations` | own memberships |
| POST | `/organisations` | any user (becomes OWNER) |
| GET | `/organisations/:orgId` | `org:read` |
| PATCH | `/organisations/:orgId` | `org:manage`: name, treasury, approval policy |
| GET | `/organisations/:orgId/capabilities` | `org:read`: chain capabilities and privacy model |
| GET | `/organisations/:orgId/treasury` | `treasury:read`: balance, committed, available |
| GET | `/organisations/:orgId/stats` | `batches:read`: totals, monthly spend; per-contractor and per-country only with `contractors:read` |
| GET/POST | `/organisations/:orgId/members` | read: `org:read`; add: `members:manage` |
| PATCH/DELETE | `/organisations/:orgId/members/:memberId` | `members:manage`; members may update their own wallet |

## Contractors

| Method | Path | Permission |
|---|---|---|
| GET | `/organisations/:orgId/contractors?archived=true` | `contractors:read` |
| POST | `/organisations/:orgId/contractors` | `contractors:write` |
| GET/PATCH | `/organisations/:orgId/contractors/:id` | read / write |
| DELETE | `/organisations/:orgId/contractors/:id` | archives (never deletes) |

## Payroll batches

| Method | Path | Notes |
|---|---|---|
| GET | `/organisations/:orgId/batches?status=` | list |
| POST | `/organisations/:orgId/batches` | `{ title, items: [{ contractorId, amount }] }` creates a DRAFT |
| GET | `.../batches/:id` | detail; items and payments hidden from VIEWER |
| PATCH | `.../batches/:id` | DRAFT only |
| POST | `.../batches/:id/validate` | dry-run: issues, treasury, capabilities |
| POST | `.../batches/:id/submit` | freeze, commit, move to PENDING_APPROVAL |
| GET | `.../batches/:id/chain-actions/:kind` | unsigned transaction for `propose`, `approve`, `execute` or `cancel` |
| POST | `.../batches/:id/proposal` | `{ txHash }` vault mode registration |
| POST | `.../batches/:id/approvals` | `{ txHash? }`: required when approvals are on-chain |
| POST | `.../batches/:id/execute` | `{ txHash? }`: required unless the chain is simulated |
| POST | `.../batches/:id/cancel` | `{ reason? }`; returns an on-chain cancel transaction if the vault knows the batch |
| POST | `.../batches/:id/reconcile` | re-check pending transactions |
| GET | `.../batches/:id/receipt` | JSON receipt (`contractors:read`) |
| GET | `.../batches/:id/receipt.csv` | CSV receipt |

## Audit

| Method | Path | Notes |
|---|---|---|
| GET | `/organisations/:orgId/audit?limit=&before=&entityId=` | newest first |
| GET | `/organisations/:orgId/audit/verify` | recomputes the hash chain |

## Health

`GET /health` returns `{ status: "ok" }` when the database is reachable.
