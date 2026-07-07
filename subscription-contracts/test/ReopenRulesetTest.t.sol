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
import {ReopenPayHook} from "../src/ReopenPayHook.sol";
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
import {JBAfterPayRecordedContext} from "@nana-core-v5/structs/JBAfterPayRecordedContext.sol";
import {JBAfterCashOutRecordedContext} from "@nana-core-v5/structs/JBAfterCashOutRecordedContext.sol";
import {JBBeforeCashOutRecordedContext} from "@nana-core-v5/structs/JBBeforeCashOutRecordedContext.sol";
import {JBTokenAmount} from "@nana-core-v5/structs/JBTokenAmount.sol";
import "base/Config.sol";

/// @notice Malicious contributor that re-enters cashOutTokensOf during the refund
///         ETH callback, attempting to drain more than it contributed.
contract ReentrantCasher {
    IJBMultiTerminal public immutable terminal;
    uint256 public immutable projectId;
    uint256 public reenterAmount;
    bool private entered;

    constructor(IJBMultiTerminal _terminal, uint256 _projectId) {
        terminal = _terminal;
        projectId = _projectId;
    }

    function contribute(uint256 amount) external {
        // Spend the contract's OWN balance so refund-vs-contribution accounting is honest.
        terminal.pay{value: amount}(
            projectId, JBConstants.NATIVE_TOKEN, 0, address(this), 0, "", new bytes(0)
        );
    }

    function arm(uint256 _reenterAmount) external {
        reenterAmount = _reenterAmount;
    }

    function attack(uint256 firstCashOut) external {
        terminal.cashOutTokensOf(
            address(this), projectId, firstCashOut, JBConstants.NATIVE_TOKEN, 0, payable(address(this)), bytes("")
        );
    }

    receive() external payable {
        if (!entered && reenterAmount > 0) {
            entered = true;
            terminal.cashOutTokensOf(
                address(this), projectId, reenterAmount, JBConstants.NATIVE_TOKEN, 0, payable(address(this)), bytes("")
            );
        }
    }
}

