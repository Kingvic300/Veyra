# Deploying the PayrollVault

This guide deploys `PayrollVault` to Starknet Sepolia with Starknet Foundry (`sncast`). Do not deploy to mainnet before the independent audit.

## 1. Build and test

```bash
cd chains/starknet/contracts
scarb build
snforge test
```

`snforge` needs `universal-sierra-compiler` on your `PATH` (see the Starknet Foundry installation guide).

## 2. Create or import a deployer account

```bash
sncast account create --network sepolia --name veyra-deployer
# fund the printed address with STRK from a Sepolia faucet, then:
sncast account deploy --network sepolia --name veyra-deployer
```

## 3. Choose the vault configuration

- **Admin**: use a multisig account. The admin can change approvers and the threshold.
- **Approvers**: the wallets your approvers will link in Veyra (Team page).
- **Threshold**: the same number you set as "Approvals needed" in Veyra.

## 4. Declare and deploy

```bash
cd chains/starknet/contracts
./scripts/deploy-vault.sh sepolia veyra-deployer <ADMIN> 2 <APPROVER_1> <APPROVER_2> <APPROVER_3>
```

The script declares the contract class if needed and deploys it with constructor calldata `admin, approvers (span), threshold`. It prints the vault address.

## 5. Connect it to Veyra

1. In Veyra, open **Settings** and paste the vault address as the PayrollVault contract.
2. Each approver links their wallet on the **Team** page.
3. Fund the vault by transferring the payroll token (for example USDC) to its address.

## 6. Run a test payroll

Create a small batch, submit it, register it on-chain, collect approvals and execute. The batch page shows each transaction hash with an explorer link, and the receipt lists the settlement transaction.

## Changing approvers later

Calling `add_approver`, `remove_approver` or `set_threshold` bumps the vault's `config_version` and invalidates every batch proposed before the change. Re-submit those batches as new batches in Veyra.
