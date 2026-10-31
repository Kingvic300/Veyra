use starknet::ContractAddress;

/// Lifecycle of a batch inside the vault.
#[derive(Copy, Drop, Serde, PartialEq, Debug, Default, starknet::Store)]
pub enum BatchStatus {
    #[default]
    None,
    Proposed,
    Executed,
    Cancelled,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub struct Batch {
    pub token: ContractAddress,
    pub total: u256,
    pub item_count: u32,
    /// Poseidon hash binding approvals to the exact recipients and amounts.
    pub items_hash: felt252,
    pub approvals: u32,
    pub status: BatchStatus,
    pub proposer: ContractAddress,
    /// Approver-set version at proposal time. Changing approvers or the
    /// threshold invalidates every batch proposed under an older version.
    pub config_version: u64,
}

#[starknet::interface]
pub trait IPayrollVault<TContractState> {
    /// Register a batch for approval. Callable by an approver or the admin.
    fn propose_batch(
        ref self: TContractState,
        batch_id: felt252,
        token: ContractAddress,
        total: u256,
        item_count: u32,
        items_hash: felt252,
    );
    /// Record the caller's approval. Each approver approves at most once.
    fn approve_batch(ref self: TContractState, batch_id: felt252);
    /// Withdraw the caller's approval before execution.
    fn revoke_approval(ref self: TContractState, batch_id: felt252);
    /// Pay every recipient once the threshold is met. All transfers succeed
    /// or the whole transaction reverts.
    fn execute_batch(
        ref self: TContractState,
        batch_id: felt252,
        recipients: Span<ContractAddress>,
        amounts: Span<u256>,
    );
    /// Cancel a proposed batch. Callable by the admin or the proposer.
    fn cancel_batch(ref self: TContractState, batch_id: felt252);

    fn add_approver(ref self: TContractState, approver: ContractAddress);
    fn remove_approver(ref self: TContractState, approver: ContractAddress);
    fn set_threshold(ref self: TContractState, threshold: u32);
    fn transfer_admin(ref self: TContractState, new_admin: ContractAddress);

    fn get_batch(self: @TContractState, batch_id: felt252) -> Batch;
    fn has_approved(self: @TContractState, batch_id: felt252, approver: ContractAddress) -> bool;
    fn is_approver(self: @TContractState, account: ContractAddress) -> bool;
    fn get_threshold(self: @TContractState) -> u32;
    fn get_approver_count(self: @TContractState) -> u32;
    fn get_admin(self: @TContractState) -> ContractAddress;
    fn get_config_version(self: @TContractState) -> u64;
    fn compute_items_hash(
        self: @TContractState,
        batch_id: felt252,
        token: ContractAddress,
        recipients: Span<ContractAddress>,
        amounts: Span<u256>,
    ) -> felt252;
}

/// Minimal ERC-20 surface the vault depends on.
#[starknet::interface]
pub trait IERC20<TContractState> {
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
}
