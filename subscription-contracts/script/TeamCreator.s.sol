// SPDX-License-Identifier: MIT

/*
Deploying a new Team Creator:
1. Run the script
2. (optional) Deploy a new whitelist contract and teamCreatorContract.setWhitelist()
3. teamContract.setMoonDaoCreatorAddress();
4. teamTableContract.setTeamCreator();
4. Transfer the controller hat to the new creator via hatsprotocol.xyz
5. Change hat eligibility to the new creator via etherscan
6. Set the new URI template for the team contract if function params have changed and you have updated the team table (teamTableContract.generateURITemplate)
*/

pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {MoonDAOTeamCreator} from "../src/MoonDAOTeamCreator.sol";
import {IHats} from "@hats/Interfaces/IHats.sol";


contract MyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        address deployerAddress = vm.addr(deployerPrivateKey);

        address TREASURY = 0xAF26a002d716508b7e375f1f620338442F5470c0;
        address TEAM_ADDRESS = 0xAB2C354eC32880C143e87418f80ACc06334Ff55F;
        address TEAM_TABLE_ADDRESS = 0x1C9B9847bE88eb3F7154bA6A4560Cb8D52A13dD9;
        address WHITELIST_ADDRESS = 0x203ca831edec28b7657A022b8aFe5d28b6BE6Eda;

        IHats hats = IHats(0x3bc1A0Ad72417f2d411118085256fC53CBdDd137);
        uint256 moonDaoTeamAdminHatId = 0x0000002a00010000000000000000000000000000000000000000000000000000;

        MoonDAOTeamCreator creator = new MoonDAOTeamCreator(0x3bc1A0Ad72417f2d411118085256fC53CBdDd137, 0x0a3f85fa597B6a967271286aA0724811acDF5CD9, 0x97b5621E4CD8F403ab5b6036181982752DE3aC44, TEAM_ADDRESS, 0x3E5c63644E683549055b9Be8653de26E0B4CD36E, 0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2, TEAM_TABLE_ADDRESS, WHITELIST_ADDRESS);

        // creator.setOpenAccess(true);
        creator.setMoonDaoTeamAdminHatId(moonDaoTeamAdminHatId);

        vm.stopBroadcast();
    }
}
