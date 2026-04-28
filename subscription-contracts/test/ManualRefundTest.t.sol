// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Vesting} from "../src/Vesting.sol";
import {PoolDeployer} from "../src/PoolDeployer.sol";
import "@nana-core-v5/interfaces/IJBRulesetApprovalHook.sol";
import {JBRuleset} from "@nana-core-v5/structs/JBRuleset.sol";
import {IWETH9} from "v4-periphery/src/interfaces/external/IWETH9.sol";
import {WETH} from "solmate/src/tokens/WETH.sol";
import {IJBRulesets} from "@nana-core-v5/interfaces/IJBRulesets.sol";
import {IJBMultiTerminal} from "@nana-core-v5/interfaces/IJBMultiTerminal.sol";
import {IJBDirectory} from "@nana-core-v5/interfaces/IJBDirectory.sol";
import {MoonDAOTeam} from "../src/ERC5643.sol";
import {GnosisSafeProxyFactory} from "../src/GnosisSafeProxyFactory.sol";
import {MissionCreator} from "../src/MissionCreator.sol";
import {MissionTable} from "../src/tables/MissionTable.sol";
import {MoonDaoTeamTableland} from "../src/tables/MoonDaoTeamTableland.sol";
import {MoonDAOTeamCreator} from "../src/MoonDAOTeamCreator.sol";
import {LaunchPadPayHook} from "../src/LaunchPadPayHook.sol";
import {LaunchPadApprovalHook} from "../src/LaunchPadApprovalHook.sol";
import {PassthroughModule} from "../src/PassthroughModule.sol";
import {IHats} from "@hats/Interfaces/IHats.sol";
import {Hats} from "@hats/Hats.sol";
import {HatsModuleFactory} from "@hats-module/HatsModuleFactory.sol";
import {deployModuleFactory} from "@hats-module/utils/DeployFunctions.sol";
import {Whitelist} from "../src/Whitelist.sol";
import {IJBTerminal} from "@nana-core-v5/interfaces/IJBTerminal.sol";
import {IJBTokens} from "@nana-core-v5/interfaces/IJBTokens.sol";
import {IJBProjects} from "@nana-core-v5/interfaces/IJBProjects.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";
import {IJBController} from "@nana-core-v5/interfaces/IJBController.sol";
import {IJBTerminalStore} from "@nana-core-v5/interfaces/IJBTerminalStore.sol";
import {JBRulesetConfig} from "@nana-core-v5/structs/JBRulesetConfig.sol";
import {JBRulesetMetadata} from "@nana-core-v5/structs/JBRulesetMetadata.sol";
import {JBSplitGroup} from "@nana-core-v5/structs/JBSplitGroup.sol";
import {JBSplit} from "@nana-core-v5/structs/JBSplit.sol";
import {JBFundAccessLimitGroup} from "@nana-core-v5/structs/JBFundAccessLimitGroup.sol";
import {JBCurrencyAmount} from "@nana-core-v5/structs/JBCurrencyAmount.sol";
import {IJBSplitHook} from "@nana-core-v5/interfaces/IJBSplitHook.sol";
import "base/Config.sol";

