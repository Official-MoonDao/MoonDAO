// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {MoonDaoTeamTableland} from "../src/tables/MoonDaoTeamTableland.sol";
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

        address TREASURY = 0xAF26a002d716508b7e375f1f620338442F5470c0;

        Whitelist whitelist = new Whitelist();

        Whitelist discountList = new Whitelist();

        IHats hats = IHats(0x3bc1A0Ad72417f2d411118085256fC53CBdDd137);

        uint256 topHatId = 11350137546870419353554813351635264513601237801889581014544619914919936;

        // uint256 topHatId = hats.mintTopHat(deployerAddress, "", "");

        uint256 moonDaoTeamAdminHatId = hats.createHat(topHatId, "ipfs://QmTp6pUATgqg5YoZ66CDEV1UUjhPVyn2t5KFvXvoobRpuV", 1, TREASURY, TREASURY, true, "");

        MoonDAOTeam team = new MoonDAOTeam("MoonDaoTeam", "MDE", TREASURY, 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137, address(discountList));

        // team.setDiscount(1000); //testing

        MoonDaoTeamTableland teamTable  = new MoonDaoTeamTableland("TEAMTABLE");

        teamTable.setMoonDaoTeam(address(team));

        address[] memory authorizedSigners = new address[](0);
        MoonDAOTeamCreator creator = new MoonDAOTeamCreator(0x3bc1A0Ad72417f2d411118085256fC53CBdDd137, 0x0a3f85fa597B6a967271286aA0724811acDF5CD9, 0x050079a8fbFCE76818C62481BA015b89567D2d35, address(team), 0x3E5c63644E683549055b9Be8653de26E0B4CD36E, 0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2, address(teamTable), address(whitelist), authorizedSigners);

        // creator.setOpenAccess(true);

        creator.setMoonDaoTeamAdminHatId(moonDaoTeamAdminHatId);
        team.setMoonDaoCreator(address(creator));

        hats.mintHat(moonDaoTeamAdminHatId, address(creator));
        hats.changeHatEligibility(moonDaoTeamAdminHatId, address(creator));

        string memory uriTemplate = string.concat("SELECT+json_object%28%27id%27%2C+id%2C+%27name%27%2C+name%2C+%27description%27%2C+description%2C+%27image%27%2C+image%2C+%27attributes%27%2C+json_array%28json_object%28%27trait_type%27%2C+%27twitter%27%2C+%27value%27%2C+twitter%29%2C+json_object%28%27trait_type%27%2C+%27communications%27%2C+%27value%27%2C+communications%29%2C+json_object%28%27trait_type%27%2C+%27website%27%2C+%27value%27%2C+website%29%2C+json_object%28%27trait_type%27%2C+%27view%27%2C+%27value%27%2C+view%29%2C+json_object%28%27trait_type%27%2C+%27formId%27%2C+%27value%27%2C+formId%29%29%29+FROM+",teamTable.getTableName(),"+WHERE+id%3D");
		team.setURITemplate(uriTemplate);

        vm.stopBroadcast();
    }
}
