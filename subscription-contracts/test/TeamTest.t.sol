// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/ERC5643.sol";
import "../src/GnosisSafeProxyFactory.sol";
import {TeamRowController} from "../src/tables/TeamRowController.sol";
import {MoonDAOTeamCreator} from "../src/MoonDAOTeamCreator.sol";
import {PassthroughModule} from "../src/PassthroughModule.sol";
import {IHats} from "@hats/Interfaces/IHats.sol";
import {Hats} from "@hats/Hats.sol";
import {HatsModuleFactory} from "@hats-module/HatsModuleFactory.sol";
import {deployModuleFactory} from "@hats-module/utils/DeployFunctions.sol";
import {Whitelist} from "../src/Whitelist.sol";
import {MoonDAOTeamTable} from "../src/tables/TeamTableV2.sol";
contract ERC5643Test is Test {
    event SubscriptionUpdate(uint256 indexed tokenId, uint64 expiration);

    bytes32 internal constant SALT = bytes32(abi.encode(0x4a75)); // ~ H(4) A(a) T(7) S(5)

    address user1 = address(0x43b8880beE7fAb93F522AC8e121FF13fB77AF711);
    address user2 = address(0x2);
    address user3 = address(0x3);
    address user4 = address(0xd1916F254866E4e70abA86F0dD668DD5942E032a);
    uint256 tokenId = 0;
    uint256 tokenId2 = 1;
    uint256 tokenId3= 2;
    string uri = "https://test.com";
    address TREASURY = user4;
    MoonDAOTeamCreator creator;
    MoonDAOTeamTable table;
    MoonDAOTeam team;

    function setUp() public {
      vm.deal(user1, 10 ether);
      vm.deal(user2, 10 ether);
      vm.deal(user4, 10 ether);

      vm.startPrank(user4);

      Hats hatsBase = new Hats("", "");
      IHats hats = IHats(address(hatsBase));
      HatsModuleFactory hatsFactory = deployModuleFactory(hats, SALT, "");
      PassthroughModule passthrough = new PassthroughModule("");
      address gnosisSafeAddress = address(0x0165878A594ca255338adfa4d48449f69242Eb8F);
      GnosisSafeProxyFactory proxyFactory = new GnosisSafeProxyFactory();

      Whitelist whitelist = new Whitelist();

      Whitelist discountList = new Whitelist();
      table = new MoonDAOTeamTable("MoonDAOTeamTable");

      team = new MoonDAOTeam("erc5369", "ERC5643", TREASURY, address(hatsBase), address(discountList));
      creator = new MoonDAOTeamCreator(address(hatsBase), address(hatsFactory), address(passthrough), address(team), gnosisSafeAddress, address(proxyFactory), address(table), address(whitelist));

      creator.setOpenAccess(true);

      table.setMoonDaoTeam(address(team));
      table.setTeamCreatorAddress(address(creator));

      uint256 topHatId = hats.mintTopHat(user4, "", "");
      uint256 moonDaoTeamAdminHatId = hats.createHat(topHatId, "", 1, TREASURY, TREASURY, true, "");

      creator.setMoonDaoTeamAdminHatId(moonDaoTeamAdminHatId);
      team.setMoonDaoCreator(address(creator));

      hats.mintHat(moonDaoTeamAdminHatId, address(creator));

      vm.stopPrank();
    }

    function testMint() public {
      vm.prank(user1);
      creator.createMoonDAOTeam{value: 0.555 ether}("", "", "", "name", "bio", "image", "twitter", "communications", "website", "view", "formId", new address[](0));
    }

    function testUpdateTable() public {
      vm.startPrank(user1);
      (uint256 topHatId, uint256 hatId) = creator.createMoonDAOTeam{value: 0.555 ether}("", "", "", "name", "bio", "image", "twitter", "communications", "website", "view", "formId", new address[](0));
      bool isAdmin = team.isManager(0, user1);
      assertTrue(isAdmin);

      string[] memory columns = new string[](8);
      columns[0] = "name";
      columns[1] = "bio";
      columns[2] = "image";
      columns[3] = "twitter";
      columns[4] = "communications";
      columns[5] = "website";
      columns[6] = "view";
      columns[7] = "formId";

      string[] memory values = new string[](8);
      values[0] = "Test Team";
      values[1] = "Test Bio";
      values[2] = "Test Image";
      values[3] = "Test Twitter";
      values[4] = "Test Communications";
      values[5] = "Test Website";
      values[6] = "Test View";
      values[7] = "Test FormId";

      table.updateTableDynamic(0, columns, values);
      vm.stopPrank();

      vm.prank(user2);
      vm.expectRevert();
      table.updateTableDynamic(0, columns, values);

      vm.prank(user4);
      vm.expectRevert();
      bool isAdmin2 = team.isManager(0, user4);
      assertFalse(isAdmin2);
    }

    function testAddDeleteTableCol() public {
      vm.prank(user1);
      vm.expectRevert();
      table.addColumn("badges", "text");

      vm.startPrank(user4);
      table.addColumn("badges", "text");
      table.deleteColumn("badges");
      vm.stopPrank();
    }
}