/// @title ManualRefundTest
/// @notice Tests the manual refund flow for missions launched with refunds disabled.
///
/// Scenario: A mission has intermediate goals and was launched with refunds disabled.
/// The mission doesn't reach its goal. The team multisig (project owner) needs to:
///   1. Deploy new pay hook and approval hook with fresh timing for the refund window.
///   2. Queue a new ruleset (copy of ruleset 0) that uses the new hooks.
///   3. Enable refunds on the new hooks so the approval hook keeps returning Failed
///      (staying on the refund ruleset) during the refund window.
///   4. Contributors can then cash out (refund) their tokens.
contract ManualRefundTest is Test, Config {

    address zero = address(0);
    address user1 = address(0x100);
    address teamAddress = address(0x200);
    address user2 = address(0x300);
    address contributor1 = address(0x500);
    address contributor2 = address(0x600);
    address TREASURY = address(0x400);

    bytes32 internal constant SALT = bytes32(abi.encode(0x4a75));

    MoonDAOTeam moonDAOTeam;
    MoonDAOTeamCreator moonDAOTeamCreator;
    MoonDaoTeamTableland moonDAOTeamTable;

    MissionCreator missionCreator;
    MissionTable missionTable;
    IJBDirectory jbDirectory;
    IJBTerminalStore jbTerminalStore;
    IJBRulesets jbRulesets;
    IJBTokens jbTokens;
    IJBController jbController;
    IJBProjects jbProjects;


    function setUp() public {
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(contributor1, 100 ether);
        vm.deal(contributor2, 100 ether);

        vm.startPrank(user1);

        Hats hatsBase = new Hats("", "");
        IHats hats = IHats(address(hatsBase));
        HatsModuleFactory hatsFactory = deployModuleFactory(hats, SALT, "");
        PassthroughModule passthrough = new PassthroughModule("");
        address gnosisSafeSingleton = address(0x3E5c63644E683549055b9Be8653de26E0B4CD36E);
        GnosisSafeProxyFactory proxyFactory = new GnosisSafeProxyFactory();

        Whitelist teamWhitelist = new Whitelist();
        Whitelist teamDiscountList = new Whitelist();

        moonDAOTeamTable = new MoonDaoTeamTableland("MoonDaoTeamTable");
        moonDAOTeam = new MoonDAOTeam("erc5369", "ERC5643", TREASURY, address(hatsBase), address(teamDiscountList));
        address[] memory authorizedSigners = new address[](0);
        moonDAOTeamCreator = new MoonDAOTeamCreator(address(hatsBase), address(hatsFactory), address(passthrough), address(moonDAOTeam), gnosisSafeSingleton, address(proxyFactory), address(moonDAOTeamTable), address(teamWhitelist), authorizedSigners);
        jbDirectory = IJBDirectory(JB_V5_DIRECTORY);

        uint256 topHatId = hats.mintTopHat(user1, "", "");
        uint256 moonDAOTeamAdminHatId = hats.createHat(topHatId, "", 1, TREASURY, TREASURY, true, "");

        moonDAOTeamCreator.setOpenAccess(true);
        moonDAOTeamTable.setMoonDaoTeam(address(moonDAOTeam));
        moonDAOTeamCreator.setMoonDaoTeamAdminHatId(moonDAOTeamAdminHatId);
        moonDAOTeam.setMoonDaoCreator(address(moonDAOTeamCreator));
        hats.mintHat(moonDAOTeamAdminHatId, address(moonDAOTeamCreator));
        jbRulesets = IJBRulesets(JB_V5_RULESETS);
        jbTerminalStore = IJBTerminalStore(JB_V5_TERMINAL_STORE);
        jbTokens = IJBTokens(JB_V5_TOKENS);
        jbController = IJBController(JB_V5_CONTROLLER);
        jbProjects = IJBProjects(JB_V5_PROJECTS);

        missionCreator = new MissionCreator(JB_V5_CONTROLLER, JB_V5_MULTI_TERMINAL, JB_V5_PROJECTS, JB_V5_TERMINAL_STORE, JB_V5_RULESETS, address(moonDAOTeam), zero, TREASURY, FEE_HOOK_ADDRESSES[block.chainid], POSITION_MANAGERS[block.chainid]);
        missionTable = new MissionTable("TestMissionTable", address(missionCreator));
        missionCreator.setMissionTable(address(missionTable));

        vm.stopPrank();
    }

    function _createTeam() internal {
        vm.startPrank(user1);
        MoonDAOTeamCreator.HatURIs memory hatURIs = MoonDAOTeamCreator.HatURIs({
            adminHatURI: "",
            managerHatURI: "",
            memberHatURI: ""
        });
        MoonDAOTeamCreator.TeamMetadata memory metadata = MoonDAOTeamCreator.TeamMetadata({
            _view: "view",
            formId: "formId"
        });
        moonDAOTeamCreator.createMoonDAOTeam{value: 0.555 ether}(hatURIs, metadata, new address[](0));
        vm.stopPrank();
    }

    function _createMission(uint256 goal, bool token) internal returns (uint256) {
        uint256 missionId = missionCreator.createMission(
           0,
           teamAddress,
           "",
           goal,
           block.timestamp + 28 days,
           28 days,
           token,
           "TEST TOKEN",
           "TEST",
           "This is a test project"
        );
        return missionId;
    }

    /// @notice Helper to build a refund ruleset config that mirrors ruleset 0 but with new hooks.
    /// @param newPayHook The address of the new LaunchPadPayHook with fresh timing.
    /// @param newApprovalHook The address of the new LaunchPadApprovalHook with fresh timing.
    /// @param terminal The terminal address for fund access limits.
    function _buildRefundRulesetConfig(
        address newPayHook,
        address newApprovalHook,
        address terminal
    ) internal pure returns (JBRulesetConfig[] memory) {
        JBRulesetConfig[] memory rulesetConfigurations = new JBRulesetConfig[](1);

        // Surplus allowances — same as original ruleset 0 (functionally unlimited)
        JBCurrencyAmount[] memory surplusAllowances = new JBCurrencyAmount[](1);
        surplusAllowances[0] = JBCurrencyAmount({
            amount: uint224(128_000_000 * 10 ** 18),
            currency: uint32(uint160(JBConstants.NATIVE_TOKEN))
        });

        JBFundAccessLimitGroup[] memory fundAccessLimitGroups = new JBFundAccessLimitGroup[](1);
        fundAccessLimitGroups[0] = JBFundAccessLimitGroup({
            terminal: terminal,
            token: JBConstants.NATIVE_TOKEN,
            payoutLimits: new JBCurrencyAmount[](0), // No payouts in refund ruleset
            surplusAllowances: surplusAllowances
        });

        rulesetConfigurations[0] = JBRulesetConfig({
            mustStartAtOrAfter: 0,
            duration: 0,
            weight: 2_000_000_000_000_000_000_000,
            weightCutPercent: 0,
            approvalHook: IJBRulesetApprovalHook(newApprovalHook),
            metadata: JBRulesetMetadata({
                reservedPercent: 5_000,
                cashOutTaxRate: 0,
                baseCurrency: 61166,
                pausePay: true, // Pause new payments during refund period
                pauseCreditTransfers: false,
                allowOwnerMinting: false,
                allowSetCustomToken: false,
                allowTerminalMigration: false,
                allowSetTerminals: false,
                allowSetController: false,
                allowAddAccountingContext: false,
                allowAddPriceFeed: false,
                ownerMustSendPayouts: false,
                holdFees: false,
                useTotalSurplusForCashOuts: false,
                useDataHookForPay: true,
                useDataHookForCashOut: true,
                dataHook: newPayHook,
                metadata: 0
            }),
            splitGroups: new JBSplitGroup[](0), // No splits needed for refund-only ruleset
            fundAccessLimitGroups: fundAccessLimitGroups
        });

        return rulesetConfigurations;
    }


    /// @notice Full end-to-end test of the manual refund flow.
    ///
    /// 1. Create a mission where funding goal is NOT met (goal=10 ETH, funded=1.5 ETH).
    /// 2. Deadline passes, original refund period expires (simulating the "too late" scenario).
    /// 3. Team multisig deploys new hooks with fresh deadline/refund timing.
    /// 4. Team multisig (project owner) queues a new refund ruleset using the JB controller.
    /// 5. Enable refunds on the NEW hooks so the approval hook stays on the refund ruleset.
    /// 6. Contributors cash out and get their ETH back.
    function testManualRefundViaQueuedRuleset() public {
        _createTeam();

        // === Step 1: Create mission with 10 ETH goal ===
        vm.startPrank(user1);
        uint256 missionId = _createMission(10_000_000_000_000_000_000, true);
        vm.stopPrank();

        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        // === Step 2: Contributors fund the mission (below goal) ===
        uint256 payAmount1 = 1 ether;
        uint256 payAmount2 = 0.5 ether;

        vm.prank(contributor1);
        terminal.pay{value: payAmount1}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            contributor1,
            0,
            "",
            new bytes(0)
        );
        uint256 contributor1Tokens = jbTokens.totalBalanceOf(contributor1, projectId);
        assertEq(contributor1Tokens, 1_000 * 1e18);

        vm.prank(contributor2);
        terminal.pay{value: payAmount2}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            contributor2,
            0,
            "",
            new bytes(0)
        );
        uint256 contributor2Tokens = jbTokens.totalBalanceOf(contributor2, projectId);
        assertEq(contributor2Tokens, 500 * 1e18);

        // Verify mission is in stage 1 (active funding)
        assertEq(missionCreator.stage(missionId), 1);

        // === Step 3: Time passes — deadline AND refund period both expire ===
        // This simulates the scenario where the team decides to refund AFTER the
        // original refund window has closed.
        skip(28 days + 28 days + 1); // Past deadline + refund period

        // The original stage would be 4 (refund period expired, goal not met)
        assertEq(missionCreator.stage(missionId), 4);

        // Verify refunds are NOT possible with the original hooks
        vm.prank(contributor1);
        vm.expectRevert("Refund period has passed. Refunds are disabled.");
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor1,
            projectId,
            contributor1Tokens,
            JBConstants.NATIVE_TOKEN,
            0,
            payable(contributor1),
            bytes("")
        );

        // === Step 4: Team multisig deploys new hooks with fresh timing ===
        // The new hooks have:
        //   - deadline = now (so we're immediately past the deadline — refunds can start)
        //   - refundPeriod = 28 days (fresh 28-day refund window)
        //   - same fundingGoal as original
        vm.startPrank(teamAddress);

        uint256 newDeadline = block.timestamp; // Deadline is "now", so refunds are immediately available
        uint256 newRefundPeriod = 28 days;
        uint256 fundingGoal = missionCreator.missionIdToFundingGoal(missionId);

        LaunchPadPayHook newPayHook = new LaunchPadPayHook(
            fundingGoal,
            newDeadline,
            newRefundPeriod,
            JB_V5_TERMINAL_STORE,
            JB_V5_RULESETS,
            teamAddress // owner = team multisig
        );

        LaunchPadApprovalHook newApprovalHook = new LaunchPadApprovalHook(
            fundingGoal,
            newDeadline,
            newRefundPeriod,
            JB_V5_TERMINAL_STORE,
            address(terminal),
            teamAddress // owner = team multisig
        );

        // Enable refunds on the new hooks immediately. The pay hook is the
        // single source of truth; the approval hook reads the flag from it.
        newApprovalHook.setPayHook(address(newPayHook));
        newPayHook.enableRefunds(true);

        // === Step 5: Queue the new refund ruleset ===
        // The team multisig owns the JB project NFT, so they can call queueRulesetsOf.
        // Since the original approval hook now returns Approved (refund period expired),
        // Juicebox has already advanced to Ruleset 1 (payouts).
        // Ruleset 1 has approvalHook = address(0), so any queued ruleset is auto-approved.
        JBRulesetConfig[] memory refundRuleset = _buildRefundRulesetConfig(
            address(newPayHook),
            address(newApprovalHook),
            address(terminal)
        );

        uint256 newRulesetId = jbController.queueRulesetsOf(
            projectId,
            refundRuleset,
            "Queuing refund ruleset for manual refunds"
        );
        assertTrue(newRulesetId > 0, "New ruleset should have been queued");

        vm.stopPrank();

        // === Step 6: Verify the new ruleset is active and refunds work ===
        // Since Ruleset 1 has duration=0 and approvalHook=address(0), the queued
        // ruleset should take effect immediately.

        uint256 contributor1BalanceBefore = address(contributor1).balance;
        uint256 contributor2BalanceBefore = address(contributor2).balance;

        // Contributor 1 cashes out
        vm.prank(contributor1);
        uint256 cashOut1 = IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor1,
            projectId,
            contributor1Tokens,
            JBConstants.NATIVE_TOKEN,
            0,
            payable(contributor1),
            bytes("")
        );

        uint256 contributor1BalanceAfter = address(contributor1).balance;
        assertEq(cashOut1, payAmount1, "Contributor 1 should get full refund");
        assertEq(contributor1BalanceAfter - contributor1BalanceBefore, payAmount1, "Contributor 1 ETH balance should increase by pay amount");
        assertEq(jbTokens.totalBalanceOf(contributor1, projectId), 0, "Contributor 1 should have 0 tokens after refund");

        // Contributor 2 cashes out
        vm.prank(contributor2);
        uint256 cashOut2 = IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor2,
            projectId,
            contributor2Tokens,
            JBConstants.NATIVE_TOKEN,
            0,
            payable(contributor2),
            bytes("")
        );

        uint256 contributor2BalanceAfter = address(contributor2).balance;
        assertEq(cashOut2, payAmount2, "Contributor 2 should get full refund");
        assertEq(contributor2BalanceAfter - contributor2BalanceBefore, payAmount2, "Contributor 2 ETH balance should increase by pay amount");
        assertEq(jbTokens.totalBalanceOf(contributor2, projectId), 0, "Contributor 2 should have 0 tokens after refund");

        // Terminal should be empty now
        uint256 remainingBalance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(remainingBalance, 0, "Terminal should be empty after all refunds");
    }

    /// @notice Test that refunds still work even when the funding goal WAS met,
    ///         but the team decides to refund anyway (e.g., mission cancelled).
    function testManualRefundWhenGoalMet() public {
        _createTeam();

        // Create mission with 1 ETH goal
        vm.startPrank(user1);
        uint256 missionId = _createMission(1_000_000_000_000_000_000, true);
        vm.stopPrank();

        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        // Fund past the goal
        uint256 payAmount = 2 ether;
        vm.prank(contributor1);
        terminal.pay{value: payAmount}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            contributor1,
            0,
            "",
            new bytes(0)
        );
        uint256 contributorTokens = jbTokens.totalBalanceOf(contributor1, projectId);
        assertEq(contributorTokens, 2_000 * 1e18);

        // Goal is met, mission is in stage 2
        assertEq(missionCreator.stage(missionId), 2);

        // Skip past deadline — approval hook sees goal met + deadline passed → Approved
        // This moves to Ruleset 1 (payouts)
        skip(28 days);

        // Now team decides to cancel and refund — deploy new hooks
        vm.startPrank(teamAddress);

        uint256 fundingGoal = missionCreator.missionIdToFundingGoal(missionId);
        uint256 newDeadline = block.timestamp;
        uint256 newRefundPeriod = 28 days;

        LaunchPadPayHook newPayHook = new LaunchPadPayHook(
            fundingGoal,
            newDeadline,
            newRefundPeriod,
            JB_V5_TERMINAL_STORE,
            JB_V5_RULESETS,
            teamAddress
        );

        LaunchPadApprovalHook newApprovalHook = new LaunchPadApprovalHook(
            fundingGoal,
            newDeadline,
            newRefundPeriod,
            JB_V5_TERMINAL_STORE,
            address(terminal),
            teamAddress
        );

        // Enable refunds — this is critical because the funding goal IS met,
        // so without enableRefunds the pay hook would reject cash outs.
        newApprovalHook.setPayHook(address(newPayHook));
        newPayHook.enableRefunds(true);

        // Queue the refund ruleset (Ruleset 1 has no approval hook, so auto-approved)
        JBRulesetConfig[] memory refundRuleset = _buildRefundRulesetConfig(
            address(newPayHook),
            address(newApprovalHook),
            address(terminal)
        );

        jbController.queueRulesetsOf(
            projectId,
            refundRuleset,
            "Refunding mission - goal met but mission cancelled"
        );
        vm.stopPrank();

        // Contributor cashes out
        uint256 balanceBefore = address(contributor1).balance;
        vm.prank(contributor1);
        uint256 cashOutAmount = IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor1,
            projectId,
            contributorTokens,
            JBConstants.NATIVE_TOKEN,
            0,
            payable(contributor1),
            bytes("")
        );

        assertEq(cashOutAmount, payAmount, "Should get full refund even though goal was met");
        assertEq(address(contributor1).balance - balanceBefore, payAmount, "ETH balance should increase by pay amount");
        assertEq(jbTokens.totalBalanceOf(contributor1, projectId), 0, "Should have 0 tokens");
    }

    /// @notice Test that the refund window expires on the new ruleset too.
    ///         After the new refund period, the ruleset advances and payouts become possible.
    function testManualRefundWindowExpires() public {
        _createTeam();

        vm.startPrank(user1);
        uint256 missionId = _createMission(10_000_000_000_000_000_000, true);
        vm.stopPrank();

        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        // Fund below goal
        vm.prank(contributor1);
        terminal.pay{value: 1 ether}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            contributor1,
            0,
            "",
            new bytes(0)
        );
        uint256 contributorTokens = jbTokens.totalBalanceOf(contributor1, projectId);

        // Skip past original deadline + refund period
        skip(28 days + 28 days + 1);
        assertEq(missionCreator.stage(missionId), 4);

        // Team queues refund ruleset
        vm.startPrank(teamAddress);

        uint256 fundingGoal = missionCreator.missionIdToFundingGoal(missionId);
        uint256 newDeadline = block.timestamp;
        uint256 newRefundPeriod = 28 days;

        LaunchPadPayHook newPayHook = new LaunchPadPayHook(
            fundingGoal, newDeadline, newRefundPeriod,
            JB_V5_TERMINAL_STORE, JB_V5_RULESETS, teamAddress
        );
        LaunchPadApprovalHook newApprovalHook = new LaunchPadApprovalHook(
            fundingGoal, newDeadline, newRefundPeriod,
            JB_V5_TERMINAL_STORE, address(terminal), teamAddress
        );
        newApprovalHook.setPayHook(address(newPayHook));
        newPayHook.enableRefunds(true);

        JBRulesetConfig[] memory refundRuleset = _buildRefundRulesetConfig(
            address(newPayHook), address(newApprovalHook), address(terminal)
        );
        jbController.queueRulesetsOf(projectId, refundRuleset, "Manual refund ruleset");
        vm.stopPrank();

        // Skip past the NEW refund period
        skip(28 days + 1);

        // Now refunds should be disabled on the new hooks too
        vm.prank(contributor1);
        vm.expectRevert("Refund period has passed. Refunds are disabled.");
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor1,
            projectId,
            contributorTokens,
            JBConstants.NATIVE_TOKEN,
            0,
            payable(contributor1),
            bytes("")
        );
    }
}
