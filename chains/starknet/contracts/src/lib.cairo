//! Veyra Starknet contracts.
//!
//! `PayrollVault` holds an organisation's treasury and only releases funds for
//! payroll batches that a threshold of approvers signed off on-chain.
//! `mocks` contains test-only contracts and must never be deployed to mainnet.

pub mod interfaces;
pub mod payroll_vault;
pub mod mocks {
    pub mod erc20;
}
