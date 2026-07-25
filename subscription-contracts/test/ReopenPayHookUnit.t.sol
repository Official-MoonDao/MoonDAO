// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {ReopenPayHook} from "../src/ReopenPayHook.sol";
import {DePrizeRegistry} from "../src/deprize/DePrizeRegistry.sol";
import {IDePrizeRegistry} from "../src/deprize/IDePrizeRegistry.sol";

import {IJBRulesetDataHook} from "@nana-core-v5/interfaces/IJBRulesetDataHook.sol";
import {IJBPayHook} from "@nana-core-v5/interfaces/IJBPayHook.sol";
import {IJBCashOutHook} from "@nana-core-v5/interfaces/IJBCashOutHook.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";
import {JBRuleset} from "@nana-core-v5/structs/JBRuleset.sol";
import {JBTokenAmount} from "@nana-core-v5/structs/JBTokenAmount.sol";
import {JBBeforePayRecordedContext} from "@nana-core-v5/structs/JBBeforePayRecordedContext.sol";
import {JBAfterPayRecordedContext} from "@nana-core-v5/structs/JBAfterPayRecordedContext.sol";
import {JBBeforeCashOutRecordedContext} from "@nana-core-v5/structs/JBBeforeCashOutRecordedContext.sol";
import {JBAfterCashOutRecordedContext} from "@nana-core-v5/structs/JBAfterCashOutRecordedContext.sol";

/// @dev Minimal IJBTerminalStore stand-in: only the two selectors the hook reads.
contract MockTerminalStore {
    uint256 public balance;
    uint256 public withdrawn;

    function setFunding(uint256 _balance, uint256 _withdrawn) external {
        balance = _balance;
        withdrawn = _withdrawn;
    }

    function balanceOf(address, uint256, address) external view returns (uint256) {
        return balance;
    }

    function usedPayoutLimitOf(address, uint256, address, uint256, uint256) external view returns (uint256) {
        return withdrawn;
    }
}

/// @dev Minimal IJBDirectory stand-in: only isTerminalOf, gating the after* hooks.
contract MockDirectory {
    bool public terminalAnswer = true;

    function setIsTerminal(bool v) external {
        terminalAnswer = v;
    }

    function isTerminalOf(uint256, address) external view returns (bool) {
        return terminalAnswer;
    }
}

/// @dev Minimal IJBController stand-in: only DIRECTORY(), used by _requireTerminal.
contract MockController {
    address public directory;

    constructor(address _directory) {
        directory = _directory;
    }

    function DIRECTORY() external view returns (address) {
        return directory;
    }
}

