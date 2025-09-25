// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {MoonDAOTeam} from "../src/ERC5643.sol";
import {IHats} from "@hats/Interfaces/IHats.sol";
import {HatsModuleFactory} from "@hats-module/HatsModuleFactory.sol";
import {PassthroughModule} from "../src/PassthroughModule.sol";
import {deployModuleInstance} from "@hats-module/utils/DeployFunctions.sol";

contract TeamAssignPassthroughScript is Script {
    
    address constant HATS_ADDRESS = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;
    address constant HATS_MODULE_FACTORY_ADDRESS = 0x0a3f85fa597B6a967271286aA0724811acDF5CD9;
    address constant CORRECT_HATS_PASSTHROUGH_ADDRESS = 0x050079a8fbFCE76818C62481BA015b89567D2d35;
    address constant TEAM_ADDRESS = 0xAB2C354eC32880C143e87418f80ACc06334Ff55F;
    
    IHats public hats;
    HatsModuleFactory public hatsModuleFactory;
    MoonDAOTeam public moonDAOTeam;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        hats = IHats(HATS_ADDRESS);
        hatsModuleFactory = HatsModuleFactory(HATS_MODULE_FACTORY_ADDRESS);
        moonDAOTeam = MoonDAOTeam(TEAM_ADDRESS);
        
        // Array of token IDs that need fixing
        uint256[] memory tokenIds = getTokenIdsToFix();
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            fixPassthroughModule(tokenIds[i]);
        }
        
        vm.stopBroadcast();
    }
    
    function fixPassthroughModule(uint256 tokenId) internal {
        console.log("Fixing passthrough module for token ID:", tokenId);
        
        // Get the current hat IDs for this team - split into separate calls
        uint256 teamManagerHat = _getTeamManagerHat(tokenId);
        uint256 teamMemberHat = _getTeamMemberHat(tokenId);
        
        console.log("Team Manager Hat:", teamManagerHat);
        console.log("Team Member Hat:", teamMemberHat);
        
        // Deploy new passthrough module - separated into its own function
        address newModuleAddress = _deployPassthroughModule(teamMemberHat, teamManagerHat);
        
        // Update hat eligibility and toggle - separated function calls
        _updateHatModule(teamMemberHat, newModuleAddress);
        
        console.log("Token ID:", tokenId);
        console.log("New passthrough module:", newModuleAddress);
        console.log("--------------------------------");
    }
    
    function _getTeamManagerHat(uint256 tokenId) private view returns (uint256) {
        uint256 hat = moonDAOTeam.teamManagerHat(tokenId);
        require(hat != 0, "Invalid manager hat");
        return hat;
    }
    
    function _getTeamMemberHat(uint256 tokenId) private view returns (uint256) {
        uint256 hat = moonDAOTeam.teamMemberHat(tokenId);
        require(hat != 0, "Invalid member hat");
        return hat;
    }
    
    function _deployPassthroughModule(uint256 memberHat, uint256 managerHat) private returns (address) {
        PassthroughModule memberPassthroughModule = PassthroughModule(deployModuleInstance(hatsModuleFactory, CORRECT_HATS_PASSTHROUGH_ADDRESS, memberHat, abi.encodePacked(managerHat), "", 0));
        return address(memberPassthroughModule);
    }
    
    function _updateHatModule(uint256 memberHat, address moduleAddress) private {
        hats.changeHatEligibility(memberHat, moduleAddress);
        hats.changeHatToggle(memberHat, moduleAddress);
    }
    
    function getTokenIdsToFix() internal pure returns (uint256[] memory) {
        // Replace this array with the actual token IDs that need fixing
        uint256[] memory tokenIds = new uint256[](5);
        
        tokenIds[0] = 15;
        tokenIds[1] = 16; 
        tokenIds[2] = 17;
        tokenIds[3] = 18;
        tokenIds[4] = 19;
        
        return tokenIds;
    }
}
