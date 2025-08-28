// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/ProjectTeam.sol";
import "../src/GnosisSafeProxyFactory.sol";
import {PassthroughModule} from "../src/PassthroughModule.sol";
import {IHats} from "@hats/Interfaces/IHats.sol";
import {Hats} from "@hats/Hats.sol";
import {HatsModuleFactory} from "@hats-module/HatsModuleFactory.sol";
import {deployModuleFactory} from "@hats-module/utils/DeployFunctions.sol";
import {ProjectTeamCreator} from "../src/ProjectTeamCreator.sol";
import {Project} from "../src/tables/Project.sol";
import {Hats} from "@hats/Hats.sol";

contract CreatorTest is Test {
    event SubscriptionUpdate(uint256 indexed tokenId, uint64 expiration);

    bytes32 internal constant SALT = bytes32(abi.encode(0x4a75)); // ~ H(4) A(a) T(7) S(5)

    address user1 = address(0x43b8880beE7fAb93F522AC8e121FF13fB77AF711);
    address user2 = address(0x2);
    address user3 = address(0x3);
    address user4 = address(0x69420);
    uint256 tokenId = 0;
    uint256 tokenId2 = 1;
    uint256 tokenId3= 2;
    string uri = "https://test.com";
    address TREASURY = user4;
    ProjectTeam team;
    Project table;
    ProjectTeamCreator creator;

    function setUp() public {
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.startPrank(user4);


        Hats hatsBase = new Hats("", "");
        IHats hats = IHats(address(hatsBase));
        HatsModuleFactory hatsFactory = deployModuleFactory(hats, SALT, "");
        PassthroughModule passthrough = new PassthroughModule("");
        address gnosisSafeAddress = address(0x0165878A594ca255338adfa4d48449f69242Eb8F);
        GnosisSafeProxyFactory proxyFactory = new GnosisSafeProxyFactory();

        table = new Project("PROJECT");

        team = new ProjectTeam("PROJECT", "MDPT", user4, address(hats));
        creator = new ProjectTeamCreator(address(hatsBase), address(hatsFactory), address(passthrough), address(team), gnosisSafeAddress, address(proxyFactory), address(table));

        table.setProjectTeam(address(team));
        uint256 topHatId = hats.mintTopHat(user4, "", "");
        uint256 projectTeamAdminHatId = hats.createHat(topHatId, "", 1, TREASURY, TREASURY, true, "");

        creator.setProjectTeamAdminHatId(projectTeamAdminHatId);
        team.setProjectTeamCreator(address(creator));

        hats.mintHat(projectTeamAdminHatId, address(creator));
        hats.changeHatEligibility(projectTeamAdminHatId, address(creator));
        vm.stopPrank();
    }

    function _createProjectTeam() internal  returns (uint256 tokenId, uint256 childHatId) {
        address[] memory members = new address[](2);
        members[0] = user2;
        members[1] = user3;
        (uint256 tokenId, uint256 childHatId) = creator.createProjectTeam(4,2024, 169, "IPFS_HASH", "LINK", "UPFRONT", user1, members, members);
    }

    function testMint() public {
        vm.prank(user4);
        _createProjectTeam();
    }

    function testMintBadUser() public {
        vm.prank(user1);
        vm.expectRevert();
        _createProjectTeam();
    }

    function testUpdateFinalReportIPFS() public {
        vm.prank(user4);
        (uint256 tokenId, uint256 childHatId) = _createProjectTeam();
        vm.prank(user1);
        table.updateFinalReportIPFS(tokenId, "IPFS_HASH");
    }

    function testUpdateFinalReportOwner() public {
        vm.prank(user4);
        (uint256 tokenId, uint256 childHatId) = _createProjectTeam();

        vm.prank(user4);
        table.updateFinalReportIPFS(tokenId, "IPFS_HASH");
    }

    function testUpdateFinalReportIPFSBadUser() public {
        vm.prank(user4);
        (uint256 tokenId, uint256 childHatId) = _createProjectTeam();

        vm.prank(user2);
        vm.expectRevert();
        table.updateFinalReportIPFS(tokenId, "IPFS_HASH");
    }


    function testUpdateActive() public {
        vm.prank(user4);
        (uint256 tokenId, uint256 childHatId) = _createProjectTeam();

        vm.prank(user4);
        table.updateTableCol(tokenId, "active", '0');
    }

    function testUpdateActiveBadUser() public {
        vm.prank(user4);
        (uint256 tokenId, uint256 childHatId) = _createProjectTeam();

        vm.prank(user1);
        vm.expectRevert();
        table.updateTableCol(tokenId, "active", '0');
    }
}
