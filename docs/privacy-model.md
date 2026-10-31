# Privacy model

Veyra never describes a payment as private unless the network and mode actually hide it. Each chain adapter declares a `PrivacyCapabilities` object and the dashboard renders it next to every batch.

## What is always private

Regardless of mode, these never leave the Veyra database in plain form:

- Contractor names and emails.
- The mapping between a contractor and their wallet.
- Per-person amounts as stored by Veyra (encrypted at rest).

## Starknet PayrollVault (transparent)

| Data | Visibility |
|---|---|
| Recipient wallets | Public |
| Individual amounts | Public |
| Batch total, item count, items hash | Public |
| Approver wallets and approval transactions | Public |
| Timing | Public |

The contract stores a Poseidon hash of the recipients and amounts at proposal time, then emits `PaymentSent` events at execution. Anyone can verify a receipt from chain data alone.

## Starknet STRK20 (experimental)

Findings from the STRK20 documentation (checked 31 October 2026):

- The privacy pool is note-based. Accounts must register (set a viewing key) before they can hold or receive private balances. **Both payer and recipients must be registered.**
- A third-party app does not handle notes or proofs. The user's privacy-enabled wallet does, through `WalletAccountV6.strk20InvokeTransaction(actions)` with actions such as `{ type: 'transfer', token, amount, recipient }`.
- **A plain contract cannot own shielded notes.** Anonymizer helpers and shadow accounts exist, but there is no documented route for a multi-approval vault to hold shielded funds. Therefore STRK20 mode cannot have contract-enforced approvals; Veyra enforces them in the API and says so.
- Hidden inside the pool: sender, receiver, amount, token, which notes were spent.
- Public: deposits into the pool (depositor, token, amount), withdrawals (recipient, token, amount), the fact that an address interacts with the pool, timing, nullifiers, open-note amounts.
- Proof generation happens in the wallet and can take tens of seconds.
- No documented limit on transfer actions per transaction; Veyra caps STRK20 batches at 20 payments until tested.

| Data | Visibility |
|---|---|
| Recipient wallets | Hidden in the pool |
| Individual amounts | Hidden in the pool |
| Batch total | Hidden (only the funding deposit is public) |
| Approvals | Recorded by Veyra, not on-chain |
| Timing and pool usage by the payer | Public |

Verification in this mode is limited: Veyra confirms the transaction succeeded and was sent by the configured paying account, but cannot check shielded amounts without the payer's viewing key. Receipts state this.

### Open questions before enabling STRK20 in production

1. Confirm USDC (and any target stablecoin) is supported by the pool on mainnet.
2. Confirm wallet support (Ready, Braavos) for `strk20InvokeTransaction` with many transfer actions.
3. Decide how contractors register with the pool (onboarding guide or escrow-claim flow).
4. Decide whether API-enforced approvals are acceptable for the organisation's risk appetite.

## Simulated ledger

Nothing is published anywhere. Use it for demos and tests only. Balances reset when the API restarts.
