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

   

    /// @notice Regression test: with the MissionCreator default of
    ///         `ownerMustSendPayouts = true` for newly created missions, a
    ///         random EOA must NOT be able to call `sendPayoutsOf`. Only the
    ///         project owner (team Safe) can.
    function testBaselineOwnerOnlyPayoutsByDefault() public {
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

        // Random caller is BLOCKED on freshly-created missions.
        vm.prank(randomCaller);
        vm.expectRevert();
        IJBMultiTerminal(address(terminal)).sendPayoutsOf(
            projectId,
            JBConstants.NATIVE_TOKEN,
            terminalBalance,
            uint32(uint160(JBConstants.NATIVE_TOKEN)),
            0
        );

        // Project owner (team Safe) CAN still send payouts.
        vm.prank(teamAddress);
        uint256 payoutAmount = IJBMultiTerminal(address(terminal)).sendPayoutsOf(
            projectId,
            JBConstants.NATIVE_TOKEN,
            terminalBalance,
            uint32(uint160(JBConstants.NATIVE_TOKEN)),
            0
        );
        assertGt(payoutAmount, 0, "Owner must still be able to send payouts");
    }
}
