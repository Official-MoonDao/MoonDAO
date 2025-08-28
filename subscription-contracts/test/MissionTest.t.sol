// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Vesting} from "../src/Vesting.sol";
import {PoolDeployer} from "../src/PoolDeployer.sol";
import "@nana-core/interfaces/IJBRulesetApprovalHook.sol";
import {IWETH9} from "v4-periphery/src/interfaces/external/IWETH9.sol";
import {WETH} from "solmate/src/tokens/WETH.sol";
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
import "base/Config.sol";

contract MissionTest is Test, Config {

    address zero = address(0);
    address user1 = address(0x1);
    address teamAddress = address(0x2);
    address user2 = address(0x3);
    address TREASURY = address(0x4);
    IWETH9 public _WETH9 = IWETH9(address(new WETH()));

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
    address jbProjectsAddress;


    function setUp() public {
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);

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
        jbProjectsAddress = address(0x0b538A02610d7d3Cc91Ce2870F423e0a34D646AD);

        address jbTerminalStoreAddress = address(0x6F6740ddA12033ca9fBAA56693194E38cfD36827);
        address jbControllerAddress = address(0xb291844F213047Eb9e1621AE555B1Eae6700d553);
        address jbRulesetsAddress = address(0xDA86EeDb67C6C9FB3E58FE83Efa28674D7C89826);
        jbRulesets = IJBRulesets(jbRulesetsAddress);
        jbTerminalStore = IJBTerminalStore(jbTerminalStoreAddress);
        jbTokens = IJBTokens(0xA59e9F424901fB9DBD8913a9A32A081F9425bf36);
        jbController = IJBController(jbControllerAddress);

        missionCreator = new MissionCreator(jbControllerAddress, jbMultiTerminalAddress, jbProjectsAddress, jbTerminalStoreAddress, jbRulesetsAddress, address(moonDAOTeam), zero, TREASURY, FEE_HOOK_ADDRESSES[block.chainid], POSITION_MANAGERS[block.chainid]);
        missionTable = new MissionTable("TestMissionTable", address(missionCreator));
        missionCreator.setMissionTable(address(missionTable));

        vm.stopPrank();
    }

    function _createTeam() internal {
        vm.startPrank(user1);
        moonDAOTeamCreator.createMoonDAOTeam{value: 0.555 ether}("", "", "","name", "bio", "image", "view", "formId", new address[](0));
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

    function _createMission() internal returns (uint256) {
        vm.startPrank(user1);
        _createMission(10_000_000_000_000_000_000, true);
        vm.stopPrank();
    }

    function _createTeamAndMission() internal returns (uint256) {
        _createTeam();
        return _createMission();
    }

    function testCreate() public {
        uint256 missionId = _createTeamAndMission();
        vm.startPrank(user1);
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

    function testPayWithNonNative() public {
        uint256 missionId = _createTeamAndMission();
        vm.startPrank(user1);
        assertEq(missionCreator.stage(missionId), 1);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);

        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);
        uint256 balance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balance, 0);

        uint256 payAmount = 2 ether;
        _WETH9.deposit{value: payAmount}();
        _WETH9.approve(address(terminal), payAmount);
        vm.expectRevert(abi.encodeWithSignature(
            "JBMultiTerminal_TokenNotAccepted(address)",
            address(_WETH9)
        ));
        terminal.pay(
            projectId,
            address(_WETH9),
            payAmount,
            user1,
            0,
            "",
            new bytes(0)
        );
        vm.stopPrank();
    }


    function testInvalidCreator() public {
        _createTeam();
        vm.startPrank(user2);
        vm.expectRevert("must wear ManagerHat");
        uint256 missionId = _createMission(0, true);
        vm.stopPrank();
    }

    function testZeroGoal() public {
        _createTeam();
        vm.startPrank(user1);
        uint256 missionId = _createMission(0, true);
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

    function testReachesDeadline() public {
        uint256 missionId = _createTeamAndMission();
        vm.startPrank(user1);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);

        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);
        uint256 balance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balance, 0);

        skip(28 days);
        uint256 payAmount = 1_000_000_000_000_000_000;
        vm.expectRevert("Project funding deadline has passed and funding goal requirement has not been met.");
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

    function testHugePayment() public {
        uint256 missionId = _createTeamAndMission();
        vm.startPrank(user1);
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
        assertEq(missionCreator.stage(missionId), 2);
    }

    function testFundingTurnedOff() public {
        uint256 missionId = _createTeamAndMission();
        vm.startPrank(user1);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        address payhookAddress = missionCreator.missionIdToPayHook(missionId);
        LaunchPadPayHook payhook = LaunchPadPayHook(payhookAddress);


        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);
        vm.startPrank(teamAddress);
        payhook.setFundingTurnedOff(true);
        vm.stopPrank();
        assertFalse(payhook.hasMintPermissionFor(projectId, user1));

        uint256 payAmount = 1_000_000_000_000_000_000;
        vm.expectRevert("Funding has been turned off.");
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

    function testCashout() public {
        uint256 missionId = _createTeamAndMission();
        vm.startPrank(user1);
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

    function testCashoutMultipleContributors() public {
        uint256 missionId = _createTeamAndMission();
        vm.startPrank(user1);
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


    function testCashoutEarly() public {
        uint256 missionId = _createTeamAndMission();
        vm.startPrank(user1);
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

        vm.expectRevert("Project funding deadline has not passed. Refunds are disabled.");
        uint256 cashOutAmount = IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            user1,
            projectId,
            tokensAfter1,
            JBConstants.NATIVE_TOKEN,
            0,
            payable(user1),
            bytes(""));
    }

    function testCashoutCashoutAfterFundingGoalMet() public {
        uint256 missionId = _createTeamAndMission();
        vm.startPrank(user1);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);

        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);
        uint256 balance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balance, 0);

        uint256 payAmount = 10_000_000_000_000_000_000;
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
        assertEq(tokensAfter1, 10_000 * 1e18);

        skip(28 days);
        vm.expectRevert("Project has passed funding goal requirement. Refunds are disabled.");
        uint256 cashOutAmount = IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            user1,
            projectId,
            tokensAfter1,
            JBConstants.NATIVE_TOKEN,
            0,
            payable(user1),
            bytes(""));
    }

    function testVestTokens() public {
        uint256 missionId = _createTeamAndMission();
        vm.startPrank(user1);
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
        // Can only set token once
        vm.expectRevert("Token already set");
        moonDAOVesting.setToken(address(0));
        uint256 tokensTeamVesting = jbTokens.totalBalanceOf(address(teamVesting), projectId);
        uint256 tokensMoonDAOVesting = jbTokens.totalBalanceOf(address(moonDAOVesting), projectId);
        assertEq(tokensTeamVesting, 300 * 1e18);
        assertEq(tokensMoonDAOVesting, 175 * 1e18);
        assertEq(jbTokens.totalBalanceOf(TREASURY, projectId), 0);
        assertEq(jbTokens.totalBalanceOf(teamAddress, projectId), 0);

        skip(200 days);
        if (block.chainid != SEP){ // Sepolia has a no cliff for easier testing
          assertEq(teamVesting.vestedAmount(), 0);
          assertEq(moonDAOVesting.vestedAmount(), 0);
        }
        skip(165 days);
        assertEq(teamVesting.vestedAmount(), 300/4 * 1e18);
        assertEq(moonDAOVesting.vestedAmount(), 175/4 * 1e18);

        vm.startPrank(TREASURY);
        moonDAOVesting.withdraw();
        vm.stopPrank();
        assertEq(jbTokens.totalBalanceOf(TREASURY, projectId), 175/4 * 1e18);

        skip(365 days);
        assertEq(teamVesting.vestedAmount(), 300/2 * 1e18);
        assertEq(moonDAOVesting.vestedAmount(), 175/2 * 1e18);

        vm.startPrank(TREASURY);
        moonDAOVesting.withdraw();
        vm.stopPrank();
        assertEq(jbTokens.totalBalanceOf(TREASURY, projectId), 175/2 * 1e18);

        skip(730 days);
        assertEq(teamVesting.vestedAmount(), 300 * 1e18);
        assertEq(moonDAOVesting.vestedAmount(), 175 * 1e18);

        vm.startPrank(teamAddress);
        vm.expectRevert("Only beneficiary can withdraw");
        moonDAOVesting.withdraw();
        vm.stopPrank();

        vm.startPrank(TREASURY);
        moonDAOVesting.withdraw();
        assertEq(jbTokens.totalBalanceOf(TREASURY, projectId), 175 * 1e18);

        vm.expectRevert("No tokens available for withdrawal");
        moonDAOVesting.withdraw();
        vm.stopPrank();
    }

    function testPayouts() public {
        uint256 missionId = _createTeamAndMission();
        vm.startPrank(user1);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);

        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);
        uint256 balance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balance, 0);
        assertEq(missionCreator.stage(missionId), 1);

        // Pay enough to pass goal and skip to deadline
        uint256 payAmount = 10_000_000_000_000_000_000;
        terminal.pay{value: payAmount}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            user1,
            0,
            "",
            new bytes(0)
        );
        skip(28 days);

        uint256 terminalBalance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        uint256 treasuryBalanceBefore = address(TREASURY).balance;
        uint256 teamBalanceBefore = address(teamAddress).balance;
        assertEq(missionCreator.stage(missionId), 2);
        uint256 payoutAmount = IJBMultiTerminal(address(terminal)).sendPayoutsOf(
            projectId,
            JBConstants.NATIVE_TOKEN,
            terminalBalance,
            uint32(uint160(JBConstants.NATIVE_TOKEN)),
            0
        );
        assertEq(missionCreator.stage(missionId), 2);
        uint256 used = jbTerminalStore.usedPayoutLimitOf(
          address(terminal),
          projectId,
          JBConstants.NATIVE_TOKEN,
          2, // second cycle
          uint32(uint160(JBConstants.NATIVE_TOKEN))
        );
        assertEq(used, payoutAmount);

        PoolDeployer poolDeployer = PoolDeployer(payable(missionCreator.missionIdToPoolDeployer(missionId)));
        vm.expectRevert("Token already set");
        poolDeployer.setToken(address(0));
        poolDeployer.setHookAddress(missionCreator.feeHookAddress());

        // JB splits have 7 decimals of precision, so check up to 6 decimals
        assertApproxEqRel(address(poolDeployer).balance, terminalBalance * 5/ 100, 0.0000001e18);
        assertApproxEqRel(address(TREASURY).balance - treasuryBalanceBefore, terminalBalance * 25/ 1000, 0.0000001e18);
        assertApproxEqRel(teamAddress.balance - teamBalanceBefore, terminalBalance *90 / 100, 0.0000001e18);
        vm.stopPrank();

        vm.startPrank(user2);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user2));
        poolDeployer.setHookAddress(address(0));
        vm.stopPrank();
    }

    function testAMM() public {
        uint256 missionId = _createTeamAndMission();
        vm.startPrank(user1);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);

        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);
        uint256 balance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balance, 0);

        // Pay enough to pass goal and skip to deadline
        uint256 payAmount = 10_000_000_000_000_000_000;
        terminal.pay{value: payAmount}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            user1,
            0,
            "",
            new bytes(0)
        );
        skip(28 days);
        uint256 terminalBalance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        jbController.sendReservedTokensToSplitsOf(projectId);
        uint256 payoutAmount = IJBMultiTerminal(address(terminal)).sendPayoutsOf(
            projectId,
            JBConstants.NATIVE_TOKEN,
            terminalBalance,
            uint32(uint160(JBConstants.NATIVE_TOKEN)),
            0
        );

        PoolDeployer poolDeployer = PoolDeployer(payable(missionCreator.missionIdToPoolDeployer(missionId)));
        uint256 tokensPoolDeployer = jbTokens.totalBalanceOf(address(poolDeployer), projectId);
        assertEq(tokensPoolDeployer, 500 * 1e18);
        // JB splits have 7 decimals of precision, so check up to 6 decimals
        assertApproxEqRel(address(poolDeployer).balance, terminalBalance * 5 / 100, 0.0000001e18);
        poolDeployer.createAndAddLiquidity();
    }

    function testRefundPeriod() public {
        uint256 missionId = _createTeamAndMission();
        vm.startPrank(user1);
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

        skip(28 days);
        // Refund period has passed
        vm.prank(user2);
        vm.expectRevert("Refund period has passed. Refunds are disabled.");
        IJBMultiTerminal(address(terminal)).cashOutTokensOf(
            user2,
            projectId,
            user2TokensAfter,
            JBConstants.NATIVE_TOKEN,
            0,
            payable(user2),
            bytes(""));


        uint256 treasuryBalanceBefore = address(TREASURY).balance;
        uint256 teamBalanceBefore = address(teamAddress).balance;
        uint256 terminalBalance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        uint256 payoutAmount = IJBMultiTerminal(address(terminal)).sendPayoutsOf(
            projectId,
            JBConstants.NATIVE_TOKEN,
            terminalBalance,
            uint32(uint160(JBConstants.NATIVE_TOKEN)),
            0
        );

        assertApproxEqRel(address(TREASURY).balance - treasuryBalanceBefore, terminalBalance * 25/ 1000, 0.0000001e18);
        assertApproxEqRel(teamAddress.balance - teamBalanceBefore, terminalBalance *90 / 100, 0.0000001e18);

    }

    function testNoTokenCashout() public {
        _createTeam();
        vm.startPrank(user1);
        uint256 missionId = _createMission(10_000_000_000_000_000_000, false);
        assertEq(missionCreator.stage(missionId), 1);
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

    function testNoTokenPayouts() public {
        _createTeam();
        vm.startPrank(user1);
        uint256 missionId = _createMission(10_000_000_000_000_000_000, false);
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);

        IJBTerminal terminal = jbDirectory.primaryTerminalOf(projectId, JBConstants.NATIVE_TOKEN);
        uint256 balance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        assertEq(balance, 0);

        // Pay enough to pass goal and skip to deadline
        uint256 payAmount = 10_000_000_000_000_000_000;
        terminal.pay{value: payAmount}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
            user1,
            0,
            "",
            new bytes(0)
        );
        skip(28 days);

        uint256 terminalBalance = jbTerminalStore.balanceOf(address(terminal), projectId, JBConstants.NATIVE_TOKEN);
        uint256 treasuryBalanceBefore = address(TREASURY).balance;
        uint256 teamBalanceBefore = address(teamAddress).balance;
        uint256 payoutAmount = IJBMultiTerminal(address(terminal)).sendPayoutsOf(
            projectId,
            JBConstants.NATIVE_TOKEN,
            terminalBalance,
            uint32(uint160(JBConstants.NATIVE_TOKEN)),
            0
        );

        PoolDeployer poolDeployer = PoolDeployer(payable(missionCreator.missionIdToPoolDeployer(missionId)));
        // JB splits have 7 decimals of precision, so check up to 6 decimals
        assertApproxEqRel(address(poolDeployer).balance, terminalBalance * 5/ 100, 0.0000001e18);
        assertApproxEqRel(address(TREASURY).balance - treasuryBalanceBefore, terminalBalance * 25/ 1000, 0.0000001e18);
        assertApproxEqRel(teamAddress.balance - teamBalanceBefore, terminalBalance *90 / 100, 0.0000001e18);
    }

    function testSetJBController() public {
        vm.prank(user1);
        missionCreator.setJBController(address(0));
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user2));
        missionCreator.setJBController(address(0));
    }

    function testSetJBMultiTerminal() public {
        vm.prank(user1);
        missionCreator.setJBMultiTerminal(address(0));
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user2));
        missionCreator.setJBMultiTerminal(address(0));
    }

    function testSetMoonDAOTreasury() public {
        vm.prank(user1);
        missionCreator.setMoonDAOTreasury(address(0));
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user2));
        missionCreator.setMoonDAOTreasury(address(0));
    }

    function testSetMoonDAOTeam() public {
        vm.prank(user1);
        missionCreator.setMoonDAOTeam(address(moonDAOTeam));
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user2));
        missionCreator.setMoonDAOTeam(address(moonDAOTeam));
    }

    function testSetMissionTable() public {
        vm.prank(user1);
        missionCreator.setMissionTable(address(missionTable));
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user2));
        missionCreator.setMissionTable(address(missionTable));
    }

    function testSetJBProjects() public {
        vm.prank(user1);
        missionCreator.setJBProjects(address(jbProjectsAddress));
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user2));
        missionCreator.setJBProjects(address(jbProjectsAddress));
    }

    function testSetFeeHookAddress() public {
        vm.prank(user1);
        missionCreator.setFeeHookAddress(address(0));
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user2));
        missionCreator.setFeeHookAddress(address(0));
    }
}

