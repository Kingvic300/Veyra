# Product strategy and roadmap

This records what Veyra is for, what the codebase already delivers, and what comes next.

## Product

Veyra is an open-source payroll and treasury toolkit for organisations that pay distributed teams, contractors and contributors with digital assets on Starknet. It lets a business fund a treasury, build payroll batches, collect approvals, execute payments and keep verifiable records.

**Model:** open-source protocol (Apache 2.0) plus an optional hosted service that charges for convenience, reliability, administration and support.

**Core promise:** create a batch, review it, approve it, execute it on Starknet and keep a verifiable record, keeping salary and identity details private where the chain and implementation genuinely support it.

## Who it serves

African businesses with cross-border contractor payments are the first segment: they pay people in several countries, bank transfers are slow and expensive, and stablecoin payouts need approval controls and records an accountant can trust.

The same workflow serves software agencies, remote-first startups, web3 teams and DAOs, and development studios.

## Why Starknet

- **Approvals enforced by a contract.** The Cairo `PayrollVault` checks the approval threshold and recomputes the batch hash on-chain before paying anyone, so the people who sign off on money cannot be bypassed by the Veyra API.
- **Low fees for batch payouts.** One transaction pays every contractor in a batch.
- **Native privacy path.** STRK20 gives a route to private transfers without leaving the network. Veyra implements it as an experimental mode and documents its limits in [privacy-model.md](privacy-model.md).
- **Native USDC.** Contractors are paid in a stablecoin they already recognise.

## Principles

- Prove one end-to-end workflow on Starknet before anything else.
- State each mode's privacy plainly; never promise more privacy than the chain delivers.
- Keep chain-specific code behind the adapter interface so the payroll core stays testable on a simulated ledger.

## Status

| Milestone | Status |
|---|---|
| Monorepo, domain model, API, schema, auth, roles | Done |
| Contractors, batches, validation, approvals, audit, dashboard | Done |
| Starknet vault contract, adapter, transaction tracking | Done (28 snforge tests; pending audit) |
| STRK20 private payments | Experimental; see [privacy-model.md](privacy-model.md) |
| Failure handling, security tests, documentation | Done for MVP scope |
| `PayrollVault` deployed on Starknet Sepolia | Done (demo vault, 1 of 1; see README) |
| Testnet pilot with real teams | Next |
| Independent audit, then Starknet mainnet | After the pilot |

## Pilot targets

These are targets, not existing traction: 5 pilot businesses, 50 contractors in batches, 15 approved batches, 100+ successful payments, at least 95% completion with every failure explained, zero unresolved critical findings, two external teams testing the SDK.

## Beyond Starknet

Other networks are out of scope until Veyra is live on Starknet mainnet. The adapter interface keeps that door open without spending effort on it now.

## Out of MVP scope

Fiat on/off ramps or custody, multi-jurisdiction tax calculation, a full accounting suite, automated recurring payroll, and universal privacy claims.

## Risks to resolve

Privacy compatibility of the chosen stablecoin and wallets, regulatory exposure in Nigeria and target markets, stablecoin availability, open-source sustainability, and scope creep.
