/// Test-only ERC-20. Anyone can mint. Never deploy outside tests or devnets.
#[starknet::interface]
pub trait IMockERC20<TContractState> {
    fn mint(ref self: TContractState, to: starknet::ContractAddress, amount: u256);
    /// When set, `transfer` returns false instead of moving funds.
    fn set_fail_transfers(ref self: TContractState, fail: bool);
}

#[starknet::contract]
pub mod MockERC20 {
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address};
    use crate::interfaces::IERC20;

    #[storage]
    struct Storage {
        balances: Map<ContractAddress, u256>,
        fail_transfers: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Transfer: Transfer,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Transfer {
        #[key]
        pub from: ContractAddress,
        #[key]
        pub to: ContractAddress,
        pub value: u256,
    }

    #[abi(embed_v0)]
    impl ERC20Impl of IERC20<ContractState> {
        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.read(account)
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            if self.fail_transfers.read() {
                return false;
            }
            let sender = get_caller_address();
            let balance = self.balances.read(sender);
            assert(balance >= amount, 'ERC20: insufficient balance');
            self.balances.write(sender, balance - amount);
            self.balances.write(recipient, self.balances.read(recipient) + amount);
            self.emit(Transfer { from: sender, to: recipient, value: amount });
            true
        }
    }

    #[abi(embed_v0)]
    impl MockImpl of super::IMockERC20<ContractState> {
        fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            self.balances.write(to, self.balances.read(to) + amount);
        }

        fn set_fail_transfers(ref self: ContractState, fail: bool) {
            self.fail_transfers.write(fail);
        }
    }
}
