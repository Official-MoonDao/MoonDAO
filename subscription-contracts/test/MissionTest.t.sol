// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {Vesting} from "../src/Vesting.sol";
import {IJBRulesets} from "@nana-core/interfaces/IJBRulesets.sol";
import {IJBMultiTerminal} from "@nana-core/interfaces/IJBMultiTerminal.sol";
import {IJBDirectory} from "@nana-core/interfaces/IJBDirectory.sol";
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
import {IJBTerminal} from "@nana-core/interfaces/IJBTerminal.sol";
import {IJBTokens} from "@nana-core/interfaces/IJBTokens.sol";
import {JBConstants} from "@nana-core/libraries/JBConstants.sol";
import {IJBController} from "@nana-core/interfaces/IJBController.sol";
import {IJBTerminalStore} from "@nana-core/interfaces/IJBTerminalStore.sol";

contract MissionTest is Test {

    address zero = address(0);
    address user1 = address(0x1);
    address teamAddress = address(0x2);
    address user2 = address(0x3);
    address user4 = address(0x4);
    address TREASURY = user4;

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


    function setUp() public {
        vm.deal(user1, 100 ether);

        vm.startPrank(user1);

        Hats hatsBase = new Hats("", "");
        IHats hats = IHats(address(hatsBase));
        HatsModuleFactory hatsFactory = deployModuleFactory(hats, SALT, "");
        PassthroughModule passthrough = new PassthroughModule("");
        address gnosisSafeAddress = address(0x0165878A594ca255338adfa4d48449f69242Eb8F);
        GnosisSafeProxyFactory proxyFactory = new GnosisSafeProxyFactory();

        Whitelist teamWhitelist = new Whitelist();
        Whitelist teamDiscountList = new Whitelist();

        moonDAOTeamTable = new MoonDaoTeamTableland("MoonDaoTeamTable");
        moonDAOTeam = new MoonDAOTeam("erc5369", "ERC5643", TREASURY, address(hatsBase), address(teamDiscountList));
        moonDAOTeamCreator = new MoonDAOTeamCreator(address(hatsBase), address(hatsFactory), address(passthrough), address(moonDAOTeam), gnosisSafeAddress, address(proxyFactory), address(moonDAOTeamTable), address(teamWhitelist));
        jbDirectory = IJBDirectory(0x0bC9F153DEe4d3D474ce0903775b9b2AAae9AA41);


        uint256 topHatId = hats.mintTopHat(user1, "", "");
        uint256 moonDAOTeamAdminHatId = hats.createHat(topHatId, "", 1, TREASURY, TREASURY, true, "");

        moonDAOTeamCreator.setOpenAccess(true);
        moonDAOTeamTable.setMoonDaoTeam(address(moonDAOTeam));
        moonDAOTeamCreator.setMoonDaoTeamAdminHatId(moonDAOTeamAdminHatId);
        moonDAOTeam.setMoonDaoCreator(address(moonDAOTeamCreator));
        hats.mintHat(moonDAOTeamAdminHatId, address(moonDAOTeamCreator));
        address jbMultiTerminalAddress = address(0xDB9644369c79C3633cDE70D2Df50d827D7dC7Dbc);
        address jbProjectsAddress = address(0x0b538A02610d7d3Cc91Ce2870F423e0a34D646AD);

        address jbTerminalStoreAddress = address(0x6F6740ddA12033ca9fBAA56693194E38cfD36827);
        address jbControllerAddress = address(0xb291844F213047Eb9e1621AE555B1Eae6700d553);
        address jbRulesetsAddress = address(0xDA86EeDb67C6C9FB3E58FE83Efa28674D7C89826);
        jbRulesets = IJBRulesets(jbRulesetsAddress);
        jbTerminalStore = IJBTerminalStore(jbTerminalStoreAddress);
        jbTokens = IJBTokens(0xA59e9F424901fB9DBD8913a9A32A081F9425bf36);
        jbController = IJBController(jbControllerAddress);

        missionCreator = new MissionCreator(jbControllerAddress, jbMultiTerminalAddress, jbProjectsAddress, jbTerminalStoreAddress, jbRulesetsAddress, address(moonDAOTeam), zero, TREASURY);
        missionTable = new MissionTable("TestMissionTable", address(missionCreator));
        missionCreator.setMissionTable(address(missionTable));

        vm.stopPrank();
    }

    function testCreateTeamProject() public {
        vm.startPrank(user1);
        moonDAOTeamCreator.createMoonDAOTeam{value: 0.555 ether}("", "", "","name", "bio", "image", "twitter", "communications", "website", "view", "formId", new address[](0));
        uint256 missionId = missionCreator.createMission(
           0,
           teamAddress,
           "",
           10_000_000_000_000_000_000,
           0,
           true,
           "TEST TOKEN",
           "TEST",
           "This is a test project"
        );
        assertEq(missionCreator.stage(missionId), 1);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);

        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);
        uint256 balance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balance, 0);

        uint256 payAmount1 = 2_000_000_000_000_000_000;
        terminal.pay{value: payAmount1}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            user1,
            0,
            "",
            new bytes(0)
        );
        uint256 balanceAfter1 = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balanceAfter1, payAmount1);
        uint256 tokensAfter1 = jbTokens.totalBalanceOf(user1, projectId);
        assertEq(tokensAfter1, payAmount1 * 1_000);
        assertEq(missionCreator.stage(missionId), 1);

        vm.stopPrank();
    }

    function testCreateTeamProjectZeroGoal() public {
        vm.startPrank(user1);
        moonDAOTeamCreator.createMoonDAOTeam{value: 0.555 ether}("", "", "","name", "bio", "image", "twitter", "communications", "website", "view", "formId", new address[](0));
        uint256 missionId = missionCreator.createMission(
           0,
           teamAddress,
           "",
           0,
           0,
           true,
           "TEST TOKEN",
           "TEST",
           "This is a test project"
        );
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);

        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);
        uint256 balance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balance, 0);

        uint256 payAmount1 = 1_000_000_000_000_000_000;
        terminal.pay{value: payAmount1}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            user1,
            0,
            "",
            new bytes(0)
        );
        uint256 balanceAfter1 = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balanceAfter1, payAmount1);
        uint256 tokensAfter1 = jbTokens.totalBalanceOf(user1, projectId);
        assertEq(tokensAfter1, payAmount1 * 1_000);

        vm.stopPrank();
    }

    function testCreateTeamProjectReachesDeadline() public {
        vm.startPrank(user1);
        moonDAOTeamCreator.createMoonDAOTeam{value: 0.555 ether}("", "", "","name", "bio", "image", "twitter", "communications", "website", "view", "formId", new address[](0));
        uint256 missionId = missionCreator.createMission(
           0,
           user1,
           "",
           10_000_000_000_000_000_000,
           0,
           true,
           "TEST TOKEN",
           "TEST",
           "This is a test project"
        );
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);

        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);
        uint256 balance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balance, 0);

        skip(28 days);
        uint256 payAmount = 1_000_000_000_000_000_000;
        vm.expectRevert();
        terminal.pay{value: payAmount}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            user1,
            0,
            "",
            new bytes(0)
        );
    }

    function testCreateTeamProjectHugePayment() public {
        vm.startPrank(user1);
        moonDAOTeamCreator.createMoonDAOTeam{value: 0.555 ether}("", "", "","name", "bio", "image", "twitter", "communications", "website", "view", "formId", new address[](0));
        uint256 missionId = missionCreator.createMission(
           0,
           teamAddress,
           "",
           10_000_000_000_000_000_000,
           0,
           true,
           "TEST TOKEN",
           "TEST",
           "This is a test project"
        );
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);

        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);
        uint256 balance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balance, 0);

        uint256 payAmount = 20_000_000_000_000_000_000;
        terminal.pay{value: payAmount}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            user1,
            0,
            "",
            new bytes(0)
        );
        uint256 balanceAfter1 = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balanceAfter1, payAmount);
        uint256 tokensAfter1 = jbTokens.totalBalanceOf(user1, projectId);
        assertEq(tokensAfter1, payAmount * 1_000);
    }

    function testCreateTeamProjectFundingTurnedOff() public {
        vm.startPrank(user1);
        moonDAOTeamCreator.createMoonDAOTeam{value: 0.555 ether}("", "", "","name", "bio", "image", "twitter", "communications", "website", "view", "formId", new address[](0));
        uint256 missionId = missionCreator.createMission(
           0,
           teamAddress,
           "",
           10_000_000_000_000_000_000,
           0,
           true,
           "TEST TOKEN",
           "TEST",
           "This is a test project"
        );
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        address payhookAddress = missionCreator.missionIdToPayHook(missionId);
        LaunchPadPayHook payhook = LaunchPadPayHook(payhookAddress);


        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);
        vm.startPrank(teamAddress);
        payhook.setFundingTurnedOff(true);
        vm.stopPrank();

        uint256 payAmount = 1_000_000_000_000_000_000;
        vm.expectRevert();
        terminal.pay{value: payAmount}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            user1,
            0,
            "",
            new bytes(0)
        );
    }

    function testCreateTeamProjectCashout() public {
        vm.startPrank(user1);
        uint256 deadline = block.timestamp + 2 days;
        moonDAOTeamCreator.createMoonDAOTeam{value: 0.555 ether}("", "", "","name", "bio", "image", "twitter", "communications", "website", "view", "formId", new address[](0));
        uint256 missionId = missionCreator.createMission(
           0,
           teamAddress,
           "",
           10_000_000_000_000_000_000,
           0,
           true,
           "TEST TOKEN",
           "TEST",
           "This is a test project"
        );
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);

        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);
        uint256 balance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balance, 0);

        uint256 payAmount = 1_000_000_000_000_000_000;
        terminal.pay{value: payAmount}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            user1,
            0,
            "",
            new bytes(0)
        );
        uint256 balanceAfter1 = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balanceAfter1, payAmount);
        uint256 tokensAfter1 = jbTokens.totalBalanceOf(user1, projectId);
        assertEq(tokensAfter1, 1_000 * 1e18);

        uint256 user1BalanceBefore = address(user1).balance;
        skip(28 days);
        assertEq(missionCreator.stage(missionId), 3);
        uint256 cashOutAmount = IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            user1,
            projectId,
            tokensAfter1,
            JBConstants.NATIVE_TOKEN,
            0,
            payable(user1),
            bytes(""));
        uint256 user1BalanceAfter = address(user1).balance;
        assertEq(user1BalanceAfter - user1BalanceBefore, payAmount);
        uint256 tokensAfter2 = jbTokens.totalBalanceOf(user1, projectId);
        assertEq(tokensAfter2, 0);
    }

    function testCreateTeamProjectCashoutMultipleContributors() public {
        vm.startPrank(user1);
        uint256 deadline = block.timestamp + 2 days;
        moonDAOTeamCreator.createMoonDAOTeam{value: 0.555 ether}("", "", "","name", "bio", "image", "twitter", "communications", "website", "view", "formId", new address[](0));
        uint256 missionId = missionCreator.createMission(
           0,
           teamAddress,
           "",
           10_000_000_000_000_000_000,
           0,
           true,
           "TEST TOKEN",
           "TEST",
           "This is a test project"
        );
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);

        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);
        uint256 balance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balance, 0);

        uint256 payAmount = 1_000_000_000_000_000_000;
        terminal.pay{value: payAmount}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            user1,
            0,
            "",
            new bytes(0)
        );
        uint256 balanceAfter1 = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balanceAfter1, payAmount);
        uint256 user1TokensAfter = jbTokens.totalBalanceOf(user1, projectId);
        assertEq(user1TokensAfter, 1_000 * 1e18);
        vm.stopPrank();

        vm.prank(user2);
        terminal.pay{value: payAmount/2}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            user2,
            0,
            "",
            new bytes(0)
        );
        uint256 user2TokensAfter = jbTokens.totalBalanceOf(user2, projectId);
        assertEq(user2TokensAfter, 500 * 1e18);

        uint256 user1BalanceBefore = address(user1).balance;
        uint256 user2BalanceBefore = address(user2).balance;
        skip(28 days);
        assertEq(missionCreator.stage(missionId), 3);


        vm.prank(user1);
        uint256 user1CashOutAmount = IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            user1,
            projectId,
            user1TokensAfter,
            JBConstants.NATIVE_TOKEN,
            0,
            payable(user1),
            bytes(""));
        uint256 user1BalanceAfter = address(user1).balance;
        assertEq(user1CashOutAmount, payAmount);
        assertEq(user1BalanceAfter - user1BalanceBefore, payAmount);
        assertEq(jbTokens.totalBalanceOf(user1, projectId), 0);
        assertEq(jbTokens.totalBalanceOf(zero, projectId), 0);

        vm.prank(user2);
        uint256 user2CashOutAmount = IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            user2,
            projectId,
            user2TokensAfter,
            JBConstants.NATIVE_TOKEN,
            0,
            payable(user2),
            bytes(""));
        uint256 user2BalanceAfter = address(user2).balance;
        assertEq(user2CashOutAmount, payAmount/2);
        assertEq(user2BalanceAfter - user2BalanceBefore, payAmount/2);
        assertEq(jbTokens.totalBalanceOf(user2, projectId), 0);
    }


    function testCreateTeamProjectCashoutEarly() public {
        vm.startPrank(user1);
        uint256 deadline = block.timestamp + 2 days;
        moonDAOTeamCreator.createMoonDAOTeam{value: 0.555 ether}("", "", "","name", "bio", "image", "twitter", "communications", "website", "view", "formId", new address[](0));
        uint256 missionId = missionCreator.createMission(
           0,
           teamAddress,
           "",
           10_000_000_000_000_000_000,
           0,
           true,
           "TEST TOKEN",
           "TEST",
           "This is a test project"
        );
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);

        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);
        uint256 balance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balance, 0);

        uint256 payAmount = 1_000_000_000_000_000_000;
        terminal.pay{value: payAmount}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            user1,
            0,
            "",
            new bytes(0)
        );
        uint256 balanceAfter1 = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balanceAfter1, payAmount);
        uint256 tokensAfter1 = jbTokens.totalBalanceOf(user1, projectId);
        assertEq(tokensAfter1, 1_000 * 1e18);

        vm.expectRevert();
        uint256 cashOutAmount = IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            user1,
            projectId,
            tokensAfter1,
            JBConstants.NATIVE_TOKEN,
            0,
            payable(user1),
            bytes(""));
    }

    function testCreateTeamProjectCashoutCashoutAfterMinFundingMet() public {
        vm.startPrank(user1);
        uint256 deadline = block.timestamp + 2 days;
        moonDAOTeamCreator.createMoonDAOTeam{value: 0.555 ether}("", "", "","name", "bio", "image", "twitter", "communications", "website", "view", "formId", new address[](0));
        uint256 missionId = missionCreator.createMission(
           0,
           teamAddress,
           "",
           10_000_000_000_000_000_000,
           0,
           true,
           "TEST TOKEN",
           "TEST",
           "This is a test project"
        );
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);

        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);
        uint256 balance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balance, 0);

        uint256 payAmount = 1_000_000_000_000_000_000;
        terminal.pay{value: payAmount}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            user1,
            0,
            "",
            new bytes(0)
        );
        uint256 balanceAfter1 = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balanceAfter1, payAmount);
        uint256 tokensAfter1 = jbTokens.totalBalanceOf(user1, projectId);
        assertEq(tokensAfter1, 1_000 * 1e18);

        skip(2 days);
        vm.expectRevert();
        uint256 cashOutAmount = IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            user1,
            projectId,
            tokensAfter1,
            JBConstants.NATIVE_TOKEN,
            0,
            payable(user1),
            bytes(""));
    }

    function testCreateTeamProjectVestTokens() public {
        vm.startPrank(user1);
        uint256 deadline = block.timestamp + 2 days;
        moonDAOTeamCreator.createMoonDAOTeam{value: 0.555 ether}("", "", "","name", "bio", "image", "twitter", "communications", "website", "view", "formId", new address[](0));
        uint256 missionId = missionCreator.createMission(
           0,
           teamAddress,
           "",
           10_000_000_000_000_000_000,
           0,
           true,
           "TEST TOKEN",
           "TEST",
           "This is a test project"
        );
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);

        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);
        uint256 balance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balance, 0);

        // Lower payment that numbers work out nice, 500 contributor tokens, and 500 reserved tokens.
        uint256 payAmount = 500_000_000_000_000_000;
        terminal.pay{value: payAmount}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            user1,
            0,
            "",
            new bytes(0)
        );
        uint256 balanceAfter1 = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balanceAfter1, payAmount);
        uint256 tokensAfter1 = jbTokens.totalBalanceOf(user1, projectId);
        assertEq(tokensAfter1, 500 * 1e18);

        // FIXME this needs to be called once the token is launched
        jbController.sendReservedTokensToSplitsOf(projectId);

        Vesting teamVesting = Vesting(missionCreator.missionIdToTeamVesting(missionId));
        Vesting moonDAOVesting = Vesting(missionCreator.missionIdToMoonDAOVesting(missionId));
        uint256 tokensTeamVesting = jbTokens.totalBalanceOf(address(teamVesting), projectId);
        uint256 tokensMoonDAOVesting = jbTokens.totalBalanceOf(address(moonDAOVesting), projectId);
        assertEq(tokensTeamVesting, 300 * 1e18);
        assertEq(tokensMoonDAOVesting, 100 * 1e18);
        assertEq(jbTokens.totalBalanceOf(TREASURY, projectId), 0);
        assertEq(jbTokens.totalBalanceOf(teamAddress, projectId), 0);

        skip(200 days);
        assertEq(teamVesting.vestedAmount(), 0);
        assertEq(moonDAOVesting.vestedAmount(), 0);
        skip(165 days);
        assertEq(teamVesting.vestedAmount(), 300/4 * 1e18);
        assertEq(moonDAOVesting.vestedAmount(), 100/4 * 1e18);

        vm.startPrank(TREASURY);
        moonDAOVesting.withdraw();
        vm.stopPrank();
        assertEq(jbTokens.totalBalanceOf(TREASURY, projectId), 100/4 * 1e18);

        skip(365 days);
        assertEq(teamVesting.vestedAmount(), 300/2 * 1e18);
        assertEq(moonDAOVesting.vestedAmount(), 100/2 * 1e18);

        vm.startPrank(TREASURY);
        moonDAOVesting.withdraw();
        vm.stopPrank();
        assertEq(jbTokens.totalBalanceOf(TREASURY, projectId), 100/2 * 1e18);
    }

    function testSetJBController() public {
        vm.prank(user1);
        missionCreator.setJBController(address(0));
    }

    function testSetJBMultiTerminal() public {
        vm.prank(user1);
        missionCreator.setJBMultiTerminal(address(0));
    }

    function testSetMoonDAOTreasury() public {
        vm.prank(user1);
        missionCreator.setMoonDAOTreasury(address(0));
    }

    function testSetMoonDAOTeam() public {
        vm.prank(user1);
        missionCreator.setMoonDAOTeam(address(moonDAOTeam));
    }

    function testSetMissionTable() public {
        vm.prank(user1);
        missionCreator.setMissionTable(address(missionTable));
    }

}

