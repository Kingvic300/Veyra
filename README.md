# Veyra

**Open-source payroll and treasury infrastructure for Starknet.**

Veyra lets an organisation prepare a payroll batch, collect approvals from the people who sign off on money, pay every contractor in one Starknet transaction, and keep a receipt anyone can verify. Contractor names, emails, wallets and per-person amounts are encrypted at rest, and every screen states plainly what is public on-chain and what is not.

A Cairo `PayrollVault` contract enforces multi-approval on-chain, and an experimental mode pays through Starknet's **STRK20** privacy pool. The chain-specific code sits behind a small adapter interface, so the payroll core stays independent of any one network.

> Status: pre-production. The contracts are tested (28 snforge tests) but have **not** been independently audited. Use the sandbox or Starknet Sepolia.

## Try it

| What | Where |
|---|---|
| Live app | <https://veyra-scpm.vercel.app> |
| `PayrollVault` on Starknet Sepolia (demo, 1 of 1) | [`0x05a9ccf144e2d1545f776132ea006c6ba2baeedfb16d7a079258bdf9eab25728`](https://sepolia.voyager.online/contract/0x05a9ccf144e2d1545f776132ea006c6ba2baeedfb16d7a079258bdf9eab25728) |
| `PayrollVault` class hash | [`0x02379628b212c4bd487cced9c0cb6dd878ed223c6f527c60c907f296b64437a3`](https://sepolia.voyager.online/class/0x02379628b212c4bd487cced9c0cb6dd878ed223c6f527c60c907f296b64437a3) |
| Walkthrough video | _Not recorded yet_ |

## What is in this repository

```
apps/
  api/          NestJS API: auth, organisations, contractors, batches, approvals, receipts, audit, stats
  dashboard/    Next.js app: marketing site, legal pages, and the payroll dashboard
packages/
  core/         Domain model, state machines, approval policy, audit hash chain, shared schemas
  chain-adapter/ ChainAdapter interface, capability model, simulated ledger
  sdk/          Typed TypeScript client for the API
chains/starknet/
  contracts/    Cairo PayrollVault + snforge tests
  adapter/      starknet.js adapter: calldata, Poseidon items hash, receipt verification, STRK20 actions
docs/           Architecture, threat model, privacy model, deployment, API reference, strategy
scripts/        Demo seed script
```

## How a payroll run works

1. **Draft**: an admin picks contractors and amounts. Amounts are validated in base units; recipients and amounts are encrypted.
2. **Submit**: the batch is frozen. Veyra computes a SHA-256 commitment and, for the vault, a Poseidon items hash.
3. **Register** (vault mode): a wallet calls `propose_batch` with the items hash.
4. **Approve**: approvers sign `approve_batch` from their own wallets. Veyra verifies each approval from the chain.
5. **Execute**: `execute_batch` recomputes the hash on-chain and pays everyone atomically.
6. **Verify**: Veyra matches `PaymentSent` events and the token's own `Transfer` events against the frozen batch, marks it paid, and issues a receipt.

Every step is appended to a per-organisation, hash-chained audit log that can be re-verified at any time.

## Quick start (local)

Requirements: Node 22+, Docker. Optional for contracts: Scarb 2.21 and Starknet Foundry 0.64.

```bash
npm install
npm run services:up                       # Postgres 17 and Redis 7 in Docker
cp apps/api/.env.example apps/api/.env    # then set JWT_SECRET and VEYRA_MASTER_KEY
npm run build
npm run dev:api                           # http://localhost:4000/v1 (runs migrations on boot)
npm run dev:dashboard                     # http://localhost:3000
node scripts/seed-demo.mjs                # optional: demo organisation on the simulated ledger
```

Generate secrets with `openssl rand -base64 48` (JWT) and `openssl rand -base64 32` (master key).

The **simulated ledger** lets you run the whole flow without a wallet. Its balances live in memory and reset when the API restarts.

## Tests

```bash
npm test                    # unit + API end-to-end tests (needs Postgres and Redis running)
npm run test:contracts      # Cairo tests with snforge
```

API end-to-end tests use the database `veyra_test` (create it once: `docker compose exec postgres createdb -U veyra veyra_test`).

## Execution modes

| Mode | Approvals enforced by | On-chain visibility | Maturity |
|---|---|---|---|
| `vault` | PayrollVault contract | Recipients, amounts and approvals are public | Pre-audit |
| `strk20-private` | Veyra API | Transfers hidden in the pool; deposits, withdrawals and timing public | Experimental |
| `simulated` | Veyra API | Nothing published | Development only |

See [docs/privacy-model.md](docs/privacy-model.md) for the full breakdown.

## Documentation

- [Architecture](docs/architecture.md)
- [Threat model](docs/threat-model.md)
- [Privacy model](docs/privacy-model.md)
- [Deploying the PayrollVault](docs/deploy-vault.md)
- [API reference](docs/api.md)
- [Product strategy and roadmap](docs/strategy.md)
- [Security policy](SECURITY.md) and [contributing guide](CONTRIBUTING.md)

## Licence

Apache License 2.0. See [LICENSE](LICENSE).
