// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@nana-core-v5/interfaces/IJBRulesetApprovalHook.sol";
import {IJBRulesets} from "@nana-core-v5/interfaces/IJBRulesets.sol";
import {JBRuleset} from "@nana-core-v5/structs/JBRuleset.sol";
import {IJBMultiTerminal} from "@nana-core-v5/interfaces/IJBMultiTerminal.sol";
import {IJBDirectory} from "@nana-core-v5/interfaces/IJBDirectory.sol";
import {MoonDAOTeam} from "../src/ERC5643.sol";
import {GnosisSafeProxyFactory} from "../src/GnosisSafeProxyFactory.sol";
import {MissionCreator} from "../src/MissionCreator.sol";
import {MissionTable} from "../src/tables/MissionTable.sol";
import {MoonDaoTeamTableland} from "../src/tables/MoonDaoTeamTableland.sol";
import {MoonDAOTeamCreator} from "../src/MoonDAOTeamCreator.sol";
import {LaunchPadPayHook} from "../src/LaunchPadPayHook.sol";
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

/// @title ReopenRulesetTest
/// @notice Tests re-opening fundraising on a closed mission at a new token rate.
///
/// Scenario (the "Send Frank to Space" re-open): a mission closed below its funding
/// goal and the refund window expired. The team multisig (project owner) queues a
/// re-open ruleset with:
///   - a new LaunchPadPayHook carrying a fresh deadline (campaign window)
///   - a lower issuance rate (500 tokens/ETH to the contributor vs the original 1,000)
///   - no approval hook, so the rate can be updated by simply queuing another ruleset
contract ReopenRulesetTest is Test, Config {

    address zero = address(0);
    address user1 = address(0x100);
    address teamAddress = address(0x200);
    address contributor1 = address(0x500);
    address contributor2 = address(0x600);
    address contributor3 = address(0x700);
    address randomCaller = address(0x900);
    address TREASURY = address(0x400);

    bytes32 internal constant SALT = bytes32(abi.encode(0x4a75));

    // 500 tokens/ETH to the contributor; 50% reserved → ruleset weight is doubled.
    uint256 constant REOPEN_TOKENS_PER_ETH = 500;
    uint256 constant REOPEN_WEIGHT = REOPEN_TOKENS_PER_ETH * 2 * 1e18;
    uint256 constant CAMPAIGN_DURATION = 548 days;
    uint256 constant REFUND_PERIOD = 28 days;

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
        vm.deal(contributor1, 100 ether);
        vm.deal(contributor2, 100 ether);
        vm.deal(contributor3, 100 ether);
        vm.deal(randomCaller, 10 ether);

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
            name: "name",
            bio: "bio",
            image: "image",
            twitter: "twitter",
            communications: "communications",
            website: "website",
            _view: "view",
            formId: "formId"
        });
        moonDAOTeamCreator.createMoonDAOTeam{value: 0.555 ether}(hatURIs, metadata, new address[](0));
        vm.stopPrank();
    }

    function _createMission(uint256 goal) internal returns (uint256) {
        vm.prank(user1);
        return missionCreator.createMission(
           0,
           teamAddress,
           "",
           goal,
           block.timestamp + 28 days,
           28 days,
           true,
           "TEST TOKEN",
           "TEST",
           "This is a test project"
        );
    }

    function _pay(address contributor, uint256 amount, IJBTerminal terminal, uint256 projectId) internal {
        vm.prank(contributor);
        terminal.pay{value: amount}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            contributor,
            0,
            "",
            new bytes(0)
        );
    }

    /// @notice Builds the re-open ruleset config — mirrors QueueReopenRuleset.s.sol.
    function _buildReopenRulesetConfig(
        uint256 missionId,
        address payHook,
        address terminal,
        uint256 weight
    ) internal view returns (JBRulesetConfig[] memory) {
        JBSplitGroup[] memory splitGroups = new JBSplitGroup[](2);

        splitGroups[0] = JBSplitGroup({groupId: 0xEEEe, splits: new JBSplit[](3)});
        splitGroups[0].splits[0] = JBSplit({
            percent: 25_641_025,
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(missionCreator.moonDAOTreasury()),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });
        splitGroups[0].splits[1] = JBSplit({
            percent: 51_282_051,
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(missionCreator.missionIdToPoolDeployer(missionId)),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });
        splitGroups[0].splits[2] = JBSplit({
            percent: 923_076_923,
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(teamAddress),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });

        splitGroups[1] = JBSplitGroup({groupId: 1, splits: new JBSplit[](3)});
        splitGroups[1].splits[0] = JBSplit({
            percent: 350_000_000,
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(missionCreator.missionIdToMoonDAOVesting(missionId)),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });
        splitGroups[1].splits[1] = JBSplit({
            percent: 600_000_000,
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(missionCreator.missionIdToTeamVesting(missionId)),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });
        splitGroups[1].splits[2] = JBSplit({
            percent: 50_000_000,
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(missionCreator.missionIdToPoolDeployer(missionId)),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });

        JBCurrencyAmount[] memory surplusAllowances = new JBCurrencyAmount[](1);
        surplusAllowances[0] = JBCurrencyAmount({
            amount: uint224(128_000_000 * 10 ** 18),
            currency: uint32(uint160(JBConstants.NATIVE_TOKEN))
        });

        JBFundAccessLimitGroup[] memory fundAccessLimitGroups = new JBFundAccessLimitGroup[](1);
        fundAccessLimitGroups[0] = JBFundAccessLimitGroup({
            terminal: terminal,
            token: JBConstants.NATIVE_TOKEN,
            payoutLimits: new JBCurrencyAmount[](0),
            surplusAllowances: surplusAllowances
        });

        JBRulesetConfig[] memory rulesetConfigurations = new JBRulesetConfig[](1);
        rulesetConfigurations[0] = JBRulesetConfig({
            mustStartAtOrAfter: 0,
            duration: 0,
            weight: uint112(weight),
            weightCutPercent: 0,
            approvalHook: IJBRulesetApprovalHook(address(0)),
            metadata: JBRulesetMetadata({
                reservedPercent: 5_000,
                cashOutTaxRate: 0,
                baseCurrency: 61166,
                pausePay: false,
                pauseCreditTransfers: false,
                allowOwnerMinting: false,
                allowSetCustomToken: false,
                allowTerminalMigration: false,
                allowSetTerminals: false,
                allowSetController: false,
                allowAddAccountingContext: false,
                allowAddPriceFeed: false,
                ownerMustSendPayouts: true,
                holdFees: false,
                useTotalSurplusForCashOuts: false,
                useDataHookForPay: true,
                useDataHookForCashOut: true,
                dataHook: payHook,
                metadata: 0
            }),
            splitGroups: splitGroups,
            fundAccessLimitGroups: fundAccessLimitGroups
        });

        return rulesetConfigurations;
    }

    /// @dev Closes the mission (deadline + refund window expire below goal), then the
    ///      team queues the re-open ruleset. Returns the new pay hook.
    function _reopen(
        uint256 missionId,
        uint256 projectId,
        IJBTerminal terminal,
        uint256 weight
    ) internal returns (LaunchPadPayHook) {
        vm.startPrank(teamAddress);

        LaunchPadPayHook newPayHook = new LaunchPadPayHook(
            missionCreator.missionIdToFundingGoal(missionId),
            block.timestamp + CAMPAIGN_DURATION,
            REFUND_PERIOD,
            JB_V5_TERMINAL_STORE,
            JB_V5_RULESETS,
            teamAddress
        );

        JBRulesetConfig[] memory reopenRuleset = _buildReopenRulesetConfig(
            missionId,
            address(newPayHook),
            address(terminal),
            weight
        );

        jbController.queueRulesetsOf(
            projectId,
            reopenRuleset,
            "Re-opening Launchpad funding"
        );

        vm.stopPrank();
        return newPayHook;
    }

    /// @notice Re-opened mission mints at the new 500/ETH rate, leaves original
    ///         balances untouched, and routes reserved tokens to the vesting splits.
    function testReopenMintsAtNewRate() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);

        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        // Original campaign: contributor1 pays 1 ETH at 1,000 tokens/ETH
        _pay(contributor1, 1 ether, terminal, projectId);
        assertEq(jbTokens.totalBalanceOf(contributor1, projectId), 1_000 * 1e18);

        // Campaign closes below goal; refund window expires
        skip(28 days + 28 days + 1);
        assertEq(missionCreator.stage(missionId), 4);

        // Payments are rejected by the original pay hook
        vm.deal(contributor2, 100 ether);
        vm.prank(contributor2);
        vm.expectRevert("Project funding deadline has passed and funding goal requirement has not been met.");
        terminal.pay{value: 1 ether}(projectId, JBConstants.NATIVE_TOKEN, 0, contributor2, 0, "", new bytes(0));

        // Team re-opens at 500 tokens/ETH
        LaunchPadPayHook newPayHook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);

        // The mission is active again per the new pay hook
        assertEq(newPayHook.stage(address(terminal), projectId), 1);

        // New contribution mints at the re-open rate
        _pay(contributor2, 1 ether, terminal, projectId);
        assertEq(jbTokens.totalBalanceOf(contributor2, projectId), REOPEN_TOKENS_PER_ETH * 1e18, "New contributor should mint at 500/ETH");

        // Original contributor's balance is untouched
        assertEq(jbTokens.totalBalanceOf(contributor1, projectId), 1_000 * 1e18, "Original balance must not change");

        // Reserved tokens flow to the original vesting/pool splits
        jbController.sendReservedTokensToSplitsOf(projectId);
        address teamVesting = missionCreator.missionIdToTeamVesting(missionId);
        address moonDAOVesting = missionCreator.missionIdToMoonDAOVesting(missionId);
        // Reserved from both payments: 1,000 (original) + 500 (re-open) = 1,500 tokens
        assertEq(jbTokens.totalBalanceOf(teamVesting, projectId), 1_500 * 1e18 * 60 / 100, "Team vesting gets 60% of reserved");
        assertEq(jbTokens.totalBalanceOf(moonDAOVesting, projectId), 1_500 * 1e18 * 35 / 100, "MoonDAO vesting gets 35% of reserved");
    }

    /// @notice The rate can be stepped down later by queuing another ruleset — no
    ///         approval hook stands in the way ("one cycle at a time").
    function testReopenRateCanBeUpdatedByQueuingNewRuleset() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);

        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        _pay(contributor1, 1 ether, terminal, projectId);
        skip(28 days + 28 days + 1);

        // Re-open at 500/ETH
        _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);
        _pay(contributor2, 1 ether, terminal, projectId);
        assertEq(jbTokens.totalBalanceOf(contributor2, projectId), 500 * 1e18);

        // A month later the team steps the rate down to 250/ETH by re-queuing
        skip(30 days);
        LaunchPadPayHook stepDownHook = _reopen(missionId, projectId, terminal, 250 * 2 * 1e18);
        assertEq(stepDownHook.stage(address(terminal), projectId), 1);

        _pay(contributor2, 1 ether, terminal, projectId);
        assertEq(jbTokens.totalBalanceOf(contributor2, projectId), (500 + 250) * 1e18, "Second payment should mint at 250/ETH");
    }

    /// @notice If the re-opened campaign misses its goal by the new deadline, payments
    ///         stop and contributors can cash out during the refund window.
    function testReopenRefundAfterNewDeadline() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);

        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        skip(28 days + 28 days + 1); // close the original campaign (no contributions)

        LaunchPadPayHook newPayHook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);

        _pay(contributor1, 1 ether, terminal, projectId);
        uint256 contributorTokens = jbTokens.totalBalanceOf(contributor1, projectId);
        assertEq(contributorTokens, 500 * 1e18);

        // Refunds are disabled while the re-opened campaign is live
        vm.prank(contributor1);
        vm.expectRevert("Project funding deadline has not passed. Refunds are disabled.");
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor1, projectId, contributorTokens, JBConstants.NATIVE_TOKEN, 0, payable(contributor1), bytes("")
        );

        // New deadline passes below goal
        skip(CAMPAIGN_DURATION + 1);
        assertEq(newPayHook.stage(address(terminal), projectId), 3, "Should be in refund stage");

        // Payments are rejected again
        vm.prank(contributor2);
        vm.expectRevert("Project funding deadline has passed and funding goal requirement has not been met.");
        terminal.pay{value: 1 ether}(projectId, JBConstants.NATIVE_TOKEN, 0, contributor2, 0, "", new bytes(0));

        // Contributor gets a full refund during the window
        uint256 balanceBefore = address(contributor1).balance;
        vm.prank(contributor1);
        uint256 cashOutAmount = IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor1, projectId, contributorTokens, JBConstants.NATIVE_TOKEN, 0, payable(contributor1), bytes("")
        );
        assertEq(cashOutAmount, 1 ether, "Full refund");
        assertEq(address(contributor1).balance - balanceBefore, 1 ether);
        assertEq(jbTokens.totalBalanceOf(contributor1, projectId), 0);
    }

    /// @notice The active re-open ruleset carries exactly the configured weight and
    ///         no decay, so the on-chain rate is what the mission page will display.
    function testReopenRulesetWeightAndNoDecay() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        skip(28 days + 28 days + 1);
        _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);

        JBRuleset memory active = jbRulesets.currentOf(projectId);
        assertEq(uint256(active.weight), REOPEN_WEIGHT, "Active weight must equal configured rate");
        assertEq(uint256(active.weightCutPercent), 0, "No automatic decay");
        assertEq(address(active.approvalHook), address(0), "No approval hook on re-open ruleset");
        assertEq(uint256(active.duration), 0, "Ruleset lasts until the next one is queued");
    }

    /// @notice Only the project owner (team Safe) can queue rulesets; a random caller
    ///         cannot re-open, change the rate, or unlock payouts.
    function testOnlyProjectOwnerCanQueueRulesets() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        skip(28 days + 28 days + 1);

        vm.startPrank(randomCaller);
        LaunchPadPayHook attackerHook = new LaunchPadPayHook(
            missionCreator.missionIdToFundingGoal(missionId),
            block.timestamp + CAMPAIGN_DURATION,
            REFUND_PERIOD,
            JB_V5_TERMINAL_STORE,
            JB_V5_RULESETS,
            randomCaller
        );
        JBRulesetConfig[] memory config = _buildReopenRulesetConfig(
            missionId, address(attackerHook), address(terminal), REOPEN_WEIGHT
        );
        vm.expectRevert();
        jbController.queueRulesetsOf(projectId, config, "attacker reopen");
        vm.stopPrank();
    }

    /// @notice Hook flags (funding kill-switch, refund enable) are owner-gated, and
    ///         the kill-switch actually blocks payments.
    function testHookFlagsAreOwnerGated() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        skip(28 days + 28 days + 1);
        LaunchPadPayHook newPayHook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);

        // Non-owner cannot toggle flags
        vm.startPrank(randomCaller);
        vm.expectRevert();
        newPayHook.setFundingTurnedOff(true);
        vm.expectRevert();
        newPayHook.enableRefunds(true);
        vm.stopPrank();

        // Owner can, and the kill-switch blocks contributions
        vm.prank(teamAddress);
        newPayHook.setFundingTurnedOff(true);

        vm.prank(contributor1);
        vm.expectRevert("Funding has been turned off.");
        terminal.pay{value: 1 ether}(projectId, JBConstants.NATIVE_TOKEN, 0, contributor1, 0, "", new bytes(0));

        // And can turn it back on
        vm.prank(teamAddress);
        newPayHook.setFundingTurnedOff(false);
        _pay(contributor1, 1 ether, terminal, projectId);
        assertEq(jbTokens.totalBalanceOf(contributor1, projectId), 500 * 1e18);
    }

    /// @notice During the re-open, payouts are locked (zero payout limit) and the
    ///         surplus allowance cannot be used by a non-owner.
    function testPayoutsLockedAndSurplusAllowancePermissioned() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        skip(28 days + 28 days + 1);
        _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);
        _pay(contributor1, 2 ether, terminal, projectId);

        // Payout distribution reverts: the re-open ruleset has no payout limit
        vm.prank(teamAddress);
        vm.expectRevert();
        IJBMultiTerminal(address(terminal)).sendPayoutsOf(
            projectId, JBConstants.NATIVE_TOKEN, 1 ether, uint32(uint160(JBConstants.NATIVE_TOKEN)), 0
        );

        // Surplus allowance is permissioned to the project owner
        vm.prank(randomCaller);
        vm.expectRevert();
        IJBMultiTerminal(address(terminal)).useAllowanceOf(
            projectId, JBConstants.NATIVE_TOKEN, 1 ether, uint32(uint160(JBConstants.NATIVE_TOKEN)),
            0, payable(randomCaller), payable(randomCaller), "attacker surplus"
        );

        // Funds are still in the terminal
        assertEq(jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN), 2 ether);
    }

    /// @notice If the re-opened raise reaches its goal, refunds are blocked (stage 2)
    ///         — matching the original launch semantics.
    function testGoalMetOnReopenBlocksRefunds() public {
        _createTeam();
        uint256 missionId = _createMission(2 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        _pay(contributor1, 1 ether, terminal, projectId); // below the 2 ETH goal
        skip(28 days + 28 days + 1);

        LaunchPadPayHook newPayHook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);
        _pay(contributor2, 1.5 ether, terminal, projectId); // goal now met (2.5 >= 2)

        assertEq(newPayHook.stage(address(terminal), projectId), 2, "Goal met -> stage 2");

        uint256 tokens = jbTokens.totalBalanceOf(contributor2, projectId);
        vm.prank(contributor2);
        vm.expectRevert("Project has passed funding goal requirement. Refunds are disabled.");
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor2, projectId, tokens, JBConstants.NATIVE_TOKEN, 0, payable(contributor2), bytes("")
        );
    }

    /// @notice KNOWN HAZARD (documented, not fixed here): the pay hook reconstructs
    ///         total supply from `currentFunding * activeWeight`, which assumes every
    ///         token was minted at the CURRENT rate. Once 1,000/ETH (original) and
    ///         500/ETH (re-open) holders coexist, the pot is over-committed: original
    ///         holders reclaim ~2x their contribution and late redeemers get nothing.
    ///         This pins down the behavior so a naive refund ruleset (re-using the
    ///         re-open weight) is never shipped. See the blended-weight test below
    ///         for the safe operational path.
    function testMixedRateRefundOverdrawHazard() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        // Original raise: two backers at 1,000/ETH
        _pay(contributor1, 1 ether, terminal, projectId);
        _pay(contributor2, 1 ether, terminal, projectId);
        skip(28 days + 28 days + 1);

        // Re-open at 500/ETH; one backer contributes 2 ETH
        _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);
        _pay(contributor3, 2 ether, terminal, projectId);
        assertEq(jbTokens.totalBalanceOf(contributor3, projectId), 1_000 * 1e18);

        // Re-opened campaign misses the goal; refund window opens on the reopen hook
        skip(CAMPAIGN_DURATION + 1);

        // Pot: 4 ETH. Hook-computed supply: 4 ETH * 500/ETH * 2 / 2 = 2,000 tokens,
        // but the real contributor supply is 3,000 tokens -> over-committed by 50%.
        uint256 balBefore1 = contributor1.balance;
        vm.prank(contributor1);
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor1, projectId, 1_000 * 1e18, JBConstants.NATIVE_TOKEN, 0, payable(contributor1), bytes("")
        );
        assertEq(contributor1.balance - balBefore1, 2 ether, "Original holder reclaims 2x their 1 ETH contribution");

        uint256 balBefore2 = contributor2.balance;
        vm.prank(contributor2);
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor2, projectId, 1_000 * 1e18, JBConstants.NATIVE_TOKEN, 0, payable(contributor2), bytes("")
        );
        assertEq(contributor2.balance - balBefore2, 2 ether, "Second original holder drains the rest");

        // The re-open backer (who paid 2 ETH at the fair current rate) is left with nothing
        assertEq(jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN), 0, "Pot is empty");
        assertEq(jbTokens.totalBalanceOf(contributor3, projectId), 1_000 * 1e18, "Re-open backer still holds worthless claim");
    }

    /// @notice Safe wind-down path: before opening refunds, queue a refund ruleset
    ///         whose weight matches the BLENDED average rate (actual contributor
    ///         supply * 2e18 / pot). Claims then sum exactly to the pot and every
    ///         token redeems at the same value — no overdraw, no stranded redeemers.
    function testBlendedWeightRefundDistributesPotExactly() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        // Same mixed-rate state as the hazard test: 3,000 tokens against a 4 ETH pot
        _pay(contributor1, 1 ether, terminal, projectId);
        _pay(contributor2, 1 ether, terminal, projectId);
        skip(28 days + 28 days + 1);
        _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);
        _pay(contributor3, 2 ether, terminal, projectId);

        // Team winds down: blended weight = contributorSupply * 2e18 / pot
        uint256 contributorSupply = 3_000 * 1e18;
        uint256 pot = 4 ether;
        uint256 blendedWeight = contributorSupply * 2e18 / pot; // 1,500e18

        vm.startPrank(teamAddress);
        LaunchPadPayHook refundHook = new LaunchPadPayHook(
            missionCreator.missionIdToFundingGoal(missionId),
            block.timestamp, // deadline = now, refunds start immediately
            REFUND_PERIOD,
            JB_V5_TERMINAL_STORE,
            JB_V5_RULESETS,
            teamAddress
        );
        refundHook.enableRefunds(true);
        JBRulesetConfig[] memory refundConfig = _buildReopenRulesetConfig(
            missionId, address(refundHook), address(terminal), blendedWeight
        );
        refundConfig[0].metadata.pausePay = true; // no new contributions while refunding
        jbController.queueRulesetsOf(projectId, refundConfig, "Blended-rate refund ruleset");
        vm.stopPrank();

        // All three redeem; each token reclaims the same value and the pot drains to 0
        uint256 total;
        address[3] memory redeemers = [contributor1, contributor2, contributor3];
        for (uint256 i = 0; i < redeemers.length; i++) {
            uint256 before = redeemers[i].balance;
            vm.prank(redeemers[i]);
            IJBMultiTerminal(address(terminal)).cashOutTokensOf(
                redeemers[i], projectId, 1_000 * 1e18, JBConstants.NATIVE_TOKEN, 0, payable(redeemers[i]), bytes("")
            );
            uint256 got = redeemers[i].balance - before;
            assertApproxEqAbs(got, pot / 3, 10, "Each 1,000-token holder reclaims an equal share");
            total += got;
        }

        // Integer division leaves at most a few wei of dust behind
        assertApproxEqAbs(total, pot, 10, "Claims sum to the pot (minus rounding dust)");
        assertLe(jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN), 10, "Only dust stranded");
    }
}
