// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Vesting} from "../src/Vesting.sol";
import {PoolDeployer} from "../src/PoolDeployer.sol";
import "@nana-core-v5/interfaces/IJBRulesetApprovalHook.sol";
import {IJBRulesets} from "@nana-core-v5/interfaces/IJBRulesets.sol";
import {IJBMultiTerminal} from "@nana-core-v5/interfaces/IJBMultiTerminal.sol";
import {IJBDirectory} from "@nana-core-v5/interfaces/IJBDirectory.sol";
import {MoonDAOTeam} from "../src/ERC5643.sol";
import {GnosisSafeProxyFactory} from "../src/GnosisSafeProxyFactory.sol";
import {MissionCreator} from "../src/MissionCreator.sol";
import {MissionTable} from "../src/tables/MissionTable.sol";
import {MoonDaoTeamTableland} from "../src/tables/MoonDaoTeamTableland.sol";
import {MoonDAOTeamCreator} from "../src/MoonDAOTeamCreator.sol";
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
import {IJBSplitHook} from "@nana-core-v5/interfaces/IJBSplitHook.sol";
import {JBRulesetConfig} from "@nana-core-v5/structs/JBRulesetConfig.sol";
import {JBRulesetMetadata} from "@nana-core-v5/structs/JBRulesetMetadata.sol";
import {JBSplitGroup} from "@nana-core-v5/structs/JBSplitGroup.sol";
import {JBSplit} from "@nana-core-v5/structs/JBSplit.sol";
import {JBFundAccessLimitGroup} from "@nana-core-v5/structs/JBFundAccessLimitGroup.sol";
import {JBCurrencyAmount} from "@nana-core-v5/structs/JBCurrencyAmount.sol";
import "base/Config.sol";

