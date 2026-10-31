use snforge_std::{
    ContractClassTrait, DeclareResultTrait, EventSpyAssertionsTrait, declare, spy_events,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use veyra_contracts::interfaces::{
    BatchStatus, IERC20Dispatcher, IERC20DispatcherTrait, IPayrollVaultDispatcher,
    IPayrollVaultDispatcherTrait, IPayrollVaultSafeDispatcher, IPayrollVaultSafeDispatcherTrait,
};
use veyra_contracts::mocks::erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use veyra_contracts::payroll_vault::PayrollVault;

const BATCH_ID: felt252 = 0x0f8e2c4a1b3d4e5f8a9b0c1d2e3f4a5b;

fn addr(name: felt252) -> ContractAddress {
    name.try_into().unwrap()
}

fn admin() -> ContractAddress {
    addr('admin')
}
fn alice() -> ContractAddress {
    addr('alice')
}
fn bob() -> ContractAddress {
    addr('bob')
}
fn carol() -> ContractAddress {
    addr('carol')
}
fn outsider() -> ContractAddress {
    addr('outsider')
}

#[derive(Drop, Copy)]
struct Setup {
    vault: IPayrollVaultDispatcher,
    token: IERC20Dispatcher,
    mock: IMockERC20Dispatcher,
}

fn deploy_token() -> ContractAddress {
    let class = declare("MockERC20").unwrap().contract_class();
    let (address, _) = class.deploy(@array![]).unwrap();
    address
}

fn deploy_vault(approvers: Span<ContractAddress>, threshold: u32) -> ContractAddress {
    let class = declare("PayrollVault").unwrap().contract_class();
    let mut calldata = array![];
    Serde::serialize(@admin(), ref calldata);
    Serde::serialize(@approvers, ref calldata);
    Serde::serialize(@threshold, ref calldata);
    let (address, _) = class.deploy(@calldata).unwrap();
    address
}

/// Vault with approvers alice, bob, carol, threshold 2, funded with 10_000.
fn setup() -> Setup {
    let token_address = deploy_token();
    let vault_address = deploy_vault(array![alice(), bob(), carol()].span(), 2);
    let mock = IMockERC20Dispatcher { contract_address: token_address };
    mock.mint(vault_address, 10_000);
    Setup {
        vault: IPayrollVaultDispatcher { contract_address: vault_address },
        token: IERC20Dispatcher { contract_address: token_address },
        mock,
    }
}

fn recipients() -> Span<ContractAddress> {
    array![addr('contractor_1'), addr('contractor_2'), addr('contractor_3')].span()
}

fn amounts() -> Span<u256> {
    array![1_000_u256, 2_500_u256, 500_u256].span()
}

fn propose_as(s: Setup, caller: ContractAddress) {
    let hash = s
        .vault
        .compute_items_hash(BATCH_ID, s.token.contract_address, recipients(), amounts());
    start_cheat_caller_address(s.vault.contract_address, caller);
    s.vault.propose_batch(BATCH_ID, s.token.contract_address, 4_000, 3, hash);
    stop_cheat_caller_address(s.vault.contract_address);
}

fn approve_as(s: Setup, caller: ContractAddress) {
    start_cheat_caller_address(s.vault.contract_address, caller);
    s.vault.approve_batch(BATCH_ID);
    stop_cheat_caller_address(s.vault.contract_address);
}

fn execute_as(s: Setup, caller: ContractAddress) {
    start_cheat_caller_address(s.vault.contract_address, caller);
    s.vault.execute_batch(BATCH_ID, recipients(), amounts());
    stop_cheat_caller_address(s.vault.contract_address);
}

fn approved_setup() -> Setup {
    let s = setup();
    propose_as(s, alice());
    approve_as(s, alice());
    approve_as(s, bob());
    s
}

#[test]
fn test_constructor_configures_approvers() {
    let s = setup();
    assert_eq!(s.vault.get_admin(), admin());
    assert_eq!(s.vault.get_threshold(), 2);
    assert_eq!(s.vault.get_approver_count(), 3);
    assert!(s.vault.is_approver(bob()));
    assert!(!s.vault.is_approver(outsider()));
}

#[test]
fn test_constructor_rejects_threshold_above_approvers() {
    let class = declare("PayrollVault").unwrap().contract_class();
    let mut calldata = array![];
    Serde::serialize(@admin(), ref calldata);
    Serde::serialize(@array![alice()].span(), ref calldata);
    Serde::serialize(@2_u32, ref calldata);
    assert!(class.deploy(@calldata).is_err());
}

#[test]
fn test_full_payroll_flow() {
    let s = setup();
    let mut spy = spy_events();
    propose_as(s, alice());
    approve_as(s, alice());
    approve_as(s, bob());
    assert_eq!(s.vault.get_batch(BATCH_ID).approvals, 2);

    execute_as(s, carol());

    let batch = s.vault.get_batch(BATCH_ID);
    assert_eq!(batch.status, BatchStatus::Executed);
    assert_eq!(s.token.balance_of(addr('contractor_1')), 1_000);
    assert_eq!(s.token.balance_of(addr('contractor_2')), 2_500);
    assert_eq!(s.token.balance_of(addr('contractor_3')), 500);
    assert_eq!(s.token.balance_of(s.vault.contract_address), 6_000);

    spy
        .assert_emitted(
            @array![
                (
                    s.vault.contract_address,
                    PayrollVault::Event::PaymentSent(
                        PayrollVault::PaymentSent {
                            batch_id: BATCH_ID, recipient: addr('contractor_2'), amount: 2_500,
                        },
                    ),
                ),
                (
                    s.vault.contract_address,
                    PayrollVault::Event::BatchExecuted(
                        PayrollVault::BatchExecuted {
                            batch_id: BATCH_ID,
                            executor: carol(),
                            token: s.token.contract_address,
                            total: 4_000,
                            item_count: 3,
                        },
                    ),
                ),
            ],
        );
}

#[test]
fn test_admin_can_propose_and_execute() {
    let s = setup();
    propose_as(s, admin());
    approve_as(s, alice());
    approve_as(s, carol());
    execute_as(s, admin());
    assert_eq!(s.vault.get_batch(BATCH_ID).status, BatchStatus::Executed);
}

#[test]
#[should_panic(expected: 'Vault: not authorised')]
fn test_outsider_cannot_propose() {
    let s = setup();
    propose_as(s, outsider());
}

#[test]
#[should_panic(expected: 'Vault: caller not approver')]
fn test_outsider_cannot_approve() {
    let s = setup();
    propose_as(s, alice());
    approve_as(s, outsider());
}

#[test]
#[should_panic(expected: 'Vault: caller not approver')]
fn test_admin_alone_cannot_approve() {
    let s = setup();
    propose_as(s, alice());
    approve_as(s, admin());
}

#[test]
#[should_panic(expected: 'Vault: already approved')]
fn test_double_approval_rejected() {
    let s = setup();
    propose_as(s, alice());
    approve_as(s, bob());
    approve_as(s, bob());
}

#[test]
#[should_panic(expected: 'Vault: threshold not met')]
fn test_execute_requires_threshold() {
    let s = setup();
    propose_as(s, alice());
    approve_as(s, alice());
    execute_as(s, alice());
}

#[test]
#[should_panic(expected: 'Vault: not authorised')]
fn test_outsider_cannot_execute() {
    let s = approved_setup();
    execute_as(s, outsider());
}

#[test]
#[should_panic(expected: 'Vault: items hash mismatch')]
fn test_execute_rejects_tampered_amounts() {
    let s = approved_setup();
    start_cheat_caller_address(s.vault.contract_address, alice());
    s.vault.execute_batch(BATCH_ID, recipients(), array![1_000_u256, 500_u256, 2_500_u256].span());
}

#[test]
#[should_panic(expected: 'Vault: items hash mismatch')]
fn test_execute_rejects_swapped_recipient() {
    let s = approved_setup();
    start_cheat_caller_address(s.vault.contract_address, alice());
    s
        .vault
        .execute_batch(
            BATCH_ID,
            array![addr('contractor_1'), addr('attacker'), addr('contractor_3')].span(),
            amounts(),
        );
}

#[test]
#[should_panic(expected: 'Vault: item count mismatch')]
fn test_execute_rejects_dropped_item() {
    let s = approved_setup();
    start_cheat_caller_address(s.vault.contract_address, alice());
    s
        .vault
        .execute_batch(
            BATCH_ID,
            array![addr('contractor_1'), addr('contractor_2')].span(),
            array![1_000_u256, 2_500_u256].span(),
        );
}

#[test]
#[should_panic(expected: 'Vault: batch not proposed')]
fn test_batch_cannot_execute_twice() {
    let s = approved_setup();
    execute_as(s, alice());
    execute_as(s, alice());
}

#[test]
#[should_panic(expected: 'Vault: batch id already used')]
fn test_batch_id_cannot_be_reused() {
    let s = approved_setup();
    execute_as(s, alice());
    propose_as(s, alice());
}

#[test]
#[should_panic(expected: 'Vault: insufficient funds')]
fn test_execute_requires_funds() {
    let token_address = deploy_token();
    let vault_address = deploy_vault(array![alice(), bob()].span(), 1);
    let s = Setup {
        vault: IPayrollVaultDispatcher { contract_address: vault_address },
        token: IERC20Dispatcher { contract_address: token_address },
        mock: IMockERC20Dispatcher { contract_address: token_address },
    };
    s.mock.mint(vault_address, 3_999);
    propose_as(s, alice());
    approve_as(s, bob());
    execute_as(s, alice());
}

#[test]
#[feature("safe_dispatcher")]
fn test_failed_transfer_reverts_whole_batch() {
    let s = approved_setup();
    s.mock.set_fail_transfers(true);
    let safe = IPayrollVaultSafeDispatcher { contract_address: s.vault.contract_address };
    start_cheat_caller_address(s.vault.contract_address, alice());
    match safe.execute_batch(BATCH_ID, recipients(), amounts()) {
        Result::Ok(_) => core::panic_with_felt252('Should have panicked'),
        Result::Err(data) => assert_eq!(*data.at(0), 'Vault: transfer failed'),
    }
    stop_cheat_caller_address(s.vault.contract_address);
    // Nothing moved and the batch is still executable once the token recovers.
    assert_eq!(s.vault.get_batch(BATCH_ID).status, BatchStatus::Proposed);
    assert_eq!(s.token.balance_of(s.vault.contract_address), 10_000);
    s.mock.set_fail_transfers(false);
    execute_as(s, alice());
    assert_eq!(s.token.balance_of(addr('contractor_3')), 500);
}

#[test]
fn test_revoke_approval() {
    let s = setup();
    propose_as(s, alice());
    approve_as(s, alice());
    approve_as(s, bob());
    start_cheat_caller_address(s.vault.contract_address, bob());
    s.vault.revoke_approval(BATCH_ID);
    stop_cheat_caller_address(s.vault.contract_address);
    assert_eq!(s.vault.get_batch(BATCH_ID).approvals, 1);
    assert!(!s.vault.has_approved(BATCH_ID, bob()));
}

#[test]
#[should_panic(expected: 'Vault: batch not proposed')]
fn test_cancelled_batch_cannot_execute() {
    let s = approved_setup();
    start_cheat_caller_address(s.vault.contract_address, admin());
    s.vault.cancel_batch(BATCH_ID);
    stop_cheat_caller_address(s.vault.contract_address);
    assert_eq!(s.vault.get_batch(BATCH_ID).status, BatchStatus::Cancelled);
    execute_as(s, alice());
}

#[test]
#[should_panic(expected: 'Vault: not authorised')]
fn test_only_admin_or_proposer_can_cancel() {
    let s = approved_setup();
    start_cheat_caller_address(s.vault.contract_address, bob());
    s.vault.cancel_batch(BATCH_ID);
}

#[test]
fn test_proposer_can_cancel() {
    let s = approved_setup();
    start_cheat_caller_address(s.vault.contract_address, alice());
    s.vault.cancel_batch(BATCH_ID);
    assert_eq!(s.vault.get_batch(BATCH_ID).status, BatchStatus::Cancelled);
}

#[test]
#[should_panic(expected: 'Vault: approver set changed')]
fn test_approver_change_invalidates_pending_batches() {
    let s = approved_setup();
    start_cheat_caller_address(s.vault.contract_address, admin());
    s.vault.add_approver(addr('dave'));
    stop_cheat_caller_address(s.vault.contract_address);
    execute_as(s, alice());
}

#[test]
#[should_panic(expected: 'Vault: caller is not admin')]
fn test_only_admin_manages_approvers() {
    let s = setup();
    start_cheat_caller_address(s.vault.contract_address, alice());
    s.vault.add_approver(outsider());
}

#[test]
#[should_panic(expected: 'Vault: invalid threshold')]
fn test_cannot_remove_approver_below_threshold() {
    let token_address = deploy_token();
    let _ = token_address;
    let vault = IPayrollVaultDispatcher {
        contract_address: deploy_vault(array![alice(), bob()].span(), 2),
    };
    start_cheat_caller_address(vault.contract_address, admin());
    vault.remove_approver(bob());
}

#[test]
fn test_admin_config_changes() {
    let s = setup();
    start_cheat_caller_address(s.vault.contract_address, admin());
    s.vault.remove_approver(carol());
    s.vault.set_threshold(1);
    s.vault.transfer_admin(alice());
    stop_cheat_caller_address(s.vault.contract_address);
    assert_eq!(s.vault.get_approver_count(), 2);
    assert_eq!(s.vault.get_threshold(), 1);
    assert_eq!(s.vault.get_admin(), alice());
    assert_eq!(s.vault.get_config_version(), 2);
}

#[test]
#[should_panic(expected: 'Vault: zero amount')]
fn test_zero_total_rejected() {
    let s = setup();
    start_cheat_caller_address(s.vault.contract_address, alice());
    s.vault.propose_batch(BATCH_ID, s.token.contract_address, 0, 1, 1);
}

#[test]
#[should_panic(expected: 'Vault: too many items')]
fn test_item_limit() {
    let s = setup();
    start_cheat_caller_address(s.vault.contract_address, alice());
    s
        .vault
        .propose_batch(BATCH_ID, s.token.contract_address, 1, PayrollVault::MAX_BATCH_ITEMS + 1, 1);
}

/// Cross-language vector: @veyra/starknet-adapter must produce the same hash.
#[test]
fn test_items_hash_vector() {
    let s = setup();
    let hash = s
        .vault
        .compute_items_hash(
            BATCH_ID,
            0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7.try_into().unwrap(),
            array![0x123.try_into().unwrap(), 0x456.try_into().unwrap()].span(),
            array![1_000_000_u256, u256 { low: 5, high: 1 }].span(),
        );
    println!("items_hash_vector: {:x}", hash);
    assert_eq!(hash, ITEMS_HASH_VECTOR);
}

const ITEMS_HASH_VECTOR: felt252 =
    0x73961680fa988d659b310e4f8c554fd23044994b55bbd9700257f2994a44fe6;
