/// Multi-approval payroll treasury.
///
/// Flow: propose(batch_id, token, total, count, items_hash) -> approve x threshold
/// -> execute(batch_id, recipients, amounts). Execution recomputes the items hash,
/// so approvers sign off on exact recipients and amounts, not just a total.
#[starknet::contract]
pub mod PayrollVault {
    use core::num::traits::Zero;
    use core::poseidon::poseidon_hash_span;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use crate::interfaces::{
        Batch, BatchStatus, IERC20Dispatcher, IERC20DispatcherTrait, IPayrollVault,
    };

    /// Upper bound on payments per batch to keep execution within block limits.
    pub const MAX_BATCH_ITEMS: u32 = 100;

    pub mod Errors {
        pub const NOT_ADMIN: felt252 = 'Vault: caller is not admin';
        pub const NOT_APPROVER: felt252 = 'Vault: caller not approver';
        pub const NOT_AUTHORISED: felt252 = 'Vault: not authorised';
        pub const BATCH_EXISTS: felt252 = 'Vault: batch id already used';
        pub const BATCH_NOT_PROPOSED: felt252 = 'Vault: batch not proposed';
        pub const STALE_CONFIG: felt252 = 'Vault: approver set changed';
        pub const ALREADY_APPROVED: felt252 = 'Vault: already approved';
        pub const NOT_APPROVED: felt252 = 'Vault: approval not found';
        pub const THRESHOLD_NOT_MET: felt252 = 'Vault: threshold not met';
        pub const LENGTH_MISMATCH: felt252 = 'Vault: length mismatch';
        pub const COUNT_MISMATCH: felt252 = 'Vault: item count mismatch';
        pub const HASH_MISMATCH: felt252 = 'Vault: items hash mismatch';
        pub const TOTAL_MISMATCH: felt252 = 'Vault: total mismatch';
        pub const INSUFFICIENT_FUNDS: felt252 = 'Vault: insufficient funds';
        pub const TRANSFER_FAILED: felt252 = 'Vault: transfer failed';
        pub const ZERO_AMOUNT: felt252 = 'Vault: zero amount';
        pub const ZERO_ADDRESS: felt252 = 'Vault: zero address';
        pub const BAD_BATCH: felt252 = 'Vault: invalid batch';
        pub const TOO_MANY_ITEMS: felt252 = 'Vault: too many items';
        pub const BAD_THRESHOLD: felt252 = 'Vault: invalid threshold';
        pub const APPROVER_EXISTS: felt252 = 'Vault: approver exists';
        pub const UNKNOWN_APPROVER: felt252 = 'Vault: unknown approver';
    }

