# Going live: private payments on Starknet mainnet

This guide turns on **Private payments (STRK20)** with real money. Follow it in order. The first payout is a small test you pay to yourself.

Checked 1 November 2026. STRK20 is new and changes often, so re-check the links before each step.

> **Read this first.** Private payments are experimental in Veyra. Before this guide, they had only been tested in code, not with a real wallet. Approvals are enforced by Veyra, not by a contract, so whoever holds the paying wallet can always send money outside Veyra. Veyra also cannot confirm private amounts; it only confirms that the transaction succeeded and came from your account. Start small.

---

## 1. What you need

| Item | What it is for | How much to start with |
|---|---|---|
| A **privacy-enabled Starknet wallet** | Signs payouts and makes the privacy proofs | Ready X or Xverse (both named in Starknet's launch). Braavos is not confirmed. |
| **STRK** | Pays network fees. Private transfers cost more than normal ones because of the proof. | About 20 STRK. Fees are usually far below that; the rest is a buffer. |
| **USDC** (Circle's native USDC on Starknet) | The money you pay people with | $10–20 for the test. Add the real payroll amount later. |
| A **Starknet mainnet RPC URL** | Lets the Veyra API read the chain | Free tier from Alchemy, Infura, Chainstack, Blast or Nethermind |
| A **second wallet you control** | Plays the contractor in the test payout | Also privacy-enabled |

Mainnet USDC contract (Veyra fills this in for you when you pick USDC):
`0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb`

---

## 2. Buy STRK and USDC

1. Buy STRK and USDC on an exchange that supports **withdrawals on the Starknet network**.
2. Install your privacy wallet and create an account. Copy its address (starts with `0x`).
3. Withdraw a **small amount first** (for example 2 STRK) to that address. Pick **Starknet** as the withdrawal network, not Ethereum or another chain. Funds sent on the wrong network can be lost.
4. When it arrives, withdraw the rest of the STRK, then the USDC, the same way.
5. If your exchange only offers USDC on Ethereum, you need a bridge to Starknet. Use the bridge your wallet suggests and test with a small amount first.

Keep the wallet's recovery phrase offline. Whoever has it controls the payroll money.

---

## 3. Turn on mainnet in the API (Render)

In Render, open the **API service → Environment** and set:

| Variable | Value |
|---|---|
| `STARKNET_RPC_MAINNET` | Your provider's **Starknet mainnet** HTTPS URL |
| `ENABLE_STRK20` | `true` |
| `ENABLE_MAINNET_VAULT` | `false` (or leave it unset). Keeps the unaudited PayrollVault off mainnet. |

Save. Render redeploys. In the logs, check for:

```
Veyra API on … (chains: starknet/sepolia, starknet/mainnet, jobs: …)
```

If `starknet/mainnet` is missing, the RPC variable is empty or misspelled.

On Vercel, check `NEXT_PUBLIC_EXPLORER_MAINNET` is `https://voyager.online` (from `docs/deploy-guide.pdf`). Redeploy the dashboard only if you change it.

What users will see: mainnet appears in onboarding with two options, **Pay from your wallet** and **Private payments**. Payroll vault stays Sepolia-only.

---

## 4. Shield your USDC

Shielding moves USDC into your private balance. Payouts come from that balance.

1. In your wallet, switch the network to **Starknet Mainnet**.
2. Find USDC and choose **Shield**. Shield the test amount (for example $10).
3. Wait for it to confirm.

The shield itself is public: anyone can see that your address put $10 USDC into the pool. Payouts made from the private balance are not public.

---

## 5. Get the test recipient ready

Every person you pay must have a privacy-enabled wallet that has been **set up for privacy**. That means it has registered a viewing key, which the wallet does the first time privacy is used. Veyra does not check this yet.

For the test, use your second wallet:

1. Install a privacy wallet (Ready X or Xverse) and create an account on mainnet.
2. Turn on privacy in it once (for example, shield a tiny amount of STRK). This registers it.
3. Copy its address.

Send real contractors the same three steps before their first private payout.

---

## 6. Create the mainnet company in Veyra

1. Sign in, then create a new company (or use **Go live** from a Sepolia one).
2. **How you pay:** pick **Private payments** with the **Mainnet** badge.
3. **Money:** choose **USDC**. Paste your paying wallet's address, or press **Use connected wallet**.
4. **Approvals:** for the test, 1 approval is fine.

---

## 7. Your first payout: $1 to yourself

1. Add the second wallet as a contractor.
2. Create a batch with **one payment of 1 USDC**.
3. Submit it and approve it.
4. Press **Pay**. Your wallet opens. Check it says **Starknet Mainnet**, the token is USDC and the amount is 1. Then sign.
5. Proof generation can take **tens of seconds**. Leave the tab open.
6. When the batch shows **Paid**, open the second wallet and check its private USDC balance went up by 1.

If the payout fails, don't retry straight away. Check the transaction in Voyager (link on the batch page) and the error the wallet showed first.

---

## 8. Scaling up

Once the $1 test works:

1. Pay 2–3 people at once with small amounts.
2. Then a batch of 5, then 10. Veyra caps private batches at 20 payments, because no one has tested wallets with more.
3. Shield only what each payroll needs. The pool is new: don't keep more there than you have to.
4. For real payroll, raise **Approvals needed** to 2 or more, so no single person can push a payout through Veyra.

---

## 9. If something goes wrong

| Problem | Likely cause | What to do |
|---|---|---|
| Mainnet isn't offered in onboarding | `STARKNET_RPC_MAINNET` unset, or the API didn't redeploy | Check the Render logs line from step 3 |
| Private payments isn't offered on mainnet | `ENABLE_STRK20` isn't `true` | Set it and redeploy |
| Wallet says it can't do private transactions | Wallet doesn't support STRK20 | Use Ready X or Xverse |
| Payout fails for one recipient | They haven't set their wallet up for privacy | Ask them to do step 5 |
| Wallet asks to pay on Sepolia | Wallet is on the wrong network | Switch it to Starknet Mainnet and try again |
| Balance calls or verification fail | RPC provider doesn't support the RPC version the `starknet` package needs | Check the provider's version list, or change provider |

**To turn it all off**, set `ENABLE_STRK20=false` on Render. Existing private companies then stop paying until it's back on. Money already shielded stays in your wallet. You can unshield it there at any time.

---

## Sources

- [STRK20 deployed contract addresses](https://strk20.starknet.io/docs/contract-addresses)
- [Starknet v0.14.2: native privacy for STRK20](https://www.starknet.io/blog/starknet-v0-14-2-the-privacy-engine-arrives/)
- [Private DeFi is coming to Starknet (wallets: Ready X, Xverse)](https://www.starknet.io/blog/private-defi-is-coming-to-starknet/)
- [Starknet: private USDC is live](https://x.com/Starknet/status/2070176768909267070)
- [Starknet privacy docs: encryption and viewing keys](https://docs.starknet.io/build/starknet-privacy/encryption-and-keys.md)
- Veyra: `docs/privacy-model.md`, `docs/deploy-guide.pdf`
