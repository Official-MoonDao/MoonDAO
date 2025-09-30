// SPDX-License-Identifier: MIT

/*
1. Run script
2. Transfer hats controller hat to creator via hatsprotocol.xyz
3. Change controller hat eligibility to creator via etherscan
*/


pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {MoonDAOTeamTable} from "../src/tables/TeamTableV2.sol";
// import "../src/ERC5643.sol";
import {MoonDAOTeamCreator} from "../src/MoonDAOTeamCreator.sol";
import {IHats} from "@hats/Interfaces/IHats.sol";
import {MoonDAOTeam} from "../src/ERC5643.sol";
import {Whitelist} from "../src/Whitelist.sol";



contract MyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        address deployerAddress = vm.addr(deployerPrivateKey);

        address TREASURY = 0x0724d0eb7b6d32AEDE6F9e492a5B1436b537262b;

        Whitelist whitelist = new Whitelist();

        Whitelist discountList = new Whitelist();

        IHats hats = IHats(0x3bc1A0Ad72417f2d411118085256fC53CBdDd137);

        uint256 moonDaoTeamAdminHatId = 0x0000018200020000000000000000000000000000000000000000000000000000;

        MoonDAOTeam team = new MoonDAOTeam("MoonDaoTeam", "MDE", TREASURY, 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137, address(discountList));

        team.setDiscount(1000); //testing

        MoonDAOTeamTable teamTable  = new MoonDAOTeamTable("TEAMTABLE");

        teamTable.setMoonDaoTeam(address(team));

        address[] memory authorizedSigners = new address[](0);
        MoonDAOTeamCreator creator = new MoonDAOTeamCreator(0x3bc1A0Ad72417f2d411118085256fC53CBdDd137, 0x0a3f85fa597B6a967271286aA0724811acDF5CD9, 0x050079a8fbFCE76818C62481BA015b89567D2d35, address(team), 0x3E5c63644E683549055b9Be8653de26E0B4CD36E, 0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2, address(teamTable), address(whitelist), authorizedSigners);

        creator.setOpenAccess(true);

        creator.setMoonDaoTeamAdminHatId(moonDaoTeamAdminHatId);
        team.setMoonDaoCreator(address(creator));
        teamTable.setTeamCreatorAddress(address(creator));

        string[] memory uriParts = new string[](6);
        uriParts[0] = "twitter";
        uriParts[1] = "communications";
        uriParts[2] = "website";
        uriParts[3] = "badges";
        uriParts[4] = "view";
        uriParts[5] = "formId";

        string memory uriTemplate = teamTable.generateURITemplate(uriParts);
		team.setURITemplate(uriTemplate);

        vm.stopBroadcast();
    }
}
