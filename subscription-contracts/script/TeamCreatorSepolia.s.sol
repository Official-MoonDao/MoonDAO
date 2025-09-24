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


contract TeamCreatorSepoliaScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address authorizedSignerAddress = vm.envAddress("AUTHORIZED_SIGNER_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        address TEAM_ADDRESS = 0x21d2C4bEBd1AEb830277F8548Ae30F505551f961;
        address TEAM_TABLE_ADDRESS = 0x6227dBa1e0AbBf6bdc5855327D2293012b91cfeB;
        address WHITELIST_ADDRESS = 0xBB22b6bfb410e62BC103CA6cAcc342bEe42117aA;
        
        address HATS_ADDRESS = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;
        address HATS_MODULE_FACTORY_ADDRESS = 0x0a3f85fa597B6a967271286aA0724811acDF5CD9;
        address HATS_PASSTHROUGH_ADDRESS = 0x050079a8fbFCE76818C62481BA015b89567D2d35;
        address GNOSIS_SINGLETON_ADDRESS = 0x3E5c63644E683549055b9Be8653de26E0B4CD36E;
        address GNOSIS_SAFE_PROXY_FACTORY_ADDRESS = 0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2;
         
        IHats hats = IHats(HATS_ADDRESS);
        uint256 moonDaoTeamAdminHatId = 0x0000018200020000000000000000000000000000000000000000000000000000;

        address[] memory authorizedSigners = new address[](1);
        authorizedSigners[0] = address(authorizedSignerAddress);

        MoonDAOTeamCreator creator = new MoonDAOTeamCreator(HATS_ADDRESS, HATS_MODULE_FACTORY_ADDRESS, HATS_PASSTHROUGH_ADDRESS, TEAM_ADDRESS, GNOSIS_SINGLETON_ADDRESS, GNOSIS_SAFE_PROXY_FACTORY_ADDRESS, TEAM_TABLE_ADDRESS, WHITELIST_ADDRESS, authorizedSigners);

        creator.setOpenAccess(true);
        creator.setMoonDaoTeamAdminHatId(moonDaoTeamAdminHatId);

        vm.stopBroadcast();
    }
}
