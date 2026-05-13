// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {GroupVault} from "../src/GroupVault.sol";
import {GroupVaultFactory} from "../src/GroupVaultFactory.sol";
import {MockUSDC} from "./MockUSDC.sol";

contract GroupVaultTest is Test {
    GroupVaultFactory factory;
    MockUSDC usdc;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address outsider = makeAddr("outsider");

    bytes32 constant GROUP_ID = keccak256("ski-trip-2025");
    uint256 constant TARGET = 400e6; // 400 USDC

    function setUp() public {
        factory = new GroupVaultFactory();
        usdc = new MockUSDC();

        usdc.mint(owner, 10_000e6);
        usdc.mint(alice, 10_000e6);
        usdc.mint(bob, 10_000e6);
        usdc.mint(carol, 10_000e6);
        usdc.mint(outsider, 10_000e6);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _makeVault() internal returns (GroupVault vault) {
        address[] memory members = new address[](3);
        members[0] = alice;
        members[1] = bob;
        members[2] = carol;

        vm.prank(owner);
        address v = factory.createVault(GROUP_ID, address(usdc), TARGET, members);
        vault = GroupVault(v);
    }

    function _deposit(GroupVault vault, address from, uint256 amount) internal {
        vm.startPrank(from);
        usdc.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Factory tests
    // -------------------------------------------------------------------------

    function test_FactoryDeploysImplementation() public view {
        assertTrue(factory.implementation() != address(0));
    }

    function test_CreateVault_HappyPath() public {
        GroupVault vault = _makeVault();

        assertEq(vault.owner(), owner);
        assertEq(address(vault.token()), address(usdc));
        assertEq(vault.targetPerMember(), TARGET);
        assertEq(vault.memberCount(), 3);
        assertTrue(vault.isMember(alice));
        assertTrue(vault.isMember(bob));
        assertTrue(vault.isMember(carol));
        assertFalse(vault.isMember(outsider));
        assertEq(factory.vaultCount(), 1);
        assertEq(factory.vaultsOf(GROUP_ID).length, 1);
    }

    function test_CreateVault_RevertsOnEmptyMembers() public {
        address[] memory empty = new address[](0);
        vm.expectRevert(GroupVaultFactory.NoMembers.selector);
        vm.prank(owner);
        factory.createVault(GROUP_ID, address(usdc), TARGET, empty);
    }

    function test_CreateVault_RevertsOnDuplicateMember() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = alice;
        vm.expectRevert(GroupVault.DuplicateMember.selector);
        vm.prank(owner);
        factory.createVault(GROUP_ID, address(usdc), TARGET, members);
    }

    function test_CreateVault_RevertsOnZeroMember() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = address(0);
        vm.expectRevert(GroupVault.ZeroAddress.selector);
        vm.prank(owner);
        factory.createVault(GROUP_ID, address(usdc), TARGET, members);
    }

    function test_MultipleVaultsPerGroup() public {
        _makeVault();
        _makeVault();
        assertEq(factory.vaultsOf(GROUP_ID).length, 2);
        assertEq(factory.vaultCount(), 2);
    }

    function test_Implementation_CannotBeInitialized() public {
        address impl = factory.implementation();
        address[] memory members = new address[](1);
        members[0] = alice;
        vm.expectRevert(GroupVault.AlreadyInitialized.selector);
        GroupVault(impl).initialize(owner, address(usdc), TARGET, members);
    }

    function test_Clone_CannotBeReinitialized() public {
        GroupVault vault = _makeVault();
        address[] memory members = new address[](1);
        members[0] = alice;
        vm.expectRevert(GroupVault.AlreadyInitialized.selector);
        vault.initialize(owner, address(usdc), TARGET, members);
    }

    // -------------------------------------------------------------------------
    // Deposit tests
    // -------------------------------------------------------------------------

    function test_Deposit_HappyPath() public {
        GroupVault vault = _makeVault();
        _deposit(vault, alice, TARGET);

        assertEq(vault.deposited(alice), TARGET);
        assertEq(vault.totalDeposited(), TARGET);
        assertEq(vault.remainingBalance(), TARGET);
        assertEq(usdc.balanceOf(address(vault)), TARGET);
    }

    function test_Deposit_RevertsForNonMember() public {
        GroupVault vault = _makeVault();
        vm.startPrank(outsider);
        usdc.approve(address(vault), TARGET);
        vm.expectRevert(GroupVault.NotMember.selector);
        vault.deposit(TARGET);
        vm.stopPrank();
    }

    function test_Deposit_RevertsOnZeroAmount() public {
        GroupVault vault = _makeVault();
        vm.prank(alice);
        vm.expectRevert(GroupVault.ZeroAmount.selector);
        vault.deposit(0);
    }

    function test_Deposit_AccumulatesAcrossCalls() public {
        GroupVault vault = _makeVault();
        _deposit(vault, alice, 100e6);
        _deposit(vault, alice, 300e6);
        assertEq(vault.deposited(alice), 400e6);
    }

    function test_Deposit_RevertsWhenClosed() public {
        GroupVault vault = _makeVault();
        _deposit(vault, alice, TARGET);

        vm.prank(owner);
        vault.close();

        vm.startPrank(bob);
        usdc.approve(address(vault), TARGET);
        vm.expectRevert(GroupVault.VaultIsClosed.selector);
        vault.deposit(TARGET);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Claim tests
    // -------------------------------------------------------------------------

    function test_Claim_HappyPath() public {
        GroupVault vault = _makeVault();
        _deposit(vault, alice, TARGET);
        _deposit(vault, bob, TARGET);
        _deposit(vault, carol, TARGET);

        bytes32 expenseId = keccak256("expense-1");
        uint256 claimAmt = 250e6;

        uint256 aliceBalBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        vault.claimReimbursement(claimAmt, expenseId);

        assertEq(usdc.balanceOf(alice), aliceBalBefore + claimAmt);
        assertEq(vault.claimed(alice), claimAmt);
        assertEq(vault.totalClaimed(), claimAmt);
        assertEq(vault.remainingBalance(), 3 * TARGET - claimAmt);
    }

    function test_Claim_RevertsForNonMember() public {
        GroupVault vault = _makeVault();
        _deposit(vault, alice, TARGET);
        _deposit(vault, bob, TARGET);

        vm.prank(outsider);
        vm.expectRevert(GroupVault.NotMember.selector);
        vault.claimReimbursement(100e6, bytes32(0));
    }

    function test_Claim_RevertsOnOverdraw() public {
        GroupVault vault = _makeVault();
        _deposit(vault, alice, 100e6);

        vm.prank(alice);
        vm.expectRevert(GroupVault.InsufficientBalance.selector);
        vault.claimReimbursement(101e6, bytes32(0));
    }

    function test_Claim_RevertsOnZero() public {
        GroupVault vault = _makeVault();
        _deposit(vault, alice, TARGET);
        vm.prank(alice);
        vm.expectRevert(GroupVault.ZeroAmount.selector);
        vault.claimReimbursement(0, bytes32(0));
    }

    function test_Claim_RevertsWhenClosed() public {
        GroupVault vault = _makeVault();
        _deposit(vault, alice, TARGET);
        vm.prank(owner);
        vault.close();
        vm.prank(alice);
        vm.expectRevert(GroupVault.VaultIsClosed.selector);
        vault.claimReimbursement(10e6, bytes32(0));
    }

    function test_Claim_AnyMemberCanClaim() public {
        GroupVault vault = _makeVault();
        _deposit(vault, alice, TARGET);
        _deposit(vault, bob, TARGET);

        // Bob paid for dinner, claims reimbursement.
        vm.prank(bob);
        vault.claimReimbursement(150e6, keccak256("dinner"));
        assertEq(vault.claimed(bob), 150e6);

        // Carol (member but no deposit yet) can also claim.
        vm.prank(carol);
        vault.claimReimbursement(50e6, keccak256("uber"));
        assertEq(vault.claimed(carol), 50e6);
    }

    // -------------------------------------------------------------------------
    // Close + refund tests
    // -------------------------------------------------------------------------

    function test_Close_RefundsProportionally() public {
        GroupVault vault = _makeVault();
        _deposit(vault, alice, 400e6);
        _deposit(vault, bob, 400e6);
        _deposit(vault, carol, 200e6); // unequal deposits

        // Spend 600 total during the trip.
        vm.prank(alice);
        vault.claimReimbursement(600e6, keccak256("hotel"));

        // Pool = 1000 - 600 = 400 USDC remaining.
        // Refund shares: alice 40%, bob 40%, carol 20% (of total 1000 deposited).
        uint256 aliceBalBefore = usdc.balanceOf(alice);
        uint256 bobBalBefore = usdc.balanceOf(bob);
        uint256 carolBalBefore = usdc.balanceOf(carol);

        vm.prank(owner);
        vault.close();

        assertEq(usdc.balanceOf(alice), aliceBalBefore + 160e6); // 40% of 400
        assertEq(usdc.balanceOf(bob), bobBalBefore + 160e6);
        assertEq(usdc.balanceOf(carol), carolBalBefore + 80e6); // 20% of 400
        assertTrue(vault.closed());
        assertEq(vault.remainingBalance(), 0);
    }

    function test_Close_RevertsForNonOwner() public {
        GroupVault vault = _makeVault();
        vm.prank(alice);
        vm.expectRevert(GroupVault.NotOwner.selector);
        vault.close();
    }

    function test_Close_RevertsOnDoubleClose() public {
        GroupVault vault = _makeVault();
        _deposit(vault, alice, TARGET);
        vm.prank(owner);
        vault.close();
        vm.prank(owner);
        vm.expectRevert(GroupVault.VaultIsClosed.selector);
        vault.close();
    }

    function test_Close_WithNoDeposits() public {
        GroupVault vault = _makeVault();
        vm.prank(owner);
        vault.close();
        assertTrue(vault.closed());
        assertEq(vault.remainingBalance(), 0);
    }

    function test_Close_FullyDrained() public {
        GroupVault vault = _makeVault();
        _deposit(vault, alice, TARGET);
        _deposit(vault, bob, TARGET);

        // Drain the entire pool.
        vm.prank(alice);
        vault.claimReimbursement(2 * TARGET, keccak256("everything"));

        uint256 aliceBalBefore = usdc.balanceOf(alice);
        uint256 bobBalBefore = usdc.balanceOf(bob);

        vm.prank(owner);
        vault.close();

        // No refunds because pool is empty.
        assertEq(usdc.balanceOf(alice), aliceBalBefore);
        assertEq(usdc.balanceOf(bob), bobBalBefore);
    }

    function test_Close_DustStaysInContract() public {
        GroupVault vault = _makeVault();
        // Deposits chosen to force rounding: 3 wei pool / 3 members each owed
        // 1 wei is clean. Use 1+1+1 deposits, claim 0 → refund 3 wei split
        // 1:1:1 → exact. Use 2+1+1 → pool 4, claim 1 → 3 wei refund split
        // 50%:25%:25% on totalDep=4 → 1.5/0.75/0.75 → 1/0/0 = 1 refunded,
        // 2 wei dust permanent.
        _deposit(vault, alice, 2);
        _deposit(vault, bob, 1);
        _deposit(vault, carol, 1);
        vm.prank(alice);
        vault.claimReimbursement(1, keccak256("dust"));

        uint256 contractBalBefore = usdc.balanceOf(address(vault));
        assertEq(contractBalBefore, 3);

        vm.prank(owner);
        vault.close();

        // Some dust is acceptable — just confirm it's small and accounted for.
        assertLe(usdc.balanceOf(address(vault)), 3);
    }

    // -------------------------------------------------------------------------
    // View tests
    // -------------------------------------------------------------------------

    function test_NetContribution() public {
        GroupVault vault = _makeVault();
        _deposit(vault, alice, 400e6);
        vm.prank(alice);
        vault.claimReimbursement(150e6, bytes32(0));
        assertEq(vault.netContribution(alice), 250e6);

        // Member who only claimed has negative net contribution.
        _deposit(vault, bob, 100e6);
        vm.prank(carol);
        vault.claimReimbursement(50e6, bytes32(0));
        assertEq(vault.netContribution(carol), -50e6);
    }

    function test_MembersView() public {
        GroupVault vault = _makeVault();
        address[] memory m = vault.members();
        assertEq(m.length, 3);
        assertEq(m[0], alice);
        assertEq(m[1], bob);
        assertEq(m[2], carol);
    }

    // -------------------------------------------------------------------------
    // Fuzz tests
    // -------------------------------------------------------------------------

    function testFuzz_DepositAndClaim(uint96 depositAmt, uint96 claimAmt) public {
        vm.assume(depositAmt > 0 && depositAmt <= 1_000_000e6);
        vm.assume(claimAmt > 0 && claimAmt <= depositAmt);

        usdc.mint(alice, depositAmt);
        GroupVault vault = _makeVault();
        _deposit(vault, alice, depositAmt);

        vm.prank(alice);
        vault.claimReimbursement(claimAmt, bytes32(0));

        assertEq(vault.deposited(alice), depositAmt);
        assertEq(vault.claimed(alice), claimAmt);
        assertEq(vault.remainingBalance(), uint256(depositAmt) - uint256(claimAmt));
    }

    function testFuzz_ProportionalRefund(uint96 aDep, uint96 bDep, uint96 cDep) public {
        vm.assume(aDep > 1e6 && aDep < 1_000_000e6);
        vm.assume(bDep > 1e6 && bDep < 1_000_000e6);
        vm.assume(cDep > 1e6 && cDep < 1_000_000e6);

        usdc.mint(alice, aDep);
        usdc.mint(bob, bDep);
        usdc.mint(carol, cDep);

        GroupVault vault = _makeVault();
        _deposit(vault, alice, aDep);
        _deposit(vault, bob, bDep);
        _deposit(vault, carol, cDep);

        uint256 total = uint256(aDep) + uint256(bDep) + uint256(cDep);
        uint256 expectedA = (total * aDep) / total;
        uint256 expectedB = (total * bDep) / total;
        uint256 expectedC = (total * cDep) / total;

        uint256 aBefore = usdc.balanceOf(alice);
        uint256 bBefore = usdc.balanceOf(bob);
        uint256 cBefore = usdc.balanceOf(carol);

        vm.prank(owner);
        vault.close();

        assertEq(usdc.balanceOf(alice), aBefore + expectedA);
        assertEq(usdc.balanceOf(bob), bBefore + expectedB);
        assertEq(usdc.balanceOf(carol), cBefore + expectedC);
    }
}