/// @title ReopenRulesetTest
/// @notice Tests re-opening fundraising on a closed mission at a new token rate.
///
/// Scenario (the "Send Frank to Space" re-open): a mission closed below its funding
/// goal and the refund window expired. The team multisig (project owner) queues a
/// re-open ruleset with:
///   - a new ReopenPayHook carrying a fresh deadline (campaign window)
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
                pauseCreditTransfers: true,
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
    ///
    /// @param existingHook If nonzero, reuse this hook instead of deploying a new one.
    ///        Rate updates MUST pass the existing hook to preserve the deposit ledger.
    function _reopen(
        uint256 missionId,
        uint256 projectId,
        IJBTerminal terminal,
        uint256 weight,
        address existingHook
    ) internal returns (ReopenPayHook) {
        vm.startPrank(teamAddress);

        address payHookAddress;
        if (existingHook != address(0)) {
            payHookAddress = existingHook;
        } else {
            address[] memory reservedHolders = new address[](3);
            reservedHolders[0] = missionCreator.missionIdToTeamVesting(missionId);
            reservedHolders[1] = missionCreator.missionIdToMoonDAOVesting(missionId);
            reservedHolders[2] = missionCreator.missionIdToPoolDeployer(missionId);

            ReopenPayHook newPayHook = new ReopenPayHook(
                missionCreator.missionIdToFundingGoal(missionId),
                block.timestamp + CAMPAIGN_DURATION,
                REFUND_PERIOD,
                JB_V5_TERMINAL_STORE,
                JB_V5_RULESETS,
                JB_V5_CONTROLLER,
                JB_V5_TOKENS,
                reservedHolders,
                teamAddress
            );
            payHookAddress = address(newPayHook);
        }

        JBRulesetConfig[] memory reopenRuleset = _buildReopenRulesetConfig(
            missionId,
            payHookAddress,
            address(terminal),
            weight
        );

        jbController.queueRulesetsOf(
            projectId,
            reopenRuleset,
            "Re-opening Launchpad funding"
        );

        vm.stopPrank();
        return ReopenPayHook(payHookAddress);
    }

    /// @dev Convenience overload that always deploys a fresh hook (initial open only).
    function _reopen(
        uint256 missionId,
        uint256 projectId,
        IJBTerminal terminal,
        uint256 weight
    ) internal returns (ReopenPayHook) {
        return _reopen(missionId, projectId, terminal, weight, address(0));
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
        ReopenPayHook newPayHook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);

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
    ///         approval hook stands in the way ("one cycle at a time"). The SAME hook
    ///         must be reused so that the deposit ledger (ethContributed) is preserved
    ///         and existing backers remain refundable.
    function testReopenRateCanBeUpdatedByQueuingNewRuleset() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);

        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        _pay(contributor1, 1 ether, terminal, projectId);
        skip(28 days + 28 days + 1);

        // Re-open at 500/ETH; contributor2 pays under the initial hook
        ReopenPayHook initialHook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);
        _pay(contributor2, 1 ether, terminal, projectId);
        assertEq(jbTokens.totalBalanceOf(contributor2, projectId), 500 * 1e18);
        assertEq(initialHook.ethContributed(contributor2), 1 ether, "Ledger should record contributor2's payment");

        // A month later the team steps the rate down to 250/ETH by re-queuing.
        // The existing hook is reused so the deposit ledger is preserved.
        skip(30 days);
        ReopenPayHook stepDownHook = _reopen(missionId, projectId, terminal, 250 * 2 * 1e18, address(initialHook));
        assertEq(address(stepDownHook), address(initialHook), "Rate update must reuse the existing hook");
        assertEq(stepDownHook.stage(address(terminal), projectId), 1);
        assertEq(stepDownHook.ethContributed(contributor2), 1 ether, "Deposit ledger must be preserved after rate update");

        _pay(contributor2, 1 ether, terminal, projectId);
        assertEq(jbTokens.totalBalanceOf(contributor2, projectId), (500 + 250) * 1e18, "Second payment should mint at 250/ETH");
        assertEq(stepDownHook.ethContributed(contributor2), 2 ether, "Ledger should accumulate across both payments");
    }

    /// @notice If the re-opened campaign misses its goal by the new deadline, payments
    ///         stop and contributors can cash out during the refund window.
    function testReopenRefundAfterNewDeadline() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);

        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        skip(28 days + 28 days + 1); // close the original campaign (no contributions)

        ReopenPayHook newPayHook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);

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
        ReopenPayHook newPayHook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);

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

        ReopenPayHook newPayHook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);
        _pay(contributor2, 1.5 ether, terminal, projectId); // goal now met (2.5 >= 2)

        assertEq(newPayHook.stage(address(terminal), projectId), 2, "Goal met -> stage 2");

        uint256 tokens = jbTokens.totalBalanceOf(contributor2, projectId);
        vm.prank(contributor2);
        vm.expectRevert("Project has passed funding goal requirement. Refunds are disabled.");
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor2, projectId, tokens, JBConstants.NATIVE_TOKEN, 0, payable(contributor2), bytes("")
        );
    }

    /// @dev Seed the deposit ledger with an original (pre-hook) contribution:
    ///      `ethAmount` wei backed by `ethAmount * 1000` tokens (original rate).
    function _seed(ReopenPayHook hook, address holder, uint256 ethAmount) internal {
        _seedWithTokens(hook, holder, ethAmount, ethAmount * 1000);
    }

    function _seedWithTokens(ReopenPayHook hook, address holder, uint256 ethAmount, uint256 tokenAmount) internal {
        address[] memory holders = new address[](1);
        uint256[] memory eth = new uint256[](1);
        uint256[] memory toks = new uint256[](1);
        holders[0] = holder;
        eth[0] = ethAmount;
        toks[0] = tokenAmount;
        vm.prank(teamAddress);
        hook.seedContributions(holders, eth, toks);
    }

    /// @notice The headline property: every backer gets back EXACTLY the ETH they
    ///         contributed, regardless of the rate they minted at. A 1,000/ETH
    ///         original backer and a 500/ETH re-open backer who each put in the same
    ///         ETH get the same ETH back — even though they hold different token
    ///         counts. No pro-rata, no one gets more or less than they paid.
    function testExactEthRefundAcrossMixedRates() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        // Original raise: two backers at 1,000/ETH (tracked by the ORIGINAL hook)
        _pay(contributor1, 1 ether, terminal, projectId);
        _pay(contributor2, 1 ether, terminal, projectId);
        assertEq(jbTokens.totalBalanceOf(contributor1, projectId), 1_000 * 1e18);
        skip(28 days + 28 days + 1);

        // Re-open at 500/ETH; seed the original cohort (balance / 1000 = ETH in), then
        // a third backer contributes 2 ETH at the new rate (tracked live by the hook).
        ReopenPayHook hook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);
        _seed(hook, contributor1, 1 ether); // 1,000 tokens / 1000
        _seed(hook, contributor2, 1 ether);
        _pay(contributor3, 2 ether, terminal, projectId);
        assertEq(jbTokens.totalBalanceOf(contributor3, projectId), 1_000 * 1e18, "2 ETH at 500/ETH = 1,000 tokens");
        assertEq(hook.ethContributed(contributor3), 2 ether, "Live contribution tracked automatically");

        // Distribute reserved tokens mid-campaign (permissionless in JB v5) to prove
        // the ledger is immune to reserved-token distribution timing.
        jbController.sendReservedTokensToSplitsOf(projectId);

        // Re-opened campaign misses the goal; refund window opens.
        skip(CAMPAIGN_DURATION + 1);

        // Pot is 4 ETH. Each backer reclaims EXACTLY what they put in.
        uint256 balBefore1 = contributor1.balance;
        vm.prank(contributor1);
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor1, projectId, 1_000 * 1e18, JBConstants.NATIVE_TOKEN, 0, payable(contributor1), bytes("")
        );
        assertEq(contributor1.balance - balBefore1, 1 ether, "Original 1,000/ETH backer gets exactly 1 ETH");

        uint256 balBefore2 = contributor2.balance;
        vm.prank(contributor2);
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor2, projectId, 1_000 * 1e18, JBConstants.NATIVE_TOKEN, 0, payable(contributor2), bytes("")
        );
        assertEq(contributor2.balance - balBefore2, 1 ether, "Second original backer gets exactly 1 ETH");

        // The 500/ETH re-open backer holds the SAME 1,000 tokens as an original 1-ETH
        // backer, but paid 2 ETH — and gets exactly 2 ETH back, not 1.
        uint256 balBefore3 = contributor3.balance;
        vm.prank(contributor3);
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor3, projectId, 1_000 * 1e18, JBConstants.NATIVE_TOKEN, 0, payable(contributor3), bytes("")
        );
        assertEq(contributor3.balance - balBefore3, 2 ether, "Re-open 500/ETH backer gets exactly their 2 ETH");

        assertLe(jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN), 10, "Pot fully distributed (dust only)");
    }

    /// @notice The exact-ETH property is order-independent: reversing the redemption
    ///         order changes nothing.
    function testExactEthRefundIsOrderIndependent() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        _pay(contributor1, 1 ether, terminal, projectId);
        _pay(contributor2, 1 ether, terminal, projectId);
        skip(28 days + 28 days + 1);
        ReopenPayHook hook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);
        _seed(hook, contributor1, 1 ether);
        _seed(hook, contributor2, 1 ether);
        _pay(contributor3, 2 ether, terminal, projectId);
        skip(CAMPAIGN_DURATION + 1);

        // Redeem in reverse order: c3, then c2, then c1.
        uint256 b3 = contributor3.balance;
        vm.prank(contributor3);
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor3, projectId, 1_000 * 1e18, JBConstants.NATIVE_TOKEN, 0, payable(contributor3), bytes("")
        );
        assertEq(contributor3.balance - b3, 2 ether, "c3 exact regardless of order");

        uint256 b2 = contributor2.balance;
        vm.prank(contributor2);
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor2, projectId, 1_000 * 1e18, JBConstants.NATIVE_TOKEN, 0, payable(contributor2), bytes("")
        );
        assertEq(contributor2.balance - b2, 1 ether, "c2 exact regardless of order");

        uint256 b1 = contributor1.balance;
        vm.prank(contributor1);
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor1, projectId, 1_000 * 1e18, JBConstants.NATIVE_TOKEN, 0, payable(contributor1), bytes("")
        );
        assertEq(contributor1.balance - b1, 1 ether, "c1 exact regardless of order");
    }

    /// @notice A partial cash-out returns a proportional slice of the contribution,
    ///         and the remaining ledger stays exact for the rest.
    function testPartialRefundIsProportional() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        skip(28 days + 28 days + 1);
        ReopenPayHook hook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);

        // contributor1 pays 2 ETH at 500/ETH -> 1,000 tokens, tracked live.
        _pay(contributor1, 2 ether, terminal, projectId);
        assertEq(hook.ethContributed(contributor1), 2 ether);
        skip(CAMPAIGN_DURATION + 1);

        // Burn half the tokens -> get half the ETH back.
        uint256 before = contributor1.balance;
        vm.prank(contributor1);
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor1, projectId, 500 * 1e18, JBConstants.NATIVE_TOKEN, 0, payable(contributor1), bytes("")
        );
        assertApproxEqAbs(contributor1.balance - before, 1 ether, 5, "Half the tokens -> half the ETH");
        assertApproxEqAbs(hook.ethContributed(contributor1), 1 ether, 5, "Ledger decremented by the refund");

        // Burn the rest -> get the other half.
        before = contributor1.balance;
        vm.prank(contributor1);
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor1, projectId, 500 * 1e18, JBConstants.NATIVE_TOKEN, 0, payable(contributor1), bytes("")
        );
        assertApproxEqAbs(contributor1.balance - before, 1 ether, 5, "Remaining tokens -> remaining ETH");
    }

    /// @notice An original backer who was NOT seeded cannot pull a refund from the
    ///         re-open round (no contribution recorded for them).
    function testUnseededOriginalHolderCannotRefund() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        _pay(contributor1, 1 ether, terminal, projectId); // original, through the old hook
        skip(28 days + 28 days + 1);
        _reopen(missionId, projectId, terminal, REOPEN_WEIGHT); // no seeding
        skip(CAMPAIGN_DURATION + 1);

        vm.prank(contributor1);
        vm.expectRevert("No refundable contribution recorded for this holder.");
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor1, projectId, 1_000 * 1e18, JBConstants.NATIVE_TOKEN, 0, payable(contributor1), bytes("")
        );
    }

    /// @notice Seeding is owner-gated, rejects reserved holders, and can be frozen.
    function testSeedIsOwnerGatedAndLockable() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        skip(28 days + 28 days + 1);
        ReopenPayHook hook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);

        address[] memory holders = new address[](1);
        uint256[] memory eth = new uint256[](1);
        uint256[] memory toks = new uint256[](1);
        holders[0] = contributor1;
        eth[0] = 1 ether;
        toks[0] = 1000 * 1e18;

        // Non-owner cannot seed.
        vm.prank(randomCaller);
        vm.expectRevert();
        hook.seedContributions(holders, eth, toks);

        // Reserved holders cannot be seeded.
        address[] memory reserved = new address[](1);
        reserved[0] = missionCreator.missionIdToTeamVesting(missionId);
        vm.prank(teamAddress);
        vm.expectRevert("Cannot seed a reserved holder.");
        hook.seedContributions(reserved, eth, toks);

        // A one-sided seed (eth but no tokens) is rejected.
        uint256[] memory zeroToks = new uint256[](1);
        vm.prank(teamAddress);
        vm.expectRevert("Both eth and tokens required.");
        hook.seedContributions(holders, eth, zeroToks);

        // Mismatched array lengths are rejected.
        uint256[] memory twoEth = new uint256[](2);
        vm.prank(teamAddress);
        vm.expectRevert("Length mismatch.");
        hook.seedContributions(holders, twoEth, toks);

        // Owner seeds, then locks; further seeding is rejected.
        vm.prank(teamAddress);
        hook.seedContributions(holders, eth, toks);
        assertEq(hook.ethContributed(contributor1), 1 ether);
        assertEq(hook.refundableTokens(contributor1), 1000 * 1e18);

        vm.prank(teamAddress);
        hook.lockLedger();

        vm.prank(teamAddress);
        vm.expectRevert("Ledger is locked.");
        hook.seedContributions(holders, eth, toks);
    }

    /// @notice `setDeadline` lets the owner reset the countdown to Safe execution
    ///         time (deploy-time deadline → go-live deadline), but only while the
    ///         current deadline is still in the future. Once the deadline has
    ///         passed the campaign is either goal-met or in the refund window, and
    ///         resetting would let the owner block refunds and re-open payments.
    function testSetDeadlineIsOwnerGatedAndTimeBounded() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        skip(28 days + 28 days + 1);
        ReopenPayHook hook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);

        uint256 initialDeadline = hook.deadline();
        assertEq(initialDeadline, block.timestamp + CAMPAIGN_DURATION, "Initial deadline is deploy-time + duration");

        // Non-owner cannot reset the deadline.
        vm.prank(randomCaller);
        vm.expectRevert();
        hook.setDeadline(block.timestamp + CAMPAIGN_DURATION);

        // Owner extends the deadline while the campaign is still live.
        skip(1 days);
        uint256 extended = block.timestamp + CAMPAIGN_DURATION;
        vm.prank(teamAddress);
        hook.setDeadline(extended);
        assertEq(hook.deadline(), extended, "Owner can shift the deadline while campaign is live");

        // A deadline in the past (or now) is still rejected on the future-check.
        vm.prank(teamAddress);
        vm.expectRevert("Deadline must be in the future.");
        hook.setDeadline(block.timestamp);

        // Once the current deadline passes, setDeadline is blocked so the owner
        // cannot retroactively reopen the campaign or abort the refund window.
        skip(CAMPAIGN_DURATION + 1);
        vm.prank(teamAddress);
        vm.expectRevert("Deadline has already passed.");
        hook.setDeadline(block.timestamp + CAMPAIGN_DURATION);
    }

    /// @notice Deadline reset after the refund window opens would block refunds
    ///         (`beforeCashOutRecordedWith` requires `block.timestamp >= deadline`)
    ///         and re-open pays (`beforePayRecordedWith` only rejects once
    ///         `block.timestamp >= deadline`). The `setDeadline` guard prevents
    ///         that abuse path; a refund attempted after a reset attempt still
    ///         succeeds against the ORIGINAL deadline.
    function testSetDeadlineCannotAbortRefundWindow() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        skip(28 days + 28 days + 1);
        ReopenPayHook hook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);

        _pay(contributor1, 1 ether, terminal, projectId);
        uint256 tokens = jbTokens.totalBalanceOf(contributor1, projectId);

        // Refund window opens once the deadline passes with the goal unmet.
        skip(CAMPAIGN_DURATION + 1);
        assertEq(hook.stage(address(terminal), projectId), 3, "Refund stage should be open");

        // Owner tries to reset the deadline into the future — must revert so the
        // refund window stays open and no new pay slips in against a stale deadline.
        vm.prank(teamAddress);
        vm.expectRevert("Deadline has already passed.");
        hook.setDeadline(block.timestamp + CAMPAIGN_DURATION);

        // The refund still goes through under the original deadline.
        uint256 balanceBefore = contributor1.balance;
        vm.prank(contributor1);
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor1, projectId, tokens, JBConstants.NATIVE_TOKEN, 0, payable(contributor1), bytes("")
        );
        assertApproxEqAbs(contributor1.balance - balanceBefore, 1 ether, 10, "Refund honored against original deadline");
    }

    /// @notice REENTRANCY: a malicious contributor whose `receive()` re-enters
    ///         `cashOutTokensOf` during the refund ETH transfer cannot drain more
    ///         than they contributed. The refund price is derived only from the
    ///         hook's own ledger, which is untouched until after the ETH send, so the
    ///         nested claims for a holder sum to exactly their contribution.
    function testReentrantCashOutCannotOverdraw() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        // Honest backers fill the pot so there is something to steal.
        _pay(contributor1, 5 ether, terminal, projectId);
        skip(28 days + 28 days + 1);
        ReopenPayHook hook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);
        _seed(hook, contributor1, 5 ether); // 5,000 tokens

        // Attacker contributes 2 ETH at the re-open rate -> 1,000 tokens.
        ReentrantCasher attacker = new ReentrantCasher(IJBMultiTerminal(address(terminal)), projectId);
        vm.deal(address(attacker), 2 ether);
        attacker.contribute(2 ether);
        assertEq(hook.ethContributed(address(attacker)), 2 ether);
        assertEq(address(attacker).balance, 0, "Attacker spent its entire balance contributing");
        assertEq(jbTokens.totalBalanceOf(address(attacker), projectId), 1_000 * 1e18);

        skip(CAMPAIGN_DURATION + 1);

        uint256 potBefore = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        // Attacker tries to re-enter on the refund. Arm it to cash out the remainder
        // during the first refund's ETH callback.
        attacker.arm(500 * 1e18);
        attacker.attack(500 * 1e18);

        // Despite re-entering, the attacker recovers at most their 2 ETH — never the
        // honest backer's funds.
        assertLe(address(attacker).balance, 2 ether + 5, "Attacker cannot profit from reentrancy");
        // The honest backer's 5 ETH is still fully claimable.
        uint256 potAfter = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertGe(potAfter, potBefore - 2 ether - 5, "Pot only debited by the attacker's own contribution");

        uint256 b1 = contributor1.balance;
        vm.prank(contributor1);
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor1, projectId, 5_000 * 1e18, JBConstants.NATIVE_TOKEN, 0, payable(contributor1), bytes("")
        );
        assertApproxEqAbs(contributor1.balance - b1, 5 ether, 10, "Honest backer still gets their full 5 ETH");
    }

    /// @notice Defensive guard: beforeCashOutRecordedWith rejects a cash-out that
    ///         exceeds the holder's recorded backing tokens (which would otherwise
    ///         let a desynced ledger over-refund). Exercised by calling the view hook
    ///         directly, since the terminal's own supply check would otherwise mask it.
    function testCashOutCannotExceedRecordedTokens() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        skip(28 days + 28 days + 1);
        ReopenPayHook hook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);
        _seedWithTokens(hook, contributor1, 1 ether, 500 * 1e18);
        skip(CAMPAIGN_DURATION + 1);

        JBBeforeCashOutRecordedContext memory ctx;
        ctx.terminal = address(terminal);
        ctx.holder = contributor1;
        ctx.projectId = projectId;
        ctx.cashOutCount = 501 * 1e18; // one token more than recorded
        ctx.totalSupply = 1_000_000 * 1e18;
        ctx.surplus = JBTokenAmount({token: JBConstants.NATIVE_TOKEN, decimals: 18, currency: 61166, value: 10 ether});
        ctx.cashOutTaxRate = 0;

        vm.expectRevert("Cash out exceeds refundable tokens.");
        hook.beforeCashOutRecordedWith(ctx);

        // Exactly the recorded amount is fine.
        ctx.cashOutCount = 500 * 1e18;
        hook.beforeCashOutRecordedWith(ctx);
    }

    /// @notice Donations to the terminal (addToBalance) do not inflate refunds: each
    ///         backer still gets exactly their contribution, and the donation is inert.
    function testDonationDoesNotInflateRefund() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        skip(28 days + 28 days + 1);
        ReopenPayHook hook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);
        _pay(contributor1, 1 ether, terminal, projectId); // 500 tokens, 1 ETH recorded

        // Someone donates 10 ETH straight to the terminal balance.
        vm.deal(user1, 20 ether);
        vm.prank(user1);
        IJBMultiTerminal(address(terminal)).addToBalanceOf{value: 10 ether}(
            projectId, JBConstants.NATIVE_TOKEN, 10 ether, false, "", bytes("")
        );

        skip(CAMPAIGN_DURATION + 1);

        uint256 before = contributor1.balance;
        vm.prank(contributor1);
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            contributor1, projectId, 500 * 1e18, JBConstants.NATIVE_TOKEN, 0, payable(contributor1), bytes("")
        );
        assertApproxEqAbs(contributor1.balance - before, 1 ether, 5, "Refund is the contribution, not a share of the donation");
    }

    /// @notice Only the project terminal can drive the ledger hooks; a direct call
    ///         from an attacker is rejected.
    function testHooksRejectNonTerminalCaller() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        skip(28 days + 28 days + 1);
        ReopenPayHook hook = _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);

        JBAfterPayRecordedContext memory payCtx;
        payCtx.projectId = projectId;
        payCtx.beneficiary = randomCaller;
        payCtx.amount = JBTokenAmount({token: JBConstants.NATIVE_TOKEN, decimals: 18, currency: 61166, value: 100 ether});
        payCtx.newlyIssuedTokenCount = 100_000 * 1e18;

        vm.prank(randomCaller);
        vm.expectRevert("Caller is not the project terminal.");
        hook.afterPayRecordedWith(payCtx);

        JBAfterCashOutRecordedContext memory outCtx;
        outCtx.projectId = projectId;
        outCtx.holder = randomCaller;
        outCtx.cashOutCount = 1;
        outCtx.reclaimedAmount = JBTokenAmount({token: JBConstants.NATIVE_TOKEN, decimals: 18, currency: 61166, value: 0});

        vm.prank(randomCaller);
        vm.expectRevert("Caller is not the project terminal.");
        hook.afterCashOutRecordedWith(outCtx);
    }

    /// @notice Reserved-token allocations (vesting contracts, pool deployer) cannot
    ///         cash out: they are excluded from the refund denominator, so letting
    ///         them redeem would overdraw the pot.
    function testReservedHoldersCannotCashOut() public {
        _createTeam();
        uint256 missionId = _createMission(1_000 ether);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        _pay(contributor1, 1 ether, terminal, projectId);
        skip(28 days + 28 days + 1);
        _reopen(missionId, projectId, terminal, REOPEN_WEIGHT);
        _pay(contributor2, 1 ether, terminal, projectId);

        // Mint the reserved tokens to the vesting contracts
        jbController.sendReservedTokensToSplitsOf(projectId);
        address teamVesting = missionCreator.missionIdToTeamVesting(missionId);
        uint256 vestingTokens = jbTokens.totalBalanceOf(teamVesting, projectId);
        assertGt(vestingTokens, 0, "Vesting received reserved tokens");

        skip(CAMPAIGN_DURATION + 1); // refund window opens

        vm.prank(teamVesting);
        vm.expectRevert("Reserved token allocations cannot cash out.");
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            teamVesting, projectId, vestingTokens, JBConstants.NATIVE_TOKEN, 0, payable(teamVesting), bytes("")
        );
    }

}