/// @notice Deterministic unit tests for ReopenPayHook branches.
///
/// The fork suite (ReopenRulesetTest) exercises the end-to-end flow against real
/// Juicebox contracts. These unit tests mock the JB terminal store / directory so
/// every guard, view, DePrize branch, and the setDeadline reset (added by the
/// reopen fix) can be tested without an RPC and with full branch coverage.
contract ReopenPayHookUnitTest is Test {
    ReopenPayHook hook;
    DePrizeRegistry registry;
    MockTerminalStore store;
    MockDirectory directory;
    MockController controller;

    address owner = address(0xA11CE);
    address stranger = address(0xBEEF);
    address contributor = address(0xCAFE);

    // Reserved-token allocation holders (vesting + pool deployer): cannot cash out.
    address reserved1 = address(0x111);
    address reserved2 = address(0x222);
    address reserved3 = address(0x333);

    uint256 constant PROJECT = 100; // bound to a DePrize in DePrize tests
    uint256 constant OTHER_PROJECT = 200; // never bound
    bytes32 constant CONDITION = bytes32(uint256(0xC0FFEE));

    uint256 constant FUNDING_GOAL = 10 ether;
    uint256 constant REFUND_PERIOD = 28 days;
    uint256 constant CAMPAIGN_DURATION = 548 days;
    uint256 deadline;

    address constant NATIVE = JBConstants.NATIVE_TOKEN;
    // A non-native token address to exercise the token guard.
    address constant NOT_NATIVE = address(0x12345678);

    function setUp() public {
        deadline = block.timestamp + CAMPAIGN_DURATION;

        store = new MockTerminalStore();
        directory = new MockDirectory();
        controller = new MockController(address(directory));

        DePrizeRegistry impl = new DePrizeRegistry();
        bytes memory initData = abi.encodeCall(DePrizeRegistry.initialize, (owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        registry = DePrizeRegistry(address(proxy));

        hook = _deployHook();
    }

    function _reserved() internal view returns (address[] memory r) {
        r = new address[](3);
        r[0] = reserved1;
        r[1] = reserved2;
        r[2] = reserved3;
    }

    function _deployHook() internal returns (ReopenPayHook) {
        return new ReopenPayHook(
            FUNDING_GOAL,
            deadline,
            REFUND_PERIOD,
            address(store),
            address(0xBEEF01), // jbRulesets (unused by ReopenPayHook)
            address(controller),
            address(0xBEEF02), // jbTokens (unused by ReopenPayHook)
            _reserved(),
            owner
        );
    }

    // ---------------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------------
    function _teams() internal pure returns (uint256[] memory t) {
        t = new uint256[](2);
        t[0] = 1;
        t[1] = 2;
    }

    /// @dev Register a DePrize bound to `projectId` and advance it to `target`.
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

        registry.startVote(id);
        registry.settleWinner(id, 1);
        registry.releaseM1(id);
        if (target == IDePrizeRegistry.DePrizeState.M2_FAILED) {
            registry.failM2(id);
            vm.stopPrank();
            return id;
        }

        revert("unsupported target");
    }

    function _attach() internal {
        vm.prank(owner);
        hook.setDePrizeRegistry(address(registry));
    }

    function _seed(address holder, uint256 eth, uint256 tokens) internal {
        address[] memory h = new address[](1);
        uint256[] memory e = new uint256[](1);
        uint256[] memory t = new uint256[](1);
        h[0] = holder;
        e[0] = eth;
        t[0] = tokens;
        vm.prank(owner);
        hook.seedContributions(h, e, t);
    }

    function _payCtx(uint256 projectId, address token, uint256 value)
        internal
        view
        returns (JBBeforePayRecordedContext memory)
    {
        return JBBeforePayRecordedContext({
            terminal: address(this),
            payer: contributor,
            amount: JBTokenAmount({token: token, decimals: 18, currency: 0, value: value}),
            projectId: projectId,
            rulesetId: 1,
            beneficiary: contributor,
            weight: 1e18,
            reservedPercent: 5000,
            metadata: ""
        });
    }

    function _afterPayCtx(uint256 projectId, address beneficiary, uint256 value, uint256 tokens)
        internal
        pure
        returns (JBAfterPayRecordedContext memory ctx)
    {
        ctx.projectId = projectId;
        ctx.beneficiary = beneficiary;
        ctx.amount = JBTokenAmount({token: NATIVE, decimals: 18, currency: 0, value: value});
        ctx.newlyIssuedTokenCount = tokens;
    }

    function _cashOutCtx(uint256 projectId, address holder, uint256 cashOutCount, uint256 surplus)
        internal
        view
        returns (JBBeforeCashOutRecordedContext memory)
    {
        return JBBeforeCashOutRecordedContext({
            terminal: address(this),
            holder: holder,
            projectId: projectId,
            rulesetId: 1,
            cashOutCount: cashOutCount,
            totalSupply: 0,
            surplus: JBTokenAmount({token: NATIVE, decimals: 18, currency: 0, value: surplus}),
            useTotalSurplus: false,
            cashOutTaxRate: 0,
            metadata: ""
        });
    }

    function _afterCashOutCtx(uint256 projectId, address holder, uint256 cashOutCount, uint256 reclaimed)
        internal
        pure
        returns (JBAfterCashOutRecordedContext memory ctx)
    {
        ctx.projectId = projectId;
        ctx.holder = holder;
        ctx.cashOutCount = cashOutCount;
        ctx.reclaimedAmount = JBTokenAmount({token: NATIVE, decimals: 18, currency: 0, value: reclaimed});
        ctx.beneficiary = payable(holder);
    }

    // ---------------------------------------------------------------------
    // constructor guards
    // ---------------------------------------------------------------------
    function testConstructorRejectsZeroReservedHolder() public {
        address[] memory r = new address[](2);
        r[0] = reserved1;
        r[1] = address(0);
        vm.expectRevert("reserved holder is zero");
        new ReopenPayHook(
            FUNDING_GOAL, deadline, REFUND_PERIOD, address(store), address(1), address(controller), address(2), r, owner
        );
    }

    function testConstructorRejectsDuplicateReservedHolder() public {
        address[] memory r = new address[](2);
        r[0] = reserved1;
        r[1] = reserved1;
        vm.expectRevert("duplicate reserved holder");
        new ReopenPayHook(
            FUNDING_GOAL, deadline, REFUND_PERIOD, address(store), address(1), address(controller), address(2), r, owner
        );
    }

    function testConstructorStoresConfig() public view {
        assertEq(hook.fundingGoal(), FUNDING_GOAL);
        assertEq(hook.deadline(), deadline);
        assertEq(hook.refundPeriod(), REFUND_PERIOD);
        assertEq(hook.owner(), owner);
        assertTrue(hook.isReservedHolder(reserved1));
        assertTrue(hook.isReservedHolder(reserved2));
        assertTrue(hook.isReservedHolder(reserved3));
        assertFalse(hook.isReservedHolder(contributor));
    }

    // ---------------------------------------------------------------------
    // setDeadline (added by the reopen fix)
    // ---------------------------------------------------------------------
    function testSetDeadlineOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", stranger));
        hook.setDeadline(block.timestamp + 10 days);
    }

    function testSetDeadlineRejectsPast() public {
        vm.prank(owner);
        vm.expectRevert("Deadline must be in the future.");
        hook.setDeadline(block.timestamp);
    }

    function testSetDeadlineUpdates() public {
        uint256 newDeadline = block.timestamp + 700 days;
        vm.prank(owner);
        hook.setDeadline(newDeadline);
        assertEq(hook.deadline(), newDeadline);
    }

    // ---------------------------------------------------------------------
    // owner flags
    // ---------------------------------------------------------------------
    function testSetFundingTurnedOffOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", stranger));
        hook.setFundingTurnedOff(true);
    }

    function testEnableRefundsOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", stranger));
        hook.enableRefunds(true);
    }

    /// @dev enableRefunds(true) lets a goal-met project refund after the deadline.
    function testEnableRefundsBypassesGoalGuard() public {
        vm.prank(owner);
        hook.enableRefunds(true);
        assertTrue(hook.refundsEnabled());

        _seed(contributor, 1 ether, 500e18);
        store.setFunding(FUNDING_GOAL, 0); // goal met
        vm.warp(deadline + 1); // past deadline, within refund window

        // Would revert with "goal met" if refunds were not enabled; instead succeeds.
        (,, uint256 totalSupply,) = hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT, contributor, 500e18, 1 ether));
        assertGt(totalSupply, 0);
    }

    // ---------------------------------------------------------------------
    // seedContributions
    // ---------------------------------------------------------------------
    function testSeedOnlyOwner() public {
        address[] memory h = new address[](1);
        uint256[] memory e = new uint256[](1);
        uint256[] memory t = new uint256[](1);
        h[0] = contributor;
        e[0] = 1 ether;
        t[0] = 1000e18;
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", stranger));
        hook.seedContributions(h, e, t);
    }

    function testSeedRejectsZeroAddress() public {
        address[] memory h = new address[](1);
        uint256[] memory e = new uint256[](1);
        uint256[] memory t = new uint256[](1);
        h[0] = address(0);
        e[0] = 1 ether;
        t[0] = 1000e18;
        vm.prank(owner);
        vm.expectRevert("Cannot seed zero address.");
        hook.seedContributions(h, e, t);
    }

    function testSeedRejectsReservedHolder() public {
        address[] memory h = new address[](1);
        uint256[] memory e = new uint256[](1);
        uint256[] memory t = new uint256[](1);
        h[0] = reserved1;
        e[0] = 1 ether;
        t[0] = 1000e18;
        vm.prank(owner);
        vm.expectRevert("Cannot seed a reserved holder.");
        hook.seedContributions(h, e, t);
    }

    function testSeedRejectsOneSided() public {
        address[] memory h = new address[](1);
        uint256[] memory e = new uint256[](1);
        uint256[] memory t = new uint256[](1);
        h[0] = contributor;
        e[0] = 1 ether;
        t[0] = 0; // eth without tokens
        vm.prank(owner);
        vm.expectRevert("Both eth and tokens required.");
        hook.seedContributions(h, e, t);
    }

    function testSeedRejectsLengthMismatch() public {
        address[] memory h = new address[](1);
        uint256[] memory e = new uint256[](2);
        uint256[] memory t = new uint256[](1);
        h[0] = contributor;
        vm.prank(owner);
        vm.expectRevert("Length mismatch.");
        hook.seedContributions(h, e, t);
    }

    function testSeedSetsLedgerAndIsIdempotent() public {
        _seed(contributor, 1 ether, 1000e18);
        assertEq(hook.ethContributed(contributor), 1 ether);
        assertEq(hook.refundableTokens(contributor), 1000e18);

        // Values are SET, not added.
        _seed(contributor, 2 ether, 2000e18);
        assertEq(hook.ethContributed(contributor), 2 ether);
        assertEq(hook.refundableTokens(contributor), 2000e18);
    }

    function testSeedAllowsZeroZero() public {
        // A (0,0) pair is neither eth-only nor token-only, so it is accepted (no-op).
        _seed(contributor, 0, 0);
        assertEq(hook.ethContributed(contributor), 0);
    }

    function testLockLedgerBlocksSeed() public {
        _seed(contributor, 1 ether, 1000e18);
        vm.prank(owner);
        hook.lockLedger();
        assertTrue(hook.ledgerLocked());

        address[] memory h = new address[](1);
        uint256[] memory e = new uint256[](1);
        uint256[] memory t = new uint256[](1);
        h[0] = contributor;
        e[0] = 1 ether;
        t[0] = 1000e18;
        vm.prank(owner);
        vm.expectRevert("Ledger is locked.");
        hook.seedContributions(h, e, t);
    }

    function testSeedBlockedAfterLiveContribution() public {
        // A real pay credits the ledger and flips hasLiveContributions.
        hook.afterPayRecordedWith(_afterPayCtx(PROJECT, contributor, 1 ether, 500e18));
        assertTrue(hook.hasLiveContributions());

        address[] memory h = new address[](1);
        uint256[] memory e = new uint256[](1);
        uint256[] memory t = new uint256[](1);
        h[0] = address(0xD00D);
        e[0] = 1 ether;
        t[0] = 1000e18;
        vm.prank(owner);
        vm.expectRevert("Live contributions recorded; seeding is no longer safe.");
        hook.seedContributions(h, e, t);
    }

    // ---------------------------------------------------------------------
    // setDePrizeRegistry
    // ---------------------------------------------------------------------
    function testSetDePrizeRegistryOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", stranger));
        hook.setDePrizeRegistry(address(registry));
    }

    function testSetDePrizeRegistryRejectsZero() public {
        vm.prank(owner);
        vm.expectRevert("registry is zero");
        hook.setDePrizeRegistry(address(0));
    }

    function testSetDePrizeRegistrySucceeds() public {
        _attach();
        assertEq(address(hook.deprizeRegistry()), address(registry));
    }

    function testSetDePrizeRegistryIsOneWay() public {
        _attach();
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("DePrizeRegistryAlreadySet()"));
        hook.setDePrizeRegistry(address(0xDEAD));
        assertEq(address(hook.deprizeRegistry()), address(registry));
    }

    // ---------------------------------------------------------------------
    // beforePayRecordedWith
    // ---------------------------------------------------------------------
    function testBeforePayFundingTurnedOff() public {
        vm.prank(owner);
        hook.setFundingTurnedOff(true);
        vm.expectRevert("Funding has been turned off.");
        hook.beforePayRecordedWith(_payCtx(PROJECT, NATIVE, 1 ether));
    }

    function testBeforePayRejectsNonNativeToken() public {
        vm.expectRevert();
        hook.beforePayRecordedWith(_payCtx(PROJECT, NOT_NATIVE, 1 ether));
    }

    function testBeforePayRejectsAfterDeadlineUnderGoal() public {
        store.setFunding(1 ether, 0); // under goal
        vm.warp(deadline + 1);
        vm.expectRevert("Project funding deadline has passed and funding goal requirement has not been met.");
        hook.beforePayRecordedWith(_payCtx(PROJECT, NATIVE, 1 ether));
    }

    function testBeforePaySucceedsUnderGoalBeforeDeadline() public {
        store.setFunding(1 ether, 0);
        (uint256 weight, ) = hook.beforePayRecordedWith(_payCtx(PROJECT, NATIVE, 1 ether));
        assertEq(weight, 1e18);
    }

    function testBeforePaySucceedsWhenGoalMetPastDeadline() public {
        // funding >= goal keeps contributions open even past the deadline.
        store.setFunding(FUNDING_GOAL, 0);
        vm.warp(deadline + 1);
        (uint256 weight, ) = hook.beforePayRecordedWith(_payCtx(PROJECT, NATIVE, 1 ether));
        assertEq(weight, 1e18);
    }

    function testBeforePayDePrizeOpenAllowsPastDeadline() public {
        _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.OPEN);
        _attach();
        vm.warp(deadline + 100 days); // registry governs, not the deadline
        (uint256 weight, ) = hook.beforePayRecordedWith(_payCtx(PROJECT, NATIVE, 1 ether));
        assertEq(weight, 1e18);
    }

    function testBeforePayDePrizeTerminalRejects() public {
        _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.CANCELLED); // terminal state
        _attach();
        vm.expectRevert("DePrize is closed to new contributions.");
        hook.beforePayRecordedWith(_payCtx(PROJECT, NATIVE, 1 ether));
    }

    function testBeforePayUnboundProjectUsesOriginalPath() public {
        _registerTo(OTHER_PROJECT, IDePrizeRegistry.DePrizeState.OPEN);
        _attach();
        store.setFunding(1 ether, 0);
        (uint256 weight, ) = hook.beforePayRecordedWith(_payCtx(PROJECT, NATIVE, 1 ether));
        assertEq(weight, 1e18);
    }

    // ---------------------------------------------------------------------
    // afterPayRecordedWith
    // ---------------------------------------------------------------------
    function testAfterPayRejectsNonTerminal() public {
        directory.setIsTerminal(false);
        vm.expectRevert("Caller is not the project terminal.");
        hook.afterPayRecordedWith(_afterPayCtx(PROJECT, contributor, 1 ether, 500e18));
    }

    function testAfterPayRejectsForwardedValue() public {
        vm.deal(address(this), 1 ether);
        vm.expectRevert("Unexpected value forwarded.");
        hook.afterPayRecordedWith{value: 1}(_afterPayCtx(PROJECT, contributor, 1 ether, 500e18));
    }

    function testAfterPayIgnoresReservedBeneficiary() public {
        hook.afterPayRecordedWith(_afterPayCtx(PROJECT, reserved1, 1 ether, 500e18));
        assertEq(hook.ethContributed(reserved1), 0);
        assertEq(hook.refundableTokens(reserved1), 0);
    }

    function testAfterPayCreditsLedger() public {
        hook.afterPayRecordedWith(_afterPayCtx(PROJECT, contributor, 1 ether, 500e18));
        assertEq(hook.ethContributed(contributor), 1 ether);
        assertEq(hook.refundableTokens(contributor), 500e18);
        assertTrue(hook.hasLiveContributions());

        // Accumulates across payments.
        hook.afterPayRecordedWith(_afterPayCtx(PROJECT, contributor, 2 ether, 1000e18));
        assertEq(hook.ethContributed(contributor), 3 ether);
        assertEq(hook.refundableTokens(contributor), 1500e18);
    }

    function testAfterPayZeroValueIsNoop() public {
        hook.afterPayRecordedWith(_afterPayCtx(PROJECT, contributor, 0, 0));
        assertEq(hook.ethContributed(contributor), 0);
        assertFalse(hook.hasLiveContributions());
    }

    // ---------------------------------------------------------------------
    // beforeCashOutRecordedWith
    // ---------------------------------------------------------------------
    function testCashOutReservedHolderReverts() public {
        vm.warp(deadline + 1);
        vm.expectRevert("Reserved token allocations cannot cash out.");
        hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT, reserved1, 500e18, 1 ether));
    }

    function testCashOutGoalMetReverts() public {
        _seed(contributor, 1 ether, 500e18);
        store.setFunding(FUNDING_GOAL, 0);
        vm.warp(deadline + 1);
        vm.expectRevert("Project has passed funding goal requirement. Refunds are disabled.");
        hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT, contributor, 500e18, 1 ether));
    }

    function testCashOutBeforeDeadlineReverts() public {
        _seed(contributor, 1 ether, 500e18);
        store.setFunding(1 ether, 0); // under goal
        vm.expectRevert("Project funding deadline has not passed. Refunds are disabled.");
        hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT, contributor, 500e18, 1 ether));
    }

    function testCashOutAfterRefundPeriodReverts() public {
        _seed(contributor, 1 ether, 500e18);
        store.setFunding(1 ether, 0);
        vm.warp(deadline + REFUND_PERIOD + 1);
        vm.expectRevert("Refund period has passed. Refunds are disabled.");
        hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT, contributor, 500e18, 1 ether));
    }

    function testCashOutNoContributionReverts() public {
        store.setFunding(1 ether, 0);
        vm.warp(deadline + 1);
        vm.expectRevert("No refundable contribution recorded for this holder.");
        hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT, contributor, 500e18, 1 ether));
    }

    function testCashOutExceedsRecordedTokensReverts() public {
        _seed(contributor, 1 ether, 500e18);
        store.setFunding(1 ether, 0);
        vm.warp(deadline + 1);
        vm.expectRevert("Cash out exceeds refundable tokens.");
        hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT, contributor, 501e18, 1 ether));
    }

    function testCashOutInsufficientSurplusReverts() public {
        _seed(contributor, 5 ether, 500e18);
        store.setFunding(1 ether, 0);
        vm.warp(deadline + 1);
        // surplus (1) far below the holder's 5 ETH contribution -> totalSupply < cashOutCount.
        vm.expectRevert("Insufficient surplus to honor refund.");
        hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT, contributor, 500e18, 1));
    }

    function testCashOutSuccessComputesSupply() public {
        _seed(contributor, 1 ether, 500e18);
        store.setFunding(1 ether, 0);
        vm.warp(deadline + 1);
        (uint256 taxRate, uint256 cashOutCount, uint256 totalSupply,) =
            hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT, contributor, 500e18, 1 ether));
        assertEq(taxRate, 0);
        assertEq(cashOutCount, 500e18);
        // ceil(surplus * tokens / contributed) = ceil(1e18 * 500e18 / 1e18) = 500e18
        assertEq(totalSupply, 500e18);
    }

    function testCashOutDePrizeActiveReverts() public {
        _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.OPEN);
        _attach();
        _seed(contributor, 1 ether, 500e18);
        vm.expectRevert("DePrize is active. Refunds are disabled.");
        hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT, contributor, 500e18, 1 ether));
    }

    function testCashOutDePrizeRefundableFallsThrough() public {
        _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.NO_WINNER); // refundable terminal state
        _attach();
        _seed(contributor, 1 ether, 500e18);
        // DePrize refundable bypasses the deadline gate: still before deadline here.
        (, uint256 cashOutCount, uint256 totalSupply,) =
            hook.beforeCashOutRecordedWith(_cashOutCtx(PROJECT, contributor, 500e18, 1 ether));
        assertEq(cashOutCount, 500e18);
        assertEq(totalSupply, 500e18);
    }

    // ---------------------------------------------------------------------
    // afterCashOutRecordedWith
    // ---------------------------------------------------------------------
    function testAfterCashOutRejectsNonTerminal() public {
        directory.setIsTerminal(false);
        vm.expectRevert("Caller is not the project terminal.");
        hook.afterCashOutRecordedWith(_afterCashOutCtx(PROJECT, contributor, 500e18, 1 ether));
    }

    function testAfterCashOutRejectsForwardedValue() public {
        vm.deal(address(this), 1 ether);
        vm.expectRevert("Unexpected value forwarded.");
        hook.afterCashOutRecordedWith{value: 1}(_afterCashOutCtx(PROJECT, contributor, 500e18, 1 ether));
    }

    function testAfterCashOutDecrementsLedgerPartial() public {
        _seed(contributor, 2 ether, 1000e18);
        hook.afterCashOutRecordedWith(_afterCashOutCtx(PROJECT, contributor, 500e18, 1 ether));
        assertEq(hook.refundableTokens(contributor), 500e18);
        assertEq(hook.ethContributed(contributor), 1 ether);
    }

    function testAfterCashOutDecrementsLedgerFull() public {
        _seed(contributor, 2 ether, 1000e18);
        // Burn/reclaim >= recorded clamps both sides to zero.
        hook.afterCashOutRecordedWith(_afterCashOutCtx(PROJECT, contributor, 1000e18, 2 ether));
        assertEq(hook.refundableTokens(contributor), 0);
        assertEq(hook.ethContributed(contributor), 0);
    }

    function testAfterCashOutOverBurnClampsToZero() public {
        _seed(contributor, 2 ether, 1000e18);
        hook.afterCashOutRecordedWith(_afterCashOutCtx(PROJECT, contributor, 5000e18, 10 ether));
        assertEq(hook.refundableTokens(contributor), 0);
        assertEq(hook.ethContributed(contributor), 0);
    }

    // ---------------------------------------------------------------------
    // stage
    // ---------------------------------------------------------------------
    function testStageActiveBeforeDeadline() public {
        store.setFunding(1 ether, 0); // under goal, before deadline
        assertEq(hook.stage(address(this), PROJECT), 1);
    }

    function testStageGoalMet() public {
        store.setFunding(FUNDING_GOAL, 0);
        assertEq(hook.stage(address(this), PROJECT), 2);
    }

    function testStageRefundWindow() public {
        store.setFunding(1 ether, 0);
        vm.warp(deadline + 1);
        assertEq(hook.stage(address(this), PROJECT), 3);
    }

    function testStageRefundExpired() public {
        store.setFunding(1 ether, 0);
        vm.warp(deadline + REFUND_PERIOD + 1);
        assertEq(hook.stage(address(this), PROJECT), 4);
    }

    function testStageWithdrawnCountsTowardGoal() public {
        // balance below goal, but balance + withdrawn >= goal -> goal met (stage 2).
        store.setFunding(4 ether, 6 ether);
        assertEq(hook.stage(address(this), PROJECT), 2);
    }

    function testStageDePrizeActive() public {
        _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.OPEN);
        _attach();
        assertEq(hook.stage(address(this), PROJECT), 1);
    }

    function testStageDePrizeRefundable() public {
        _registerTo(PROJECT, IDePrizeRegistry.DePrizeState.NO_WINNER);
        _attach();
        assertEq(hook.stage(address(this), PROJECT), 3);
    }

    // ---------------------------------------------------------------------
    // boilerplate views
    // ---------------------------------------------------------------------
    function testSupportsInterface() public view {
        assertTrue(hook.supportsInterface(type(IJBRulesetDataHook).interfaceId));
        assertTrue(hook.supportsInterface(type(IJBPayHook).interfaceId));
        assertTrue(hook.supportsInterface(type(IJBCashOutHook).interfaceId));
        assertTrue(hook.supportsInterface(type(IERC165).interfaceId));
        assertFalse(hook.supportsInterface(0xffffffff));
    }

    function testHasMintPermissionForIsFalse() public view {
        JBRuleset memory r;
        assertFalse(hook.hasMintPermissionFor(PROJECT, r, contributor));
    }
}
