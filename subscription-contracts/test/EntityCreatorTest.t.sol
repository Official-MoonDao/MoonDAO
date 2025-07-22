// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/ERC5643.sol";
import "../src/GnosisSafeProxyFactory.sol";
import {PassthroughModule} from "../src/PassthroughModule.sol";
import {IHats} from "@hats/Interfaces/IHats.sol";
import {Hats} from "@hats/Hats.sol";
import {HatsModuleFactory} from "@hats-module/HatsModuleFactory.sol";
import {deployModuleFactory} from "@hats-module/utils/DeployFunctions.sol";
import {MoonDAOTeamCreator} from "../src/MoonDAOTeamCreator.sol";
import {MoonDaoTeamTableland} from "../src/tables/MoonDaoTeamTableland.sol";
import {Whitelist} from "../src/Whitelist.sol";
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
    MoonDAOTeam team;
    MoonDaoTeamTableland table;
    MoonDAOTeamCreator creator;

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


        Whitelist whitelist = new Whitelist();
        Whitelist discountList = new Whitelist();

        table = new MoonDaoTeamTableland("team");

        team = new MoonDAOTeam("erc5369", "ERC5643", user4, address(hats), address(discountList));
        creator = new MoonDAOTeamCreator(address(hatsBase), address(hatsFactory), address(passthrough), address(team), gnosisSafeAddress, address(proxyFactory), address(table), address(whitelist));

        creator.setOpenAccess(true);

        table.setMoonDaoTeam(address(team));
        uint256 topHatId = hats.mintTopHat(user4, "", "");
        uint256 moonDaoTeamAdminHatId = hats.createHat(topHatId, "", 1, TREASURY, TREASURY, true, "");

        creator.setMoonDaoTeamAdminHatId(moonDaoTeamAdminHatId);
        team.setMoonDaoCreator(address(creator));

        hats.mintHat(moonDaoTeamAdminHatId, address(creator));
        vm.stopPrank();
    }

    function testMint() public {
        vm.prank(user1);
        creator.createMoonDAOTeam{value: 0.555 ether}(uri, uri, uri, "name", "bio", "image", "twitter", "communications", "website", "view", "formId", new address[](0));
    }




}
