# Product and grant strategy

This summarises the Veyra strategy (originally drafted on 31 October 2026) and records what the codebase already delivers against it.

## Product

Veyra is an open-source payroll and treasury toolkit for organisations that pay distributed teams, contractors and contributors with digital assets. It lets a business fund a treasury, build payroll batches, collect approvals, execute payments through supported networks and keep verifiable records.

**Model:** open-source protocol (Apache 2.0) plus an optional hosted service that charges for convenience, reliability, administration and support.

**Core promise:** create a batch, review it, approve it, execute it on a supported network and keep a verifiable record, keeping salary and identity details private where the chain and implementation genuinely support it.

## Who it serves

Software agencies, remote-first startups, web3 teams and DAOs, development studios, and African businesses with cross-border contractor payments (the initial segment).

## Principles

- Build one shared core with chain adapters, never one app per chain.
- Declare each chain's capabilities, including privacy; never promise universal private payments.
- Prove one end-to-end workflow before adding networks.
- Treat Bitcoin and Lightning as a separate design, not a contract port.

## Network order

1. **Starknet** (lead): Cairo PayrollVault, STRK20 private transfers.
2. **Stellar**: Soroban contracts and stablecoin workflows.
3. **Sui and Solana**: Move packages and Anchor programs.
4. **Ethereum**: smart-account workflows.
5. **Bitcoin and Lightning**: dedicated payment-channel design.

## MVP status

| Milestone | Status |
|---|---|
| Monorepo, domain model, API, schema, auth, roles | Done |
| Contractors, batches, validation, approvals, audit, dashboard | Done |
| Starknet vault contract, adapter, transaction tracking | Done (contract tests written; pending audit) |
| STRK20 feasibility | Researched and implemented as an experimental mode; see [privacy-model.md](privacy-model.md) |
| Failure handling, security tests, documentation | Done for MVP scope |
| Testnet pilot with real teams | Next |
| Stellar adapter | After the pilot |

## Pilot targets

These are targets, not existing traction: 5 pilot businesses, 50 contractors in batches, 15 approved batches, 100+ successful payments, at least 95% completion with every failure explained, zero unresolved critical findings, two external teams testing the SDK.

## Grant approach

Each ecosystem application must describe value specific to that ecosystem and separate deliverables. Do not bill the same work twice; disclose parallel funding.

| Ecosystem | Framing |
|---|---|
| Starknet | Seed Grant for the Cairo vault, STRK20 integration and a testnet pilot |
| Stellar | Soroban payroll contracts and reusable stablecoin tooling |
| Sui | Move-native treasury and payment infrastructure for a concrete use case |
| Solana | Open-source batch-payment SDK as a public good |
| Ethereum | Reusable payroll/treasury primitives, privacy or security infrastructure |
| Bitcoin | Substantive Bitcoin/Lightning payment or verification tooling |

Verify every programme's current terms, eligibility and deadlines on its official page before applying.

## Out of MVP scope

Fiat on/off ramps or custody, multi-jurisdiction tax calculation, a full accounting suite, automated recurring payroll, and universal privacy claims.

## Risks to resolve

Privacy compatibility of the chosen stablecoin and wallets, regulatory exposure in Nigeria and target markets, stablecoin availability per network, cross-chain complexity, open-source sustainability, and scope creep.