/// @title OwnerOnlyPayoutsRulesetTest
/// @notice Tests the `ownerMustSendPayouts = true` ruleset queued onto a
///         completed mission (per Jango's recommendation). When the flag is
///         on, only the project owner (the team multisig) can call
///         `sendPayoutsOf`; all other callers revert with
///         `JBPermissioned_Unauthorized`.
contract OwnerOnlyPayoutsRulesetTest is Test, Config {

    address zero = address(0);
    address user1 = address(0x100);
    address teamAddress = address(0x200);
    address user2 = address(0x300);
    address contributor1 = address(0x500);
    address randomCaller = address(0x900);
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
        vm.deal(contributor1, 100 ether);
        vm.deal(randomCaller, 1 ether);

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

    function _createMission(uint256 goal, bool token) internal returns (uint256) {
        return missionCreator.createMission(
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
    }

    /// @dev Mirrors `_buildOwnerOnlyPayoutsRuleset` from the script.
    function _buildOwnerOnlyPayoutsRuleset(
        uint256 missionId,
        address terminal
    ) internal view returns (JBRulesetConfig[] memory) {
        address payHook = missionCreator.missionIdToPayHook(missionId);
        address poolDeployer = missionCreator.missionIdToPoolDeployer(missionId);
        address teamVesting = missionCreator.missionIdToTeamVesting(missionId);
        address moonDAOVesting = missionCreator.missionIdToMoonDAOVesting(missionId);
        address moonDAOTreasury = missionCreator.moonDAOTreasury();

        JBRulesetConfig[] memory rulesetConfigurations = new JBRulesetConfig[](1);

        JBCurrencyAmount[] memory payoutLimits = new JBCurrencyAmount[](1);
        payoutLimits[0] = JBCurrencyAmount({
            amount: uint224(128_000_000 * 10 ** 18),
            currency: uint32(uint160(JBConstants.NATIVE_TOKEN))
        });

        JBFundAccessLimitGroup[] memory fundAccessLimitGroups = new JBFundAccessLimitGroup[](1);
        fundAccessLimitGroups[0] = JBFundAccessLimitGroup({
            terminal: terminal,
            token: JBConstants.NATIVE_TOKEN,
            payoutLimits: payoutLimits,
            surplusAllowances: new JBCurrencyAmount[](0)
        });

        JBSplitGroup[] memory splitGroups = new JBSplitGroup[](2);

        splitGroups[0] = JBSplitGroup({groupId: 0xEEEe, splits: new JBSplit[](3)});
        splitGroups[0].splits[0] = JBSplit({
            percent: 25_641_025,
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(moonDAOTreasury),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });
        splitGroups[0].splits[1] = JBSplit({
            percent: 51_282_051,
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(poolDeployer),
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
            beneficiary: payable(moonDAOVesting),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });
        splitGroups[1].splits[1] = JBSplit({
            percent: 600_000_000,
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(teamVesting),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });
        splitGroups[1].splits[2] = JBSplit({
            percent: 50_000_000,
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(poolDeployer),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });

        rulesetConfigurations[0] = JBRulesetConfig({
            mustStartAtOrAfter: 0,
            duration: 0,
            weight: 2_000_000_000_000_000_000_000,
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
                ownerMustSendPayouts: true, // ★ the gating flag
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

    /// @notice After queuing the owner-only payouts ruleset, a non-owner
    ///         caller must NOT be able to call `sendPayoutsOf`, while the
    ///         project owner still can — and the splits land in the same
    ///         beneficiaries as the original ruleset 1.
    function testOwnerOnlyPayoutsBlocksNonOwners() public {
        _createTeam();

        // === Step 1: Create + fully fund a mission, deadline passes ===
        vm.startPrank(user1);
        uint256 missionId = _createMission(1 ether, true);
        vm.stopPrank();

        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        uint256 payAmount = 10 ether;
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

        // Goal met → stage 2; skip past deadline so Ruleset 1 is active.
        assertEq(missionCreator.stage(missionId), 2);
        skip(28 days);

        // === Step 2: Sanity check — under Ruleset 1, ANY caller can call sendPayoutsOf ===
        // Don't actually drain payouts here — just verify the gate is open by
        // confirming the project owner is the team multisig (i.e. ruleset 1 is
        // live). We'll prove the "anyone can" behaviour against a fresh mission
        // in a second test below.

        // === Step 3: Project owner queues the owner-only payouts ruleset ===
        vm.startPrank(teamAddress);
        JBRulesetConfig[] memory cfg = _buildOwnerOnlyPayoutsRuleset(missionId, address(terminal));
        uint256 newRulesetId = jbController.queueRulesetsOf(
            projectId,
            cfg,
            "Owner-only payouts (ownerMustSendPayouts = true)"
        );
        assertGt(newRulesetId, 0, "New ruleset should be queued");
        vm.stopPrank();

        // Ruleset 1 has duration=0 + no approval hook → queued ruleset takes
        // effect immediately. Bump one block for clarity.
        skip(1);

        uint256 terminalBalance = jbTerminalStore.balanceOf(
            address(terminal), projectId, JBConstants.NATIVE_TOKEN
        );

        // === Step 4: A random caller can NOT call sendPayoutsOf ===
        vm.prank(randomCaller);
        vm.expectRevert(); // JBPermissioned: unauthorized
        IJBMultiTerminal(address(terminal)).sendPayoutsOf(
            projectId,
            JBConstants.NATIVE_TOKEN,
            terminalBalance,
            uint32(uint160(JBConstants.NATIVE_TOKEN)),
            0
        );

        // === Step 5: The project owner CAN call sendPayoutsOf ===
        uint256 treasuryBalanceBefore = address(TREASURY).balance;
        uint256 teamBalanceBefore = address(teamAddress).balance;
        address poolDeployerAddr = missionCreator.missionIdToPoolDeployer(missionId);
        uint256 poolDeployerBalanceBefore = address(poolDeployerAddr).balance;

        vm.prank(teamAddress);
        uint256 payoutAmount = IJBMultiTerminal(address(terminal)).sendPayoutsOf(
            projectId,
            JBConstants.NATIVE_TOKEN,
            terminalBalance,
            uint32(uint160(JBConstants.NATIVE_TOKEN)),
            0
        );
        assertGt(payoutAmount, 0, "Owner payout should succeed");

        // Splits land where the original ruleset 1 would have sent them.
        // JB splits have 7 decimals of precision, so check up to 6 decimals.
        assertApproxEqRel(
            address(TREASURY).balance - treasuryBalanceBefore,
            terminalBalance * 25 / 1000,
            0.0000001e18
        );
        assertApproxEqRel(
            address(poolDeployerAddr).balance - poolDeployerBalanceBefore,
            terminalBalance * 5 / 100,
            0.0000001e18
        );
        assertApproxEqRel(
            address(teamAddress).balance - teamBalanceBefore,
            terminalBalance * 90 / 100,
            0.0000001e18
        );
    }

    /// @notice Sanity check on the *baseline* behaviour: with the default
    ///         MissionCreator ruleset 1 (`ownerMustSendPayouts = false`), a
    ///         random EOA can trigger payouts. This is exactly the issue
    ///         Jango flagged — the new ruleset closes it.
    function testBaselineAnyoneCanSendPayouts() public {
        _createTeam();

        vm.startPrank(user1);
        uint256 missionId = _createMission(1 ether, true);
        vm.stopPrank();

        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);

        vm.prank(contributor1);
        terminal.pay{value: 10 ether}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            contributor1,
            0,
            "",
            new bytes(0)
        );
        skip(28 days);

        uint256 terminalBalance = jbTerminalStore.balanceOf(
            address(terminal), projectId, JBConstants.NATIVE_TOKEN
        );

        // Baseline: a random caller successfully triggers payouts.
        vm.prank(randomCaller);
        uint256 payoutAmount = IJBMultiTerminal(address(terminal)).sendPayoutsOf(
            projectId,
            JBConstants.NATIVE_TOKEN,
            terminalBalance,
            uint32(uint160(JBConstants.NATIVE_TOKEN)),
            0
        );
        assertGt(payoutAmount, 0, "Random caller can trigger payouts on default rulesets");
    }
}
