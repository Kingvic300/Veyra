# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately by email to the security contact listed on the Veyra website (`NEXT_PUBLIC_SECURITY_EMAIL`), or through GitHub's private vulnerability reporting on this repository. Do not open a public issue.

Include:

- what you found and its impact,
- steps to reproduce or a proof of concept,
- affected versions or commits.

We acknowledge reports within two working days, keep you informed, and credit you in the release notes if you wish.

## Rules of engagement

- Test only against your own deployment, the simulated ledger, or a testnet.
- Do not access other organisations' data or move real funds.
- Give us reasonable time to fix the issue before disclosure.

## Scope

- `apps/api`, `apps/dashboard`
- `packages/*`, `chains/starknet/adapter`
- `chains/starknet/contracts` (the PayrollVault contract)

## Current status

The PayrollVault contract has a test suite but **has not been independently audited**. Do not hold significant funds in it on mainnet. See [docs/threat-model.md](docs/threat-model.md).
