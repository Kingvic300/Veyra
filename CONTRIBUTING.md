# Contributing to Veyra

Thanks for helping. Veyra moves money, so we value correctness over speed.

## Getting set up

See the quick start in the [README](README.md). You need Node 22+, Docker, and for contract work Scarb 2.21 and Starknet Foundry 0.64.

## Before you open a pull request

```bash
npm run typecheck
npm test
npm run test:contracts   # if you touched chains/starknet/contracts
```

- Keep pull requests focused. One behaviour change per PR.
- Add or update tests with every behaviour change. Payment, approval and verification logic must have tests that fail without your change.
- Never weaken a privacy statement. If a feature exposes data on-chain, the adapter's `PrivacyCapabilities` must say so.
- Do not log or audit decrypted payroll data.
- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`...).

## Adding a network

1. Create `chains/<network>/adapter` implementing `ChainAdapter` from `@veyra/chain-adapter`.
2. Declare honest capabilities, including the privacy model and whether approvals are enforced on-chain.
3. Add contracts or programs under `chains/<network>/contracts` with their own test suite.
4. Register the adapter in `apps/api/src/chain/chain.service.ts` behind configuration.
5. Add an end-to-end API test using a fake RPC, like `apps/api/test/starknet-vault-flow.test.ts`.

## Code of conduct

Participation is covered by our [code of conduct](CODE_OF_CONDUCT.md).