    #[storage]
    struct Storage {
        admin: ContractAddress,
        approvers: Map<ContractAddress, bool>,
        approver_count: u32,
        threshold: u32,
        config_version: u64,
        batches: Map<felt252, Batch>,
        approvals: Map<(felt252, ContractAddress), bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        BatchProposed: BatchProposed,
        BatchApproved: BatchApproved,
        ApprovalRevoked: ApprovalRevoked,
        BatchExecuted: BatchExecuted,
        PaymentSent: PaymentSent,
        BatchCancelled: BatchCancelled,
        ApproverAdded: ApproverAdded,
        ApproverRemoved: ApproverRemoved,
        ThresholdChanged: ThresholdChanged,
        AdminTransferred: AdminTransferred,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BatchProposed {
        #[key]
        pub batch_id: felt252,
        pub proposer: ContractAddress,
        pub token: ContractAddress,
        pub total: u256,
        pub item_count: u32,
        pub items_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BatchApproved {
        #[key]
        pub batch_id: felt252,
        #[key]
        pub approver: ContractAddress,
        pub approvals: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ApprovalRevoked {
        #[key]
        pub batch_id: felt252,
        #[key]
        pub approver: ContractAddress,
        pub approvals: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BatchExecuted {
        #[key]
        pub batch_id: felt252,
        pub executor: ContractAddress,
        pub token: ContractAddress,
        pub total: u256,
        pub item_count: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PaymentSent {
        #[key]
        pub batch_id: felt252,
        #[key]
        pub recipient: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BatchCancelled {
        #[key]
        pub batch_id: felt252,
        pub by: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ApproverAdded {
        #[key]
        pub approver: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ApproverRemoved {
        #[key]
        pub approver: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ThresholdChanged {
        pub threshold: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AdminTransferred {
        pub previous: ContractAddress,
        pub new_admin: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        admin: ContractAddress,
        approvers: Span<ContractAddress>,
        threshold: u32,
    ) {
        assert(admin.is_non_zero(), Errors::ZERO_ADDRESS);
        self.admin.write(admin);
        for approver in approvers {
            self._add_approver(*approver);
        }
        self._set_threshold(threshold);
    }

    #[abi(embed_v0)]
    impl PayrollVaultImpl of IPayrollVault<ContractState> {
        fn propose_batch(
            ref self: ContractState,
            batch_id: felt252,
            token: ContractAddress,
            total: u256,
            item_count: u32,
            items_hash: felt252,
        ) {
            let caller = get_caller_address();
            assert(self.approvers.read(caller) || caller == self.admin.read(), Errors::NOT_AUTHORISED);
            assert(batch_id != 0 && items_hash != 0, Errors::BAD_BATCH);
            assert(token.is_non_zero(), Errors::ZERO_ADDRESS);
            assert(total != 0, Errors::ZERO_AMOUNT);
            assert(item_count != 0, Errors::BAD_BATCH);
            assert(item_count <= MAX_BATCH_ITEMS, Errors::TOO_MANY_ITEMS);
            // Batch ids are single-use, including cancelled and executed ones.
            assert(self.batches.read(batch_id).status == BatchStatus::None, Errors::BATCH_EXISTS);

            self
                .batches
                .write(
                    batch_id,
                    Batch {
                        token,
                        total,
                        item_count,
                        items_hash,
                        approvals: 0,
                        status: BatchStatus::Proposed,
                        proposer: caller,
                        config_version: self.config_version.read(),
                    },
                );
            self
                .emit(
                    BatchProposed { batch_id, proposer: caller, token, total, item_count, items_hash },
                );
        }

        fn approve_batch(ref self: ContractState, batch_id: felt252) {
            let caller = get_caller_address();
            assert(self.approvers.read(caller), Errors::NOT_APPROVER);
            let mut batch = self._live_batch(batch_id);
            assert(!self.approvals.read((batch_id, caller)), Errors::ALREADY_APPROVED);

            self.approvals.write((batch_id, caller), true);
            batch.approvals += 1;
            self.batches.write(batch_id, batch);
            self.emit(BatchApproved { batch_id, approver: caller, approvals: batch.approvals });
        }

        fn revoke_approval(ref self: ContractState, batch_id: felt252) {
            let caller = get_caller_address();
            let mut batch = self._live_batch(batch_id);
            assert(self.approvals.read((batch_id, caller)), Errors::NOT_APPROVED);

            self.approvals.write((batch_id, caller), false);
            batch.approvals -= 1;
            self.batches.write(batch_id, batch);
            self.emit(ApprovalRevoked { batch_id, approver: caller, approvals: batch.approvals });
        }

        fn execute_batch(
            ref self: ContractState,
            batch_id: felt252,
            recipients: Span<ContractAddress>,
            amounts: Span<u256>,
        ) {
            let caller = get_caller_address();
            assert(self.approvers.read(caller) || caller == self.admin.read(), Errors::NOT_AUTHORISED);
            let mut batch = self._live_batch(batch_id);
            assert(batch.approvals >= self.threshold.read(), Errors::THRESHOLD_NOT_MET);
            assert(recipients.len() == amounts.len(), Errors::LENGTH_MISMATCH);
            assert(recipients.len() == batch.item_count, Errors::COUNT_MISMATCH);
            assert(
                _items_hash(batch_id, batch.token, recipients, amounts) == batch.items_hash,
                Errors::HASH_MISMATCH,
            );

            let mut sum: u256 = 0;
            for amount in amounts {
                assert(*amount != 0, Errors::ZERO_AMOUNT);
                sum += *amount;
            }
            assert(sum == batch.total, Errors::TOTAL_MISMATCH);

            let token = IERC20Dispatcher { contract_address: batch.token };
            assert(token.balance_of(get_contract_address()) >= sum, Errors::INSUFFICIENT_FUNDS);

            // Effects before interactions: mark executed before any external call
            // so a re-entrant token cannot execute the batch twice.
            batch.status = BatchStatus::Executed;
            self.batches.write(batch_id, batch);

            let mut i: u32 = 0;
            while i != recipients.len() {
                let recipient = *recipients.at(i);
                let amount = *amounts.at(i);
                assert(recipient.is_non_zero(), Errors::ZERO_ADDRESS);
                assert(token.transfer(recipient, amount), Errors::TRANSFER_FAILED);
                self.emit(PaymentSent { batch_id, recipient, amount });
                i += 1;
            }

            self
                .emit(
                    BatchExecuted {
                        batch_id,
                        executor: caller,
                        token: batch.token,
                        total: sum,
                        item_count: batch.item_count,
                    },
                );
        }

        fn cancel_batch(ref self: ContractState, batch_id: felt252) {
            let caller = get_caller_address();
            let mut batch = self.batches.read(batch_id);
            assert(batch.status == BatchStatus::Proposed, Errors::BATCH_NOT_PROPOSED);
            assert(caller == self.admin.read() || caller == batch.proposer, Errors::NOT_AUTHORISED);
            batch.status = BatchStatus::Cancelled;
            self.batches.write(batch_id, batch);
            self.emit(BatchCancelled { batch_id, by: caller });
        }

        fn add_approver(ref self: ContractState, approver: ContractAddress) {
            self._only_admin();
            self._add_approver(approver);
            self._bump_config();
        }

        fn remove_approver(ref self: ContractState, approver: ContractAddress) {
            self._only_admin();
            assert(self.approvers.read(approver), Errors::UNKNOWN_APPROVER);
            let count = self.approver_count.read() - 1;
            assert(count >= self.threshold.read(), Errors::BAD_THRESHOLD);
            self.approvers.write(approver, false);
            self.approver_count.write(count);
            self.emit(ApproverRemoved { approver });
            self._bump_config();
        }

        fn set_threshold(ref self: ContractState, threshold: u32) {
            self._only_admin();
            self._set_threshold(threshold);
            self._bump_config();
        }

        fn transfer_admin(ref self: ContractState, new_admin: ContractAddress) {
            self._only_admin();
            assert(new_admin.is_non_zero(), Errors::ZERO_ADDRESS);
            let previous = self.admin.read();
            self.admin.write(new_admin);
            self.emit(AdminTransferred { previous, new_admin });
        }

        fn get_batch(self: @ContractState, batch_id: felt252) -> Batch {
            self.batches.read(batch_id)
        }

        fn has_approved(self: @ContractState, batch_id: felt252, approver: ContractAddress) -> bool {
            self.approvals.read((batch_id, approver))
        }

        fn is_approver(self: @ContractState, account: ContractAddress) -> bool {
            self.approvers.read(account)
        }

        fn get_threshold(self: @ContractState) -> u32 {
            self.threshold.read()
        }

        fn get_approver_count(self: @ContractState) -> u32 {
            self.approver_count.read()
        }

        fn get_admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }

        fn get_config_version(self: @ContractState) -> u64 {
            self.config_version.read()
        }

        fn compute_items_hash(
            self: @ContractState,
            batch_id: felt252,
            token: ContractAddress,
            recipients: Span<ContractAddress>,
            amounts: Span<u256>,
        ) -> felt252 {
            assert(recipients.len() == amounts.len(), Errors::LENGTH_MISMATCH);
            _items_hash(batch_id, token, recipients, amounts)
        }
    }

    /// poseidon([batch_id, token, n, r_0, a_0.low, a_0.high, ..., r_n-1, a_n-1.low, a_n-1.high])
    /// Must match `computeItemsHash` in @veyra/starknet-adapter.
    fn _items_hash(
        batch_id: felt252,
        token: ContractAddress,
        recipients: Span<ContractAddress>,
        amounts: Span<u256>,
    ) -> felt252 {
        let mut data: Array<felt252> = array![batch_id, token.into(), recipients.len().into()];
        let mut i: u32 = 0;
        while i != recipients.len() {
            let amount = *amounts.at(i);
            data.append((*recipients.at(i)).into());
            data.append(amount.low.into());
            data.append(amount.high.into());
            i += 1;
        }
        poseidon_hash_span(data.span())
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _only_admin(self: @ContractState) {
            assert(get_caller_address() == self.admin.read(), Errors::NOT_ADMIN);
        }

        /// Load a batch that is still open for approvals and execution.
        fn _live_batch(self: @ContractState, batch_id: felt252) -> Batch {
            let batch = self.batches.read(batch_id);
            assert(batch.status == BatchStatus::Proposed, Errors::BATCH_NOT_PROPOSED);
            assert(batch.config_version == self.config_version.read(), Errors::STALE_CONFIG);
            batch
        }

        fn _add_approver(ref self: ContractState, approver: ContractAddress) {
            assert(approver.is_non_zero(), Errors::ZERO_ADDRESS);
            assert(!self.approvers.read(approver), Errors::APPROVER_EXISTS);
            self.approvers.write(approver, true);
            self.approver_count.write(self.approver_count.read() + 1);
            self.emit(ApproverAdded { approver });
        }

        fn _set_threshold(ref self: ContractState, threshold: u32) {
            assert(threshold >= 1 && threshold <= self.approver_count.read(), Errors::BAD_THRESHOLD);
            self.threshold.write(threshold);
            self.emit(ThresholdChanged { threshold });
        }

        fn _bump_config(ref self: ContractState) {
            self.config_version.write(self.config_version.read() + 1);
        }
    }
}
