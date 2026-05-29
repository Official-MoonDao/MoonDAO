// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {DePrizeMilestoneEscrow} from "../../src/deprize/DePrizeMilestoneEscrow.sol";
import {DePrizeRegistry} from "../../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";

/// @dev Records addToBalanceOf calls; only the selector the escrow uses is real.
contract MockJBTerminal {
    uint256 public lastProjectId;
    uint256 public lastAmount;
    uint256 public received;

    function addToBalanceOf(
        uint256 projectId,
        address,
        uint256 amount,
        bool,
        string calldata,
        bytes calldata
    ) external payable {
        lastProjectId = projectId;
        lastAmount = amount;
        received += msg.value;
    }
}

contract DePrizeMilestoneEscrowTest is Test {
    DePrizeMilestoneEscrow escrow;
    DePrizeRegistry registry;
    MockJBTerminal terminal;

    address owner = address(0xA11CE);
    address stranger = address(0xBEEF);
    address provider = address(0x9F0);
    address treasury = address(0x7EA);

    uint256 constant PROJECT = 100;
    bytes32 constant CONDITION = bytes32(uint256(0xC0FFEE));
    uint256 constant DEPOSIT = 10 ether;

    function setUp() public {
        DePrizeRegistry rImpl = new DePrizeRegistry();
        ERC1967Proxy rProxy = new ERC1967Proxy(address(rImpl), abi.encodeCall(DePrizeRegistry.initialize, (owner)));
        registry = DePrizeRegistry(address(rProxy));

        terminal = new MockJBTerminal();

        DePrizeMilestoneEscrow eImpl = new DePrizeMilestoneEscrow();
        ERC1967Proxy eProxy = new ERC1967Proxy(
            address(eImpl),
            abi.encodeCall(DePrizeMilestoneEscrow.initialize, (owner, address(registry), address(terminal), treasury))
        );
        escrow = DePrizeMilestoneEscrow(payable(address(eProxy)));

        vm.deal(address(this), 1_000 ether);
    }

    // ---------------------------------------------------------------------
    // lifecycle helper (mirrors the registry tests)
    // ---------------------------------------------------------------------
    function _teams() internal pure returns (uint256[] memory t) {
        t = new uint256[](2);
        t[0] = 1;
        t[1] = 2;
    }

    function _registerTo(uint256 projectId, IDePrizeRegistry.DePrizeState target) internal returns (uint256 id) {
        vm.startPrank(owner);
        id = registry.register(projectId, _teams(), block.timestamp + 30 days);

        if (target == IDePrizeRegistry.DePrizeState.DRAFT) {
            vm.stopPrank();
            return id;
        }

        registry.setCondition(id, CONDITION);
        registry.open(id);
        if (target == IDePrizeRegistry.DePrizeState.OPEN) {
            vm.stopPrank();
            return id;
        }

        if (target == IDePrizeRegistry.DePrizeState.CANCELLED) {
            registry.announceCancellation(id);
            vm.warp(block.timestamp + registry.CANCELLATION_NOTICE());
            registry.cancel(id);
            vm.stopPrank();
            return id;
        }

        registry.lock(id);
        if (target == IDePrizeRegistry.DePrizeState.LOCKED) {
            vm.stopPrank();
            return id;
        }
        if (target == IDePrizeRegistry.DePrizeState.NO_WINNER) {
            registry.settleNoWinner(id);
            vm.stopPrank();
            return id;
        }

        registry.settleWinner(id, 1);
        if (target == IDePrizeRegistry.DePrizeState.SETTLED) {
            vm.stopPrank();
            return id;
        }

        registry.releaseM1(id);
        if (target == IDePrizeRegistry.DePrizeState.M1_RELEASED) {
            vm.stopPrank();
            return id;
        }
        if (target == IDePrizeRegistry.DePrizeState.M2_FAILED) {
            registry.failM2(id);
            vm.stopPrank();
            return id;
        }
        if (target == IDePrizeRegistry.DePrizeState.M2_COMPLETE) {
            registry.completeM2(id);
            vm.stopPrank();
            return id;
        }

        revert("unsupported target");
    }

    function _setRecipient(uint256 id, address r) internal {
        vm.prank(owner);
        escrow.setProviderRecipient(id, r);
    }

    // ---------------------------------------------------------------------
    // init / config
    // ---------------------------------------------------------------------
    function testInitialState() public view {
        assertEq(address(escrow.registry()), address(registry));
        assertEq(address(escrow.jbTerminal()), address(terminal));
        assertEq(escrow.moonDAOTreasury(), treasury);
        assertEq(escrow.owner(), owner);
        assertEq(escrow.M1_BPS(), 3_000);
    }

    function testCannotReinitialize() public {
        vm.expectRevert();
        escrow.initialize(owner, address(registry), address(terminal), treasury);
    }

    function testSettersOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", stranger));
        escrow.setMoonDAOTreasury(address(0x1234));

        vm.prank(owner);
        escrow.setMoonDAOTreasury(address(0x1234));
        assertEq(escrow.moonDAOTreasury(), address(0x1234));
    }

    // ---------------------------------------------------------------------
    // deposit
    // ---------------------------------------------------------------------
    function testDepositCreditsBalance() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.OPEN);
        escrow.deposit{value: DEPOSIT}(id);
        assertEq(escrow.deposited(id), DEPOSIT);
        assertEq(escrow.pendingBalance(id), DEPOSIT);
        assertEq(address(escrow).balance, DEPOSIT);
    }

    function testDepositUnknownReverts() public {
        vm.expectRevert(abi.encodeWithSignature("UnknownDePrize(uint256)", uint256(999)));
        escrow.deposit{value: 1 ether}(999);
    }

    function testDepositZeroReverts() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.OPEN);
        vm.expectRevert(abi.encodeWithSignature("ZeroAmount()"));
        escrow.deposit{value: 0}(id);
    }

    function testReceiveReverts() public {
        (bool ok,) = address(escrow).call{value: 1 ether}("");
        assertFalse(ok);
    }

    // ---------------------------------------------------------------------
    // provider recipient
    // ---------------------------------------------------------------------
    function testSetProviderRecipientRequiresWinner() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.OPEN);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("NoWinnerDeclared(uint256)", id));
        escrow.setProviderRecipient(id, provider);
    }

    function testSetProviderRecipientOnlyOwner() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.SETTLED);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", stranger));
        escrow.setProviderRecipient(id, provider);
    }

    // ---------------------------------------------------------------------
    // releaseM1 (30%)
    // ---------------------------------------------------------------------
    function testReleaseM1Pays30Percent() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.M1_RELEASED);
        _setRecipient(id, provider);
        escrow.deposit{value: DEPOSIT}(id);

        escrow.releaseM1(id);

        assertEq(provider.balance, 3 ether);
        assertEq(escrow.released(id), 3 ether);
        assertEq(escrow.pendingBalance(id), 7 ether);
        assertTrue(escrow.m1Released(id));
    }

    function testReleaseM1WrongStateReverts() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.SETTLED);
        _setRecipient(id, provider);
        escrow.deposit{value: DEPOSIT}(id);
        vm.expectRevert();
        escrow.releaseM1(id);
    }

    function testReleaseM1NoRecipientReverts() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.M1_RELEASED);
        escrow.deposit{value: DEPOSIT}(id);
        vm.expectRevert(abi.encodeWithSignature("RecipientNotSet(uint256)", id));
        escrow.releaseM1(id);
    }

    function testReleaseM1Twice() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.M1_RELEASED);
        _setRecipient(id, provider);
        escrow.deposit{value: DEPOSIT}(id);
        escrow.releaseM1(id);
        vm.expectRevert(abi.encodeWithSignature("AlreadyReleasedM1(uint256)", id));
        escrow.releaseM1(id);
    }

    function testSetRecipientAfterM1Reverts() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.M1_RELEASED);
        _setRecipient(id, provider);
        escrow.deposit{value: DEPOSIT}(id);
        escrow.releaseM1(id);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("AlreadyReleasedM1(uint256)", id));
        escrow.setProviderRecipient(id, stranger);
    }

    // ---------------------------------------------------------------------
    // releaseM2 (remainder)
    // ---------------------------------------------------------------------
    function testReleaseM2PaysRemainderAfterM1() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.M1_RELEASED);
        _setRecipient(id, provider);
        escrow.deposit{value: DEPOSIT}(id);
        escrow.releaseM1(id);

        vm.prank(owner);
        registry.completeM2(id);
        escrow.releaseM2(id);

        assertEq(provider.balance, DEPOSIT); // 3 + 7
        assertEq(escrow.pendingBalance(id), 0);
        assertTrue(escrow.finalized(id));
    }

    function testReleaseM2WithoutM1PaysAll() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.M2_COMPLETE);
        _setRecipient(id, provider);
        escrow.deposit{value: DEPOSIT}(id);

        escrow.releaseM2(id);

        assertEq(provider.balance, DEPOSIT);
        assertEq(escrow.pendingBalance(id), 0);
    }

    function testReleaseM2Finalized() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.M2_COMPLETE);
        _setRecipient(id, provider);
        escrow.deposit{value: DEPOSIT}(id);
        escrow.releaseM2(id);
        vm.expectRevert(abi.encodeWithSignature("AlreadyFinalized(uint256)", id));
        escrow.releaseM2(id);
    }

    // ---------------------------------------------------------------------
    // M2_FAILED -> treasury
    // ---------------------------------------------------------------------
    function testReturnToTreasuryOnM2Failed() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.M1_RELEASED);
        _setRecipient(id, provider);
        escrow.deposit{value: DEPOSIT}(id);
        escrow.releaseM1(id); // provider gets 3 ETH

        vm.prank(owner);
        registry.failM2(id);
        escrow.returnToTreasury(id);

        assertEq(provider.balance, 3 ether);
        assertEq(treasury.balance, 7 ether);
        assertEq(escrow.pendingBalance(id), 0);
        assertTrue(escrow.finalized(id));
    }

    function testReturnToTreasuryWrongStateReverts() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.M2_COMPLETE);
        escrow.deposit{value: DEPOSIT}(id);
        vm.expectRevert();
        escrow.returnToTreasury(id);
    }

    // ---------------------------------------------------------------------
    // refundToJB on CANCELLED / NO_WINNER
    // ---------------------------------------------------------------------
    function testRefundToJBOnCancelled() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.CANCELLED);
        escrow.deposit{value: DEPOSIT}(id);

        escrow.refundToJB(id);

        assertEq(terminal.received(), DEPOSIT);
        assertEq(terminal.lastProjectId(), PROJECT);
        assertEq(terminal.lastAmount(), DEPOSIT);
        assertEq(escrow.pendingBalance(id), 0);
        assertTrue(escrow.finalized(id));
    }

    function testRefundToJBOnNoWinner() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.NO_WINNER);
        escrow.deposit{value: DEPOSIT}(id);
        escrow.refundToJB(id);
        assertEq(terminal.received(), DEPOSIT);
        assertEq(terminal.lastProjectId(), PROJECT);
    }

    function testRefundToJBWrongStateReverts() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.M2_COMPLETE);
        escrow.deposit{value: DEPOSIT}(id);
        vm.expectRevert();
        escrow.refundToJB(id);
    }

    function testDepositAfterFinalizedReverts() public {
        uint256 id = _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.CANCELLED);
        escrow.deposit{value: DEPOSIT}(id);
        escrow.refundToJB(id);
        vm.expectRevert(abi.encodeWithSignature("AlreadyFinalized(uint256)", id));
        escrow.deposit{value: 1 ether}(id);
    }
}
